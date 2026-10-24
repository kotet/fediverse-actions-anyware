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
  if (button === undefined) throw new Error(`no ${kind} button was built`);
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

  it("builds the four actions", () => {
    const kinds = buildActionButtons(account, post, stateMemory).map(
      (button) => button.kind,
    );
    expect(kinds).toEqual(["favourite", "boost", "bookmark", "reply"]);
  });

  it.each(["apply", "undo"] as const)(
    "passes the click direction %s on to the home account as is",
    async (direction) => {
      const buttons = buildActionButtons(account, post, stateMemory);
      await buttonFor(buttons, "boost").onClick(direction);
      expect(account.performedActions).toEqual([["boost", direction]]);
    },
  );

  it("starts resolving the post ahead when told of a press", () => {
    buildActionButtons(account, post, stateMemory)[0]?.onPressStart();
    expect(account.resolvedPosts).toEqual([POST_URL]);
  });

  it("carries a state reached by an action over to the buttons built next", async () => {
    await buttonFor(
      buildActionButtons(account, post, stateMemory),
      "favourite",
    ).onClick("apply");

    const rebuilt = buildActionButtons(account, post, stateMemory);
    expect(buttonFor(rebuilt, "favourite").initiallyActive).toBe(true);
    // Only the action that was taken; the post's other buttons are untouched.
    expect(buttonFor(rebuilt, "boost").initiallyActive).toBe(false);
  });

  it("carries an undone state over as well", async () => {
    const buttons = buildActionButtons(account, post, stateMemory);
    await buttonFor(buttons, "favourite").onClick("apply");
    await buttonFor(buttons, "favourite").onClick("undo");

    expect(
      buttonFor(buildActionButtons(account, post, stateMemory), "favourite")
        .initiallyActive,
    ).toBe(false);
  });

  it("remembers the state the home account reports, not the direction asked for", async () => {
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

  it("does not remember a failed result", async () => {
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

  it("does not remember a reply, which leaves no state, even when it succeeds", async () => {
    await buttonFor(buildActionButtons(account, post, stateMemory), "reply").onClick(
      "apply",
    );

    expect(
      buttonFor(buildActionButtons(account, post, stateMemory), "reply")
        .initiallyActive,
    ).toBe(false);
  });

  it("returns the buttons to inactive once the memory is dropped", async () => {
    await buttonFor(
      buildActionButtons(account, post, stateMemory),
      "favourite",
    ).onClick("apply");

    // What the content script does whenever the extension's storage changes.
    stateMemory.forgetAll();
    expect(
      buttonFor(buildActionButtons(account, post, stateMemory), "favourite")
        .initiallyActive,
    ).toBe(false);
  });

  it("keeps a separate memory for each post", async () => {
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
