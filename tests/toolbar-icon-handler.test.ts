import { beforeEach, describe, expect, it, vi } from "vitest";
import { isToolbarIconRequest } from "../src/app";
import { handleToolbarIconRequest } from "../src/background/toolbar-icon-handler";

let setIconCalls: unknown[];

beforeEach(() => {
  setIconCalls = [];
  vi.stubGlobal("browser", {
    action: {
      setIcon: async (details: unknown) => {
        setIconCalls.push(details);
      },
    },
  });
});

describe("handleToolbarIconRequest", () => {
  it.each([
    [true, "/icons/icon-replacing.svg"],
    [false, "/icons/icon.svg"],
  ])("replacing=%s なら送信元タブだけ %s にする", async (replacing, path) => {
    await handleToolbarIconRequest(
      { type: "toolbar-icon:set-replacing", replacing },
      { tab: { id: 7 } as browser.tabs.Tab },
    );
    expect(setIconCalls).toEqual([{ tabId: 7, path }]);
  });

  it("タブを持たない送信元は無視する", async () => {
    await handleToolbarIconRequest(
      { type: "toolbar-icon:set-replacing", replacing: true },
      {},
    );
    expect(setIconCalls).toEqual([]);
  });
});

describe("isToolbarIconRequest", () => {
  it.each([
    [{ type: "toolbar-icon:set-replacing", replacing: true }, true],
    [{ type: "toolbar-icon:set-replacing" }, false],
    [{ type: "mastodon:get-auth-state", accountId: "a1" }, false],
    [null, false],
  ])("%j -> %s", (message, expected) => {
    expect(isToolbarIconRequest(message)).toBe(expected);
  });
});
