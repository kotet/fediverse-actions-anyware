import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ReplaceUnderlineButtonRenderMode } from "../src/button-render-modes";
import type {
  ActionButtonReplacer,
  ActionButtonSpec,
  ButtonKind,
  ExtractedPost,
  PostActionKind,
} from "../src/core";

/**
 * Stands in for a page adapter's button replacement capability.
 *
 * Returns plain buttons instead of clones of real markup, which keeps this suite
 * free of any host page fixture — site-specific behavior is covered by the adapter's
 * own tests.
 */
class FakeActionButtonReplacer implements ActionButtonReplacer {
  readonly replacedKinds: ButtonKind[] = [];
  restoreCallCount = 0;

  /** Kinds this replacer reports it has no host button for, as a real adapter does per post. */
  private readonly missingKinds: ReadonlySet<string>;

  constructor(missingKinds: readonly PostActionKind[] = []) {
    this.missingKinds = new Set(missingKinds);
  }

  replaceActionButton(post: ExtractedPost, kind: ButtonKind): HTMLElement | null {
    if (this.missingKinds.has(kind)) return null;
    this.replacedKinds.push(kind);
    const button = document.createElement("button");
    button.type = "button";
    post.insertionTarget.append(button);
    return button;
  }

  restoreActionButtons(post: ExtractedPost): void {
    this.restoreCallCount += 1;
    post.insertionTarget.replaceChildren();
  }
}

const ACTION_KINDS: readonly PostActionKind[] = [
  "reply",
  "favourite",
  "boost",
  "bookmark",
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

/** An action button spec whose handler records the calls made to it. */
type SpiedAction = ActionButtonSpec & { readonly onClick: Mock<() => void> };

function createActions(): SpiedAction[] {
  return ACTION_KINDS.map((kind) => ({
    kind,
    label: kind,
    onClick: vi.fn<() => void>(),
  }));
}

function clickCounts(actions: readonly SpiedAction[]): number[] {
  return actions.map((action) => action.onClick.mock.calls.length);
}

function buttonsIn(post: ExtractedPost): HTMLButtonElement[] {
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

  it("アクションすべてを元ボタンの置き換えで描画する", () => {
    const replacer = new FakeActionButtonReplacer();
    new ReplaceUnderlineButtonRenderMode(replacer).render(createPost(), createActions());
    expect(replacer.replacedKinds).toEqual(["reply", "favourite", "boost", "bookmark"]);
  });

  it("元ボタンのない種別は読み飛ばす", () => {
    const replacer = new FakeActionButtonReplacer(["bookmark"]);
    const post = createPost();
    new ReplaceUnderlineButtonRenderMode(replacer).render(post, createActions());
    expect(buttonsIn(post)).toHaveLength(ACTION_KINDS.length - 1);
  });

  it("描画のたびに先に元の状態へ戻す", () => {
    const replacer = new FakeActionButtonReplacer();
    const post = createPost();
    const renderMode = new ReplaceUnderlineButtonRenderMode(replacer);
    renderMode.render(post, createActions());
    renderMode.render(post, createActions());
    expect(replacer.restoreCallCount).toBe(2);
    expect(buttonsIn(post)).toHaveLength(ACTION_KINDS.length);
  });

  it("描画したボタンすべてに下線用のクラスを付ける", () => {
    const post = createPost();
    new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
      post,
      createActions(),
    );
    for (const button of buttonsIn(post)) {
      expect(button.classList).toContain("faa-button");
    }
  });

  it("title と aria-label をホームアカウント用の文言で上書きする", () => {
    const post = createPost();
    new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
      post,
      createActions(),
    );
    const button = buttonsIn(post)[0];
    expect(button?.title).toBe("actionButtonHomeAccountTitle:reply");
    expect(button?.getAttribute("aria-label")).toBe(
      "actionButtonHomeAccountTitle:reply",
    );
  });

  it.each(ACTION_KINDS.map((kind, index) => [kind, index] as const))(
    "%s ボタンをクリックすると対応するアクションを1回だけ実行する",
    (_kind, index) => {
      const post = createPost();
      const actions = createActions();
      new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
        post,
        actions,
      );
      buttonsIn(post)[index]?.click();
      expect(clickCounts(actions)).toEqual(
        ACTION_KINDS.map((_, other) => (other === index ? 1 : 0)),
      );
    },
  );

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
      buttonsIn(post)[0]?.dispatchEvent(new MouseEvent(eventType, { bubbles: true }));
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
    buttonsIn(post)[0]?.click();
    expect(freshActions[0]?.onClick).toHaveBeenCalledTimes(1);
    expect(staleActions[0]?.onClick).not.toHaveBeenCalled();
  });
});
