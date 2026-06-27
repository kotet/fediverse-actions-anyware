import {
  type AuthState,
  type HomeAccountConfig,
  type HomeAccountStoreState,
  removeAccount,
  setActiveAccount,
} from "../core";
import { getMessage } from "../i18n";

const AUTH_STATE_KEYS: Record<AuthState, Parameters<typeof getMessage>[0]> = {
  authenticated: "authStateAuthenticated",
  unauthenticated: "authStateUnauthenticated",
  error: "authStateError",
};

/**
 * Re-renders the account list based on the store state.
 *
 * @param state The current store state.
 */
export function renderAccountList(state: HomeAccountStoreState): void {
  const list = document.getElementById("account-list") as HTMLUListElement;
  const emptyMessage = document.getElementById(
    "empty-message",
  ) as HTMLParagraphElement;

  list.replaceChildren();
  emptyMessage.classList.toggle("hidden", state.accounts.length > 0);

  for (const account of state.accounts) {
    list.append(
      createAccountItem(account, account.id === state.activeAccountId),
    );
  }
}

/**
 * Creates a list item element for a single account.
 *
 * @param account The account configuration.
 * @param isActive Whether this is the active account.
 */
function createAccountItem(
  account: HomeAccountConfig,
  isActive: boolean,
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
    void setActiveAccount(account.id).then(renderAccountList);
  });

  const body = document.createElement("div");
  body.className = "account-body";

  const label = document.createElement("div");
  label.className = "account-label";
  label.textContent = account.label;

  const meta = document.createElement("div");
  meta.className = "account-meta";
  const authStateLabel = account.mockAuthState
    ? getMessage(AUTH_STATE_KEYS[account.mockAuthState])
    : "-";
  meta.textContent = `${account.software} / ${authStateLabel}`;

  body.append(label, meta);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "account-remove";
  removeButton.textContent = "✕";
  removeButton.title = getMessage("accountRemoveTitle");
  removeButton.addEventListener("click", () => {
    void removeAccount(account.id).then(renderAccountList);
  });

  item.append(radio, body, removeButton);
  return item;
}
