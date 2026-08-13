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
 * `open-home` represents "open the post on the active account's home instance"
 * and differs from others in that it involves post resolution (URL resolution)
 * rather than an API call.
 */
export type PostActionKind =
  | "favourite"
  | "boost"
  | "bookmark"
  | "reply"
  | "open-home";

/**
 * Kinds of actions that involve an API call to the home instance,
 * such as favourite, boost, bookmark, and reply.
 * {@link PostActionKind} excluding `open-home`.
 */
export type ApiActionKind = Exclude<PostActionKind, "open-home">;

/** Button render mode. Switched by user settings. */
export type ButtonRenderModeKind =
  /** Replaces existing action buttons with the extension's buttons. */
  | "replace"
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

/** Result of an API action execution. */
export type ActionResult =
  | { readonly ok: true }
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
  /** Other operation failures. */
  | "failed";

/** Error representing a failure in action execution or post resolution. */
export interface ActionError {
  readonly kind: ActionErrorKind;
  readonly message: string;
}
