import type { ActionResult, ApiActionKind, AuthState } from "../core/types";
import { loadMastodonCredentials } from "./mastodon-credentials";
import {
  bookmarkStatus,
  boostStatus,
  favouriteStatus,
  searchStatus,
} from "./mastodon-api-client";

/**
 * Home instance operations that talk to the Mastodon API.
 *
 * These run in the background script only. A content script cannot issue them:
 * the host page's `connect-src` directive covers requests made from content
 * scripts, and Mastodon serves a CSP that allows its own origin alone.
 *
 * Reading the stored credentials is part of each operation, which keeps the
 * access token inside the background script.
 */

/** Reports whether an access token is stored for the account. Performs no network access. */
export async function getMastodonAuthState(
  accountId: string,
): Promise<AuthState> {
  const credentials = await loadMastodonCredentials(accountId);
  if (!credentials?.accessToken) return "unauthenticated";
  return "authenticated";
}

/**
 * Executes an API action against the post on the home instance.
 *
 * Resolves `postUrl` on the home instance first, so the action applies to the
 * home instance's own copy of a post that lives elsewhere.
 *
 * Never throws: failures are returned as {@link ActionResult} errors.
 */
export async function performMastodonAction(
  instance: string,
  accountId: string,
  action: ApiActionKind,
  postUrl: string,
): Promise<ActionResult> {
  const credentials = await loadMastodonCredentials(accountId);
  if (!credentials?.accessToken) {
    return {
      ok: false,
      error: { kind: "unauthenticated", message: "Not authenticated" },
    };
  }

  try {
    const status = await searchStatus(
      instance,
      credentials.accessToken,
      postUrl,
    );
    if (!status) {
      return {
        ok: false,
        error: { kind: "not-found", message: "Post not found" },
      };
    }

    switch (action) {
      case "favourite":
        await favouriteStatus(instance, credentials.accessToken, status.id);
        break;
      case "boost":
        await boostStatus(instance, credentials.accessToken, status.id);
        break;
      case "bookmark":
        await bookmarkStatus(instance, credentials.accessToken, status.id);
        break;
      case "reply":
        return {
          ok: false,
          error: { kind: "failed", message: "Reply is not implemented" },
        };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Resolves a remote post URL to its URL on the home instance.
 *
 * Returns `postUrl` unchanged when the account is unauthenticated, the post is
 * not found, or the request fails, so the caller cannot tell those apart. Stage 1
 * of the release plan replaces this with a result type.
 */
export async function resolveMastodonPost(
  instance: string,
  accountId: string,
  postUrl: string,
): Promise<string> {
  const credentials = await loadMastodonCredentials(accountId);
  if (!credentials?.accessToken) return postUrl;

  try {
    const status = await searchStatus(
      instance,
      credentials.accessToken,
      postUrl,
    );
    if (!status) return postUrl;
    return `https://${instance}/@${status.account.acct}/${status.id}`;
  } catch {
    return postUrl;
  }
}
