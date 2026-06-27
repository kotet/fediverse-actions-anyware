import type { ExtractedPost, PageAdapter } from "../core";

/**
 * Mock implementation of the page adapter.
 *
 * To work on any page, always returns `true` for page detection and generates
 * dummy data by treating `<article>` elements on the page as posts.
 */
export class MockPageAdapter implements PageAdapter {
  isSupportedPage(): boolean {
    // Works on any URL.
    return true;
  }

  extractPosts(): ExtractedPost[] {
    const articles = Array.from(document.querySelectorAll("article"));
    return articles.map((article, index) => ({
      postUrl: `https://mock.example/users/mock_user/statuses/${index}`,
      // Treated as having no existing buttons.
      existingButtons: [],
      // The insertion target is the <article> element itself.
      insertionTarget: article,
    }));
  }
}
