import {
  type HomeAccountConfig,
  type HomeAccountStoreState,
  removeAccount,
} from "../core";
import { createHomeAccount } from "./home-account-factory";

/**
 * Removes a home account along with everything it had stored.
 *
 * Removing only the configuration would leave the account's access token behind
 * in `browser.storage.local` for as long as the extension is installed, with no
 * way left to reach it: nothing lists it, and re-registering the same instance
 * produces a new account id. The credentials are deleted first, so a failure
 * midway leaves the account still listed rather than orphaning them.
 *
 * Lives in the wiring layer because it needs both the store, which is core, and
 * the implementation that knows which keys the account holds.
 *
 * @returns The new state after removal.
 */
export async function removeHomeAccount(
  config: HomeAccountConfig,
): Promise<HomeAccountStoreState> {
  await createHomeAccount(config).deleteStoredCredentials();
  return await removeAccount(config.id);
}
