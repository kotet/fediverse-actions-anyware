import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleMastodonActionRequest } from "../src/background/mastodon-action-handler";
import type { MastodonActionRequest } from "../src/mastodon";
import { refreshAccountList } from "../src/popup/account-list-view";

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

let storage: Record<string, unknown>;
/** Set to make the background unreachable, as it is while the extension reloads. */
let backgroundReachable: boolean;
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
  if (button === undefined) throw new Error(`${label} のボタンが無い`);
  button.click();
}

function notice(): HTMLElement {
  const element = document.getElementById("account-list-notice");
  if (element === null) throw new Error("通知欄が無い");
  return element;
}

/** Puts `accounts` in the store with the first one active. */
function storeAccounts(accounts: readonly unknown[]): void {
  storage.homeAccountStore = {
    accounts,
    activeAccountId: (accounts[0] as { id: string } | undefined)?.id ?? null,
  };
}

describe("ポップアップのアカウント一覧", () => {
  beforeEach(() => {
    storage = {};
    backgroundReachable = true;
    grantedOrigins = ["<all_urls>"];
    setupPopupMarkup();
    vi.stubGlobal("browser", {
      storage: {
        local: {
          get: async (key: string) =>
            key in storage ? { [key]: storage[key] } : {},
          set: async (items: Record<string, unknown>) => {
            Object.assign(storage, items);
          },
          remove: async (key: string) => {
            delete storage[key];
          },
        },
        onChanged: { addListener: () => {} },
      },
      runtime: {
        sendMessage: async (message: MastodonActionRequest) => {
          if (!backgroundReachable) {
            throw new Error("Receiving end does not exist");
          }
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
    ["トークンがあれば", "token", "authStateAuthenticated"],
    ["トークンが無ければ", undefined, "authStateUnauthenticated"],
  ])("認証状態は %s %s と表示する", async (_name, accessToken, expected) => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = { ...CREDENTIALS, accessToken };

    await refreshAccountList();
    expect(textOf(accountItems()[0]!, ".account-meta")).toContain(expected);
  });

  it("バックグラウンドへ届かないアカウントはエラーとして表示する", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    backgroundReachable = false;

    await refreshAccountList();
    expect(textOf(accountItems()[0]!, ".account-meta")).toContain("authStateError");
  });

  it("認証済みなら再認証とログアウトの導線を出す", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = CREDENTIALS;

    await refreshAccountList();
    expect(buttonLabels(accountItems()[0]!)).toEqual([
      "accountReauthenticateButton",
      "accountLogoutButton",
    ]);
  });

  it("未認証ならログインの導線を出す", async () => {
    storeAccounts([MASTODON_ACCOUNT]);

    await refreshAccountList();
    expect(buttonLabels(accountItems()[0]!)).toEqual(["accountLoginButton"]);
  });

  it("認証する相手のないモックアカウントには導線を出さない", async () => {
    storeAccounts([MOCK_ACCOUNT]);

    await refreshAccountList();
    expect(buttonLabels(accountItems()[0]!)).toEqual([]);
  });

  it("アクティブなアカウントが未認証ならボタンが出ない理由を示す", async () => {
    storeAccounts([MASTODON_ACCOUNT]);

    await refreshAccountList();
    expect(notice().textContent).toBe("popupActiveAccountNotUsable");
    expect(notice().classList).not.toContain("hidden");
  });

  it("ページで動作する権限が無ければ、認証状態より先にそれを伝える", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    grantedOrigins = [];

    await refreshAccountList();
    expect(notice().textContent).toBe("popupNoHostAccess");
    expect(notice().classList).toContain("error");
  });

  it("アクティブなアカウントが認証済みなら理由を示さない", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = CREDENTIALS;

    await refreshAccountList();
    expect(notice().classList).toContain("hidden");
  });

  it("ログアウトはアクセストークンだけを消す", async () => {
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

  it("アカウントを削除すると資格情報も残さない", async () => {
    storeAccounts([MASTODON_ACCOUNT]);
    storage[CREDENTIALS_KEY] = CREDENTIALS;
    await refreshAccountList();

    accountItems()[0]?.querySelector<HTMLButtonElement>(".account-remove")?.click();

    await vi.waitFor(() => {
      expect(accountItems()).toHaveLength(0);
      expect(CREDENTIALS_KEY in storage).toBe(false);
    });
  });
});
