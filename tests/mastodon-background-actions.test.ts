import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleMastodonActionRequest } from "../src/background/mastodon-action-handler";
import { MastodonHomeAccount } from "../src/mastodon";

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

/**
 * Answers the Mastodon endpoints the actions use and records every call.
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
      : {};
    const status = isSearch ? 200 : actionStatus;
    // `statusText` is left empty as Firefox reports it for an HTTP/2 response.
    return { ok: status < 400, status, statusText: "", json: async () => body };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MastodonHomeAccount", () => {
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessage = vi.fn().mockResolvedValue({ ok: true });
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
      (account: MastodonHomeAccount) => account.performAction("favourite", POST_URL),
      {
        type: "mastodon:perform-action",
        accountId: "m1",
        action: "favourite",
        postUrl: POST_URL,
      },
    ],
    [
      "openPost",
      (account: MastodonHomeAccount) => account.openPost(POST_URL),
      { type: "mastodon:open-post", accountId: "m1", postUrl: POST_URL },
    ],
  ])("%s はバックグラウンドへ依頼する", async (_name, call, expectedMessage) => {
    await call(new MastodonHomeAccount("m1", HOME_INSTANCE));
    expect(sendMessage).toHaveBeenCalledWith(expectedMessage);
  });

  it("バックグラウンドの応答をそのまま返す", async () => {
    sendMessage.mockResolvedValue({
      ok: false,
      error: { kind: "not-found", message: "Post not found" },
    });
    const result = await new MastodonHomeAccount("m1", HOME_INSTANCE).performAction(
      "boost",
      POST_URL,
    );
    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", message: "Post not found" },
    });
  });

  it.each([
    ["performAction", (account: MastodonHomeAccount) => account.performAction("favourite", POST_URL)],
    ["openPost", (account: MastodonHomeAccount) => account.openPost(POST_URL)],
  ])(
    "バックグラウンドへ届かないときは %s が network ではなく failed を返す",
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
    ["favourite", `https://${HOME_INSTANCE}/api/v1/statuses/${RESOLVED_STATUS_ID}/favourite`],
    ["boost", `https://${HOME_INSTANCE}/api/v1/statuses/${RESOLVED_STATUS_ID}/reblog`],
    ["bookmark", `https://${HOME_INSTANCE}/api/v1/statuses/${RESOLVED_STATUS_ID}/bookmark`],
  ] as const)("%s は解決した投稿に対して実行される", async (action, expectedUrl) => {
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action,
      postUrl: POST_URL,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchCalls.at(-1)).toEqual({
      url: expectedUrl,
      method: "POST",
      authorization: "Bearer token",
    });
  });

  it("リクエストではなく保存された設定のインスタンスへ送信する", async () => {
    await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      postUrl: POST_URL,
    });
    expect(fetchCalls.every((call) => call.url.startsWith(`https://${HOME_INSTANCE}/`))).toBe(true);
  });

  it("ホームインスタンス上に投稿が見つからなければ not-found を返す", async () => {
    stubMastodonApi(false);
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      postUrl: POST_URL,
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", message: "Post not found" },
    });
  });

  it("トークンが無ければ通信せずに unauthenticated を返す", async () => {
    stubBackgroundStorage({
      homeAccountStore: { accounts: [MASTODON_ACCOUNT], activeAccountId: "m1" },
    });
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      postUrl: POST_URL,
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: "unauthenticated", message: "Not authenticated" },
    });
    expect(fetchCalls).toEqual([]);
  });

  it.each([
    ["未登録のアカウント", "unknown"],
    ["Mastodon ではないアカウント", "mock-1"],
  ])("%s の依頼は通信せずに失敗する", async (_name, accountId) => {
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
      postUrl: POST_URL,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "failed" } });
    expect(fetchCalls).toEqual([]);
  });

  it.each([
    ["トークンがあれば", "token", "authenticated"],
    ["トークンが無ければ", undefined, "unauthenticated"],
  ])("認証状態は %s %s", async (_name, accessToken, expected) => {
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
  ])("HTTP %i は %s として報告される", async (status, kind) => {
    stubMastodonApi(true, status);
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      postUrl: POST_URL,
    });
    expect(result).toMatchObject({ ok: false, error: { kind } });
  });

  it("応答が返らない通信は network として報告される", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("NetworkError when attempting to fetch resource.");
    });
    const result = await handleMastodonActionRequest({
      type: "mastodon:perform-action",
      accountId: "m1",
      action: "favourite",
      postUrl: POST_URL,
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "network" } });
  });

  it("解決した投稿をホームインスタンス上で開く", async () => {
    const result = await handleMastodonActionRequest({
      type: "mastodon:open-post",
      accountId: "m1",
      postUrl: POST_URL,
    });
    expect(result).toEqual({ ok: true });
    expect(createdTabUrls).toEqual([RESOLVED_POST_URL]);
  });

  it("解決できないときはタブを開かず失敗を返す", async () => {
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
