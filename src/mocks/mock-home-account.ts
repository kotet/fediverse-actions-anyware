import type {
  ActionDirection,
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
   * Whether action execution returns a failure. Defaults to `false` (returns success).
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

  async deleteStoredCredentials(): Promise<void> {
    // Nothing is stored: the state lives on this object and on the registered
    // configuration, which the caller removing the account deletes itself.
    console.log("[mock] deleteStoredCredentials");
  }

  async performAction(
    action: ApiActionKind,
    direction: ActionDirection,
    postUrl: string,
  ): Promise<ActionResult> {
    console.log(`[mock] action: ${action} ${direction}, postUrl: ${postUrl}`);
    if (this.failActions) {
      return {
        ok: false,
        error: { kind: "failed", message: "[mock] action failed" },
      };
    }
    // With no instance to report a state, the state is simply the one asked for.
    return { ok: true, active: direction === "apply" };
  }

  async openPost(postUrl: string): Promise<ActionResult> {
    // Neither resolves the post nor opens a tab, so that a mock account stays
    // usable on any page without a home instance behind it.
    console.log(`[mock] openPost: ${postUrl}`);
    if (this.failActions) {
      return {
        ok: false,
        error: { kind: "failed", message: "[mock] open post failed" },
      };
    }
    return { ok: true, active: null };
  }

  async startResolvingPost(postUrl: string): Promise<void> {
    // Nothing to resolve against, so this only records that the press arrived.
    console.log(`[mock] startResolvingPost: ${postUrl}`);
  }
}
