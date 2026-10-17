import { createHomeAccount, removeHomeAccount } from "../app";
import {
  type AuthState,
  type HomeAccountConfig,
  type HomeAccountStoreState,
  loadAccountStore,
  onAccountStoreChanged,
  setActiveAccount,
} from "../core";
import { getMessage, type MessageKey } from "../i18n";

const AUTH_STATE_KEYS: Record<AuthState, MessageKey> = {
  authenticated: "authStateAuthenticated",
  unauthenticated: "authStateUnauthenticated",
  error: "authStateError",
};

/**
 * Reads an account's authentication state, reporting an unreachable one as an error.
 *
 * For a Mastodon account the answer comes from the background script, and a
 * failure to reach it is not something the account itself can report. Showing the
 * account as being in error is what that leaves the user: it is the state the
 * extension is in as far as this account is concerned.
 */
async function readAuthState(account: HomeAccountConfig): Promise<AuthState> {
  try {
    return await createHomeAccount(account).getAuthState();
  } catch {
    return "error";
  }
}

/**
 * Whether logging in and out is something this account can do at all.
 *
 * A mock account has no instance to authenticate against; its state comes from
 * the configuration it was registered with, and v1 offers no way to edit that, so
 * controls for it would do nothing the user could see.
 */
function supportsAuthentication(account: HomeAccountConfig): boolean {
  return account.software !== "mock";
}

/**
 * Whether the extension may still act on the pages it is loaded into.
 *
 * MV3 lets the user withdraw host access after installation. The content script
 * is what would otherwise report that, and it is the very thing that stops
 * running, so the popup is the only place the user can be told.
 *
 * Doubt is resolved in favour of access being granted. The origins this extension
 * holds come from its `content_scripts` match pattern rather than from a declared
 * `host_permissions`, so a check that misread them would put a warning in front of
 * every user for no reason.
 */
async function hasHostAccess(): Promise<boolean> {
  try {
    const granted = await browser.permissions.getAll();
    return (granted.origins ?? []).length > 0;
  } catch {
    return true;
  }
}

function noticeElement(): HTMLParagraphElement {
  return document.getElementById("account-list-notice") as HTMLParagraphElement;
}

/** Puts a message above the add button, or clears it when `message` is empty. */
function showNotice(message: string, isError: boolean): void {
  const notice = noticeElement();
  notice.textContent = message;
  notice.classList.toggle("error", isError);
  notice.classList.toggle("hidden", message === "");
}

/**
 * Draws the list and keeps it in step with the account store from then on.
 *
 * A Mastodon account is only registered once the OAuth tab reaches the callback
 * page, which is another realm and finishes while the popup is already open, so
 * the store is watched rather than re-read only after the popup's own actions.
 * Those actions rely on the same subscription: refreshing after them as well
 * would render every change twice.
 *
 * @returns The first render.
 */
export async function setupAccountListView(): Promise<void> {
  onAccountStoreChanged(() => {
    void refreshAccountList();
  });
  await refreshAccountList();
}

/**
 * Counts the renders started so far, so that a render can tell whether a later
 * one has started while it was waiting.
 *
 * Each render waits on storage and on the background before touching the list,
 * so two changes in quick succession, such as switching the active account twice,
 * could otherwise finish out of order and leave the earlier state on screen.
 */
let renderGeneration = 0;

/**
 * Reloads the store and re-renders the account list.
 *
 * Changes to the store are picked up by the subscription in setupAccountListView;
 * this is called directly only for what the store does not record.
 */
export async function refreshAccountList(): Promise<void> {
  renderGeneration += 1;
  const generation = renderGeneration;

  // Everything is collected before anything is drawn, so the list is not shown
  // with the states missing and then filled in under the user's eyes.
  const state = await loadAccountStore();
  const authStates = await Promise.all(state.accounts.map(readAuthState));
  const hostAccess = await hasHostAccess();
  // A render started later has read a newer store and has the final say.
  if (generation !== renderGeneration) {
    return;
  }
  drawAccountList(state, authStates, hostAccess);
}

/**
 * Replaces the account list and the notice above it.
 *
 * @param state The store state to show.
 * @param authStates The authentication state of each account in `state.accounts`, in the same order.
 * @param hostAccess Whether the extension may still act on the pages it is loaded into.
 */
