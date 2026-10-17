import type { PostActionKind } from "../core";

/** Keyed by both, since one post carries a state per action. */
function stateKey(postUrl: string, action: PostActionKind): string {
  return `${action}\n${postUrl}`;
}

/**
 * Remembers which actions this extension has put into effect on which posts.
 *
 * The buttons that show those states are built from scratch on every render, and
 * the host client re-renders on its own often enough — relative timestamps alone
 * see to that — that a button which has just been used is regularly replaced. What
 * an action left on the post outlives its button, so it is kept here and restored,
 * rather than falling back to "not in effect" and telling the user something
 * untrue about a post they just favourited.
 *
 * Progress states are deliberately not kept: they last seconds and losing one
 * costs no more than a second click.
 *
 * Nothing is written to storage. A page that is reloaded starts with every button
 * inactive, the same as any post that has not been acted on in this tab — which is
 * what the decision not to fetch the state beforehand already means.
 */
export class PostActionStateMemory {
  private readonly activeActions = new Set<string>();

  /** Whether `action` is known to be in effect on `postUrl`. */
  isActive(postUrl: string, action: PostActionKind): boolean {
    return this.activeActions.has(stateKey(postUrl, action));
  }

  /**
   * Drops everything remembered.
   *
   * What is kept here is true of one user only: a post the previous user had
   * favourited says nothing about the next one. The caller empties this whenever
   * the user acting may have changed.
   */
  forgetAll(): void {
    this.activeActions.clear();
  }

  /** Records the state an action ended up in, as the home instance reported it. */
  remember(postUrl: string, action: PostActionKind, active: boolean): void {
    const key = stateKey(postUrl, action);
    if (active) {
      this.activeActions.add(key);
    } else {
      this.activeActions.delete(key);
    }
  }
}
