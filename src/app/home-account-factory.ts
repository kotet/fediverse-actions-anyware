import type { HomeAccount, HomeAccountConfig } from "../core";
import { MockHomeAccount } from "../mocks";

/**
 * Creates a {@link HomeAccount} instance from account configuration.
 *
 * Placed in the wiring layer that knows both core (abstract) and mocks
 * (implementation), preventing core from depending on mocks.
 *
 * @param config Persisted account configuration.
 */
export function createHomeAccount(config: HomeAccountConfig): HomeAccount {
  switch (config.software) {
    case "mock":
      return new MockHomeAccount({ authState: config.mockAuthState });
    case "mastodon":
      throw new Error("Mastodon ホームアカウントは未実装です。");
  }
}
