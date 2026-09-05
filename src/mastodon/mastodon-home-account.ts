import type {
  ActionDirection,
  ActionResult,
  ApiActionKind,
  AuthState,
} from "../core/types";
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
        message: `The extension's background script did not respond: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    };
  }
}

/**
 * Hostname of `url`, or `null` if it is not a parsable absolute URL.
 *
 * The hostname is what `URL` normalizes it to, which is lowercased and free of
 * the port and any userinfo, so two hostnames obtained this way compare directly.
 */
function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
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

  ownsUrl(url: string): boolean {
    // The instance is stored as a bare hostname, but is only ever used as the
    // authority of `https://<instance>/...`, so it is compared as that authority
    // rather than as a string: a stray trailing slash or a differing case then
    // does not change the answer.
    const instanceHostname = hostnameOf(`https://${this.instance}`);
    return instanceHostname !== null && hostnameOf(url) === instanceHostname;
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
