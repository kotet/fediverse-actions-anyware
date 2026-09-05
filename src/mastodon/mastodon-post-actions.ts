import type {
  ActionResult,
  ApiActionKind,
  AuthState,
  ResolveResult,
} from "../core/types";
import { loadMastodonCredentials } from "./mastodon-credentials";
import {
  bookmarkStatus,
  boostStatus,
  favouriteStatus,
  searchStatus,
  toActionError,
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

/** Error returned before any request when the account has no access token. */
const UNAUTHENTICATED_ERROR = {
  kind: "unauthenticated",
  message: "Not authenticated",
} as const;

/** Error returned when the home instance does not know the post. */
const NOT_FOUND_ERROR = {
  kind: "not-found",
  message: "Post not found",
} as const;

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
    return { ok: false, error: UNAUTHENTICATED_ERROR };
  }

  try {
    const status = await searchStatus(
      instance,
      credentials.accessToken,
      postUrl,
    );
    if (!status) {
      return { ok: false, error: NOT_FOUND_ERROR };
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
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Resolves a remote post URL to its URL on the home instance.
 *
 * Never throws: a post that cannot be resolved is reported as an error rather
 * than by handing back the original URL, which would take the user to the target
 * instance while claiming to open the post on their own.
 */
export async function resolveMastodonPost(
  instance: string,
  accountId: string,
  postUrl: string,
): Promise<ResolveResult> {
  const credentials = await loadMastodonCredentials(accountId);
  if (!credentials?.accessToken) {
    return { ok: false, error: UNAUTHENTICATED_ERROR };
  }

  try {
    const status = await searchStatus(
      instance,
      credentials.accessToken,
      postUrl,
    );
    if (!status) {
      return { ok: false, error: NOT_FOUND_ERROR };
    }
    return {
      ok: true,
      url: `https://${instance}/@${status.account.acct}/${status.id}`,
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
