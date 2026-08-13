import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { MastodonPageAdapter } from "../src/page-adapters/mastodon-page-adapter";

const statusPageFixture = readFileSync(
  resolve(import.meta.dirname, "fixtures/mastodon-status-page.html"),
  "utf8",
);

describe("MastodonPageAdapter", () => {
  describe("isSupportedPage", () => {
    it("Mastodon ページ (#mastodon 要素あり) を検出する", () => {
      document.body.innerHTML = statusPageFixture;
      expect(new MastodonPageAdapter().isSupportedPage()).toBe(true);
    });

    it("非 Mastodon ページ (#mastodon 要素なし) は検出しない", () => {
      document.body.innerHTML = "<article><p>Not Mastodon</p></article>";
      expect(new MastodonPageAdapter().isSupportedPage()).toBe(false);
    });
  });

  describe("extractPosts", () => {
    beforeEach(() => {
      document.body.innerHTML = statusPageFixture;
    });

    it("3件の投稿をすべて抽出する", () => {
      const posts = new MastodonPageAdapter().extractPosts();
      expect(posts).toHaveLength(3);
    });

    it("メイン投稿のURLを正しく取得する", () => {
      const posts = new MastodonPageAdapter().extractPosts();
      expect(posts[0]?.postUrl).toBe(
        "https://mastodon.archive.org/@internetarchive/116818894033044875",
      );
    });

    it("スレッドリプライのURLをすべて正しく取得する", () => {
      const posts = new MastodonPageAdapter().extractPosts();
      expect(posts[1]?.postUrl).toBe(
        "https://mastodon.archive.org/@internetarchive/116818894061160135",
      );
      expect(posts[2]?.postUrl).toBe(
        "https://mastodon.archive.org/@internetarchive/116818894089254210",
      );
    });

    it("メイン投稿のアクションボタンを5種すべて取得する", () => {
      const buttons = new MastodonPageAdapter().extractPosts()[0]?.existingButtons;
      expect(buttons?.reply).toBeInstanceOf(HTMLButtonElement);
      expect(buttons?.boost).toBeInstanceOf(HTMLButtonElement);
      expect(buttons?.favourite).toBeInstanceOf(HTMLButtonElement);
      expect(buttons?.bookmark).toBeInstanceOf(HTMLButtonElement);
      expect(buttons?.more).toBeInstanceOf(HTMLButtonElement);
    });

    it("スレッドリプライのアクションボタンを5種すべて取得する", () => {
      const posts = new MastodonPageAdapter().extractPosts();
      for (const post of [posts[1], posts[2]]) {
        const buttons = post?.existingButtons;
        expect(buttons?.reply).toBeInstanceOf(HTMLButtonElement);
        expect(buttons?.boost).toBeInstanceOf(HTMLButtonElement);
        expect(buttons?.favourite).toBeInstanceOf(HTMLButtonElement);
        expect(buttons?.bookmark).toBeInstanceOf(HTMLButtonElement);
        expect(buttons?.more).toBeInstanceOf(HTMLButtonElement);
      }
    });

    it("各ボタン要素が対応するアイコンクラスを持つ", () => {
      const buttons = new MastodonPageAdapter().extractPosts()[0]?.existingButtons;
      expect(buttons?.reply?.querySelector("svg")?.classList).toContain("icon-reply");
      expect(buttons?.boost?.querySelector("svg")?.classList).toContain("icon-retweet");
      expect(buttons?.favourite?.querySelector("svg")?.classList).toContain("icon-star");
      expect(buttons?.bookmark?.querySelector("svg")?.classList).toContain("icon-bookmark");
      expect(buttons?.more?.querySelector("svg")?.classList).toContain("icon-ellipsis-h");
    });
  });
});
