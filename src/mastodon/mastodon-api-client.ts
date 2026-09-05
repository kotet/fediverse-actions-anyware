import type { ActionError, ActionErrorKind } from "../core/types";

const APP_NAME = "Fediverse Actions Anyware";
const SCOPES = "read write";

export interface MastodonApp {
  clientId: string;
  clientSecret: string;
}

export interface MastodonAccount {
  id: string;
  username: string;
  displayName: string;
}

export interface MastodonStatus {
  id: string;
  url: string;
  account: {
    acct: string;
  };
}

/**
 * Failure of a request to a Mastodon instance, carrying the kind shown to the user.
 *
 * This module is the only one that sees HTTP status codes, so the classification
 * happens here and everything above it works with {@link ActionErrorKind} alone.
 */
export class MastodonApiError extends Error {
  readonly kind: ActionErrorKind;

  constructor(kind: ActionErrorKind, message: string) {
    super(message);
    this.name = "MastodonApiError";
    this.kind = kind;
  }
}

/**
 * Classifies an HTTP status from the home instance.
 *
 * 5xx counts as `network` rather than `failed`: from the user's side an instance
 * that answers with an internal error is as unreachable as one that does not
 * answer, and both call for the same "try again later".
 */
function errorKindForStatus(status: number): ActionErrorKind {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status >= 500) return "network";
  return "failed";
}

/** Extracts a message from a thrown value of unknown shape. */
function describeThrown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Converts a value thrown by this module into the error reported to the user.
 *
 * Anything that is not a {@link MastodonApiError} came from the extension's own
 * code rather than from the instance, so it stays the catch-all `failed`.
 */
export function toActionError(error: unknown): ActionError {
  if (error instanceof MastodonApiError) {
    return { kind: error.kind, message: error.message };
  }
  return { kind: "failed", message: describeThrown(error) };
}

/**
 * Performs a request against a Mastodon instance and classifies its failures.
 *
 * Every failure leaves as a {@link MastodonApiError}, so callers report the cause
 * without inspecting status codes themselves.
 *
 * @param operation Name of the operation, used in the error message.
 */
async function requestMastodonApi(
  operation: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    // `fetch` rejects only when no response was produced at all: DNS failure,
    // refused connection, TLS error, or the request being blocked before it left.
    throw new MastodonApiError(
      "network",
      `${operation} could not reach the instance: ${describeThrown(error)}`,
    );
  }
  if (!response.ok) {
    // Only the status code is reported: HTTP/2 carries no reason phrase, so
    // `statusText` is empty for every instance served over it.
    throw new MastodonApiError(
      errorKindForStatus(response.status),
      `${operation} failed: HTTP ${response.status}`,
    );
  }
  return response;
}

export async function registerMastodonApp(
  instance: string,
  redirectUri: string,
): Promise<MastodonApp> {
  const response = await requestMastodonApi(
    "App registration",
    `https://${instance}/api/v1/apps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: APP_NAME,
        redirect_uris: redirectUri,
        scopes: SCOPES,
      }),
    },
  );
  const data = (await response.json()) as {
    client_id: string;
    client_secret: string;
  };
  return { clientId: data.client_id, clientSecret: data.client_secret };
}

export function buildAuthorizationUrl(
  instance: string,
  clientId: string,
  redirectUri: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    response_type: "code",
  });
  return `https://${instance}/oauth/authorize?${params.toString()}`;
}

export async function exchangeAuthCode(
  instance: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<string> {
  const response = await requestMastodonApi(
    "Token exchange",
    `https://${instance}/oauth/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    },
  );
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function verifyCredentials(
  instance: string,
  accessToken: string,
): Promise<MastodonAccount> {
  const response = await requestMastodonApi(
    "Credential verification",
    `https://${instance}/api/v1/accounts/verify_credentials`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await response.json()) as {
    id: string;
    username: string;
    display_name: string;
  };
  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
  };
}

export async function searchStatus(
  instance: string,
  accessToken: string,
  statusUrl: string,
): Promise<MastodonStatus | null> {
  const params = new URLSearchParams({
    q: statusUrl,
    type: "statuses",
    resolve: "true",
    limit: "1",
  });
  const response = await requestMastodonApi(
    "Status search",
    `https://${instance}/api/v2/search?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await response.json()) as {
    statuses: Array<{ id: string; url: string; account: { acct: string } }>;
  };
  return data.statuses[0] ?? null;
}

export async function favouriteStatus(
  instance: string,
  accessToken: string,
  statusId: string,
): Promise<void> {
  await requestMastodonApi(
    "Favourite",
    `https://${instance}/api/v1/statuses/${statusId}/favourite`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

export async function boostStatus(
  instance: string,
  accessToken: string,
  statusId: string,
): Promise<void> {
  await requestMastodonApi(
    "Boost",
    `https://${instance}/api/v1/statuses/${statusId}/reblog`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

export async function bookmarkStatus(
  instance: string,
  accessToken: string,
  statusId: string,
): Promise<void> {
  await requestMastodonApi(
    "Bookmark",
    `https://${instance}/api/v1/statuses/${statusId}/bookmark`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}
