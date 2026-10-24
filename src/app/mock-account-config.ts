import { type HomeAccountConfig, loadAccountStore } from "../core";
import { getMessage } from "../i18n";

/**
 * Builds the configuration of a new, authenticated mock account.
 *
 * The label carries a sequence number counted from the mock accounts already
 * registered, so that accounts added one after another can be told apart. Nothing
 * is saved; the caller adds the result to the store.
 */
export async function buildMockAccountConfig(): Promise<HomeAccountConfig> {
  const state = await loadAccountStore();
  const mockCount = state.accounts.filter(
    (account) => account.software === "mock",
  ).length;
  return {
    id: crypto.randomUUID(),
    software: "mock",
    label: getMessage("mockAccountLabel", [String(mockCount + 1)]),
    mockAuthState: "authenticated",
  };
}
