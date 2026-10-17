import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Markup of a Mastodon status page, in the two states the content script meets it.
 *
 * Shared by the tests that drive the content script through a page load, since
 * both need the same "app shell first, posts later" sequence.
 */

/**
 * Server-delivered markup of a Mastodon status page.
 *
 * Verified against the live site: the response carries the app shell and nothing
 * else: no action bar, and an `initial-state` payload with no status in it. The
 * client has to fetch the status before any post markup exists, which is always
 * after the content script runs.
 */
export const APP_SHELL = `<div class="notranslate app-holder" id="mastodon"></div>`;

/**
 * The same page once the client has fetched the status and rendered it.
 *
 * Captured from `https://mastodon.archive.org`, which the test environment is
 * configured to serve as the page URL.
 */
export const renderedStatusPage = readFileSync(
  resolve(import.meta.dirname, "mastodon-status-page.html"),
  "utf8",
)
  // The fixture is a live capture; its resource tags only produce loader noise here.
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<link\b[^>]*>/g, "");
