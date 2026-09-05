import type { ActionResult, AuthState } from "../core";
import { loadAccountStore } from "../core";
import {
  getMastodonAuthState,
  performMastodonAction,
  resolveMastodonPost,
  type MastodonActionRequest,
} from "../mastodon";

/**
 * Looks up the instance hostname registered for a Mastodon account.
 *
 * Reading it from the store rather than from the request is what limits the
 * background script to instances the user registered.
 *
 * @returns The hostname, or `null` if no Mastodon account has that ID.
 */
async function findMastodonInstance(accountId: string): Promise<string | null> {
  const store = await loadAccountStore();
  const config = store.accounts.find((account) => account.id === accountId);
  if (config === undefined || config.software !== "mastodon") return null;
  return config.mastodonInstance ?? null;
}

/** Failure returned for a request naming an account this script cannot act for. */
function unknownAccountFailure(accountId: string): ActionResult {
  return {
    ok: false,
    error: {
      kind: "failed",
      message: `No Mastodon account is registered as ${accountId}.`,
    },
  };
}

/**
 * Opens `url` in a new tab.
 *
 * Done here rather than in the requesting realm because a content script has no
 * `tabs` API, and `window.open` after awaiting the post resolution would have lost
 * the click's transient activation and be treated as an unsolicited popup.
 */
async function openInNewTab(url: string): Promise<ActionResult> {
  try {
    await browser.tabs.create({ url });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "failed",
        message: `Could not open a tab: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}

/**
 * Runs a home account operation on behalf of another realm.
 *
 * Never throws: the underlying operations report failures in their return
 * values, and an unknown account is reported the same way.
 */
export async function handleMastodonActionRequest(
  request: MastodonActionRequest,
): Promise<AuthState | ActionResult> {
  switch (request.type) {
    case "mastodon:get-auth-state":
      return await getMastodonAuthState(request.accountId);

    case "mastodon:perform-action": {
      const instance = await findMastodonInstance(request.accountId);
      if (instance === null) return unknownAccountFailure(request.accountId);
      return await performMastodonAction(
        instance,
        request.accountId,
        request.action,
        request.postUrl,
      );
    }

    case "mastodon:open-post": {
      const instance = await findMastodonInstance(request.accountId);
      if (instance === null) return unknownAccountFailure(request.accountId);
      const resolved = await resolveMastodonPost(
        instance,
        request.accountId,
        request.postUrl,
      );
      if (!resolved.ok) return { ok: false, error: resolved.error };
      return await openInNewTab(resolved.url);
    }
  }
}
