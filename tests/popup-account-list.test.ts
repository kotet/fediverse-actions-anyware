import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleMastodonActionRequest } from "../src/background/mastodon-action-handler";
import type { MastodonActionRequest } from "../src/mastodon";
import {
  refreshAccountList,
  setupAccountListView,
} from "../src/popup/account-list-view";

/**
 * Covers what the popup says about an account and what its controls do to what is
 * stored.
 *
 * Requests for an authentication state are answered by the real background
 * handler against the same fake storage, since that round trip is what the popup
 * actually depends on.
 */

const MASTODON_ACCOUNT = {
  id: "m1",
  software: "mastodon",
  label: "user@home.example",
  mastodonInstance: "home.example",
};

const MOCK_ACCOUNT = { id: "k1", software: "mock", label: "Mock" };

const CREDENTIALS_KEY = "mastodonCredentials_m1";

const CREDENTIALS = {
  instance: "home.example",
  clientId: "c",
  clientSecret: "s",
  redirectUri: "https://redirect.example/",
  accessToken: "token",
};

type StorageListener = (
  changes: Record<string, { newValue?: unknown }>,
  areaName: string,
) => void;

let storage: Record<string, unknown>;
let storageListeners: StorageListener[];
/** Set to make the background unreachable, as it is while the extension reloads. */
let backgroundReachable: boolean;
/** Set to hold every answer from the background until it resolves. */
let backgroundGate: Promise<void> | null;
/** The origins the extension holds, which the user can withdraw under MV3. */
let grantedOrigins: string[];

function setupPopupMarkup(): void {
  document.body.innerHTML = `
    <ul id="account-list"></ul>
    <p id="empty-message"></p>
    <p id="account-list-notice" class="account-notice hidden"></p>
  `;
}

function accountItems(): HTMLLIElement[] {
  return Array.from(document.querySelectorAll("#account-list li"));
}

function textOf(item: HTMLElement, selector: string): string {
  return item.querySelector(selector)?.textContent ?? "";
}

function buttonLabels(item: HTMLElement): string[] {
  return Array.from(item.querySelectorAll(".account-auth-button")).map(
    (button) => button.textContent ?? "",
  );
}

function clickAuthButton(item: HTMLElement, label: string): void {
  const button = Array.from(
    item.querySelectorAll<HTMLButtonElement>(".account-auth-button"),
  ).find((candidate) => candidate.textContent === label);
  if (button === undefined) throw new Error(`no ${label} button`);
  button.click();
}

function notice(): HTMLElement {
  const element = document.getElementById("account-list-notice");
  if (element === null) throw new Error("no notice element");
  return element;
}

function notifyStorageListeners(
  changes: Record<string, { newValue?: unknown }>,
): void {
  for (const listener of storageListeners) listener(changes, "local");
}

/** Puts `accounts` in the store with the first one active. */
function storeAccounts(accounts: readonly unknown[]): void {
  storage.homeAccountStore = {
    accounts,
    activeAccountId: (accounts[0] as { id: string } | undefined)?.id ?? null,
  };
}

