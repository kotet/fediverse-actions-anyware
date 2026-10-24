import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMastodonActionRequest } from "../src/background/mastodon-action-handler";
import {
  MastodonHomeAccount,
  forgetRememberedResolutions,
} from "../src/mastodon";

/**
 * Covers the split introduced because a content script cannot reach the home
 * instance: the account object only sends requests, and the background handler
 * is the only side that reads credentials and calls the API.
 */

const HOME_INSTANCE = "home.example";
const POST_URL = "https://remote.example/@someone/1";
const RESOLVED_STATUS_ID = "99";

const MASTODON_ACCOUNT = {
  id: "m1",
  software: "mastodon",
  label: "Home",
  mastodonInstance: HOME_INSTANCE,
};

const RESOLVED_POST_URL = `https://${HOME_INSTANCE}/@someone@remote.example/${RESOLVED_STATUS_ID}`;

interface FetchCall {
  url: string;
  method: string;
  authorization: string | null;
}

let fetchCalls: FetchCall[];
let createdTabUrls: string[];

/**
 * Serves the storage keys the handler reads, and fails any credential read
 * attempted from elsewhere so a leak back into the content script is caught.
 */
function stubBackgroundStorage(storage: Record<string, unknown>): void {
  createdTabUrls = [];
  vi.stubGlobal("browser", {
    storage: {
      local: {
        get: async (key: string) =>
          key in storage ? { [key]: storage[key] } : {},
      },
    },
    tabs: {
      create: async ({ url }: { url: string }) => {
        createdTabUrls.push(url);
      },
    },
  });
}

/** The action state a Mastodon instance reports after each endpoint is called. */
const ACTION_RESPONSE_STATES: Readonly<Record<string, Record<string, boolean>>> = {
  favourite: { favourited: true },
  unfavourite: { favourited: false },
  reblog: { reblogged: true },
  unreblog: { reblogged: false },
  bookmark: { bookmarked: true },
  unbookmark: { bookmarked: false },
};

/** How many times the status search was called, which the resolution cache changes. */
function searchCallCount(): number {
  return fetchCalls.filter((call) => call.url.includes("/api/v2/search")).length;
}

/**
 * Answers the Mastodon endpoints the actions use and records every call.
 *
 * Action endpoints answer with the status as it stands afterwards, as the real
 * ones do, so what the extension reports back can be traced to the instance.
 *
 * @param searchHit Whether the status search resolves the post on the home instance.
 * @param actionStatus HTTP status answered to everything other than the search,
 *   so that a failing action can be told apart from a failing resolution.
 */
function stubMastodonApi(searchHit: boolean, actionStatus = 200): void {
  fetchCalls = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    fetchCalls.push({
      url,
      method: init?.method ?? "GET",
      authorization: headers.Authorization ?? null,
    });
    const isSearch = url.includes("/api/v2/search");
    const body = isSearch
      ? {
          statuses: searchHit
            ? [
                {
                  id: RESOLVED_STATUS_ID,
                  url: POST_URL,
                  account: { acct: "someone@remote.example" },
                },
              ]
            : [],
        }
      : {
          id: RESOLVED_STATUS_ID,
          url: POST_URL,
          account: { acct: "someone@remote.example" },
          ...(ACTION_RESPONSE_STATES[url.split("/").at(-1) ?? ""] ?? {}),
        };
    const status = isSearch ? 200 : actionStatus;
    // `statusText` is left empty as Firefox reports it for an HTTP/2 response.
    return { ok: status < 400, status, statusText: "", json: async () => body };
  });
}

/**
 * Answers the action endpoint with `actionResponse` whatever was asked of it, so
 * that a state the extension reports can only have come from the instance.
 */
function stubMastodonApiAnswering(actionResponse: Record<string, unknown>): void {
  fetchCalls = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    fetchCalls.push({
      url,
      method: init?.method ?? "GET",
      authorization: null,
    });
    return {
      ok: true,
      status: 200,
      statusText: "",
      json: async () =>
        url.includes("/api/v2/search")
          ? {
              statuses: [
                {
                  id: RESOLVED_STATUS_ID,
                  url: POST_URL,
                  account: { acct: "someone@remote.example" },
                },
              ],
            }
          : actionResponse,
    };
  });
}

