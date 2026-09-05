import type {
  ActionResult,
  ButtonRenderModeKind,
  ExtractedPost,
  PostActionKind,
} from "./types";

/**
 * Specification for a single action button rendered by the button render mode.
 *
 * Click behavior (API execution, post resolution and navigation) is encapsulated
 * in `onClick`, keeping the render mode responsible only for how to render.
 */
export interface ActionButtonSpec {
  /** The action kind. */
  readonly kind: PostActionKind;
  /** Label displayed on the button. */
  readonly label: string;
  /**
   * Whether succeeding leaves the post in this action's own state — favourited,
   * boosted, bookmarked — which the button keeps showing afterwards.
   *
   * Replying has no such state: it opens the post on the home instance and leaves
   * nothing behind on the target post, so its button returns to its resting look.
   */
  readonly activatesOnSuccess: boolean;
  /**
   * Handler called when the button is clicked.
   *
   * Reports how the action ended instead of swallowing it, because showing the
   * outcome is the render mode's responsibility (spec 3.8).
   */
  readonly onClick: () => Promise<ActionResult>;
}

/**
 * Button render mode abstraction.
 *
 * Responsibility: switching the method of rendering action buttons.
 * Displays action buttons in one of three ways — "replace-underline", "append", or "popup" —
 * based on the existing button elements and insertion target from the page adapter.
 * The implementation is switched based on user settings.
 *
 * Suppressing button display when the home account is unauthenticated is handled
 * by the caller layer checking auth state and not calling render at all.
 */
export interface ButtonRenderMode {
  /** The kind of this render mode. */
  readonly mode: ButtonRenderModeKind;

  /**
   * Renders action buttons for a single post.
   *
   * @param post The target post (includes existing button elements and insertion target).
   * @param actions List of action button specs to render.
   */
  render(post: ExtractedPost, actions: readonly ActionButtonSpec[]): void;
}
