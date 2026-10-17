/** OAuth credentials and tokens for a Mastodon account. */
export interface MastodonCredentials {
  readonly instance: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly accessToken?: string;
}

/** Temporary state stored during an in-progress OAuth flow. */
export interface PendingMastodonOAuth {
  readonly accountId: string;
  readonly instance: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

function credentialsKey(accountId: string): string {
  return `mastodonCredentials_${accountId}`;
}

export async function loadMastodonCredentials(
  accountId: string,
): Promise<MastodonCredentials | null> {
  const key = credentialsKey(accountId);
  const stored = await browser.storage.local.get(key);
  return (stored[key] as MastodonCredentials | undefined) ?? null;
}

export async function saveMastodonCredentials(
  accountId: string,
  credentials: MastodonCredentials,
): Promise<void> {
  await browser.storage.local.set({ [credentialsKey(accountId)]: credentials });
}

export async function removeMastodonCredentials(
  accountId: string,
): Promise<void> {
  await browser.storage.local.remove(credentialsKey(accountId));
}

const PENDING_OAUTH_KEY = "pendingMastodonOAuth";

export async function savePendingOAuth(
  state: PendingMastodonOAuth,
): Promise<void> {
  await browser.storage.local.set({ [PENDING_OAUTH_KEY]: state });
}

export async function loadPendingOAuth(): Promise<PendingMastodonOAuth | null> {
  const stored = await browser.storage.local.get(PENDING_OAUTH_KEY);
  return (
    (stored[PENDING_OAUTH_KEY] as PendingMastodonOAuth | undefined) ?? null
  );
}

export async function clearPendingOAuth(): Promise<void> {
  await browser.storage.local.remove(PENDING_OAUTH_KEY);
}
