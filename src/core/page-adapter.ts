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
   * If `false`, the extension does not operate on this page.
   */
  isSupportedPage(): boolean;

  /**
   * Extracts the list of posts on the page. Supports both individual post pages and timeline views.
   *
   * @returns An array of each post's URL, existing button elements, and insertion target.
   */
  extractPosts(): ExtractedPost[];
}

/**
 * Optional page adapter capability: substituting a host action button with an
 * equivalent-looking element that carries none of the host's behavior.
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
   * Undoes every substitution previously made on `post`, restoring the host buttons.
   * Safe to call when nothing has been substituted.
   */
  restoreActionButtons(post: ExtractedPost): void;
}

/**
 * Determines whether an adapter supports action button substitution, narrowing its
 * type so the capability can be used. Render modes that rely on substitution call
 * this to decide whether they can operate on the current site.
 */
export function supportsActionButtonReplacement(
  adapter: PageAdapter,
): adapter is PageAdapter & ActionButtonReplacer {
  const candidate = adapter as Partial<ActionButtonReplacer>;
  return (
    typeof candidate.replaceActionButton === "function" &&
    typeof candidate.restoreActionButtons === "function"
  );
}
