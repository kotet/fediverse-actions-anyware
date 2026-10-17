import type { HomeAccountConfig, HomeAccountStoreState } from "./account-config";

/**
 * Store that persists home account configurations to browser.storage.local.
 *
 * Responsible for managing multiple accounts and active account selection (spec 3.1).
 * Handles saving and retrieving configurations, not the home account abstraction itself.
 */

const STORAGE_KEY = "homeAccountStore";

const EMPTY_STATE: HomeAccountStoreState = {
  accounts: [],
  activeAccountId: null,
};

/** Loads the current store state. Returns an empty state if nothing is saved. */
export async function loadAccountStore(): Promise<HomeAccountStoreState> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const state = stored[STORAGE_KEY] as HomeAccountStoreState | undefined;
  return state ?? EMPTY_STATE;
}

/** Saves the store state. */
async function saveAccountStore(state: HomeAccountStoreState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

/** Retrieves the active account configuration from state. Returns `null` if unselected or inconsistent. */
export function getActiveAccount(
  state: HomeAccountStoreState,
): HomeAccountConfig | null {
  if (state.activeAccountId === null) {
    return null;
  }
  return (
    state.accounts.find((account) => account.id === state.activeAccountId) ??
    null
  );
}

/**
 * Adds an account. The first account added is automatically made active.
 *
 * @returns The new state after addition.
 */
export async function addAccount(
  config: HomeAccountConfig,
): Promise<HomeAccountStoreState> {
  const state = await loadAccountStore();
  const next: HomeAccountStoreState = {
    accounts: [...state.accounts, config],
    activeAccountId: state.activeAccountId ?? config.id,
  };
  await saveAccountStore(next);
  return next;
}

/**
 * Replaces the configuration of an account that is already registered.
 *
 * Which account is active is not touched: the account is the same one, so a
 * change to what is known about it is no reason to act as somebody else.
 *
 * @returns The new state, unchanged if no account carries that ID.
 */
export async function updateAccount(
  config: HomeAccountConfig,
): Promise<HomeAccountStoreState> {
  const state = await loadAccountStore();
  if (!state.accounts.some((account) => account.id === config.id)) {
    return state;
  }
  const next: HomeAccountStoreState = {
    ...state,
    accounts: state.accounts.map((account) =>
      account.id === config.id ? config : account,
    ),
  };
  await saveAccountStore(next);
  return next;
}

/**
 * Removes an account. If the removed account was active, switches to the first remaining account.
 *
 * @returns The new state after removal.
 */
export async function removeAccount(
  id: string,
): Promise<HomeAccountStoreState> {
  const state = await loadAccountStore();
  const accounts = state.accounts.filter((account) => account.id !== id);
  const activeAccountId =
    state.activeAccountId === id
      ? (accounts[0]?.id ?? null)
      : state.activeAccountId;
  const next: HomeAccountStoreState = { accounts, activeAccountId };
  await saveAccountStore(next);
  return next;
}

/**
 * Switches the active account. If the ID does not exist, no change is made.
 *
 * @returns The new state after switching.
 */
export async function setActiveAccount(
  id: string,
): Promise<HomeAccountStoreState> {
  const state = await loadAccountStore();
  if (!state.accounts.some((account) => account.id === id)) {
    return state;
  }
  const next: HomeAccountStoreState = { ...state, activeAccountId: id };
  await saveAccountStore(next);
  return next;
}

/**
 * Subscribes to store state changes.
 *
 * @param listener Callback that receives the updated state.
 */
export function onAccountStoreChanged(
  listener: (state: HomeAccountStoreState) => void,
): void {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    const change = changes[STORAGE_KEY];
    if (change === undefined) {
      return;
    }
    listener((change.newValue as HomeAccountStoreState | undefined) ?? EMPTY_STATE);
  });
}
