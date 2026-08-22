import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Server-delivered markup of a Mastodon status page.
 *
 * Verified against the live site: the response carries the app shell and nothing
 * else — no action bar, and an `initial-state` payload with no status in it. The
 * client has to fetch the status before any post markup exists, which is always
 * after the content script runs.
 */
const APP_SHELL = `<div class="notranslate app-holder" id="mastodon"></div>`;

/** The same page once the client has fetched the status and rendered it. */
const renderedStatusPage = readFileSync(
  resolve(import.meta.dirname, "fixtures/mastodon-status-page.html"),
  "utf8",
)
  // The fixture is a live capture; its resource tags only produce loader noise here.
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<link\b[^>]*>/g, "");

const RENDER_SETTLE_MS = 600;

function substitutedKinds(): string[] {
  return [...document.querySelectorAll("[data-faa-action]")].map(
    (element) => element.getAttribute("data-faa-action") ?? "",
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The content script is a module with side effects and a single module-level
 * observer, so it is imported once and the page is then driven through its real
 * lifecycle. The assertions below therefore run in order against shared state.
 */
describe("コンテンツスクリプトの自動再描画", () => {
  beforeAll(async () => {
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({
            homeAccountStore: {
              accounts: [{ id: "a1", software: "mock", label: "Mock 1" }],
              activeAccountId: "a1",
            },
          }),
        },
        onChanged: { addListener: () => {} },
      },
      i18n: { getMessage: (key: string) => key },
    });
    document.body.innerHTML = APP_SHELL;
    await import("../src/content/content");
    await wait(RENDER_SETTLE_MS);
  });

  it("投稿が描画される前は何も挿入しない", () => {
    expect(substitutedKinds()).toEqual([]);
  });

  it("後から投稿が描画されるとボタンを挿入する", async () => {
    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await wait(RENDER_SETTLE_MS);
    expect(new Set(substitutedKinds())).toEqual(
      new Set(["favourite", "boost", "bookmark"]),
    );
  });

  it("自身の挿入で再描画が繰り返されない", async () => {
    const before = substitutedKinds().length;
    await wait(RENDER_SETTLE_MS);
    expect(substitutedKinds()).toHaveLength(before);
  });

  it("ホスト側がボタンを描画し直しても挿入し直す", async () => {
    document.body.innerHTML = APP_SHELL;
    await wait(RENDER_SETTLE_MS);
    expect(substitutedKinds()).toEqual([]);

    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await wait(RENDER_SETTLE_MS);
    expect(substitutedKinds().length).toBeGreaterThan(0);
  });
});
