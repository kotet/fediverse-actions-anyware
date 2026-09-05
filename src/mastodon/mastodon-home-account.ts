import type { ActionResult, ApiActionKind, AuthState } from "../core/types";
import type { HomeAccount } from "../core/home-account";
import {
  loadMastodonCredentials,
  saveMastodonCredentials,
  savePendingOAuth,
} from "./mastodon-credentials";
import {
  buildAuthorizationUrl,
  registerMastodonApp,
} from "./mastodon-api-client";
import { sendMastodonActionRequest } from "./mastodon-action-request";

/**
 * Home account backed by a Mastodon instance.
 *
 * Every operation that reaches the home instance is delegated to the background
 * script: this class is constructed in the content script, where the host page's
 * `connect-src` directive blocks requests to any other origin. Delegating also
 * keeps the access token out of the page's process.
 *
 * `authenticate()` and `logout()` are the exception. They are driven from the
 * popup, which is an extension page and can reach the instance directly, and
 * `authenticate()` needs the `tabs` API that a content script does not have.
 */
export class MastodonHomeAccount implements HomeAccount {
  readonly accountId: string;
  readonly instance: string;

  constructor(accountId: string, instance: string) {
    this.accountId = accountId;
    this.instance = instance;
  }

  async getAuthState(): Promise<AuthState> {
    return await sendMastodonActionRequest({
      type: "mastodon:get-auth-state",
      accountId: this.accountId,
    });
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
    try {
      return await sendMastodonActionRequest({
        type: "mastodon:perform-action",
        accountId: this.accountId,
        action,
        postUrl,
      });
    } catch (error) {
      // Reaching the background script can fail while the extension is
      // reloading or updating. The caller expects a result, not an exception.
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
    try {
      return await sendMastodonActionRequest({
        type: "mastodon:resolve-post",
        accountId: this.accountId,
        postUrl,
      });
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
