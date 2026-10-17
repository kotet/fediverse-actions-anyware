import { beforeAll, describe, expect, it, vi } from "vitest";
import { APP_SHELL, renderedStatusPage } from "./fixtures/status-page-markup";

const RENDER_SETTLE_MS = 600;

const STORE_WITH_ACCOUNT = {
  homeAccountStore: {
    accounts: [{ id: "a1", software: "mock", label: "Mock 1" }],
    activeAccountId: "a1",
  },
};

const EMPTY_STORE = {
  homeAccountStore: { accounts: [], activeAccountId: null },
};

/** What the stubbed storage answers to the next read, swapped by each test. */
let readStore: () => Promise<Record<string, unknown>> = async () => STORE_WITH_ACCOUNT;

/** Fires the listener the content script registered for store changes. */
let notifyStoreChanged: () => void = () => {};

function placedKinds(): string[] {
  return [...document.querySelectorAll("[data-faa-action]")].map(
    (element) => element.getAttribute("data-faa-action") ?? "",
  );
}

function hiddenHostButtonCount(): number {
  return [...document.querySelectorAll("button:not([data-faa-action])")].filter(
    (button) => button instanceof HTMLElement && button.style.display === "none",
  ).length;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Removes the account through the store, the way the popup does, and checks what
 * is left on a page that buttons were already rendered on. The content script has
 * module-level state, so the cases run in order against one page.
 */
describe("アクティブなアカウントが無くなったときの後片付け", () => {
  beforeAll(async () => {
    vi.stubGlobal("browser", {
      storage: {
        local: { get: () => readStore() },
        onChanged: {
          addListener: (
            listener: (changes: Record<string, unknown>, areaName: string) => void,
          ) => {
            notifyStoreChanged = () => {
              listener({ homeAccountStore: { newValue: undefined } }, "local");
            };
          },
        },
      },
      i18n: { getMessage: (key: string) => key },
    });
    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await import("../src/content/content");
    await wait(RENDER_SETTLE_MS);
  });

  it("アカウントが無くなるとボタンを取り除き、元のボタンを戻す", async () => {
    expect(placedKinds().length).toBeGreaterThan(0);

    readStore = async () => EMPTY_STORE;
    notifyStoreChanged();
    await wait(RENDER_SETTLE_MS);

    expect(placedKinds()).toEqual([]);
    expect(hiddenHostButtonCount()).toBe(0);
  });

  it("削除前に始まった描画が後から終わってもボタンを戻さない", async () => {
    readStore = async () => STORE_WITH_ACCOUNT;
    notifyStoreChanged();
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds().length).toBeGreaterThan(0);

    let releaseStaleRead: () => void = () => {};
    readStore = () =>
      new Promise((resolve) => {
        releaseStaleRead = () => resolve(STORE_WITH_ACCOUNT);
      });
    notifyStoreChanged();
    readStore = async () => EMPTY_STORE;
    notifyStoreChanged();
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds()).toEqual([]);

    releaseStaleRead();
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds()).toEqual([]);
    expect(hiddenHostButtonCount()).toBe(0);
  });
});
