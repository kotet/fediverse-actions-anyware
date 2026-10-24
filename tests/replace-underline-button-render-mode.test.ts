import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ReplaceUnderlineButtonRenderMode } from "../src/button-render-modes";
import type {
  ActionButtonReplacer,
  ActionButtonSpec,
  ActionDirection,
  ActionErrorKind,
  ActionResult,
  ButtonKind,
  ExtractedPost,
  PostActionKind,
} from "../src/core";

/** Class the fake replacer marks an active button with, standing in for the host's own. */
const HOST_ACTIVE_CLASS = "host-active";

/**
 * Stands in for a page adapter's button replacement capability.
 *
 * Returns plain buttons instead of clones of real markup, which keeps this suite
 * free of any host page fixture. Site-specific behavior is covered by the adapter's
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

  setActionButtonActive(button: HTMLElement, active: boolean): void {
    button.classList.toggle(HOST_ACTIVE_CLASS, active);
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

/** An action button spec whose handlers record the calls made to them. */
type SpiedAction = ActionButtonSpec & {
  readonly onPressStart: Mock<() => void>;
  readonly onClick: Mock<(direction: ActionDirection) => Promise<ActionResult>>;
};

/**
 * What a home account answers when the action succeeds.
 *
 * `reply` is the one kind that leaves no state on the post, so a suite covering
 * all kinds covers both cases.
 */
function successOf(
  kind: PostActionKind,
  direction: ActionDirection,
): ActionResult {
  if (kind === "reply") return { ok: true, active: null };
  return { ok: true, active: direction === "apply" };
}

/**
 * Builds a spec per action kind.
 *
 * @param result What every handler reports regardless of direction, or a promise
 *   the test settles itself. Omitted, each handler answers as a home instance
 *   would for the direction it was given.
 */
