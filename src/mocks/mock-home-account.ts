import type {
  ActionResult,
  ApiActionKind,
  AuthState,
  HomeAccount,
} from "../core";

/** Options to control the behavior of {@link MockHomeAccount}. */
export interface MockHomeAccountOptions {
  /** Initial authentication state. Defaults to `"authenticated"`. */
  authState?: AuthState;
  /**
   * Whether `performAction` returns a failure. Defaults to `false` (returns success).
   */
  failActions?: boolean;
}

/**
 * Mock implementation of the home account.
 *
 * Does not send actual HTTP requests; logs action inputs and results to the console.
 * A debug implementation for testing behavior without a real server.
 */
export class MockHomeAccount implements HomeAccount {
  private authState: AuthState;
  private readonly failActions: boolean;

  constructor(options: MockHomeAccountOptions = {}) {
    this.authState = options.authState ?? "authenticated";
    this.failActions = options.failActions ?? false;
  }

  async getAuthState(): Promise<AuthState> {
    return this.authState;
  }

  async authenticate(): Promise<void> {
    console.log("[mock] authenticate");
    this.authState = "authenticated";
  }

  async logout(): Promise<void> {
    console.log("[mock] logout");
    this.authState = "unauthenticated";
  }

  async performAction(
    action: ApiActionKind,
    postUrl: string,
  ): Promise<ActionResult> {
    console.log(`[mock] action: ${action}, postUrl: ${postUrl}`);
    if (this.failActions) {
      return {
        ok: false,
        error: { kind: "failed", message: "[mock] action failed" },
      };
    }
    return { ok: true };
  }

  async resolvePost(postUrl: string): Promise<string> {
    console.log(`[mock] resolvePost: ${postUrl}`);
    // Does not resolve the post; returns the given URL as-is.
    return postUrl;
  }
}
