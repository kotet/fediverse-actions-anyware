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

/**
 * Runs a home account operation on behalf of another realm.
 *
 * Never throws: the underlying operations report failures in their return
 * values, and an unknown account is reported the same way.
 */
export async function handleMastodonActionRequest(
  request: MastodonActionRequest,
): Promise<AuthState | ActionResult | string> {
  switch (request.type) {
    case "mastodon:get-auth-state":
      return await getMastodonAuthState(request.accountId);

    case "mastodon:perform-action": {
      const instance = await findMastodonInstance(request.accountId);
      if (instance === null) {
        return {
          ok: false,
          error: {
            kind: "failed",
            message: `No Mastodon account is registered as ${request.accountId}.`,
          },
        };
      }
      return await performMastodonAction(
        instance,
        request.accountId,
        request.action,
        request.postUrl,
      );
    }

    case "mastodon:resolve-post": {
      const instance = await findMastodonInstance(request.accountId);
      // Matches how resolution failures are reported elsewhere: the original URL.
      if (instance === null) return request.postUrl;
      return await resolveMastodonPost(
        instance,
        request.accountId,
        request.postUrl,
      );
    }
  }
}
