import type { HomeAccount } from "../core/home-account";
import type { HomeAccountConfig } from "../core/account-config";
import { MockHomeAccount } from "../mocks";
import { MastodonHomeAccount } from "../mastodon";

/**
 * Creates a {@link HomeAccount} instance from account configuration.
 *
 * Placed in the wiring layer that knows both core (abstract) and implementations,
 * preventing core from depending on implementations.
 *
 * @param config Persisted account configuration.
 */
export function createHomeAccount(config: HomeAccountConfig): HomeAccount {
  switch (config.software) {
    case "mock":
      return new MockHomeAccount({ authState: config.mockAuthState });
    case "mastodon": {
      if (!config.mastodonInstance) {
        throw new Error("mastodonInstance is not configured.");
      }
      return new MastodonHomeAccount(config.id, config.mastodonInstance);
    }
  }
}
