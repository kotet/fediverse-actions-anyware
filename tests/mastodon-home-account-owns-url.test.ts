import { describe, expect, it } from "vitest";
import { MastodonHomeAccount } from "../src/mastodon";
import { MockHomeAccount } from "../src/mocks";

/**
 * Covers the check the content script uses to stay out of the way on pages of an
 * instance the user is logged in to. Nothing here touches the network or storage,
 * which is what lets the caller ask it about every registered account.
 */

const account = new MastodonHomeAccount("m1", "home.example");

describe("MastodonHomeAccount.ownsUrl", () => {
  it.each([
    ["投稿URL", "https://home.example/@someone/1", true],
    ["ホスト名の大文字小文字は無視する", "https://HOME.example/@someone/1", true],
    ["ポートは無視する", "https://home.example:8443/", true],
    ["別インスタンス", "https://remote.example/@someone/1", false],
    ["サブドメインは別ホスト", "https://www.home.example/", false],
    ["ホスト名を含むだけのパス", "https://remote.example/home.example", false],
    ["URLとして解釈できない文字列", "not a url", false],
  ])("%s: %s → %s", (_name, url, expected) => {
    expect(account.ownsUrl(url)).toBe(expected);
  });

  it("インスタンス名に余分な区切りが付いていても比較できる", () => {
    const withTrailingSlash = new MastodonHomeAccount("m1", "home.example/");
    expect(withTrailingSlash.ownsUrl("https://home.example/")).toBe(true);
  });
});

describe("MockHomeAccount.ownsUrl", () => {
  it("どのページも自インスタンス扱いしない", () => {
    const mock = new MockHomeAccount();
    expect(mock.ownsUrl("https://home.example/")).toBe(false);
    expect(mock.ownsUrl(location.href)).toBe(false);
  });
});
