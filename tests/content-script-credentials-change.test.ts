import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AuthState } from "../src/core";
import { APP_SHELL, renderedStatusPage } from "./fixtures/status-page-markup";

const RENDER_SETTLE_MS = 600;

function placedKinds(): string[] {
  return [...document.querySelectorAll("[data-faa-action]")].map(
    (element) => element.getAttribute("data-faa-action") ?? "",
  );
}

function favouriteIsShownActive(): boolean {
  return (
    document
      .querySelector('[data-faa-action="favourite"]')
      ?.hasAttribute("data-faa-active") ?? false
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type StorageChangeListener = (changes: object, areaName: string) => void;

/** What the background script reports for the account, changed by the tests. */
let authState: AuthState = "authenticated";
let storageChangeListener: StorageChangeListener | undefined;

/**
 * Tells the content script that an account's credentials were rewritten, as a
 * logout or a fresh sign-in does, leaving the account store itself untouched.
 */
function changeCredentials(nextAuthState: AuthState): void {
  authState = nextAuthState;
  storageChangeListener?.({ mastodonCredentials_m1: { newValue: {} } }, "local");
}

/**
 * The page is left alone between the steps below, so any change to the buttons
 * can only come from the storage change the step reports.
 */
describe("認証情報の変更によるコンテンツスクリプトの再描画", () => {
  beforeAll(async () => {
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({
            homeAccountStore: {
              accounts: [
                {
                  id: "m1",
                  software: "mastodon",
                  label: "alice@home.example",
                  mastodonInstance: "home.example",
                },
              ],
              activeAccountId: "m1",
            },
          }),
        },
        onChanged: {
          addListener: (listener: StorageChangeListener) => {
            storageChangeListener = listener;
          },
        },
      },
      runtime: {
        sendMessage: async (request: { type: string }) =>
          request.type === "mastodon:get-auth-state"
            ? authState
            : { ok: true, active: true },
      },
      i18n: { getMessage: (key: string) => key },
    });
    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await import("../src/content/content");
    await wait(RENDER_SETTLE_MS);
  });

  it("認証済みならボタンを挿入する", () => {
    expect(placedKinds().length).toBeGreaterThan(0);
  });

  it("ログアウトで認証情報だけが変わってもボタンを取り除く", async () => {
    changeCredentials("unauthenticated");
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds()).toEqual([]);
  });

  it("再ログインで認証情報だけが変わってもボタンを挿入し直す", async () => {
    changeCredentials("authenticated");
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds().length).toBeGreaterThan(0);
  });

  it("認証済みのまま認証情報が変わると実行済みの表示を捨てる", async () => {
    document.querySelector<HTMLElement>('[data-faa-action="favourite"]')?.click();
    await wait(RENDER_SETTLE_MS);
    expect(favouriteIsShownActive()).toBe(true);

    // Signing in again, possibly as someone else, without logging out first.
    changeCredentials("authenticated");
    await wait(RENDER_SETTLE_MS);
    expect(favouriteIsShownActive()).toBe(false);
  });
});
