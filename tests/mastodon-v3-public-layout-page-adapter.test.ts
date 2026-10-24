import { describe, expect, it } from "vitest";
import type { ButtonKind, ExtractedPost } from "../src/core";
import { supportsActionButtonReplacement } from "../src/core";
import { MastodonV3PublicLayoutPageAdapter } from "../src/page-adapters";
import { APP_SHELL } from "./fixtures/status-page-markup";
import { V3_PUBLIC_TIMELINE_PAGE, V3_STATUS_PAGE } from "./fixtures/v3-public-layout-markup";

/** Loads `markup` and returns the posts the adapter extracts from it. */
function extractFrom(markup: string): ExtractedPost[] {
  document.body.innerHTML = markup;
  return new MastodonV3PublicLayoutPageAdapter().extractPosts();
}

/** The kinds of host link the adapter found on `post`, in a stable order. */
function kindsOf(post: ExtractedPost | undefined): ButtonKind[] {
  return Object.keys(post?.existingButtons ?? {}).sort() as ButtonKind[];
}

/** Finds the post whose URL is `postUrl`, failing the test if there is none. */
function postAt(posts: ExtractedPost[], postUrl: string): ExtractedPost {
  const post = posts.find((candidate) => candidate.postUrl === postUrl);
  if (post === undefined) throw new Error(`no post at ${postUrl}`);
  return post;
}

describe("MastodonV3PublicLayoutPageAdapter", () => {
  it.each([
    ["a 3.x status page", V3_STATUS_PAGE, true],
    ["the 3.x public timeline", V3_PUBLIC_TIMELINE_PAGE, true],
    ["the 4.x web client", APP_SHELL, false],
    ["a public-layout without a boot payload", "<div class='public-layout'></div>", false],
    ["a page that is not Mastodon", "<article><p>Not Mastodon</p></article>", false],
  ])("isSupportedPage: %s -> %s", (_case, markup, expected) => {
    document.body.innerHTML = markup;
    expect(new MastodonV3PublicLayoutPageAdapter().isSupportedPage()).toBe(expected);
  });

  it.each([
    ["a page served to a signed-out visitor", V3_STATUS_PAGE, false],
    [
      "a page whose payload has meta.me",
      `<script id="initial-state" type="application/json">{"meta":{"me":"1"}}</script>`,
      true,
    ],
  ])("hasSignedInSession: %s -> %s", (_case, markup, expected) => {
    document.body.innerHTML = markup;
    expect(new MastodonV3PublicLayoutPageAdapter().hasSignedInSession()).toBe(expected);
  });

  it.each([
    // A reply shows `fa-reply-all` instead of `fa-reply`; both are the reply action.
    ["https://mstdn.nere9.help/@alice/100000000000000001", ["boost", "favourite", "reply"]],
    ["https://mstdn.nere9.help/@alice/100000000000000002", ["boost", "favourite", "reply"]],
    // A followers-only post shows a lock where the boost arrows would be.
    ["https://mstdn.nere9.help/@bob/100000000000000003", ["favourite", "reply"]],
  ])("extracts %s with the actions %j from a status page", (postUrl, kinds) => {
    const posts = extractFrom(V3_STATUS_PAGE);
    expect(posts).toHaveLength(3);
    expect(kindsOf(postAt(posts, postUrl))).toEqual(kinds);
  });

  it("extracts a timeline post by its original URL, without a reply action", () => {
    const posts = extractFrom(V3_PUBLIC_TIMELINE_PAGE);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.postUrl).toBe("https://remote.example/@carol/200000000000000001");
    expect(kindsOf(posts[0])).toEqual(["boost", "favourite"]);
  });

  it("hides the original link and cuts the copy off from the host's remote interaction", () => {
    const adapter = new MastodonV3PublicLayoutPageAdapter();
    const post = postAt(
      extractFrom(V3_STATUS_PAGE),
      "https://mstdn.nere9.help/@alice/100000000000000002",
    );
    const original = post.existingButtons.favourite;
    const substitute = adapter.replaceActionButton(post, "favourite");

    expect(substitute).not.toBe(original);
    expect(substitute?.querySelector("i")?.classList).toContain("fa-star");
    expect(substitute?.classList).not.toContain("modal-button");
    // Without it, neither a middle click nor the context menu reaches the host's page.
    expect(substitute?.hasAttribute("href")).toBe(false);
    expect(substitute?.getAttribute("role")).toBe("button");
    expect(substitute?.tabIndex).toBe(0);
    expect(original?.isConnected).toBe(true);
    expect(original?.style.display).toBe("none");
    // A re-render scans the same action bar and must not take the copy for the host's.
    expect(adapter.extractPosts()).toContainEqual(
      expect.objectContaining({
        existingButtons: expect.objectContaining({ favourite: original }),
      }),
    );

    adapter.restoreActionButtons(post);
    expect(substitute?.isConnected).toBe(false);
    expect(original?.style.display).toBe("");
  });

  it.each([
    ["Enter", 1],
    [" ", 1],
    ["a", 0],
  ])("the key %j clicks a copied link %i time(s)", (key, clicks) => {
    const adapter = new MastodonV3PublicLayoutPageAdapter();
    const post = extractFrom(V3_PUBLIC_TIMELINE_PAGE)[0];
    if (post === undefined) throw new Error("fixture broken");
    const substitute = adapter.replaceActionButton(post, "favourite");
    if (substitute === null) throw new Error("fixture broken");
    let clicked = 0;
    substitute.addEventListener("click", () => {
      clicked += 1;
    });

    const event = new KeyboardEvent("keydown", { key, cancelable: true });
    substitute.dispatchEvent(event);
    expect(clicked).toBe(clicks);
    // Space must not also scroll the page.
    expect(event.defaultPrevented).toBe(clicks > 0);
  });

  it("returns null for a kind the post has no link for", () => {
    const post = extractFrom(V3_PUBLIC_TIMELINE_PAGE)[0];
    if (post === undefined) throw new Error("fixture broken");
    expect(new MastodonV3PublicLayoutPageAdapter().replaceActionButton(post, "reply")).toBeNull();
  });

  it("supports action button replacement", () => {
    expect(supportsActionButtonReplacement(new MastodonV3PublicLayoutPageAdapter())).toBe(
      true,
    );
  });
});
