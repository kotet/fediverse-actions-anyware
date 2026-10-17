import type {
  ActionDirection,
  ActionResult,
  ApiActionKind,
  AuthState,
} from "../core/types";
import type { HomeAccount } from "../core/home-account";
import { describeThrown } from "../core/describe-thrown";
import {
  loadMastodonCredentials,
  removeMastodonCredentials,
  saveMastodonCredentials,
  savePendingOAuth,
} from "./mastodon-credentials";
import {
  buildAuthorizationUrl,
  type MastodonApp,
  registerMastodonApp,
} from "./mastodon-api-client";
import {
  type MastodonActionRequest,
  sendMastodonActionRequest,
} from "./mastodon-action-request";

/** Requests the background script answers with an {@link ActionResult}. */
type ActionRequest = Extract<
  MastodonActionRequest,
  { type: "mastodon:perform-action" | "mastodon:open-post" }
>;

/**
 * Sends a request whose response already reports failures, and turns a failure to
 * deliver it into one of them.
 *
 * Delivery fails while the extension is reloading or updating. That is a failure
 * inside the extension rather than one of the home instance, so it is reported as
 * `failed`; `network` is reserved for the instance being out of reach, which the
 * user would act on differently.
 */
async function requestActionFromBackground(
  request: ActionRequest,
): Promise<ActionResult> {
  try {
    return await sendMastodonActionRequest(request);
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "failed",
        message: `The extension's background script did not respond: ${describeThrown(error)}`,
      },
    };
  }
}

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

  /**
   * The app registration to authorize against, made only when there is none to
   * reuse.
   *
   * An instance keeps every registration it is asked for and lists them to the
   * user as authorized apps, so registering afresh on each sign-in would leave a
   * growing row of this extension there. Reuse is what `logout()` deliberately
   * leaves the registration behind for, and re-authentication needs it just as
   * much.
   *
   * A registration is only good for the instance and redirect it was made
   * against, so one made for either of those being different is replaced —
   * along with the token that came from it.
   *
   * Whether the instance still has the registration is not checked. Mastodon does
   * not delete registrations on its own; revoking the app from its settings only
   * revokes the tokens. Losing one takes something like an administrator deleting
   * it, and the authorization page then stops with `invalid_client` instead of
   * redirecting back, so nothing here learns of it. Removing the account and
   * adding it again registers afresh.
   */
  private async appRegistration(redirectUri: string): Promise<MastodonApp> {
    const stored = await loadMastodonCredentials(this.accountId);
    if (
      stored !== null &&
      stored.instance === this.instance &&
      stored.redirectUri === redirectUri
    ) {
      return { clientId: stored.clientId, clientSecret: stored.clientSecret };
    }

    const app = await registerMastodonApp(this.instance, redirectUri);
    await saveMastodonCredentials(this.accountId, {
      instance: this.instance,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      redirectUri,
    });
    return app;
  }

  async authenticate(): Promise<void> {
    const redirectUri = browser.runtime.getURL("popup/oauth-callback.html");
    const app = await this.appRegistration(redirectUri);

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
    // Only the token goes. The app registration stays behind so that logging in
    // again does not have to register this extension with the instance afresh.
    const credentials = await loadMastodonCredentials(this.accountId);
    if (credentials) {
      await saveMastodonCredentials(this.accountId, {
        ...credentials,
        accessToken: undefined,
      });
    }
  }

  async deleteStoredCredentials(): Promise<void> {
    await removeMastodonCredentials(this.accountId);
  }

  async performAction(
    action: ApiActionKind,
    direction: ActionDirection,
    postUrl: string,
  ): Promise<ActionResult> {
    return await requestActionFromBackground({
      type: "mastodon:perform-action",
      accountId: this.accountId,
      action,
      direction,
      postUrl,
    });
  }

  async startResolvingPost(postUrl: string): Promise<void> {
    try {
      await sendMastodonActionRequest({
        type: "mastodon:start-resolving-post",
        accountId: this.accountId,
        postUrl,
      });
    } catch {
      // Nothing was promised. A background script that cannot be reached now is
      // reported by the action this was getting ready for.
    }
  }

  async openPost(postUrl: string): Promise<ActionResult> {
    return await requestActionFromBackground({
      type: "mastodon:open-post",
      accountId: this.accountId,
      postUrl,
    });
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
