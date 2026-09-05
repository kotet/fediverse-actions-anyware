import type {
  ActionDirection,
  ActionResult,
  ApiActionKind,
  AuthState,
  ResolveResult,
} from "../core/types";
import { loadMastodonCredentials } from "./mastodon-credentials";
import {
  readActionState,
  requestStatusAction,
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

/** Where a post of another instance turned out to live on the home instance. */
interface ResolvedStatus {
  readonly id: string;
  readonly acct: string;
}

/**
 * Resolutions already made, so acting on the same post again — undoing what was
 * just done, most of all — costs one round trip instead of two.
 *
 * Only identity is kept, never the action state fields the same response carries:
 * those go stale, whereas where a post lives on the instance does not. The map is
 * lost whenever the background script is unloaded, which costs nothing but the
 * saved round trip.
 */
const rememberedResolutions = new Map<string, ResolvedStatus>();

/**
 * Resolutions still on their way, so a click landing during the one its own press
 * started waits for that instead of asking the instance a second time.
 */
const resolutionsInFlight = new Map<string, Promise<ResolvedStatus | null>>();

/**
 * How many resolutions are remembered at once.
 *
 * Bounded because a timeline scrolled for long enough would otherwise keep every
 * post ever acted on.
 */
const MAX_REMEMBERED_RESOLUTIONS = 200;

/** Keyed by account as well as post, since each account resolves to its own instance. */
function resolutionKey(accountId: string, postUrl: string): string {
  return `${accountId}\n${postUrl}`;
}

function rememberResolution(key: string, resolved: ResolvedStatus): void {
  // A Map yields its keys in insertion order, so the first one is the oldest.
  if (rememberedResolutions.size >= MAX_REMEMBERED_RESOLUTIONS) {
    const oldest = rememberedResolutions.keys().next();
    if (!oldest.done) rememberedResolutions.delete(oldest.value);
  }
  rememberedResolutions.set(key, resolved);
}

/**
 * Forgets every remembered resolution.
 *
 * The map only saves a round trip, so emptying it changes nothing but latency.
 * Exists so that a test can start from a cold cache.
 */
export function forgetRememberedResolutions(): void {
  rememberedResolutions.clear();
}

/**
 * Finds where `postUrl` lives on the home instance, reusing a resolution that has
 * already been made or is being made right now.
 *
 * Throws whatever the search throws, so the caller classifies it as it would any
 * other failed request.
 */
async function resolveStatus(
  instance: string,
  accessToken: string,
  accountId: string,
  postUrl: string,
): Promise<ResolvedStatus | null> {
  const key = resolutionKey(accountId, postUrl);
  const remembered = rememberedResolutions.get(key);
  if (remembered !== undefined) return remembered;
  const inFlight = resolutionsInFlight.get(key);
  if (inFlight !== undefined) return await inFlight;

  const resolution = searchStatus(instance, accessToken, postUrl).then(
    (status) =>
      status === null ? null : { id: status.id, acct: status.account.acct },
  );
  resolutionsInFlight.set(key, resolution);
  try {
    const resolved = await resolution;
    // A post the instance does not know is not remembered: fetching it is exactly
    // what `resolve=true` is asked to do, so the next attempt may well succeed.
    if (resolved !== null) rememberResolution(key, resolved);
    return resolved;
  } finally {
    resolutionsInFlight.delete(key);
  }
}

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
  direction: ActionDirection,
  postUrl: string,
): Promise<ActionResult> {
  const credentials = await loadMastodonCredentials(accountId);
  if (!credentials?.accessToken) {
    return { ok: false, error: UNAUTHENTICATED_ERROR };
  }

  try {
    const resolved = await resolveStatus(
      instance,
      credentials.accessToken,
      accountId,
      postUrl,
    );
    if (resolved === null) {
      return { ok: false, error: NOT_FOUND_ERROR };
    }

    const updated = await requestStatusAction(
      instance,
      credentials.accessToken,
      action,
      direction,
      resolved.id,
    );
    // What the instance reports is preferred over what was asked for, so that a
    // post already in this state answers with the state it is really in. The
    // direction stands in only for an instance that omits the field.
    return {
      ok: true,
      active: readActionState(action, updated) ?? direction === "apply",
    };
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
    const resolved = await resolveStatus(
      instance,
      credentials.accessToken,
      accountId,
      postUrl,
    );
    if (resolved === null) {
      return { ok: false, error: NOT_FOUND_ERROR };
    }
    return {
      ok: true,
      url: `https://${instance}/@${resolved.acct}/${resolved.id}`,
    };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

/**
 * Resolves the post ahead of the action that will need it.
 *
 * Reports nothing, not even that it failed: it is called on a press that may
 * never become a click, and the action that follows makes the same call and
 * reports for itself.
 */
export async function startResolvingMastodonPost(
  instance: string,
  accountId: string,
  postUrl: string,
): Promise<void> {
  const credentials = await loadMastodonCredentials(accountId);
  if (!credentials?.accessToken) return;
  try {
    await resolveStatus(instance, credentials.accessToken, accountId, postUrl);
  } catch {
    // Left for the action to report.
  }
}
