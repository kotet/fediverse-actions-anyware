import type {
  ActionButtonReplacer,
  ActionButtonSpec,
  ActionError,
  ActionErrorKind,
  ButtonRenderMode,
  ButtonRenderModeKind,
  ExtractedPost,
} from "../core";
import { getMessage, type MessageKey } from "../i18n";

/** Class applied to every substituted button. Styled by `src/content/content.css`. */
const UNDERLINE_BUTTON_CLASS = "faa-button";

/**
 * Attribute telling how far along the click on a substituted button is.
 * Absent while there is nothing to report.
 */
const PROGRESS_ATTRIBUTE = "data-faa-state";

/** Attribute marking a button whose action is in effect on the post. */
const ACTIVE_ATTRIBUTE = "data-faa-active";

/**
 * Pointer events swallowed on a substituted button.
 *
 * The substitute carries no host listeners of its own, but the host page may have
 * delegated handlers on an ancestor — Mastodon opens the post detail when a status
 * is clicked — so propagation is stopped for the whole press sequence.
 */
const SWALLOWED_EVENT_TYPES: readonly string[] = ["mousedown", "mouseup", "click"];

/**
 * How long a failure stays on the button before it returns to the look it had
 * before the click.
 *
 * The wording is only readable by hovering or focusing the button, so this has to
 * outlast noticing the underline and going back to it.
 */
const FAILURE_DISPLAY_MS = 8000;

/**
 * How long the button says what just happened before it switches to stating the
 * state it ended up in.
 */
const SUCCESS_MESSAGE_MS = 4000;

/**
 * The wording for each failure.
 *
 * The underline shows only that something failed, so which of the kinds it was —
 * and therefore whether the remedy is re-authenticating, waiting, or nothing the
 * user can do — is said here or nowhere.
 */
const ERROR_MESSAGE_KEYS: Readonly<Record<ActionErrorKind, MessageKey>> = {
  unauthenticated: "actionErrorUnauthenticated",
  network: "actionErrorNetwork",
  "not-found": "actionErrorNotFound",
  forbidden: "actionErrorForbidden",
  "rate-limited": "actionErrorRateLimited",
  failed: "actionErrorFailed",
};

/**
 * Shows one substituted button's action state on the button itself (spec 3.8).
 *
 * The look is carried by two attributes that `content.css` selects on, rather than
 * by inline styles: {@link PROGRESS_ATTRIBUTE} for how a click is going and
 * {@link ACTIVE_ATTRIBUTE} for whether the action is in effect on the post. They
 * are separate because they are independent — a button that is already active can
 * be running again.
 *
 * Everything the underline cannot distinguish goes into `title` / `aria-label`:
 * which of the failures happened, and whether the post has just entered the active
 * state or was already in it. Both look the same on purpose, since a favourite
 * that just succeeded and a post that is favourited are the same fact.
 *
 * Nothing here adds or removes nodes, so the content script's `MutationObserver` —
 * which watches `childList` alone — is not woken by showing a result.
 */
class ActionButtonStateDisplay {
  private readonly button: HTMLElement;
  private readonly action: ActionButtonSpec;
  /** Wording for a button that is neither running, failed, nor active. */
  private readonly restingDescription: string;
  private running = false;
  private active = false;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(button: HTMLElement, action: ActionButtonSpec) {
    this.button = button;
    this.action = action;
    // The button is copied from a host one and inherits its label, which claims
    // the action happens on the target instance. Say where it actually runs, so
    // the change is conveyed to assistive technology too and not by the underline
    // alone.
    this.restingDescription = getMessage(
      "actionButtonHomeAccountTitle",
      action.label,
    );
    this.describe(this.restingDescription);
  }

  /** Runs the action, showing it in flight and then reporting how it ended. */
  async handleClick(): Promise<void> {
    // A second click while the first is in flight would send the same request
    // twice. The host's own handler is swallowed either way, so ignoring the click
    // does not hand the press back to the page.
    if (this.running) return;
    this.running = true;
    this.clearSettleTimer();
    this.button.setAttribute(PROGRESS_ATTRIBUTE, "running");
    this.describe(getMessage("actionStateRunning", this.action.label));

    const result = await this.action.onClick();

    this.running = false;
    if (result.ok) {
      this.showSuccess();
    } else {
      this.showFailure(result.error);
    }
  }

  private showSuccess(): void {
    if (!this.action.activatesOnSuccess) {
      this.settle();
      return;
    }
    this.active = true;
    this.button.setAttribute(ACTIVE_ATTRIBUTE, "");
    this.button.removeAttribute(PROGRESS_ATTRIBUTE);
    this.describe(getMessage("actionStateSucceeded", this.action.label));
    // Only the wording is temporary. The active look is the post's state now, so
    // it stays.
    this.settleAfter(SUCCESS_MESSAGE_MS);
  }

  private showFailure(error: ActionError): void {
    // The instance's own message is developer-facing English that cannot be
    // localized, so it goes to the console and the button states the kind.
    console.error(
      `[content] Action failed: ${this.action.kind} (${error.kind}) ${error.message}`,
    );
    this.button.setAttribute(PROGRESS_ATTRIBUTE, "failed");
    this.describe(getMessage(ERROR_MESSAGE_KEYS[error.kind], this.action.label));
    this.settleAfter(FAILURE_DISPLAY_MS);
  }

  /** Returns the button to the look and wording of the state it is now in. */
  private settle(): void {
    this.button.removeAttribute(PROGRESS_ATTRIBUTE);
    this.describe(
      this.active
        ? getMessage("actionStateActive", this.action.label)
        : this.restingDescription,
    );
  }

  private settleAfter(delayMs: number): void {
    this.clearSettleTimer();
    this.settleTimer = setTimeout(() => {
      this.settleTimer = undefined;
      this.settle();
    }, delayMs);
  }

  private clearSettleTimer(): void {
    if (this.settleTimer === undefined) return;
    clearTimeout(this.settleTimer);
    this.settleTimer = undefined;
  }

  /**
   * Puts `description` where both a pointer and assistive technology can find it.
   *
   * A substituted button shows an icon and no text of its own, so these two
   * attributes are the only place any wording can go.
   */
  private describe(description: string): void {
    this.button.title = description;
    this.button.setAttribute("aria-label", description);
  }
}

/**
 * Button render mode that substitutes the host's action buttons and marks each one
 * with an accent underline.
 *
 * Without the underline a substituted button is indistinguishable from the host's
 * own, leaving the user unable to tell which action runs on the target instance and
 * which runs through their home account. The underline occupies a dimension the host
 * does not use, keeping color free for the action state it already conveys. It
 * doubles as the place where this mode reports how an action went, so a result
 * needs no element of its own.
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
      const stateDisplay = new ActionButtonStateDisplay(button, action);

      for (const type of SWALLOWED_EVENT_TYPES) {
        button.addEventListener(type, (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (type === "click") {
            void stateDisplay.handleClick();
          }
        });
      }
    }
  }
}
