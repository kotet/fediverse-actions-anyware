import type {
  ActionButtonSpec,
  ButtonRenderMode,
  ButtonRenderModeKind,
  ExtractedPost,
} from "../core";

/**
 * Mock implementation of the button render mode.
 *
 * Does not modify the DOM; logs what should be displayed to the console instead.
 * Does not create actual button elements. The mode is configurable and reflected in the log.
 */
export class MockButtonRenderMode implements ButtonRenderMode {
  readonly mode: ButtonRenderModeKind;

  constructor(mode: ButtonRenderModeKind = "replace-underline") {
    this.mode = mode;
  }

  render(post: ExtractedPost, _actions: readonly ActionButtonSpec[]): void {
    console.log(
      `[mock] render buttons: postUrl=${post.postUrl}, mode=${this.mode}`,
    );
  }

  clear(post: ExtractedPost): void {
    console.log(`[mock] clear buttons: postUrl=${post.postUrl}, mode=${this.mode}`);
  }
}
