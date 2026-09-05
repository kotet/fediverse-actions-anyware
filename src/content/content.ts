import {
  PostActionStateMemory,
  buildActionButtons,
  createHomeAccount,
} from "../app";
import { ReplaceUnderlineButtonRenderMode } from "../button-render-modes";
import {
  type HomeAccountConfig,
  getActiveAccount,
  loadAccountStore,
  onAccountStoreChanged,
  supportsActionButtonReplacement,
} from "../core";
import { MastodonPageAdapter } from "../page-adapters";

/**
 * Content script orchestration.
 *
 * Wires up the design flow of "skip pages of a logged-in home account → get
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

/**
 * Determines whether the current page is served by a home instance the user is
 * already logged in to.
 *
 * On such a page the client's own action buttons already act as that account, so
 * substituting them would replace working buttons with ones that take the long
 * way round — resolving the post through the search API before acting on it — and
 * would act as the active account even when that is a different one. Nothing is
 * gained, so the extension stays out of the way entirely.
 *
 * An account that is not logged in is ignored: with no session on that instance
 * the client's buttons cannot act either, so its pages are no different from any
 * other target instance's.
 */
async function isPageOfLoggedInHomeAccount(
  accounts: readonly HomeAccountConfig[],
): Promise<boolean> {
  for (const config of accounts) {
    const account = createHomeAccount(config);
    // Ownership is decided locally, so the auth state — which costs a round trip
    // to the background script — is only asked about accounts claiming the page.
    if (!account.ownsUrl(location.href)) continue;
    if ((await account.getAuthState()) === "authenticated") return true;
  }
  return false;
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

  const store = await loadAccountStore();

  // Decided over every registered account rather than the active one, since the
  // page belonging to any logged-in account is enough to make the client's own
  // buttons the better ones to leave in place.
  if (await isPageOfLoggedInHomeAccount(store.accounts)) {
    logStatusChange(
      "[content] This page belongs to a logged-in home account. Not displaying buttons.",
    );
    return;
  }

  const activeConfig = getActiveAccount(store);
  if (activeConfig === null) {
    logStatusChange("[content] No active home account. Not displaying buttons.");
    return;
  }

  const account = createHomeAccount(activeConfig);
  const authState = await account.getAuthState();
  if (authState !== "authenticated") {
    logStatusChange(
      `[content] Active account is not authenticated (${authState}). Not displaying buttons.`,
    );
    return;
  }

  // What one account has favourited is not what the next one has, so the states
  // shown on the buttons do not survive a switch of the active account.
  if (activeConfig.id !== accountOfPostActionStates) {
    postActionStates.forgetAll();
    accountOfPostActionStates = activeConfig.id;
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
      renderMode.render(
        post,
        buildActionButtons(account, post, postActionStates),
      );
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
