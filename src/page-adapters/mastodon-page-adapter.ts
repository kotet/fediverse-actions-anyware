import type { ButtonKind, ExtractedPost } from "../core";
import type { PageAdapter } from "../core";

const ICON_CLASS_TO_BUTTON_KIND: ReadonlyMap<string, ButtonKind> = new Map([
  ["icon-reply", "reply"],
  ["icon-retweet", "boost"],
  ["icon-star", "favourite"],
  ["icon-bookmark", "bookmark"],
  ["icon-ellipsis-h", "more"],
]);

function collectButtonsByKind(
  actionBar: HTMLElement,
): Readonly<Partial<Record<ButtonKind, HTMLElement>>> {
  const result: Partial<Record<ButtonKind, HTMLElement>> = {};
  for (const button of actionBar.querySelectorAll("button")) {
    if (!(button instanceof HTMLElement)) continue;
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

/**
 * Page adapter for the standard Mastodon web client.
 *
 * Targets individual status pages (e.g. `/@user/123`) which display
 * one detailed status followed by thread replies.
 */
export class MastodonPageAdapter implements PageAdapter {
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
}
