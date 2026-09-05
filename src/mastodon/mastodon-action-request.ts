import type { ActionResult, ApiActionKind, AuthState } from "../core/types";

/**
 * Messages that carry a home account operation to the background script.
 *
 * A request names an account, never an instance or a token: the background
 * script looks both up from stored state. That keeps it from acting as a proxy
 * that would fetch whatever host the sender asks for.
 */
export type MastodonActionRequest =
  | {
      readonly type: "mastodon:get-auth-state";
      readonly accountId: string;
    }
  | {
      readonly type: "mastodon:perform-action";
      readonly accountId: string;
      readonly action: ApiActionKind;
      readonly postUrl: string;
    }
  // Resolution and opening are one request: the sender may be a content script,
  // which has no `tabs` API and would lose the click's transient activation while
  // waiting for the resolution.
  | {
      readonly type: "mastodon:open-post";
      readonly accountId: string;
      readonly postUrl: string;
    };

/** Response type produced for each request type. */
export interface MastodonActionResponses {
  "mastodon:get-auth-state": AuthState;
  "mastodon:perform-action": ActionResult;
  "mastodon:open-post": ActionResult;
}

const REQUEST_TYPES: ReadonlySet<string> = new Set([
  "mastodon:get-auth-state",
  "mastodon:perform-action",
  "mastodon:open-post",
]);

/**
 * Narrows an arbitrary message to a request this extension handles.
 *
 * The background script receives every `runtime.sendMessage` the extension
 * sends, so unrecognized messages have to be left for other listeners.
 */
export function isMastodonActionRequest(
  message: unknown,
): message is MastodonActionRequest {
  if (typeof message !== "object" || message === null) return false;
  const type = (message as { type?: unknown }).type;
  return typeof type === "string" && REQUEST_TYPES.has(type);
}

/**
 * Sends a request to the background script and returns its response.
 *
 * This is the one place where the response of `runtime.sendMessage` is given a
 * type; the background script is the only sender of it, so the mapping in
 * {@link MastodonActionResponses} is what keeps the two sides in step.
 */
export async function sendMastodonActionRequest<
  Request extends MastodonActionRequest,
>(request: Request): Promise<MastodonActionResponses[Request["type"]]> {
  return (await browser.runtime.sendMessage(
    request,
  )) as MastodonActionResponses[Request["type"]];
}
