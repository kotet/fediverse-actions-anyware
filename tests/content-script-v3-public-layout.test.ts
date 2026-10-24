import { beforeAll, describe, expect, it, vi } from "vitest";
import { V3_STATUS_PAGE } from "./fixtures/v3-public-layout-markup";

const RENDER_SETTLE_MS = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The page is in place before the script loads, as a server-rendered page is at
 * `document_idle`, which is when the script picks its adapter.
 */
describe("Mastodon 3.x public pages", () => {
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
      runtime: { sendMessage: async () => undefined },
      i18n: { getMessage: (key: string) => key },
    });
    document.body.innerHTML = V3_STATUS_PAGE;
    await import("../src/content/content");
    await wait(RENDER_SETTLE_MS);
  });

  it("replaces the action links of every post", () => {
    const placed = [...document.querySelectorAll("[data-faa-action]")].map((element) =>
      element.getAttribute("data-faa-action"),
    );
    // Three posts with reply, favourite and, on the two public ones, boost.
    expect(placed.sort()).toEqual([
      "boost",
      "boost",
      "favourite",
      "favourite",
      "favourite",
      "reply",
      "reply",
      "reply",
    ]);
  });
});
