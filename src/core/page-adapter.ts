import type { ExtractedPost } from "./types";

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
