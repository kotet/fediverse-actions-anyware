import { beforeAll, describe, expect, it, vi } from "vitest";
import { APP_SHELL, renderedStatusPage } from "./fixtures/status-page-markup";

const RENDER_SETTLE_MS = 600;

/**
 * Whether the account registered for the instance serving the page is logged in.
 *
 * Read on every render through the stubbed `runtime.sendMessage`, so flipping it
 * changes what the next render sees.
 */
let ownInstanceAuthState = "authenticated";

function placedKinds(): string[] {
  return [...document.querySelectorAll("[data-faa-action]")].map(
    (element) => element.getAttribute("data-faa-action") ?? "",
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The page is served by `mastodon.archive.org` (the test environment's URL), and
 * a home account for that instance is registered but is not the active one. The
 * active account is a mock one, which would otherwise render buttons on any page,
 * so a page left untouched can only be the work of the ownership check.
 */
describe("ログイン済みホームアカウントのページの除外", () => {
  beforeAll(async () => {
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({
            homeAccountStore: {
              accounts: [
                {
                  id: "own",
                  software: "mastodon",
                  label: "Own instance",
                  mastodonInstance: "mastodon.archive.org",
                },
                { id: "mock", software: "mock", label: "Mock" },
              ],
              activeAccountId: "mock",
            },
          }),
        },
        onChanged: { addListener: () => {} },
      },
      runtime: {
        sendMessage: async (message: { type: string }) => {
          if (message.type === "mastodon:get-auth-state") {
            return ownInstanceAuthState;
          }
          throw new Error(`Unexpected request: ${message.type}`);
        },
      },
      i18n: { getMessage: (key: string) => key },
    });
    document.body.innerHTML = APP_SHELL;
    await import("../src/content/content");
    await wait(RENDER_SETTLE_MS);
  });

  it("ログイン済みアカウントのインスタンスのページにはボタンを挿入しない", async () => {
    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds()).toEqual([]);
  });

  it("そのアカウントが未ログインならボタンを挿入する", async () => {
    ownInstanceAuthState = "unauthenticated";

    document.body.innerHTML = APP_SHELL;
    await wait(RENDER_SETTLE_MS);
    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await wait(RENDER_SETTLE_MS);

    expect(placedKinds().length).toBeGreaterThan(0);
  });
});
