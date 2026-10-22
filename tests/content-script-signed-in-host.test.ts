import { beforeAll, describe, expect, it, vi } from "vitest";
import { APP_SHELL, renderedStatusPage } from "./fixtures/status-page-markup";

const RENDER_SETTLE_MS = 600;

function placedKinds(): string[] {
  return [...document.querySelectorAll("[data-faa-action]")].map(
    (element) => element.getAttribute("data-faa-action") ?? "",
  );
}

/** Every message the content script sent to the background script, in order. */
const sentMessages: unknown[] = [];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Puts the page into the state Mastodon's server delivers it in for a signed-in
 * user, or takes it back out of that state.
 *
 * The payload lives in the document head, which is where the server writes it
 * and which survives the page markup being replaced below.
 */
function setHostSession(signedIn: boolean): void {
  document.getElementById("initial-state")?.remove();
  const element = document.createElement("script");
  element.type = "application/json";
  element.id = "initial-state";
  element.textContent = JSON.stringify({
    meta: signedIn ? { me: "109252080473231374" } : {},
  });
  document.head.append(element);
}

/**
 * The active account is a mock one, which is authenticated and would render
 * buttons on any page, so a page left untouched can only be the work of the
 * signed-in check.
 */
describe("ホスト側がログイン中のページの除外", () => {
  beforeAll(async () => {
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async () => ({
            homeAccountStore: {
              accounts: [{ id: "mock", software: "mock", label: "Mock" }],
              activeAccountId: "mock",
            },
          }),
        },
        onChanged: { addListener: () => {} },
      },
      runtime: {
        sendMessage: async (message: unknown) => {
          sentMessages.push(message);
        },
      },
      i18n: { getMessage: (key: string) => key },
    });
    setHostSession(true);
    document.body.innerHTML = APP_SHELL;
    await import("../src/content/content");
    await wait(RENDER_SETTLE_MS);
  });

  it("ホスト側がログイン中のページにはボタンを挿入しない", async () => {
    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await wait(RENDER_SETTLE_MS);
    expect(placedKinds()).toEqual([]);
    // The toolbar icon keeps the usual look, as nothing on the page is replaced.
    expect(sentMessages).toEqual([]);
  });

  it("ホスト側が未ログインならボタンを挿入する", async () => {
    setHostSession(false);

    document.body.innerHTML = APP_SHELL;
    await wait(RENDER_SETTLE_MS);
    document.body.innerHTML = APP_SHELL + renderedStatusPage;
    await wait(RENDER_SETTLE_MS);

    expect(placedKinds().length).toBeGreaterThan(0);
  });
});
