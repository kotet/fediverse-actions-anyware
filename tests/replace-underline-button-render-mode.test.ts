import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReplaceUnderlineButtonRenderMode } from "../src/button-render-modes";
import type {
  ActionButtonReplacer,
  ActionButtonSpec,
  ButtonKind,
  ExtractedPost,
  PostActionKind,
} from "../src/core";

/**
 * Stands in for a page adapter's substitution capability.
 *
 * Returns plain buttons instead of clones of real markup, which keeps this suite
 * free of any host page fixture — site-specific behavior is covered by the adapter's
 * own tests.
 */
class FakeActionButtonReplacer implements ActionButtonReplacer {
  readonly replacedKinds: ButtonKind[] = [];
  restoreCallCount = 0;
  private readonly missingKinds: ReadonlySet<ButtonKind>;

  constructor(missingKinds: readonly ButtonKind[] = []) {
    this.missingKinds = new Set(missingKinds);
  }

  replaceActionButton(post: ExtractedPost, kind: ButtonKind): HTMLElement | null {
    if (this.missingKinds.has(kind)) return null;
    this.replacedKinds.push(kind);
    const substitute = document.createElement("button");
    substitute.type = "button";
    post.insertionTarget.append(substitute);
    return substitute;
  }

  restoreActionButtons(post: ExtractedPost): void {
    this.restoreCallCount += 1;
    post.insertionTarget.replaceChildren();
  }
}

const ACTION_KINDS: readonly PostActionKind[] = [
  "favourite",
  "boost",
  "bookmark",
  "open-home",
];

function createPost(): ExtractedPost {
  const actionBar = document.createElement("div");
  document.body.append(actionBar);
  return {
    postUrl: "https://example.test/@user/1",
    existingButtons: {},
    insertionTarget: actionBar,
  };
}

function createActions(): ActionButtonSpec[] {
  return ACTION_KINDS.map((kind) => ({ kind, label: kind, onClick: vi.fn() }));
}

function substitutesIn(post: ExtractedPost): HTMLButtonElement[] {
  return Array.from(post.insertionTarget.querySelectorAll("button"));
}

describe("ReplaceUnderlineButtonRenderMode", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.stubGlobal("browser", {
      i18n: {
        getMessage: (key: string, substitutions?: string | string[]): string =>
          `${key}:${String(substitutions)}`,
      },
    });
  });

  it("モード種別が replace-underline である", () => {
    expect(new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).mode).toBe(
      "replace-underline",
    );
  });

  it("元ボタンのあるアクションすべてを置き換える", () => {
    const replacer = new FakeActionButtonReplacer();
    new ReplaceUnderlineButtonRenderMode(replacer).render(createPost(), createActions());
    expect(replacer.replacedKinds).toEqual(["favourite", "boost", "bookmark"]);
  });

  it("open-home は対応する元ボタンがないため置き換えない", () => {
    const replacer = new FakeActionButtonReplacer();
    new ReplaceUnderlineButtonRenderMode(replacer).render(createPost(), createActions());
    expect(replacer.replacedKinds).not.toContain("open-home");
  });

  it("置き換えられない種別は読み飛ばす", () => {
    const replacer = new FakeActionButtonReplacer(["bookmark"]);
    new ReplaceUnderlineButtonRenderMode(replacer).render(createPost(), createActions());
    expect(replacer.replacedKinds).toEqual(["favourite", "boost"]);
  });

  it("描画のたびに先に元の状態へ戻す", () => {
    const replacer = new FakeActionButtonReplacer();
    const post = createPost();
    const renderMode = new ReplaceUnderlineButtonRenderMode(replacer);
    renderMode.render(post, createActions());
    renderMode.render(post, createActions());
    expect(replacer.restoreCallCount).toBe(2);
    expect(substitutesIn(post)).toHaveLength(3);
  });

  it("置き換えたボタンに下線用のクラスを付ける", () => {
    const post = createPost();
    new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
      post,
      createActions(),
    );
    for (const substitute of substitutesIn(post)) {
      expect(substitute.classList).toContain("faa-button");
    }
  });

  it("title と aria-label をホームアカウント用の文言で上書きする", () => {
    const post = createPost();
    new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
      post,
      createActions(),
    );
    const substitute = substitutesIn(post)[0];
    expect(substitute?.title).toBe("actionButtonHomeAccountTitle:favourite");
    expect(substitute?.getAttribute("aria-label")).toBe(
      "actionButtonHomeAccountTitle:favourite",
    );
  });

  it("クリックすると対応するアクションを1回だけ実行する", () => {
    const post = createPost();
    const actions = createActions();
    new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(post, actions);
    substitutesIn(post)[0]?.click();
    expect(actions[0]?.onClick).toHaveBeenCalledTimes(1);
    expect(actions[1]?.onClick).not.toHaveBeenCalled();
  });

  it.each(["mousedown", "mouseup", "click"])(
    "%s イベントを祖先へ伝播させない",
    (eventType) => {
      const post = createPost();
      const ancestorListener = vi.fn();
      document.body.addEventListener(eventType, ancestorListener);
      new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
        post,
        createActions(),
      );
      substitutesIn(post)[0]?.dispatchEvent(new MouseEvent(eventType, { bubbles: true }));
      expect(ancestorListener).not.toHaveBeenCalled();
      document.body.removeEventListener(eventType, ancestorListener);
    },
  );

  it("再描画すると新しいアクションが実行される", () => {
    const post = createPost();
    const staleActions = createActions();
    const freshActions = createActions();
    const renderMode = new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer());
    renderMode.render(post, staleActions);
    renderMode.render(post, freshActions);
    substitutesIn(post)[0]?.click();
    expect(freshActions[0]?.onClick).toHaveBeenCalledTimes(1);
    expect(staleActions[0]?.onClick).not.toHaveBeenCalled();
  });
});
