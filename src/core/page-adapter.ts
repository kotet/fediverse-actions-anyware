import type { ButtonKind, ExtractedPost } from "./types";

/**
 * Page adapter abstraction.
 *
 * Responsibility: extracting post information from the current page and providing
 * existing button elements. An implementation is defined per target web client
 * (Mastodon official UI, Elk, Semaphore, etc.).
 */
export interface PageAdapter {
  /**
   * Determines whether the current page is a supported client for this adapter.
   *
   * Asked once, when the content script loads, to pick the adapter for the page:
   * the first one answering `true` is used, and if none does, the extension does
   * not operate on this page. What it reads therefore has to be in the document
   * the server delivers.
   */
  isSupportedPage(): boolean;

  /**
   * Determines whether the page was served to a signed-in user, so that the
   * client's own action buttons already act as that user's account.
   *
   * Answered from the page alone, without reaching the network or storage, so
   * that it can be asked on every render.
   *
   * What marks a page as signed in is part of the target client's markup, which
   * is why this is the adapter's to answer. An adapter that cannot tell answers
   * `false`: the extension then offers its buttons, which is the more visible of
   * the two ways to be wrong and leaves the host's own buttons working besides.
   */
  hasSignedInSession(): boolean;

  /**
   * Extracts the list of posts on the page. Supports both individual post pages and timeline views.
   *
   * @returns An array of each post's URL, existing button elements, and insertion target.
   */
  extractPosts(): ExtractedPost[];
}

/**
 * Optional page adapter capability: putting the extension's action buttons into
 * the host's action bar in place of the host's own.
 *
 * Only adapters whose target client allows this implement it. How to preserve the
 * host's appearance, how to neutralize its disabled state, and whether the host
 * element may be removed at all are client-specific concerns, so they live here
 * rather than in the button render mode.
 */
export interface ActionButtonReplacer {
  /**
   * Substitutes the host button of `kind` on `post`.
   *
   * The returned element is already inserted into the page, looks like the host's
   * button, and carries no host event handlers. The host element stays in the DOM
   * (hidden) so that a client-side framework owning it is not disrupted.
   *
   * @returns The inserted element, or `null` if this post has no button of that kind.
   */
  replaceActionButton(post: ExtractedPost, kind: ButtonKind): HTMLElement | null;

  /**
   * Removes every element previously placed on `post`, restoring the host buttons.
   * Safe to call when nothing has been placed.
   */
  restoreActionButtons(post: ExtractedPost): void;

  /**
   * Gives a substituted button the look the target client uses for an action that
   * is in effect on the post, or takes that look back off it.
   *
   * Lives here rather than in the render mode because how a client marks a button
   * as "favourited" is part of that client's markup, which only this adapter knows.
   * The render mode marks the button in its own way as well, so an adapter whose
   * client offers nothing to reuse may leave this doing nothing.
   *
   * @param button An element returned by {@link replaceActionButton}.
   */
  setActionButtonActive(button: HTMLElement, active: boolean): void;
}

/**
 * Determines whether an adapter supports action button replacement, narrowing its
 * type so the capability can be used. Render modes that rely on replacement call
 * this to decide whether they can operate on the current site.
 */
export function supportsActionButtonReplacement(
  adapter: PageAdapter,
): adapter is PageAdapter & ActionButtonReplacer {
  const candidate = adapter as Partial<ActionButtonReplacer>;
  return (
    typeof candidate.replaceActionButton === "function" &&
    typeof candidate.restoreActionButtons === "function" &&
    typeof candidate.setActionButtonActive === "function"
  );
}
