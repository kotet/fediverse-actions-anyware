import type {
  ActionDirection,
  ActionResult,
  ApiActionKind,
  AuthState,
} from "./types";

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
   * Determines whether `url` is served by this account's own home instance.
   *
   * Answered from the configured instance alone, without reaching the network,
   * so that a caller can ask it about every registered account cheaply.
   *
   * @param url Absolute URL to test. A string that is not a URL is not owned.
   */
  ownsUrl(url: string): boolean;

  /**
   * Initiates the OAuth flow to log in.
   * Also used for re-authentication when already authenticated or after an auth error.
   */
  authenticate(): Promise<void>;

  /** Logs out and resets the authentication state to unauthenticated. */
  logout(): Promise<void>;

  /**
   * Executes an API action (favourite, boost, bookmark) on the target post
   * using the active account.
   *
   * @param action The kind of action to execute.
   * @param direction Whether to put the action into effect or take it back off.
   * @param postUrl URL of the target post (URL on the target instance).
   */
  performAction(
    action: ApiActionKind,
    direction: ActionDirection,
    postUrl: string,
  ): Promise<ActionResult>;

  /**
   * Begins resolving the target post onto the home instance, so that an action
   * arriving shortly afterwards does not have to wait for that round trip.
   *
   * Optional to call and best-effort: a failure is not reported here, because the
   * action that follows makes the same request and reports it. Calling it more than
   * once for the same post does not resolve it more than once.
   *
   * @param postUrl URL of the target post (URL on the target instance).
   */
  startResolvingPost(postUrl: string): Promise<void>;

  /**
   * Resolves the target post onto the home instance and opens it there.
   *
   * If the post does not exist on the home instance, fetches it before opening.
   * Serves both "open in home instance" and "reply", which differ only in what the
   * user does once the post is open.
   *
   * Resolving and opening are one operation rather than two because the caller may
   * be a content script, which has no `tabs` API and would lose the click's
   * transient activation while awaiting the resolution.
   *
   * @param postUrl URL of the target post (URL on the target instance).
   */
  openPost(postUrl: string): Promise<ActionResult>;
}
