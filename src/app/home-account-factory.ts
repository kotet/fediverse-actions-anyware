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
 * @throws When `config` is a mock account and this is the release build.
 */
export function createHomeAccount(config: HomeAccountConfig): HomeAccount {
  switch (config.software) {
    case "mock":
      if (FAA_INCLUDE_MOCKS) {
        return new MockHomeAccount({ authState: config.mockAuthState });
      }
      // The release build offers no way to register one, so the only way here is
      // a configuration a development build left in the same profile.
      throw new Error("Mock accounts are not available in this build.");
    case "mastodon": {
      if (!config.mastodonInstance) {
        throw new Error("mastodonInstance is not configured.");
      }
      return new MastodonHomeAccount(config.id, config.mastodonInstance);
    }
  }
}