beforeEach(() => {
  // The background remembers where a post resolved to, so each test starts cold.
  forgetRememberedResolutions();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MastodonHomeAccount", () => {
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessage = vi.fn().mockResolvedValue({ ok: true, active: true });
    vi.stubGlobal("browser", {
      runtime: { sendMessage },
      storage: {
        local: {
          get: () => {
            throw new Error("credentials must not be read outside the background");
          },
        },
      },
      tabs: { create: vi.fn() },
    });
    vi.stubGlobal("fetch", () => {
      throw new Error("the home instance must not be contacted from here");
    });
  });

  it.each([
    [
      "getAuthState",
      (account: MastodonHomeAccount) => account.getAuthState(),
      { type: "mastodon:get-auth-state", accountId: "m1" },
    ],
    [
      "performAction",
      (account: MastodonHomeAccount) =>
        account.performAction("favourite", "apply", POST_URL),
      {
        type: "mastodon:perform-action",
        accountId: "m1",
        action: "favourite",
        direction: "apply",
        postUrl: POST_URL,
      },
    ],
    [
      "openPost",
      (account: MastodonHomeAccount) => account.openPost(POST_URL),
      { type: "mastodon:open-post", accountId: "m1", postUrl: POST_URL },
    ],
    [
      "startResolvingPost",
      (account: MastodonHomeAccount) => account.startResolvingPost(POST_URL),
      {
        type: "mastodon:start-resolving-post",
        accountId: "m1",
        postUrl: POST_URL,
      },
    ],
  ])("%s asks the background script", async (_name, call, expectedMessage) => {
    await call(new MastodonHomeAccount("m1", HOME_INSTANCE));
    expect(sendMessage).toHaveBeenCalledWith(expectedMessage);
  });

  it("returns the background script's answer as is", async () => {
    sendMessage.mockResolvedValue({
      ok: false,
      error: { kind: "not-found", message: "Post not found" },
    });
    const result = await new MastodonHomeAccount("m1", HOME_INSTANCE).performAction(
      "boost",
      "apply",
      POST_URL,
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", message: "Post not found" },
    });
  });

  it.each([
    [
      "performAction",
      (account: MastodonHomeAccount) =>
        account.performAction("favourite", "apply", POST_URL),
    ],
    ["openPost", (account: MastodonHomeAccount) => account.openPost(POST_URL)],
  ])(
    "%s returns failed rather than network when the background script cannot be reached",
    async (_name, call) => {
      sendMessage.mockRejectedValue(new Error("Receiving end does not exist"));
      const result = await call(new MastodonHomeAccount("m1", HOME_INSTANCE));
      expect(result).toMatchObject({ ok: false, error: { kind: "failed" } });
      // The instance was never contacted, so the message must not read like it was.
      expect(result.ok ? "" : result.error.message).toContain("background");
    },
  );
});

