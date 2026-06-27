import {
  addAccount,
  type HomeAccountConfig,
  type HomeAccountSoftware,
  type HomeAccountStoreState,
  loadAccountStore,
} from "../core";

/** Callbacks to notify the caller of the result of operations on the add account view. */
export interface AddAccountViewCallbacks {
  /** Called when account addition is complete. Receives the updated state after addition. */
  readonly onAccountAdded: (state: HomeAccountStoreState) => void;
  /** Called when the user cancels and returns to the list. */
  readonly onCancel: () => void;
}

/**
 * Initializes the add account form and wires up events.
 *
 * Toggles input fields based on the software selection and adds the account on submit.
 * Mock accounts complete within the popup; Mastodon accounts are expected to proceed
 * to an OAuth flow in a dedicated tab after instance selection (not yet implemented).
 */
export function setupAddAccountView(callbacks: AddAccountViewCallbacks): void {
  const form = document.getElementById("add-account-form") as HTMLFormElement;
  const softwareSelect = document.getElementById(
    "account-software",
  ) as HTMLSelectElement;
  const instanceField = document.getElementById(
    "instance-field",
  ) as HTMLElement;
  const errorMessage = document.getElementById(
    "add-account-error",
  ) as HTMLParagraphElement;
  const cancelButton = document.getElementById(
    "cancel-add-account",
  ) as HTMLButtonElement;

  // Show the instance field only for non-mock software (those that have an instance).
  const syncInstanceField = (): void => {
    const needsInstance = softwareSelect.value !== "mock";
    instanceField.classList.toggle("hidden", !needsInstance);
  };

  softwareSelect.addEventListener("change", syncInstanceField);

  cancelButton.addEventListener("click", () => {
    form.reset();
    syncInstanceField();
    errorMessage.classList.add("hidden");
    callbacks.onCancel();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    errorMessage.classList.add("hidden");

    const software = softwareSelect.value as HomeAccountSoftware;
    if (software === "mastodon") {
      // Instance selection is done in the popup; OAuth is expected to be handled in a dedicated tab.
      errorMessage.textContent = "Mastodon アカウントの追加は未実装です。";
      errorMessage.classList.remove("hidden");
      return;
    }

    void buildMockAccountConfig()
      .then(addAccount)
      .then((nextState) => {
        form.reset();
        syncInstanceField();
        callbacks.onAccountAdded(nextState);
      });
  });

  syncInstanceField();
}

/** Builds a mock account configuration with a sequential label based on the existing mock account count. */
async function buildMockAccountConfig(): Promise<HomeAccountConfig> {
  const state = await loadAccountStore();
  const mockCount = state.accounts.filter(
    (account) => account.software === "mock",
  ).length;
  return {
    id: crypto.randomUUID(),
    software: "mock",
    label: `モックアカウント ${mockCount + 1}`,
    mockAuthState: "authenticated",
  };
}
