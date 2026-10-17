import { isMastodonActionRequest } from "../mastodon";
import { handleMastodonActionRequest } from "./mastodon-action-handler";

/**
 * Background script.
 *
 * Holds every request that leaves the browser for a home instance. Content
 * scripts cannot make them: a request from a content script is checked against
 * the host page's `connect-src` directive, and Mastodon allows its own origin
 * alone, so such a request never leaves. The background script is not covered by
 * the page's policy and runs with the extension's host permissions, which the
 * `<all_urls>` content script match pattern already grants.
 */

browser.runtime.onInstalled.addListener(() => {
  console.log("Fediverse Actions Anyware installed.");
});

// Returning a promise answers the sender; returning undefined leaves the message
// to other listeners, so the listener itself must not be async.
browser.runtime.onMessage.addListener((message) => {
  if (!isMastodonActionRequest(message)) return undefined;
  return handleMastodonActionRequest(message);
});
