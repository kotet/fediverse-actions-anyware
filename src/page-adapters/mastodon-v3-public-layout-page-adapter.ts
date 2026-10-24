import type { ButtonKind, ExtractedPost } from "../core";
import type { ActionButtonReplacer, PageAdapter } from "../core";
import {
  isExtensionButton,
  restoreHostButtons,
  substituteHostButton,
} from "./host-button-substitution";
import {
  hasInitialState,
  initialStateHasSignedInViewer,
} from "./mastodon-initial-state";

/**
 * Font Awesome classes on the icon of each action link, mapped to the action.
 *
 * A post that cannot be boosted keeps its boost link but shows a lock or an at
 * sign in place of the arrows (`statuses/_simple_status.html.haml`), so leaving
 * those icons out is what leaves such a post without a boost button.
 */
const ICON_CLASS_TO_BUTTON_KIND: ReadonlyMap<string, ButtonKind> = new Map([
  ["fa-reply", "reply"],
  // Shown instead of `fa-reply` on a post that is itself a reply.
  ["fa-reply-all", "reply"],
  ["fa-retweet", "boost"],
  ["fa-star", "favourite"],
]);

/**
 * Class of the root element of the layout Mastodon 3.x renders its public pages
 * in (`layouts/public.html.haml`).
 *
 * The same layout writes the boot payload into the head, so a page carrying both
 * is one Mastodon rendered in it rather than any site using the class name.
 */
const PUBLIC_LAYOUT_CLASS = "public-layout";

/**
 * Class on every action link Mastodon renders on the server, which its `public`
 * script takes over with a handler delegated from the document to open the
 * remote interaction dialog in a popup window.
 */
const MODAL_BUTTON_CLASS = "modal-button";

/** Where a post's own URL and its action links are found in one way of rendering it. */
interface PostLayout {
  /** Selects the element holding a single post. */
  readonly post: string;
  /** Selects, within the post, the link whose target is the post's URL. */
  readonly postLink: string;
  /** Selects, within the post, the element holding its action links. */
  readonly actionBar: string;
}

const POST_LAYOUTS: readonly PostLayout[] = [
  // The post a status page is about, rendered by the server
  // (`statuses/_detailed_status.html.haml`), and every post of the public and
  // hashtag timelines, rendered by the client in the same markup.
  {
    post: ".detailed-status",
    postLink: ".detailed-status__datetime",
    actionBar: ".detailed-status__meta",
  },
  // The rest of a thread and the posts on an account page, rendered by the server
  // (`statuses/_simple_status.html.haml`).
  {
    post: ".status",
    postLink: ".status__relative-time",
    actionBar: ".status__action-bar",
  },
];

function collectLinksByKind(
  actionBar: HTMLElement,
): Readonly<Partial<Record<ButtonKind, HTMLElement>>> {
  const result: Partial<Record<ButtonKind, HTMLElement>> = {};
  for (const link of actionBar.querySelectorAll("a")) {
    if (isExtensionButton(link)) continue;
    const icon = link.querySelector("i.fa");
    if (!icon) continue;
    for (const cls of icon.classList) {
      const kind = ICON_CLASS_TO_BUTTON_KIND.get(cls);
      if (kind !== undefined) {
        result[kind] = link;
        break;
      }
    }
  }
  return result;
}

/** Keys that press a button, which a copied link has to answer to as one. */
const ACTIVATION_KEYS: ReadonlySet<string> = new Set(["Enter", " "]);

/**
 * Presses the copied link from the keyboard by firing `click` on it.
 *
 * The click goes to the render mode's handler like one from the pointer, so the
 * action is still run from that one place.
 */
function clickOnActivationKey(event: KeyboardEvent): void {
  if (!ACTIVATION_KEYS.has(event.key)) return;
  // Space would otherwise scroll the page.
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.click();
  }
}

/**
 * Turns a copied action link into a button, cut off from the host's remote
 * interaction.
 *
 * Adds a keyboard listener to the copy, which goes with it when it is removed.
 */
function neutralizeHostLink(link: HTMLElement): void {
  // The render mode stops the click from reaching the document, which is where the
  // host's handler listens; dropping the class it selects on keeps the dialog shut
  // even for a click that gets there some other way. Taking the class off changes
  // neither the color nor the cursor of the link (checked on 3.5.18).
  link.classList.remove(MODAL_BUTTON_CLASS);
  // The render mode handles the click alone, so with the `href` left in, a middle
  // click or "Open Link in New Tab" would still open the host's remote interaction
  // page, and hovering would show its URL, from a button that acts through the
  // home account. Without it the link is no longer a link to the browser, so what
  // it gave for free (being focusable, the Enter key, the pointer cursor) is put
  // back here. The host's stylesheet selects none of these links by `href`, so
  // nothing else about their look changes (checked on 3.5.18).
  link.removeAttribute("href");
  link.setAttribute("role", "button");
  link.tabIndex = 0;
  link.addEventListener("keydown", clickOnActivationKey);
  // The cursor of `.detailed-status__link` comes only from the browser's style for
  // links; `.icon-button` sets its own.
  link.style.cursor = "pointer";
  // The copy would otherwise duplicate the host's id.
  link.removeAttribute("id");
}

/**
 * Page adapter for the public pages of Mastodon 3.x.
 *
 * Mastodon 3.x serves signed-out visitors server-rendered pages instead of its web
 * client: status pages and account pages are plain HTML, and only the public and
 * hashtag timelines are drawn by a small client into the same layout. None of the
 * markup {@link MastodonPageAdapter} reads is there. Each action is a link to the
 * instance's remote interaction page (`/interact/:id?type=...`) with a Font Awesome
 * icon, and there is no bookmark action, so posts here get no bookmark button.
 *
 * Supports action button replacement by substituting those links. The host's
 * stylesheet marks no link as an action in effect on the post: an `active` class
 * on any of them changes nothing in its computed style (checked on 3.5.18), so the
 * render mode's own underline is all that shows the state.
 */
export class MastodonV3PublicLayoutPageAdapter implements PageAdapter, ActionButtonReplacer {
  isSupportedPage(): boolean {
    return (
      document.querySelector(`.${PUBLIC_LAYOUT_CLASS}`) !== null && hasInitialState()
    );
  }

  hasSignedInSession(): boolean {
    return initialStateHasSignedInViewer();
  }

  extractPosts(): ExtractedPost[] {
    const posts: ExtractedPost[] = [];
    for (const layout of POST_LAYOUTS) {
      for (const container of document.querySelectorAll(layout.post)) {
        const urlLink = container.querySelector(layout.postLink);
        const actionBar = container.querySelector(layout.actionBar);
        if (urlLink instanceof HTMLAnchorElement && actionBar instanceof HTMLElement) {
          posts.push({
            postUrl: urlLink.href,
            existingButtons: collectLinksByKind(actionBar),
            insertionTarget: actionBar,
          });
        }
      }
    }
    return posts;
  }

  replaceActionButton(post: ExtractedPost, kind: ButtonKind): HTMLElement | null {
    const original = post.existingButtons[kind];
    if (original === undefined) return null;
    return substituteHostButton(original, kind, neutralizeHostLink);
  }

  setActionButtonActive(_button: HTMLElement, _active: boolean): void {
    // The host has no look of its own for an action in effect; see the class doc.
  }

  restoreActionButtons(post: ExtractedPost): void {
    restoreHostButtons(post);
  }
}
