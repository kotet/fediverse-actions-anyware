import { readFileSync } from "fs";
import { resolve } from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { supportsActionButtonReplacement } from "../src/core";
import { MockPageAdapter } from "../src/mocks";
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

    it("拡張が置き換えたボタンを既存ボタンとして扱わない", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      const original = post?.existingButtons.favourite;
      if (post === undefined || original === undefined) throw new Error("fixture broken");
      adapter.replaceActionButton(post, "favourite");

      const reextracted = adapter.extractPosts()[0]?.existingButtons.favourite;
      expect(reextracted).toBe(original);
    });
  });

  describe("replaceActionButton", () => {
    beforeEach(() => {
      document.body.innerHTML = statusPageFixture;
    });

    it("元ボタンのアイコンを引き継いだ別の要素を返す", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      if (post === undefined) throw new Error("fixture broken");
      const substitute = adapter.replaceActionButton(post, "favourite");
      expect(substitute).not.toBe(post.existingButtons.favourite);
      expect(substitute?.querySelector("svg")?.classList).toContain("icon-star");
    });

    it("元ボタンを削除せず非表示にする", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      const original = post?.existingButtons.favourite;
      if (post === undefined || original === undefined) throw new Error("fixture broken");
      adapter.replaceActionButton(post, "favourite");
      expect(original.isConnected).toBe(true);
      expect(original.style.display).toBe("none");
    });

    it("無効化されたブックマークボタンを操作可能にする", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      if (post === undefined) throw new Error("fixture broken");
      // The fixture is an anonymous view, where Mastodon disables bookmarking.
      expect(post.existingButtons.bookmark?.hasAttribute("disabled")).toBe(true);

      const substitute = adapter.replaceActionButton(post, "bookmark");
      expect(substitute?.hasAttribute("disabled")).toBe(false);
      expect(substitute?.classList).not.toContain("disabled");
      expect((substitute as HTMLButtonElement | null)?.disabled).toBe(false);
    });

    it("元ボタンがない種別では null を返す", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      if (post === undefined) throw new Error("fixture broken");
      const withoutButtons = { ...post, existingButtons: {} };
      expect(adapter.replaceActionButton(withoutButtons, "favourite")).toBeNull();
    });
  });

  describe("restoreActionButtons", () => {
    beforeEach(() => {
      document.body.innerHTML = statusPageFixture;
    });

    it("置き換えた要素を取り除き元ボタンを再表示する", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      const original = post?.existingButtons.favourite;
      if (post === undefined || original === undefined) throw new Error("fixture broken");
      const substitute = adapter.replaceActionButton(post, "favourite");

      adapter.restoreActionButtons(post);
      expect(substitute?.isConnected).toBe(false);
      expect(original.style.display).toBe("");
    });

    it("何も置き換えていない状態で呼んでも安全である", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      if (post === undefined) throw new Error("fixture broken");
      expect(() => adapter.restoreActionButtons(post)).not.toThrow();
    });
  });

  describe("supportsActionButtonReplacement", () => {
    it("MastodonPageAdapter は置き換えに対応している", () => {
      expect(supportsActionButtonReplacement(new MastodonPageAdapter())).toBe(true);
    });

    it("MockPageAdapter は置き換えに対応していない", () => {
      expect(supportsActionButtonReplacement(new MockPageAdapter())).toBe(false);
    });
  });
});