describe("handleMastodonActionRequest", () => {
  beforeEach(() => {
    stubMastodonApi(true);
    stubBackgroundStorage({
      homeAccountStore: {
        accounts: [MASTODON_ACCOUNT],
        activeAccountId: "m1",
      },
      mastodonCredentials_m1: {
        instance: HOME_INSTANCE,
        clientId: "c",
        clientSecret: "s",
        redirectUri: "https://redirect.example/",
        accessToken: "token",
      },
    });
  });

  it.each([
    ["favourite", "apply", "favourite", true],
    ["favourite", "undo", "unfavourite", false],
    ["boost", "apply", "reblog", true],
    ["boost", "undo", "unreblog", false],
    ["bookmark", "apply", "bookmark", true],
    ["bookmark", "undo", "unbookmark", false],
  ] as const)(
    "%s %s calls %s on the resolved post and returns the resulting state",
    async (action, direction, path, expectedActive) => {
      const result = await handleMastodonActionRequest({
        type: "mastodon:perform-action",
        accountId: "m1",
        action,
        direction,
        postUrl: POST_URL,
      });
      expect(result).toEqual({ ok: true, active: expectedActive });
      expect(fetchCalls.at(-1)).toEqual({
        url: `https://${HOME_INSTANCE}/api/v1/statuses/${RESOLVED_STATUS_ID}/${path}`,
        method: "POST",
        authorization: "Bearer token",
      });
    },
  );

  it.each([
    [
      "what the instance reports wins",
      "undo",
      { id: RESOLVED_STATUS_ID, favourited: true },
      true,
    ],
    [
      "the direction asked for is used when the instance reports nothing",
      "apply",
      { id: RESOLVED_STATUS_ID },
      true,
    ],
  ] as const)("for the state after a success, %s", async (_name, direction, answer, expected) => {
    stubMastodonApiAnswering(answer);
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction,
      postUrl: POST_URL,
    });
    expect(result).toEqual({ ok: true, active: expected });
  });

  it("does not search again for a post already resolved when undoing", async () => {
    await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction: "apply",
      postUrl: POST_URL,
    });
    await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction: "undo",
      postUrl: POST_URL,
    });
    expect(searchCallCount()).toBe(1);
  });

  it("a click overlapping the resolution started on press does not resolve again", async () => {
    const preparing = handleMastodonActionRequest({
      type: "mastodon:start-resolving-post",
      accountId: "m1",
      postUrl: POST_URL,
    });
    const acting = handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction: "apply",
      postUrl: POST_URL,
    });
    const [, result] = await Promise.all([preparing, acting]);
    expect(result).toEqual({ ok: true, active: true });
    expect(searchCallCount()).toBe(1);
  });

  it("sends to the instance in the stored configuration, not one from the request", async () => {
    await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction: "apply",
      postUrl: POST_URL,
    });
    expect(fetchCalls.every((call) => call.url.startsWith(`https://${HOME_INSTANCE}/`))).toBe(true);
  });

  it("returns not-found when the post is not found on the home instance", async () => {
    stubMastodonApi(false);
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction: "apply",
      postUrl: POST_URL,
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", message: "Post not found" },
    });
  });

  it("returns unauthenticated without any request when there is no token", async () => {
    stubBackgroundStorage({
      homeAccountStore: { accounts: [MASTODON_ACCOUNT], activeAccountId: "m1" },
    });
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction: "apply",
      postUrl: POST_URL,
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: "unauthenticated", message: "Not authenticated" },
    });
    expect(fetchCalls).toEqual([]);
  });

  it.each([
    ["an unregistered account", "unknown"],
    ["an account that is not Mastodon", "mock-1"],
  ])("a request for %s fails without any request", async (_name, accountId) => {
    stubBackgroundStorage({
      homeAccountStore: {
        accounts: [MASTODON_ACCOUNT, { id: "mock-1", software: "mock", label: "Mock" }],
        activeAccountId: "m1",
      },
    });
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId,
      action: "favourite",
      direction: "apply",
      postUrl: POST_URL,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "failed" } });
    expect(fetchCalls).toEqual([]);
  });

  it.each([
    ["with a token", "token", "authenticated"],
    ["without a token", undefined, "unauthenticated"],
  ])("reports the auth state of an account %s", async (_name, accessToken, expected) => {
    stubBackgroundStorage({
      homeAccountStore: { accounts: [MASTODON_ACCOUNT], activeAccountId: "m1" },
      mastodonCredentials_m1: {
        instance: HOME_INSTANCE,
        clientId: "c",
        clientSecret: "s",
        redirectUri: "https://redirect.example/",
        accessToken,
      },
    });
    expect(
      await handleMastodonActionRequest({
        type: "mastodon:get-auth-state",
        accountId: "m1",
      }),
    ).toBe(expected);
  });

  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [500, "network"],
    [429, "rate-limited"],
    [418, "failed"],
  ])("HTTP %i is reported as %s", async (status, kind) => {
    stubMastodonApi(true, status);
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction: "apply",
      postUrl: POST_URL,
    });
    expect(result).toMatchObject({ ok: false, error: { kind } });
  });

  it("a request that gets no response is reported as network", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("NetworkError when attempting to fetch resource.");
    });
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      direction: "apply",
      postUrl: POST_URL,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "network" } });
  });

  it("opens the resolved post on the home instance", async () => {
    const result = await handleMastodonActionRequest({
      type: "mastodon:open-post",
      accountId: "m1",
      postUrl: POST_URL,
    });
    // Opening a tab leaves no state on the post to report.
    expect(result).toEqual({ ok: true, active: null });
    expect(createdTabUrls).toEqual([RESOLVED_POST_URL]);
  });

  it("opens no tab and returns a failure when the post cannot be resolved", async () => {
    stubMastodonApi(false);
    const result = await handleMastodonActionRequest({
      type: "mastodon:open-post",
      accountId: "m1",
      postUrl: POST_URL,
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", message: "Post not found" },
    });
    expect(createdTabUrls).toEqual([]);
  });
});
