import type { ActionResult, ApiActionKind, AuthState } from "../core/types";
import type { HomeAccount } from "../core/home-account";
import {
  loadMastodonCredentials,
  saveMastodonCredentials,
  savePendingOAuth,
} from "./mastodon-credentials";
import {
  bookmarkStatus,
  boostStatus,
  buildAuthorizationUrl,
  favouriteStatus,
  registerMastodonApp,
  searchStatus,
} from "./mastodon-api-client";

export class MastodonHomeAccount implements HomeAccount {
  readonly accountId: string;
  readonly instance: string;

  constructor(accountId: string, instance: string) {
    this.accountId = accountId;
    this.instance = instance;
  }

  async getAuthState(): Promise<AuthState> {
    const credentials = await loadMastodonCredentials(this.accountId);
    if (!credentials?.accessToken) return "unauthenticated";
    return "authenticated";
  }

  async authenticate(): Promise<void> {
    const redirectUri = browser.runtime.getURL("popup/oauth-callback.html");
    const app = await registerMastodonApp(this.instance, redirectUri);

    const credentials = {
      instance: this.instance,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      redirectUri,
    };
    await saveMastodonCredentials(this.accountId, credentials);
    await savePendingOAuth({
      accountId: this.accountId,
      instance: this.instance,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      redirectUri,
    });

    const authUrl = buildAuthorizationUrl(
      this.instance,
      app.clientId,
      redirectUri,
    );
    await browser.tabs.create({ url: authUrl });
  }

  async logout(): Promise<void> {
    const credentials = await loadMastodonCredentials(this.accountId);
    if (credentials) {
      await saveMastodonCredentials(this.accountId, {
        ...credentials,
        accessToken: undefined,
      });
    }
  }

  async performAction(
    action: ApiActionKind,
    postUrl: string,
  ): Promise<ActionResult> {
    const credentials = await loadMastodonCredentials(this.accountId);
    if (!credentials?.accessToken) {
      return {
        ok: false,
        error: { kind: "unauthenticated", message: "Not authenticated" },
      };
    }

    try {
      const status = await searchStatus(
        this.instance,
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
          await favouriteStatus(this.instance, credentials.accessToken, status.id);
          break;
        case "boost":
          await boostStatus(this.instance, credentials.accessToken, status.id);
          break;
        case "bookmark":
          await bookmarkStatus(this.instance, credentials.accessToken, status.id);
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

  async resolvePost(postUrl: string): Promise<string> {
    const credentials = await loadMastodonCredentials(this.accountId);
    if (!credentials?.accessToken) return postUrl;

    try {
      const status = await searchStatus(
        this.instance,
        credentials.accessToken,
        postUrl,
      );
      if (!status) return postUrl;
      return `https://${this.instance}/@${status.account.acct}/${status.id}`;
    } catch {
      return postUrl;
    }
  }
}

/**
 * Initiates OAuth for a new Mastodon account by registering the app, saving
 * pending state, and opening the authorization tab.
 *
 * @param instance Mastodon instance hostname (e.g. "mastodon.social")
 * @param accountId Pre-generated account ID that will identify this account after OAuth completes
 */
export async function startMastodonOAuth(
  instance: string,
  accountId: string,
): Promise<void> {
  const redirectUri = browser.runtime.getURL("popup/oauth-callback.html");
  const app = await registerMastodonApp(instance, redirectUri);

  await savePendingOAuth({
    accountId,
    instance,
    clientId: app.clientId,
    clientSecret: app.clientSecret,
    redirectUri,
  });

  const authUrl = buildAuthorizationUrl(instance, app.clientId, redirectUri);
  await browser.tabs.create({ url: authUrl });
}
