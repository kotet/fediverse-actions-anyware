import type { ButtonKind, ExtractedPost } from "../core";
import type { ActionButtonReplacer, PageAdapter } from "../core";

const ICON_CLASS_TO_BUTTON_KIND: ReadonlyMap<string, ButtonKind> = new Map([
  ["icon-reply", "reply"],
  ["icon-retweet", "boost"],
  ["icon-star", "favourite"],
  ["icon-bookmark", "bookmark"],
  ["icon-ellipsis-h", "more"],
]);

/**
 * Attribute marking an element this extension added to an action bar.
 * The value is the action kind the element serves.
 *
 * Written by {@link MastodonPageAdapter.replaceActionButton}, read back by
 * {@link collectButtonsByKind} and {@link MastodonPageAdapter.restoreActionButtons},
 * so both sides of the contract stay inside this module.
 */
const EXTENSION_BUTTON_ATTRIBUTE = "data-faa-action";

/** Attributes Mastodon uses to disable a button, which a usable copy must not carry. */
const DISABLING_ATTRIBUTES: readonly string[] = ["disabled", "aria-disabled"];

/** Class Mastodon adds to a button it has disabled, e.g. bookmark for anonymous viewers. */
const DISABLED_CLASS = "disabled";

/**
 * Class Mastodon puts on an icon button whose action is in effect on the post.
 *
 * Its own client sets it the same way for every action (`icon-button.tsx` builds
 * the class list from an `active` prop), and the color that follows comes from the
 * stylesheet alone — `.icon-button.star-icon.active`, `.bookmark-icon.active`, and
 * `.icon-button.active` for the rest — so a substituted button carrying the class
 * takes on the client's own look with nothing else to copy.
 */
const ACTIVE_CLASS = "active";

function collectButtonsByKind(
  actionBar: HTMLElement,
): Readonly<Partial<Record<ButtonKind, HTMLElement>>> {
  const result: Partial<Record<ButtonKind, HTMLElement>> = {};
  for (const button of actionBar.querySelectorAll("button")) {
    if (!(button instanceof HTMLElement)) continue;
    // Buttons this extension added keep the host's markup, so they would otherwise
    // be picked up here and shadow the real host button.
    if (button.hasAttribute(EXTENSION_BUTTON_ATTRIBUTE)) continue;
    const svg = button.querySelector("svg");
    if (!svg) continue;
    for (const cls of svg.classList) {
      const kind = ICON_CLASS_TO_BUTTON_KIND.get(cls);
      if (kind !== undefined) {
        result[kind] = button;
        break;
      }
    }
  }
  return result;
}

/** Strips the host's disabled state and identity from a copied button. */
function neutralizeHostButton(button: HTMLElement): void {
  // Mastodon disables buttons that an anonymous viewer cannot use, via both the
  // attribute and a class. The copy acts through the home account instead, so
  // every trace of that disabled state has to go.
  for (const attribute of DISABLING_ATTRIBUTES) {
    button.removeAttribute(attribute);
  }
  button.classList.remove(DISABLED_CLASS);
  if (button instanceof HTMLButtonElement) {
    button.disabled = false;
  }
  // A visitor logged in to the target instance sees its own buttons marked for the
  // actions it has taken there. The copy acts as the home account, whose state is
  // a different one, so it starts out unmarked either way.
  button.classList.remove(ACTIVE_CLASS);
  // The copy would otherwise duplicate the host's id.
  button.removeAttribute("id");
}

/**
 * Page adapter for the standard Mastodon web client.
 *
 * Targets individual status pages (e.g. `/@user/123`) which display
 * one detailed status followed by thread replies.
 *
 * Supports action button replacement: Mastodon's buttons carry their icon as
 * inline SVG, so cloning one reproduces the host's appearance exactly. A host
 * element being substituted is only hidden, never removed, because Mastodon's
 * React tree keeps a reference to it and would fail on a later re-render.
 */
export class MastodonPageAdapter implements PageAdapter, ActionButtonReplacer {
  isSupportedPage(): boolean {
    return document.querySelector("#mastodon") !== null;
  }

  extractPosts(): ExtractedPost[] {
    const posts: ExtractedPost[] = [];

    // Main (detailed) status — appears once at the top of a status page.
    const detailedWrapper = document.querySelector(".detailed-status__wrapper");
    if (detailedWrapper instanceof HTMLElement) {
      const urlLink = detailedWrapper.querySelector(".detailed-status__datetime");
      const actionBar = detailedWrapper.querySelector(".detailed-status__action-bar");
      if (urlLink instanceof HTMLAnchorElement && actionBar instanceof HTMLElement) {
        posts.push({
          postUrl: urlLink.href,
          existingButtons: collectButtonsByKind(actionBar),
          insertionTarget: actionBar,
        });
      }
    }

    // Thread / reply statuses listed below the detailed status.
    for (const wrapper of document.querySelectorAll(".status__wrapper")) {
      const urlLink = wrapper.querySelector(".status__relative-time");
      const actionBar = wrapper.querySelector(".status__action-bar");
      if (urlLink instanceof HTMLAnchorElement && actionBar instanceof HTMLElement) {
        posts.push({
          postUrl: urlLink.href,
          existingButtons: collectButtonsByKind(actionBar),
          insertionTarget: actionBar,
        });
      }
    }

    return posts;
  }

  replaceActionButton(post: ExtractedPost, kind: ButtonKind): HTMLElement | null {
    const original = post.existingButtons[kind];
    if (original === undefined) return null;
    const parent = original.parentElement;
    if (parent === null) return null;

    // A deep clone reproduces the icon, sizing and hover styling. Event listeners
    // are not cloned, so the host's behavior is dropped without any extra work.
    const substitute = original.cloneNode(true);
    if (!(substitute instanceof HTMLElement)) return null;

    neutralizeHostButton(substitute);
    substitute.setAttribute(EXTENSION_BUTTON_ATTRIBUTE, kind);

    // Inserting before the original keeps the host button last in DOM order, which
    // guards against scans that resolve duplicates by taking the last match.
    parent.insertBefore(substitute, original);
    original.style.display = "none";
    return substitute;
  }

  setActionButtonActive(button: HTMLElement, active: boolean): void {
    button.classList.toggle(ACTIVE_CLASS, active);
  }

  restoreActionButtons(post: ExtractedPost): void {
    for (const substitute of post.insertionTarget.querySelectorAll(
      `[${EXTENSION_BUTTON_ATTRIBUTE}]`,
    )) {
      substitute.remove();
    }
    for (const original of Object.values(post.existingButtons)) {
      original.style.display = "";
    }
  }
}