function createActions(
  result?: ActionResult | Promise<ActionResult>,
): SpiedAction[] {
  return ACTION_KINDS.map((kind) => ({
    kind,
    label: kind,
    initiallyActive: false,
    onPressStart: vi.fn<() => void>(),
    onClick: vi.fn<(direction: ActionDirection) => Promise<ActionResult>>(
      async (direction) =>
        result === undefined ? successOf(kind, direction) : await result,
    ),
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

  it("has the mode kind replace-underline", () => {
    expect(new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).mode).toBe(
      "replace-underline",
    );
  });

  it("renders every action by replacing the original button", () => {
    const replacer = new FakeActionButtonReplacer();
    new ReplaceUnderlineButtonRenderMode(replacer).render(createPost(), createActions());
    expect(replacer.replacedKinds).toEqual(["reply", "favourite", "boost", "bookmark"]);
  });

  it("skips a kind that has no original button", () => {
    const replacer = new FakeActionButtonReplacer(["bookmark"]);
    const post = createPost();
    new ReplaceUnderlineButtonRenderMode(replacer).render(post, createActions());
    expect(buttonsIn(post)).toHaveLength(ACTION_KINDS.length - 1);
  });

  it("restores the original state first on every render", () => {
    const replacer = new FakeActionButtonReplacer();
    const post = createPost();
    const renderMode = new ReplaceUnderlineButtonRenderMode(replacer);
    renderMode.render(post, createActions());
    renderMode.render(post, createActions());
    expect(replacer.restoreCallCount).toBe(2);
    expect(buttonsIn(post)).toHaveLength(ACTION_KINDS.length);
  });

  it("clearing restores the rendered buttons to the original state", () => {
    const post = createPost();
    const renderMode = new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer());
    renderMode.render(post, createActions());
    renderMode.clear(post);
    expect(buttonsIn(post)).toEqual([]);
  });

  it("puts the underline class on every rendered button", () => {
    const post = createPost();
    new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
      post,
      createActions(),
    );
    for (const button of buttonsIn(post)) {
      expect(button.classList).toContain("faa-button");
    }
  });

  it("overwrites title and aria-label with the home account wording", () => {
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
    "clicking the %s button runs its action exactly once",
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
    "does not let the %s event propagate to ancestors",
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

  it("runs the new actions after a re-render", () => {
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

  it.each([
    { name: "primary", mouseButton: 0, pressStartCount: 1 },
    { name: "middle", mouseButton: 1, pressStartCount: 0 },
    { name: "right", mouseButton: 2, pressStartCount: 0 },
  ])(
    "a press of the $name button starts preparing for the click only if it is the primary one",
    ({ mouseButton, pressStartCount }) => {
      const post = createPost();
      const actions = createActions();
      new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
        post,
        actions,
      );
      buttonsIn(post)[0]?.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, button: mouseButton }),
      );
      expect(actions[0]?.onPressStart).toHaveBeenCalledTimes(pressStartCount);
      expect(actions[0]?.onClick).not.toHaveBeenCalled();
    },
  );

  describe("showing action results", () => {
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
      result?: ActionResult | Promise<ActionResult>,
    ): SpiedAction {
      const action = createActions(result).find(
        (candidate) => candidate.kind === kind,
      );
      if (action === undefined) throw new Error(`unknown action kind: ${kind}`);
      return action;
    }

    function renderSingleAction(action: ActionButtonSpec): HTMLButtonElement {
      const post = createPost();
      new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
        post,
        [action],
      );
      const button = buttonsIn(post)[0];
      if (button === undefined) throw new Error("no button was rendered");
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

    it("shows no state right after rendering", () => {
      const button = renderSingleAction(createAction("favourite"));
      expect(button.hasAttribute("data-faa-state")).toBe(false);
      expect(button.hasAttribute("data-faa-active")).toBe(false);
      expect(button.classList).not.toContain(HOST_ACTIVE_CLASS);
      expect(button.title).toBe("actionButtonHomeAccountTitle:favourite");
    });

    it("shows the action as running until the result comes back", () => {
      const button = renderSingleAction(createAction("favourite", NEVER_SETTLES));
      button.click();
      expect(button.getAttribute("data-faa-state")).toBe("running");
      expect(button.title).toBe("actionStateRunning:favourite");
    });

    it("does not send the same request again on a click while running", () => {
      const action = createAction("favourite", NEVER_SETTLES);
      const button = renderSingleAction(action);
      button.click();
      button.click();
      expect(action.onClick).toHaveBeenCalledTimes(1);
    });

    it("turns active on success and, after a while, switches to wording that states the state", async () => {
      const button = renderSingleAction(createAction("favourite"));
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

    it("leaves the host's look for the active state to the page adapter as well", async () => {
      const button = renderSingleAction(createAction("favourite"));
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button.classList).toContain(HOST_ACTIVE_CLASS);
    });

    it("returns to the resting look after a success of an action that leaves no state", async () => {
      const button = renderSingleAction(createAction("reply"));
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(button.hasAttribute("data-faa-active")).toBe(false);
      expect(button.hasAttribute("data-faa-state")).toBe(false);
      expect(button.title).toBe("actionButtonHomeAccountTitle:reply");
    });

    it.each(ERROR_MESSAGE_KEYS)(
      "reports a %s failure with the wording for that kind",
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

    it("returns from showing a failure to the look before the click after a while", async () => {
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

    it("stays active once the failure display ends, for a failure after becoming active", async () => {
      const action = createAction("favourite");
      action.onClick
        .mockResolvedValueOnce({ ok: true, active: true })
        .mockResolvedValueOnce({
          ok: false,
          error: { kind: "network", message: "boom" },
        });
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

    it("writes the technical message, which cannot be translated, to the console", async () => {
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

  describe("keeping and undoing the action state", () => {
    const SUCCESS_MESSAGE_MS = 4000;

    /** Renders one favourite button, optionally already in effect on the post. */
    function renderFavourite(initiallyActive = false): {
      action: SpiedAction;
      button: HTMLButtonElement;
    } {
      const source = createActions().find((candidate) => candidate.kind === "favourite");
      if (source === undefined) throw new Error("no favourite action was built");
      const action: SpiedAction = { ...source, initiallyActive };
      const post = createPost();
      new ReplaceUnderlineButtonRenderMode(new FakeActionButtonReplacer()).render(
        post,
        [action],
      );
      const button = buttonsIn(post)[0];
      if (button === undefined) throw new Error("no button was rendered");
      return { action, button };
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("sends the first click on an inactive button as apply", async () => {
      const { action, button } = renderFavourite();
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(action.onClick).toHaveBeenCalledWith("apply");
    });

    it("sends another click on an active button as undo", async () => {
      const { action, button } = renderFavourite();
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(action.onClick.mock.calls).toEqual([["apply"], ["undo"]]);
    });

    it("turns inactive on a successful undo and says the action was undone", async () => {
      const { button } = renderFavourite();
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      button.click();
      await vi.advanceTimersByTimeAsync(0);

      expect(button.hasAttribute("data-faa-active")).toBe(false);
      expect(button.classList).not.toContain(HOST_ACTIVE_CLASS);
      expect(button.title).toBe("actionStateUndone:favourite");

      await vi.advanceTimersByTimeAsync(SUCCESS_MESSAGE_MS);
      expect(button.title).toBe("actionButtonHomeAccountTitle:favourite");
    });

    it("shows a button handed over as already taken as active right after rendering", () => {
      const { button } = renderFavourite(true);
      expect(button.hasAttribute("data-faa-active")).toBe(true);
      expect(button.classList).toContain(HOST_ACTIVE_CLASS);
      expect(button.title).toBe("actionStateActive:favourite");
    });

    it("makes the first click on a button handed over as already taken an undo", async () => {
      const { action, button } = renderFavourite(true);
      button.click();
      await vi.advanceTimersByTimeAsync(0);
      expect(action.onClick).toHaveBeenCalledWith("undo");
    });
  });
});
