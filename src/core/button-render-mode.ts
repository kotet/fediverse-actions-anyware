import type {
  ActionDirection,
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
   * Whether the post is known to be in this action's state already, so the button
   * is rendered active and its first click undoes the action.
   *
   * Only ever true for a post acted on earlier in this tab: the state a post is in
   * before that is not fetched, since learning it would cost one request per post
   * on screen.
   */
  readonly initiallyActive: boolean;
  /**
   * Handler called once the button has been pressed but before it is clicked.
   *
   * Lets the work a click will need start while the button is still held down.
   * Nothing is reported back, and a press that never becomes a click simply
   * discards it.
   */
  readonly onPressStart: () => void;
  /**
   * Handler called when the button is clicked.
   *
   * Reports how the action ended instead of swallowing it, because showing the
   * outcome is the render mode's responsibility (spec 3.8).
   *
   * @param direction Which way to act, decided by the render mode from the state
   *   the button is currently showing.
   */
  readonly onClick: (direction: ActionDirection) => Promise<ActionResult>;
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
