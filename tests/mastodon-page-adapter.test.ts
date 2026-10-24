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
    it("detects a Mastodon page (with a #mastodon element)", () => {
      document.body.innerHTML = statusPageFixture;
      expect(new MastodonPageAdapter().isSupportedPage()).toBe(true);
    });

    it("does not detect a non-Mastodon page (without a #mastodon element)", () => {
      document.body.innerHTML = "<article><p>Not Mastodon</p></article>";
      expect(new MastodonPageAdapter().isSupportedPage()).toBe(false);
    });
  });

  describe("hasSignedInSession", () => {
    /**
     * Places the boot payload Mastodon's server writes into the document, or
     * leaves the document without one when `payload` is `null`.
     */
    function setInitialState(payload: string | null): void {
      document.body.innerHTML = "";
      if (payload === null) return;
      const element = document.createElement("script");
      element.type = "application/json";
      element.id = "initial-state";
      element.textContent = payload;
      document.body.append(element);
    }

    it("judges a page whose payload has meta.me as signed in", () => {
      setInitialState(JSON.stringify({ meta: { me: "109252080473231374" } }));
      expect(new MastodonPageAdapter().hasSignedInSession()).toBe(true);
    });

    it("judges a page served to a signed-out visitor (the fixture) as signed out", () => {
      document.body.innerHTML = statusPageFixture;
      // The capture does carry a payload; what it lacks is an account in it.
      expect(document.getElementById("initial-state")).not.toBeNull();
      expect(new MastodonPageAdapter().hasSignedInSession()).toBe(false);
    });

    it.each([
      ["has no payload", null],
      ["has a payload that is broken JSON", "{"],
      ["has no meta", "{}"],
      ["has no meta.me", JSON.stringify({ meta: { access_token: null } })],
      ["has a meta.me that is not a string", JSON.stringify({ meta: { me: null } })],
    ])("treats a page that %s as signed out", (_case, payload) => {
      setInitialState(payload);
      expect(new MastodonPageAdapter().hasSignedInSession()).toBe(false);
    });
  });

  describe("extractPosts", () => {
    beforeEach(() => {
      document.body.innerHTML = statusPageFixture;
    });

    it("extracts all three posts", () => {
      const posts = new MastodonPageAdapter().extractPosts();
      expect(posts).toHaveLength(3);
    });

    it("reads the URL of the main post", () => {
      const posts = new MastodonPageAdapter().extractPosts();
      expect(posts[0]?.postUrl).toBe(
        "https://mastodon.archive.org/@internetarchive/116818894033044875",
      );
    });

    it("reads the URLs of all the thread replies", () => {
      const posts = new MastodonPageAdapter().extractPosts();
      expect(posts[1]?.postUrl).toBe(
        "https://mastodon.archive.org/@internetarchive/116818894061160135",
      );
      expect(posts[2]?.postUrl).toBe(
        "https://mastodon.archive.org/@internetarchive/116818894089254210",
      );
    });

    it("finds all five action buttons of the main post", () => {
      const buttons = new MastodonPageAdapter().extractPosts()[0]?.existingButtons;
      expect(buttons?.reply).toBeInstanceOf(HTMLButtonElement);
      expect(buttons?.boost).toBeInstanceOf(HTMLButtonElement);
      expect(buttons?.favourite).toBeInstanceOf(HTMLButtonElement);
      expect(buttons?.bookmark).toBeInstanceOf(HTMLButtonElement);
      expect(buttons?.more).toBeInstanceOf(HTMLButtonElement);
    });

    it("finds all five action buttons of each thread reply", () => {
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

    it("finds each button by the icon class of its kind", () => {
      const buttons = new MastodonPageAdapter().extractPosts()[0]?.existingButtons;
      expect(buttons?.reply?.querySelector("svg")?.classList).toContain("icon-reply");
      expect(buttons?.boost?.querySelector("svg")?.classList).toContain("icon-retweet");
      expect(buttons?.favourite?.querySelector("svg")?.classList).toContain("icon-star");
      expect(buttons?.bookmark?.querySelector("svg")?.classList).toContain("icon-bookmark");
      expect(buttons?.more?.querySelector("svg")?.classList).toContain("icon-ellipsis-h");
    });

    it("does not take a button the extension put in for a host button", () => {
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

    it("returns a separate element carrying the original button's icon", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      if (post === undefined) throw new Error("fixture broken");
      const substitute = adapter.replaceActionButton(post, "favourite");
      expect(substitute).not.toBe(post.existingButtons.favourite);
      expect(substitute?.querySelector("svg")?.classList).toContain("icon-star");
    });

    it("hides the original button instead of removing it", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      const original = post?.existingButtons.favourite;
      if (post === undefined || original === undefined) throw new Error("fixture broken");
      adapter.replaceActionButton(post, "favourite");
      expect(original.isConnected).toBe(true);
      expect(original.style.display).toBe("none");
    });

    it("makes a disabled bookmark button usable", () => {
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

    it("returns null for a kind the post has no button for", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      if (post === undefined) throw new Error("fixture broken");
      const withoutButtons = { ...post, existingButtons: {} };
      expect(adapter.replaceActionButton(withoutButtons, "favourite")).toBeNull();
    });

    it("does not carry over the host's look for an action already taken", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      const original = post?.existingButtons.favourite;
      if (post === undefined || original === undefined) throw new Error("fixture broken");
      // A visitor logged in to the target instance sees its own state marked here,
      // which says nothing about the home account the copy acts as.
      original.classList.add("active");

      expect(adapter.replaceActionButton(post, "favourite")?.classList).not.toContain(
        "active",
      );
    });
  });

  describe("setActionButtonActive", () => {
    beforeEach(() => {
      document.body.innerHTML = statusPageFixture;
    });

    it("shows an action in effect with the host's own class", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      if (post === undefined) throw new Error("fixture broken");
      const substitute = adapter.replaceActionButton(post, "favourite");
      if (substitute === null) throw new Error("fixture broken");

      adapter.setActionButtonActive(substitute, true);
      expect(substitute.classList).toContain("active");
      // The kind-specific color comes from the class the host button already
      // carries, so nothing else has to be copied.
      expect(substitute.classList).toContain("star-icon");

      adapter.setActionButtonActive(substitute, false);
      expect(substitute.classList).not.toContain("active");
    });
  });

  describe("restoreActionButtons", () => {
    beforeEach(() => {
      document.body.innerHTML = statusPageFixture;
    });

    it("removes the substitutes and shows the original buttons again", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      const original = post?.existingButtons.favourite;
      if (post === undefined || original === undefined) throw new Error("fixture broken");
      const substitute = adapter.replaceActionButton(post, "favourite");

      adapter.restoreActionButtons(post);
      expect(substitute?.isConnected).toBe(false);
      expect(original.style.display).toBe("");
    });

    it("is safe to call when nothing has been replaced", () => {
      const adapter = new MastodonPageAdapter();
      const post = adapter.extractPosts()[0];
      if (post === undefined) throw new Error("fixture broken");
      expect(() => adapter.restoreActionButtons(post)).not.toThrow();
    });
  });

  describe("supportsActionButtonReplacement", () => {
    it("MastodonPageAdapter supports replacement", () => {
      expect(supportsActionButtonReplacement(new MastodonPageAdapter())).toBe(true);
    });

    it("MockPageAdapter does not support replacement", () => {
      expect(supportsActionButtonReplacement(new MockPageAdapter())).toBe(false);
    });
  });
});
