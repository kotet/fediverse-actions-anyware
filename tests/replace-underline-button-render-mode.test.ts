import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ReplaceUnderlineButtonRenderMode } from "../src/button-render-modes";
import type {
  ActionButtonReplacer,
  ActionButtonSpec,
  ActionErrorKind,
  ActionResult,
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
type SpiedAction = ActionButtonSpec & {
  readonly onClick: Mock<() => Promise<ActionResult>>;
};

/**
 * Builds a spec per action kind, all reporting the same outcome.
 *
 * `reply` is the one kind that leaves no state on the post, matching what the app
 * layer declares, so a suite covering all kinds covers both cases.
 *
 * @param result What every handler reports, or a promise the test settles itself.
 */
function createActions(
  result: ActionResult | Promise<ActionResult> = { ok: true },
): SpiedAction[] {
  return ACTION_KINDS.map((kind) => ({
    kind,
    label: kind,
    activatesOnSuccess: kind !== "reply",
    onClick: vi.fn<() => Promise<ActionResult>>(async () => await result),
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

  describe("アクション結果の表示", () => {
    /** Mirror of the render mode's own timings. */
    const SUCCESS_MESSAGE_MS = 4000;
    const FAILURE_DISPLAY_MS = 8000;

    /** A promise standing for an action that has not answered yet. */
    const NEVER_SETTLES = new Promise<ActionResult>(() => {});

    const ERROR_MESSAGE_KEYS: ReadonlyArray<readonly [ActionErrorKind, string]> = [
      ["unauthenticated", "actionErrorUnauthenticated"],
      ["network", "actionErrorNetwork"],
      ["not-found", "actionErrorNotFound"],
      ["forbidden", "actionErrorForbidden"],
      ["rate-limited", "actionErrorRateLimited"],
      ["failed", "actionErrorFailed"],
    ];

    function createAction(
      kind: PostActionKind,
      result: ActionResult | Promise<ActionResult>,
    ): SpiedAction {
      const action = createActions(result).find(
        (candidate) => candidate.kind === kind,
      );
      if (action === undefined) throw new Error(`未知のアクション種別: ${kind}`);
      return action;
    }

    function renderSingleAction(action: ActionButtonSpec): HTMLButtonElement {
      const post = createPost();
      new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
        post,
        [action],
      );
      const button = buttonsIn(post)[0];
      if (button === undefined) throw new Error("ボタンが描画されなかった");
      return button;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      // The technical message is written here on every failure; it is asserted on
      // in its own test and would otherwise clutter the run.
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("描画した直後は状態を表さない", () => {
      const button = renderSingleAction(createAction("favourite", { ok: true }));
      expect(button.hasAttribute("data-faa-state")).toBe(false);
      expect(button.hasAttribute("data-faa-active")).toBe(false);
      expect(button.title).toBe("actionButtonHomeAccountTitle:favourite");
    });

    it("結果が返るまでは実行中として表示する", () => {
      const button = renderSingleAction(createAction("favourite", NEVER_SETTLES));
      button.click();
      expect(button.getAttribute("data-faa-state")).toBe("running");
      expect(button.title).toBe("actionStateRunning:favourite");
    });

    it("実行中の再クリックでは同じ依頼を重ねて送らない", () => {
      const action = createAction("favourite", NEVER_SETTLES);
      const button = renderSingleAction(action);
      button.click();
      button.click();
      expect(action.onClick).toHaveBeenCalledTimes(1);
    });

    it("成功するとアクティブ表示になり、一定時間後に状態を述べる文言へ変わる", async () => {
      const button = renderSingleAction(createAction("favourite", { ok: true }));
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button.hasAttribute("data-faa-active")).toBe(true);
      expect(button.hasAttribute("data-faa-state")).toBe(false);
      expect(button.title).toBe("actionStateSucceeded:favourite");

      await vi.advanceTimersByTimeAsync(SUCCESS_MESSAGE_MS);
      expect(button.hasAttribute("data-faa-active")).toBe(true);
      expect(button.title).toBe("actionStateActive:favourite");
      expect(button.getAttribute("aria-label")).toBe("actionStateActive:favourite");
    });

    it("状態を残さないアクションは成功しても既定の見え方へ戻る", async () => {
      const button = renderSingleAction(createAction("reply", { ok: true }));
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button.hasAttribute("data-faa-active")).toBe(false);
      expect(button.hasAttribute("data-faa-state")).toBe(false);
      expect(button.title).toBe("actionButtonHomeAccountTitle:reply");
    });

    it.each(ERROR_MESSAGE_KEYS)(
      "%s の失敗はその種別の文言で伝える",
      async (kind, messageKey) => {
        const button = renderSingleAction(
          createAction("favourite", {
            ok: false,
            error: { kind, message: "boom" },
          }),
        );
        button.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(button.getAttribute("data-faa-state")).toBe("failed");
        expect(button.title).toBe(`${messageKey}:favourite`);
        expect(button.getAttribute("aria-label")).toBe(`${messageKey}:favourite`);
      },
    );

    it("失敗の表示は一定時間で操作前の見え方へ戻る", async () => {
      const button = renderSingleAction(
        createAction("favourite", {
          ok: false,
          error: { kind: "network", message: "boom" },
        }),
      );
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button.getAttribute("data-faa-state")).toBe("failed");

      await vi.advanceTimersByTimeAsync(FAILURE_DISPLAY_MS);
      expect(button.hasAttribute("data-faa-state")).toBe(false);
      expect(button.hasAttribute("data-faa-active")).toBe(false);
      expect(button.title).toBe("actionButtonHomeAccountTitle:favourite");
    });

    it("アクティブになった後に失敗しても、表示が戻るとアクティブのままになる", async () => {
      const action: SpiedAction = {
        kind: "favourite",
        label: "favourite",
        activatesOnSuccess: true,
        onClick: vi
          .fn<() => Promise<ActionResult>>()
          .mockResolvedValueOnce({ ok: true })
          .mockResolvedValueOnce({
            ok: false,
            error: { kind: "network", message: "boom" },
          }),
      };
      const button = renderSingleAction(action);
      button.click();
      await vi.advanceTimersByTimeAsync(SUCCESS_MESSAGE_MS);

      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button.getAttribute("data-faa-state")).toBe("failed");
      expect(button.hasAttribute("data-faa-active")).toBe(true);

      await vi.advanceTimersByTimeAsync(FAILURE_DISPLAY_MS);
      expect(button.hasAttribute("data-faa-state")).toBe(false);
      expect(button.title).toBe("actionStateActive:favourite");
    });

    it("翻訳できない技術的なメッセージはコンソールへ出す", async () => {
      const button = renderSingleAction(
        createAction("favourite", {
          ok: false,
          error: { kind: "failed", message: "Favourite failed: HTTP 418" },
        }),
      );
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Favourite failed: HTTP 418"),
      );
    });
  });
});
