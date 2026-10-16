import {
  PostActionStateMemory,
  buildActionButtons,
  createHomeAccount,
} from "../app";
import { ReplaceUnderlineButtonRenderMode } from "../button-render-modes";
import {
  getActiveAccount,
  loadAccountStore,
  onAccountStoreChanged,
  supportsActionButtonReplacement,
  type AuthState,
  type HomeAccount,
} from "../core";
import { MastodonPageAdapter } from "../page-adapters";

/**
 * Content script orchestration.
 *
 * Wires up the design flow of "skip pages whose own client is signed in → get
 * active account → check auth → extract posts via page adapter → render via
 * button render mode".
 *
 * The adapter is fixed to Mastodon and the render mode to "replace-underline" for
 * now. In the future, the adapter will be selected by page URL and the render mode
 * by settings.
 */

/**
 * How long the page's DOM has to stay still before rendering.
 *
 * A status page arrives as an app shell with no post markup at all; the client
 * fetches the status over the network and only then builds the action bar. That
 * always lands after `document_idle`, so rendering once at startup finds nothing.
 * Mutations then come in bursts (thread replies, media, relative timestamps), and
 * waiting for the burst to end collapses them into a single render.
 */
const RERENDER_DEBOUNCE_MS = 200;

const pageAdapter = new MastodonPageAdapter();

/**
 * Outlives the buttons, which are rebuilt on every render, so that an action the
 * user has taken goes on being shown after the host page redraws the post.
 */
const postActionStates = new PostActionStateMemory();

/** Which account the states above were produced by, so a switch can clear them. */
let accountOfPostActionStates: string | null = null;

let rerenderTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Logs `message` only when it differs from the previously logged one.
 *
 * The observer re-runs the flow on every burst of DOM changes, so logging
 * unconditionally would flood the host page's console with identical lines.
 */
let lastLoggedStatus: string | null = null;
function logStatusChange(message: string): void {
  if (message === lastLoggedStatus) return;
  lastLoggedStatus = message;
  console.log(message);
}

const pageObserver = new MutationObserver(() => {
  if (rerenderTimer !== undefined) clearTimeout(rerenderTimer);
  rerenderTimer = setTimeout(() => {
    void renderActionButtons();
  }, RERENDER_DEBOUNCE_MS);
});

function observePage(): void {
  pageObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Counts the renders started so far, so that a render can tell whether a later
 * one has started while it was waiting.
 *
 * Renders are started by DOM changes and by store changes alike, and each one
 * waits on storage and on the background before touching the page. Without this,
 * a render that started before the only account was removed could finish after
 * the one that followed the removal, putting back buttons bound to that account.
 */
let renderGeneration = 0;

/** The account buttons act through, and the id of its configuration. */
interface DisplayableAccount {
  readonly id: string;
  readonly account: HomeAccount;
}

/**
 * Finds the account buttons may act through, or `null` when no button may be
 * shown on the page at all (spec 3.2).
 *
 * Every reason not to show buttons ends in `null` here, so that the caller has a
 * single place to take back buttons an earlier render left behind. That includes
 * an account that cannot be built or asked for its state: its buttons could only
 * fail, so the error is logged and the buttons go.
 */
async function findDisplayableAccount(): Promise<DisplayableAccount | null> {
  const store = await loadAccountStore();
  const activeConfig = getActiveAccount(store);
  if (activeConfig === null) {
    logStatusChange("[content] No active home account. Not displaying buttons.");
    return null;
  }

  let account: HomeAccount;
  let authState: AuthState;
  try {
    account = createHomeAccount(activeConfig);
    authState = await account.getAuthState();
  } catch (error) {
    console.error("[content] Failed to check the active account.", error);
    return null;
  }
  if (authState !== "authenticated") {
    logStatusChange(
      `[content] Active account is not authenticated (${authState}). Not displaying buttons.`,
    );
    return null;
  }
  return { id: activeConfig.id, account };
}

async function renderActionButtons(): Promise<void> {
  // Checked before touching storage so unrelated pages cost one querySelector.
  if (!pageAdapter.isSupportedPage()) {
    return;
  }

  // The replace-underline mode works by substituting the host's own action
  // buttons, which only adapters that know how to do it safely on their target
  // client can offer.
  if (!supportsActionButtonReplacement(pageAdapter)) {
    logStatusChange(
      "[content] This site does not support the replace-underline mode. Not displaying buttons.",
    );
    return;
  }

  // On a page its own client is signed in to, that client's action buttons
  // already act as the signed-in account. Substituting them would replace
  // working buttons with ones that take the long way round — resolving the post
  // through the search API before acting on it — and would act as the active
  // account even when that is a different one. Nothing is gained, so the
  // extension stays out of the way entirely. Asked before the store is read
  // because it costs one lookup in the page and no storage access. Unlike the
  // reasons in findDisplayableAccount, this one is fixed for the life of the
  // document, so no earlier render can have left buttons to take back.
  if (pageAdapter.hasSignedInSession()) {
    logStatusChange(
      "[content] This page's own client is signed in. Not displaying buttons.",
    );
    return;
  }

  renderGeneration += 1;
  const generation = renderGeneration;
  const displayable = await findDisplayableAccount();
  // A render started later has read a newer store and has the final say.
  if (generation !== renderGeneration) {
    return;
  }

  // What one account has favourited is not what the next one has, so the states
  // shown on the buttons do not survive a switch of the active account.
  if (displayable !== null && displayable.id !== accountOfPostActionStates) {
    postActionStates.forgetAll();
    accountOfPostActionStates = displayable.id;
  }

  const renderMode = new ReplaceUnderlineButtonRenderMode(pageAdapter);
  const posts = pageAdapter.extractPosts();
  logStatusChange(`[content] Extracted ${posts.length} post(s).`);

  // Rendering mutates the page, which would otherwise wake the observer and
  // schedule another render indefinitely. Disconnecting also discards the records
  // already queued for these mutations, so reconnecting starts from a clean slate.
  pageObserver.disconnect();
  try {
    for (const post of posts) {
      if (displayable === null) {
        renderMode.clear(post);
      } else {
        renderMode.render(
          post,
          buildActionButtons(displayable.account, post, postActionStates),
        );
      }
    }
  } finally {
    observePage();
  }
}

console.log("Fediverse Actions Anyware content script loaded.");
void renderActionButtons();

// Keeps up with the client-side rendering that produces the posts in the first
// place, and with SPA navigation, infinite scroll, and React re-renders that drop
// the substituted buttons afterwards.
if (pageAdapter.isSupportedPage()) {
  observePage();
}

// Re-renders when account store changes (e.g., adding or switching accounts in the popup).
onAccountStoreChanged(() => {
  void renderActionButtons();
});
