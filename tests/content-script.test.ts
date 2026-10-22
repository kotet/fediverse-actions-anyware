import { beforeAll, describe, expect, it, vi } from "vitest";
import { APP_SHELL, renderedStatusPage } from "./fixtures/status-page-markup";

const RENDER_SETTLE_MS = 600;

function placedKinds(): string[] {
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
      runtime: { sendMessage: async () => undefined },
      i18n: { getMessage: (key: string) => key },
    });
    document.body.innerHTML = APP_SHELL;
    await import("../src/content/content");
    await wait(RENDER_SETTLE_MS);
  });

  it("投稿が描画される前は何も挿入しない", () => {
    expect(placedKinds()).toEqual([]);
  });

  it("後から投稿が描画されるとボタンを挿入する", async () => {
    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await wait(RENDER_SETTLE_MS);
    expect(new Set(placedKinds())).toEqual(
      new Set(["reply", "favourite", "boost", "bookmark"]),
    );
  });

  it("自身の挿入で再描画が繰り返されない", async () => {
    const before = placedKinds().length;
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds()).toHaveLength(before);
  });

  it("ホスト側がボタンを描画し直しても挿入し直す", async () => {
    document.body.innerHTML = APP_SHELL;
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds()).toEqual([]);

    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds().length).toBeGreaterThan(0);
  });
});
