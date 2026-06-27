import type { ActionResult, ApiActionKind, AuthState } from "./types";

/**
 * Home account abstraction.
 *
 * Responsibility: authentication, API action execution, and post resolution for the home instance.
 * An implementation is defined per home instance software (Mastodon, and potentially Misskey, etc.).
 *
 * One instance corresponds to one home account. Managing multiple accounts and
 * selecting the active account is the responsibility of the layer holding this abstraction.
 */
export interface HomeAccount {
  /** Returns the current authentication state. */
  getAuthState(): Promise<AuthState>;

  /**
   * Initiates the OAuth flow to log in.
   * Also used for re-authentication when already authenticated or after an auth error.
   */
  authenticate(): Promise<void>;

  /** Logs out and resets the authentication state to unauthenticated. */
  logout(): Promise<void>;

  /**
   * Executes an API action (favourite, boost, bookmark, reply) on the target post
   * using the active account.
   *
   * @param action The kind of action to execute.
   * @param postUrl URL of the target post (URL on the target instance).
   */
  performAction(action: ApiActionKind, postUrl: string): Promise<ActionResult>;

  /**
   * Resolves a remote post URL to a URL that can be opened on the home instance
   * (for the "open in home instance" action).
   *
   * If the post does not exist on the home instance, fetches it before resolving.
   *
   * @param postUrl URL of the target post (URL on the target instance).
   * @returns URL to open the post on the home instance.
   */
  resolvePost(postUrl: string): Promise<string>;
}