function drawAccountList(
  state: HomeAccountStoreState,
  authStates: readonly AuthState[],
  hostAccess: boolean,
): void {
  const list = document.getElementById("account-list") as HTMLUListElement;
  const emptyMessage = document.getElementById(
    "empty-message",
  ) as HTMLParagraphElement;

  list.replaceChildren();
  emptyMessage.classList.toggle("hidden", state.accounts.length > 0);

  state.accounts.forEach((account, index) => {
    list.append(
      createAccountItem(
        account,
        account.id === state.activeAccountId,
        authStates[index] ?? "error",
      ),
    );
  });

  // The extension shows no buttons at all while the active account cannot act
  // (spec 3.2), and a page that simply looks untouched gives the user nothing to
  // go on. This is the only place that can say why.
  const activeIndex = state.accounts.findIndex(
    (account) => account.id === state.activeAccountId,
  );
  const activeAuthState = activeIndex === -1 ? null : authStates[activeIndex];
  const isBlocked = activeAuthState !== null && activeAuthState !== "authenticated";

  // Host access comes first: without it nothing runs on the page at all, which
  // would make the account's own state beside the point.
  if (!hostAccess) {
    showNotice(getMessage("popupNoHostAccess"), true);
  } else {
    showNotice(isBlocked ? getMessage("popupActiveAccountNotUsable") : "", false);
  }
}

/**
 * Creates a list item element for a single account.
 *
 * @param account The account configuration.
 * @param isActive Whether this is the active account.
 * @param authState The account's authentication state.
 */
function createAccountItem(
  account: HomeAccountConfig,
  isActive: boolean,
  authState: AuthState,
): HTMLLIElement {
  const item = document.createElement("li");
  item.className = isActive ? "account-item active" : "account-item";

  const radio = document.createElement("input");
  radio.type = "radio";
  radio.name = "active-account";
  radio.className = "account-radio";
  radio.checked = isActive;
  radio.title = getMessage("accountActivateTitle");
  radio.addEventListener("change", () => {
    void setActiveAccount(account.id);
  });

  const body = document.createElement("div");
  body.className = "account-body";

  const label = document.createElement("div");
  label.className = "account-label";
  label.textContent = account.label;

  const meta = document.createElement("div");
  meta.className = "account-meta";
  meta.textContent = `${account.software} / ${getMessage(AUTH_STATE_KEYS[authState])}`;

  body.append(label, meta);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "account-remove";
  removeButton.textContent = "✕";
  removeButton.title = getMessage("accountRemoveTitle");
  removeButton.addEventListener("click", () => {
    void removeHomeAccount(account);
  });

  item.append(radio, body, removeButton);

  const authActions = createAuthActions(account, authState);
  if (authActions !== null) item.append(authActions);

  return item;
}

/**
 * Creates the row of login and logout controls for one account.
 *
 * An authenticated account is offered a way to authenticate again as well as to
 * log out: the state is read from whether a token is stored, never from asking
 * the instance, so a token the instance has since rejected still reads as
 * authenticated and re-authenticating is the only way out of it.
 *
 * @returns The row, or `null` for an account that has nothing to log in to.
 */
function createAuthActions(
  account: HomeAccountConfig,
  authState: AuthState,
): HTMLElement | null {
  if (!supportsAuthentication(account)) return null;

  const actions = document.createElement("div");
  actions.className = "account-auth-actions";

  if (authState === "authenticated") {
    actions.append(
      createAuthenticateButton(account, "accountReauthenticateButton"),
      createLogoutButton(account),
    );
  } else {
    actions.append(createAuthenticateButton(account, "accountLoginButton"));
  }
  return actions;
}

function createAuthenticateButton(
  account: HomeAccountConfig,
  labelKey: MessageKey,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "account-auth-button";
  button.textContent = getMessage(labelKey);
  button.addEventListener("click", () => {
    button.disabled = true;
    showNotice("", false);
    void createHomeAccount(account)
      .authenticate()
      .catch((error: unknown) => {
        // Only the sentence is localized: what comes back names the operation and
        // the HTTP status, which has no translation to show in its place.
        const reason =
          error instanceof Error ? error.message : getMessage("unknownError");
        showNotice(getMessage("mastodonOAuthError", reason), true);
      })
      .finally(() => {
        button.disabled = false;
      });
  });
  return button;
}

function createLogoutButton(account: HomeAccountConfig): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "account-auth-button";
  button.textContent = getMessage("accountLogoutButton");
  button.addEventListener("click", () => {
    // Logging out changes no account configuration, so nothing else would prompt
    // a re-render; the list is refreshed here.
    void createHomeAccount(account).logout().then(refreshAccountList);
  });
  return button;
}
