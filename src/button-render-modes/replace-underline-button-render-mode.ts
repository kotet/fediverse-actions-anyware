import type {
  ActionButtonReplacer,
  ActionButtonSpec,
  ButtonRenderMode,
  ButtonRenderModeKind,
  ExtractedPost,
} from "../core";
import { getMessage } from "../i18n";

/** Class applied to every substituted button. Styled by `src/content/content.css`. */
const UNDERLINE_BUTTON_CLASS = "faa-button";

/**
 * Pointer events swallowed on a substituted button.
 *
 * The substitute carries no host listeners of its own, but the host page may have
 * delegated handlers on an ancestor — Mastodon opens the post detail when a status
 * is clicked — so propagation is stopped for the whole press sequence.
 */
const SWALLOWED_EVENT_TYPES: readonly string[] = ["mousedown", "mouseup", "click"];

/**
 * Button render mode that substitutes the host's action buttons and marks each one
 * with an accent underline.
 *
 * Without the underline a substituted button is indistinguishable from the host's
 * own, leaving the user unable to tell which action runs on the target instance and
 * which runs through their home account. The underline occupies a dimension the host
 * does not use, keeping color free for the action state it already conveys.
 *
 * All knowledge of how to substitute a button on a given client lives in the
 * {@link ActionButtonReplacer} this mode is constructed with, so this class contains
 * nothing specific to any site.
 */
export class ReplaceUnderlineButtonRenderMode implements ButtonRenderMode {
  readonly mode: ButtonRenderModeKind = "replace-underline";

  private readonly replacer: ActionButtonReplacer;

  constructor(replacer: ActionButtonReplacer) {
    this.replacer = replacer;
  }

  render(post: ExtractedPost, actions: readonly ActionButtonSpec[]): void {
    // Rebuild rather than skip: a button left over from an earlier render still
    // holds a click handler bound to the account that was active back then.
    this.replacer.restoreActionButtons(post);

    for (const action of actions) {
      // Every offered action has a host button standing for it, so a missing one
      // means this post does not carry that action at all and it is left out.
      const button = this.replacer.replaceActionButton(post, action.kind);
      if (button === null) continue;

      button.classList.add(UNDERLINE_BUTTON_CLASS);

      // The button is copied from a host one and inherits its label, which claims
      // the action happens on the target instance. Say where it actually runs, so
      // the change is conveyed to assistive technology too and not by the underline
      // alone.
      const description = getMessage("actionButtonHomeAccountTitle", action.label);
      button.title = description;
      button.setAttribute("aria-label", description);

      for (const type of SWALLOWED_EVENT_TYPES) {
        button.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (type === "click") {
            void action.onClick();
          }
        });
      }
    }
  }
}