describe("popup account list", () => {
  beforeEach(() => {
    storage = {};
    storageListeners = [];
    backgroundReachable = true;
    backgroundGate = null;
    grantedOrigins = ["<all_urls>"];
    setupPopupMarkup();
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async (key: string) =>
            key in storage ? { [key]: storage[key] } : {},
          set: async (items: Record<string, unknown>) => {
            Object.assign(storage, items);
            notifyStorageListeners(
              Object.fromEntries(
                Object.entries(items).map(([key, value]) => [key, { newValue: value }]),
              ),
            );
          },
          remove: async (key: string) => {
            delete storage[key];
            notifyStorageListeners({ [key]: {} });
          },
        },
        onChanged: {
          addListener: (listener: StorageListener) => {
            storageListeners.push(listener);
          },
        },
      },
      runtime: {
        sendMessage: async (message: MastodonActionRequest) => {
          if (!backgroundReachable) {
            throw new Error("Receiving end does not exist");
          }
          if (backgroundGate !== null) await backgroundGate;
          return await handleMastodonActionRequest(message);
        },
        getURL: (path: string) => `moz-extension://test/${path}`,
      },
      i18n: { getMessage: (key: string) => key },
      tabs: { create: async () => {} },
      permissions: {
        getAll: async () => ({ permissions: [], origins: grantedOrigins }),
      },
    });
  });

  it.each([
    ["with a token", "token", "authStateAuthenticated"],
    ["without a token", undefined, "authStateUnauthenticated"],
  ])("shows the auth state of an account %s", async (_name, accessToken, expected) => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = { ...CREDENTIALS, accessToken };

    await refreshAccountList();
    expect(textOf(accountItems()[0]!, ".account-meta")).toContain(expected);
  });

  it("shows an error for an account when the background script cannot be reached", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    backgroundReachable = false;

    await refreshAccountList();
    expect(textOf(accountItems()[0]!, ".account-meta")).toContain("authStateError");
  });

  it("offers re-authentication and logout when authenticated", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = CREDENTIALS;

    await refreshAccountList();
    expect(buttonLabels(accountItems()[0]!)).toEqual([
      "accountReauthenticateButton",
      "accountLogoutButton",
    ]);
  });

  it("offers login when unauthenticated", async () => {
    storeAccounts([MASTODON_ACCOUNT]);

    await refreshAccountList();
    expect(buttonLabels(accountItems()[0]!)).toEqual(["accountLoginButton"]);
  });

  it("offers nothing for a mock account, which has nowhere to authenticate", async () => {
    storeAccounts([MOCK_ACCOUNT]);

    await refreshAccountList();
    expect(buttonLabels(accountItems()[0]!)).toEqual([]);
  });

  it("explains why no buttons appear when the active account is unauthenticated", async () => {
    storeAccounts([MASTODON_ACCOUNT]);

    await refreshAccountList();
    expect(notice().textContent).toBe("popupActiveAccountNotUsable");
    expect(notice().classList).not.toContain("hidden");
  });

  it("reports a missing permission to run on pages ahead of the auth state", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    grantedOrigins = [];

    await refreshAccountList();
    expect(notice().textContent).toBe("popupNoHostAccess");
    expect(notice().classList).toContain("error");
  });

  it("shows no reason when the active account is authenticated", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = CREDENTIALS;

    await refreshAccountList();
    expect(notice().classList).toContain("hidden");
  });

  it("logging out deletes the access token alone", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = CREDENTIALS;
    await refreshAccountList();

    clickAuthButton(accountItems()[0]!, "accountLogoutButton");

    await vi.waitFor(() => {
      expect(storage[CREDENTIALS_KEY]).toEqual({
        ...CREDENTIALS,
        accessToken: undefined,
      });
      // The state shown follows from the token being gone.
      expect(textOf(accountItems()[0]!, ".account-meta")).toContain(
        "authStateUnauthenticated",
      );
    });
  });

  it("reflects a switch of the active account in the list", async () => {
    storeAccounts([MASTODON_ACCOUNT, MOCK_ACCOUNT]);
    await setupAccountListView();

    accountItems()[1]?.querySelector<HTMLInputElement>(".account-radio")?.click();

    await vi.waitFor(() => {
      expect(accountItems().map((item) => item.classList.contains("active"))).toEqual(
        [false, true],
      );
    });
  });

  it("does not let a render started earlier overwrite one started later", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    let releaseBackground = (): void => {};
    backgroundGate = new Promise((resolve) => {
      releaseBackground = resolve;
    });
    const earlierRender = refreshAccountList();

    storeAccounts([]);
    await refreshAccountList();
    releaseBackground();
    await earlierRender;

    expect(accountItems()).toHaveLength(0);
  });

  it("leaves no credentials behind when an account is removed", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = CREDENTIALS;
    await setupAccountListView();

    accountItems()[0]?.querySelector<HTMLButtonElement>(".account-remove")?.click();

    await vi.waitFor(() => {
      expect(accountItems()).toHaveLength(0);
      expect(CREDENTIALS_KEY in storage).toBe(false);
    });
  });

  it("can remove an account whose configuration cannot be built", async () => {
    // A mock account under the release build fails the same way, but the build
    // flag is fixed at compile time, so a Mastodon account missing its instance
    // stands in for it.
    storeAccounts([{ id: "m2", software: "mastodon", label: "broken" }]);
    await setupAccountListView();

    accountItems()[0]?.querySelector<HTMLButtonElement>(".account-remove")?.click();

    await vi.waitFor(() => {
      expect(accountItems()).toHaveLength(0);
    });
  });
});
