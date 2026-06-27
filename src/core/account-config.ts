import type { AuthState } from "./types";

/**
 * Implementation type of the home account (software of the home instance).
 * This is the variation axis of the home account abstraction.
 */
export type HomeAccountSoftware =
  /** Mock implementation for debugging. */
  | "mock"
  /** Mastodon implementation (not yet implemented). */
  | "mastodon";

/**
 * Persisted configuration for a single home account.
 *
 * A plain object that can be saved directly to storage (JSON);
 * `HomeAccount` instances are created from this configuration each time.
 */
export interface HomeAccountConfig {
  /** ID that uniquely identifies the account. */
  readonly id: string;
  /** Implementation type. */
  readonly software: HomeAccountSoftware;
  /** Name displayed in the list. */
  readonly label: string;
  /** Initial auth state for mock implementation. Only meaningful when `software === "mock"`. */
  readonly mockAuthState?: AuthState;
}

/** Persisted state holding registered accounts and the active account selection. */
export interface HomeAccountStoreState {
  /** List of registered home account configurations. */
  readonly accounts: readonly HomeAccountConfig[];
  /** ID of the active account. `null` if none is selected. */
  readonly activeAccountId: string | null;
}
