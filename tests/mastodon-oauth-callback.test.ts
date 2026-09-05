import { beforeEach, expect, it, vi } from "vitest";
import { loadAccountStore } from "../src/core";
import { MastodonHomeAccount, startMastodonOAuth } from "../src/mastodon";

/**
 * Covers what completing OAuth does to the account list, across the two ways of
 * reaching it: registering an account from the add form, and signing in again
 * from the row of an account that is already registered.
 *
 * The callback page is a page rather than a function, so it is driven the way the
 * redirect drives it — by loading the module with the code in the query string —
 * and the instance it talks to is a stubbed `fetch`.
 */

const INSTANCE = "home.example";
const ACCOUNT_ID = "account-1";

let storage: Record<string, unknown>;
/** Every URL `fetch` was called with, so app registrations can be counted. */
let requestedUrls: string[];
/** The username `verify_credentials` answers with, which becomes the label. */
let username: string;

function installBrowserGlobal(): void {
  vi.stubGlobal("browser", {
    storage: {
      local: {
        get: async (key?: string) =>
          key === undefined ? { ...storage } : { [key]: storage[key] },
        set: async (items: Record<string, unknown>) => {
          Object.assign(storage, items);
        },
        remove: async (key: string) => {
          delete storage[key];
        },
      },
      onChanged: { addListener: () => {} },
    },
    i18n: {
      getMessage: (key: string) => key,
      getUILanguage: () => "en",
    },
    runtime: { getURL: (path: string) => `moz-extension://test/${path}` },
    tabs: { create: async () => {} },
  });
}

function installFetchStub(): void {
  vi.stubGlobal("fetch", async (url: string) => {
    requestedUrls.push(String(url));
    const answer = (payload: unknown): Response =>
      new Response(JSON.stringify(payload), { status: 200 });
    if (String(url).endsWith("/api/v1/apps")) {
      return answer({
        client_id: `client-${requestedUrls.length}`,
        client_secret: "secret",
      });
    }
    if (String(url).endsWith("/oauth/token")) {
      return answer({ access_token: "token" });
    }
    return answer({ id: "1", username, display_name: username });
  });
}

/** Loads the callback page afresh, as the redirect to it does. */
async function loadCallbackPage(): Promise<void> {
  document.body.innerHTML = `<p id="status"></p>`;
  history.replaceState({}, "", "/popup/oauth-callback.html?code=authcode");
  vi.resetModules();
  await import("../src/popup/oauth-callback");
  // The page reports its outcome instead of returning one, so that is what
  // completion is read from.
  await vi.waitFor(() => {
    const status = document.getElementById("status");
    expect(status?.className).toBe("status-success");
  });
}

function appRegistrationCount(): number {
  return requestedUrls.filter((url) => url.endsWith("/api/v1/apps")).length;
}

beforeEach(() => {
  storage = {};
  requestedUrls = [];
  username = "kotet";
  installBrowserGlobal();
  installFetchStub();
});

it("registers the account the add form started the flow for", async () => {
  await startMastodonOAuth(INSTANCE, ACCOUNT_ID);
  await loadCallbackPage();

  const state = await loadAccountStore();
  expect(state.accounts).toEqual([
    {
      id: ACCOUNT_ID,
      software: "mastodon",
      label: `kotet@${INSTANCE}`,
      mastodonInstance: INSTANCE,
    },
  ]);
  expect(state.activeAccountId).toBe(ACCOUNT_ID);
});

it("leaves one row however many times an account is signed in again", async () => {
  await startMastodonOAuth(INSTANCE, ACCOUNT_ID);
  await loadCallbackPage();

  const account = new MastodonHomeAccount(ACCOUNT_ID, INSTANCE);
  await account.authenticate();
  await loadCallbackPage();
  await account.authenticate();
  await loadCallbackPage();

  const state = await loadAccountStore();
  expect(state.accounts).toHaveLength(1);
});

it("takes the label from the account the instance answers with each time", async () => {
  await startMastodonOAuth(INSTANCE, ACCOUNT_ID);
  await loadCallbackPage();

  username = "renamed";
  await new MastodonHomeAccount(ACCOUNT_ID, INSTANCE).authenticate();
  await loadCallbackPage();

  const state = await loadAccountStore();
  expect(state.accounts[0]?.label).toBe(`renamed@${INSTANCE}`);
});

it("reuses the app registration it already holds when signing in again", async () => {
  await startMastodonOAuth(INSTANCE, ACCOUNT_ID);
  await loadCallbackPage();
  expect(appRegistrationCount()).toBe(1);

  await new MastodonHomeAccount(ACCOUNT_ID, INSTANCE).authenticate();
  await loadCallbackPage();

  expect(appRegistrationCount()).toBe(1);
});

it("registers again for an account whose instance has changed", async () => {
  await startMastodonOAuth(INSTANCE, ACCOUNT_ID);
  await loadCallbackPage();

  await new MastodonHomeAccount(ACCOUNT_ID, "elsewhere.example").authenticate();

  expect(appRegistrationCount()).toBe(2);
});

it("keeps the stored token while a repeated sign-in is unfinished", async () => {
  await startMastodonOAuth(INSTANCE, ACCOUNT_ID);
  await loadCallbackPage();

  // Started but never returned from, which is what abandoning the authorization
  // page leaves behind.
  await new MastodonHomeAccount(ACCOUNT_ID, INSTANCE).authenticate();

  const credentials = storage[`mastodonCredentials_${ACCOUNT_ID}`] as {
    accessToken?: string;
  };
  expect(credentials.accessToken).toBe("token");
});
