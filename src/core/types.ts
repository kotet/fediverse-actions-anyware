/**
 * Defines domain types shared across the three abstractions
 * (home account, page adapter, and button render mode).
 */

/** Authentication state of the home account. */
export type AuthState =
  /** Authenticated. Actions can be executed. */
  | "authenticated"
  /** Unauthenticated. Login is required; action buttons are not shown. */
  | "unauthenticated"
  /** Authentication error. Re-authentication flow is required. */
  | "error";

/**
 * Kinds of actions that can be executed on a post.
 *
 * `reply` is carried out by resolving the post onto the active account's home
 * instance and opening it there, rather than by an API call, because writing a
 * reply needs a composer this extension does not provide. Landing on the post
 * under the user's own account is also what "open it on my instance" means, so
 * no separate action is offered for that.
 */
export type PostActionKind = "favourite" | "boost" | "bookmark" | "reply";

/**
 * Kinds of actions that are carried out by an API call to the home instance.
 * {@link PostActionKind} excluding the one that opens the post instead.
 */
export type ApiActionKind = Exclude<PostActionKind, "reply">;

/**
 * Which way an action is being carried out on a post.
 *
 * A separate axis from {@link PostActionKind} rather than a kind of its own: the
 * user is offered one button per action, and which way that button acts follows
 * from the state it is showing.
 */
export type ActionDirection =
  /** Put the action into effect on the post. */
  | "apply"
  /** Take it back off the post. */
  | "undo";

/** Button render mode. Switched by user settings. */
export type ButtonRenderModeKind =
  /**
   * Replaces existing action buttons with the extension's buttons, each marked
   * with an accent underline so the changed behavior is visible.
   */
  | "replace-underline"
  /** Appends the extension's buttons alongside existing action buttons. */
  | "append"
  /** Displays as a popup menu. */
  | "popup";

/**
 * Kinds of existing action buttons on the page that can be identified by the page adapter.
 * Maps to the action labels used by the target client's UI.
 */
export type ButtonKind = "reply" | "boost" | "favourite" | "bookmark" | "more";

/**
 * Information about a single post extracted by the page adapter.
 *
 * The button render mode uses this information to render action buttons.
 */
export interface ExtractedPost {
  /** Canonical URL of the target post (URL on the target instance). */
  readonly postUrl: string;
  /** Existing action button elements keyed by their action kind. Empty object if there are no original buttons. */
  readonly existingButtons: Readonly<Partial<Record<ButtonKind, HTMLElement>>>;
  /** The element to insert the extension's buttons into. */
  readonly insertionTarget: HTMLElement;
}

/** Result of an action execution. */
export type ActionResult =
  | {
      readonly ok: true;
      /**
       * Whether the action is in effect on the post now, or `null` for an action
       * that leaves no state on it (replying).
       *
       * Taken from what the home instance reports rather than assumed from the
       * direction that was asked for, so that a post already acted on outside this
       * extension ends up displayed as it really is.
       */
      readonly active: boolean | null;
    }
  | { readonly ok: false; readonly error: ActionError };

/**
 * Result of resolving a post onto the home instance.
 *
 * Distinct from {@link ActionResult} because success carries the resolved URL.
 * Kept to plain JSON values, since a resolution runs in the background script and
 * its result crosses a `runtime.sendMessage` boundary.
 */
export type ResolveResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly error: ActionError };

/** Error kinds that can occur during action execution or post resolution. Corresponds to the error display in spec 3.8. */
export type ActionErrorKind =
  /** Active account is unauthenticated. */
  | "unauthenticated"
  /** Cannot connect to the home instance. */
  | "network"
  /** Post cannot be retrieved. */
  | "not-found"
  /** Insufficient permissions. */
  | "forbidden"
  /**
   * Too many requests in the allotted window.
   *
   * Kept apart from `failed` because it is the one failure that passes on its
   * own: the user only has to wait, which no other kind's remedy resembles.
   */
  | "rate-limited"
  /** Other operation failures. */
  | "failed";

/** Error representing a failure in action execution or post resolution. */
export interface ActionError {
  readonly kind: ActionErrorKind;
  readonly message: string;
}
