import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostActionStateMemory, buildActionButtons } from "../src/app";
import type {
  ActionButtonSpec,
  ActionDirection,
  ActionResult,
  ApiActionKind,
  ExtractedPost,
  HomeAccount,
  PostActionKind,
} from "../src/core";

/**
 * Covers what the app layer adds between the home account and the render mode:
 * the direction a click carries through, and the states actions leave on posts
 * outliving the buttons that showed them.
 */

const POST_URL = "https://remote.example/@someone/1";

const post: ExtractedPost = {
  postUrl: POST_URL,
  existingButtons: {},
  insertionTarget: document.createElement("div"),
};

/** A home account that answers as asked and records what it was asked. */
class RecordingHomeAccount implements HomeAccount {
  readonly performedActions: Array<[ApiActionKind, ActionDirection]> = [];
  readonly resolvedPosts: string[] = [];
  /** What every API action answers, so a test can make one fail or disagree. */
  answer: ActionResult | undefined;

  async getAuthState(): Promise<"authenticated"> {
    return "authenticated";
  }

  async authenticate(): Promise<void> {}

  async logout(): Promise<void> {}

  async deleteStoredCredentials(): Promise<void> {}

  async performAction(
    action: ApiActionKind,
    direction: ActionDirection,
  ): Promise<ActionResult> {
    this.performedActions.push([action, direction]);
    return this.answer ?? { ok: true, active: direction === "apply" };
  }

  async openPost(): Promise<ActionResult> {
    return { ok: true, active: null };
  }

  async startResolvingPost(postUrl: string): Promise<void> {
    this.resolvedPosts.push(postUrl);
  }
}

function buttonFor(
  buttons: readonly ActionButtonSpec[],
  kind: PostActionKind,
): ActionButtonSpec {
  const button = buttons.find((candidate) => candidate.kind === kind);
  if (button === undefined) throw new Error(`${kind} のボタンが作られなかった`);
  return button;
}

describe("buildActionButtons", () => {
  let account: RecordingHomeAccount;
  let stateMemory: PostActionStateMemory;

  beforeEach(() => {
    vi.stubGlobal("browser", {
      i18n: { getMessage: (key: string) => key },
    });
    account = new RecordingHomeAccount();
    stateMemory = new PostActionStateMemory();
  });

  it("4種のアクションを組み立てる", () => {
    const kinds = buildActionButtons(account, post, stateMemory).map(
      (button) => button.kind,
    );
    expect(kinds).toEqual(["favourite", "boost", "bookmark", "reply"]);
  });

  it.each(["apply", "undo"] as const)(
    "クリックの向き %s をそのままホームアカウントへ渡す",
    async (direction) => {
      const buttons = buildActionButtons(account, post, stateMemory);
      await buttonFor(buttons, "boost").onClick(direction);
      expect(account.performedActions).toEqual([["boost", direction]]);
    },
  );

  it("押し下げの通知で投稿の解決を先に始めさせる", () => {
    buildActionButtons(account, post, stateMemory)[0]?.onPressStart();
    expect(account.resolvedPosts).toEqual([POST_URL]);
  });

  it("実行した状態は次に組み立てたボタンへ引き継がれる", async () => {
    await buttonFor(
      buildActionButtons(account, post, stateMemory),
      "favourite",
    ).onClick("apply");

    const rebuilt = buildActionButtons(account, post, stateMemory);
    expect(buttonFor(rebuilt, "favourite").initiallyActive).toBe(true);
    // Only the action that was taken; the post's other buttons are untouched.
    expect(buttonFor(rebuilt, "boost").initiallyActive).toBe(false);
  });

  it("取り消した状態も引き継がれる", async () => {
    const buttons = buildActionButtons(account, post, stateMemory);
    await buttonFor(buttons, "favourite").onClick("apply");
    await buttonFor(buttons, "favourite").onClick("undo");

    expect(
      buttonFor(buildActionButtons(account, post, stateMemory), "favourite")
        .initiallyActive,
    ).toBe(false);
  });

  it("記憶するのは依頼した向きではなくホームアカウントが報告した状態である", async () => {
    account.answer = { ok: true, active: true };
    await buttonFor(
      buildActionButtons(account, post, stateMemory),
      "favourite",
    ).onClick("undo");

    expect(
      buttonFor(buildActionButtons(account, post, stateMemory), "favourite")
        .initiallyActive,
    ).toBe(true);
  });

  it("失敗した結果は記憶しない", async () => {
    account.answer = { ok: false, error: { kind: "network", message: "boom" } };
    await buttonFor(
      buildActionButtons(account, post, stateMemory),
      "favourite",
    ).onClick("apply");

    expect(
      buttonFor(buildActionButtons(account, post, stateMemory), "favourite")
        .initiallyActive,
    ).toBe(false);
  });

  it("状態を残さない返信は成功しても記憶しない", async () => {
    await buttonFor(buildActionButtons(account, post, stateMemory), "reply").onClick(
      "apply",
    );

    expect(
      buttonFor(buildActionButtons(account, post, stateMemory), "reply")
        .initiallyActive,
    ).toBe(false);
  });

  it("記憶を捨てるとボタンは非アクティブに戻る", async () => {
    await buttonFor(
      buildActionButtons(account, post, stateMemory),
      "favourite",
    ).onClick("apply");

    // What the content script does when the active account is switched.
    stateMemory.forgetAll();
    expect(
      buttonFor(buildActionButtons(account, post, stateMemory), "favourite")
        .initiallyActive,
    ).toBe(false);
  });

  it("記憶は投稿ごとに分かれている", async () => {
    await buttonFor(
      buildActionButtons(account, post, stateMemory),
      "favourite",
    ).onClick("apply");

    const otherPost: ExtractedPost = { ...post, postUrl: `${POST_URL}0` };
    expect(
      buttonFor(buildActionButtons(account, otherPost, stateMemory), "favourite")
        .initiallyActive,
    ).toBe(false);
  });
});
