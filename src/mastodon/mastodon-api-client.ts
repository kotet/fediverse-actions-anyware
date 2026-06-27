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

export async function registerMastodonApp(
  instance: string,
  redirectUri: string,
): Promise<MastodonApp> {
  const response = await fetch(`https://${instance}/api/v1/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: APP_NAME,
      redirect_uris: redirectUri,
      scopes: SCOPES,
    }),
  });
  if (!response.ok) {
    throw new Error(`App registration failed: ${response.status} ${response.statusText}`);
  }
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
  const response = await fetch(`https://${instance}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export async function verifyCredentials(
  instance: string,
  accessToken: string,
): Promise<MastodonAccount> {
  const response = await fetch(
    `https://${instance}/api/v1/accounts/verify_credentials`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Credential verification failed: ${response.status} ${response.statusText}`);
  }
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
  const response = await fetch(
    `https://${instance}/api/v2/search?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Status search failed: ${response.status} ${response.statusText}`);
  }
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
  const response = await fetch(
    `https://${instance}/api/v1/statuses/${statusId}/favourite`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Favourite failed: ${response.status} ${response.statusText}`);
  }
}

export async function boostStatus(
  instance: string,
  accessToken: string,
  statusId: string,
): Promise<void> {
  const response = await fetch(
    `https://${instance}/api/v1/statuses/${statusId}/reblog`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Boost failed: ${response.status} ${response.statusText}`);
  }
}

export async function bookmarkStatus(
  instance: string,
  accessToken: string,
  statusId: string,
): Promise<void> {
  const response = await fetch(
    `https://${instance}/api/v1/statuses/${statusId}/bookmark`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) {
    throw new Error(`Bookmark failed: ${response.status} ${response.statusText}`);
  }
}
