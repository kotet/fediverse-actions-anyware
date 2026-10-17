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

  hasSignedInSession(): boolean {
    // Answers that no client of its own is acting on the page, so that the mock
    // adapter never suppresses the extension on the page being used to debug it.
    return false;
  }

  extractPosts(): ExtractedPost[] {
    const articles = Array.from(document.querySelectorAll("article"));
    return articles.map((article, index) => ({
      postUrl: `https://mock.example/users/mock_user/statuses/${index}`,
      existingButtons: {},
      insertionTarget: article,
    }));
  }
}
