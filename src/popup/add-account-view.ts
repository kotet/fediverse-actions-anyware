import {
  addAccount,
  type HomeAccountConfig,
  type HomeAccountSoftware,
  loadAccountStore,
} from "../core";
import { getMessage } from "../i18n";
import { startMastodonOAuth } from "../mastodon";

/** Callbacks to notify the caller of the result of operations on the add account view. */
export interface AddAccountViewCallbacks {
  /** Called when account addition is complete. */
  readonly onAccountAdded: () => void;
  /** Called when the user cancels and returns to the list. */
  readonly onCancel: () => void;
}

/**
 * Initializes the add account form and wires up events.
 *
 * Toggles input fields based on the software selection and adds the account on submit.
 * Mock accounts complete within the popup; Mastodon accounts open an OAuth tab and
 * complete asynchronously via the callback page.
 */
export function setupAddAccountView(callbacks: AddAccountViewCallbacks): void {
  const form = document.getElementById("add-account-form") as HTMLFormElement;
  const softwareSelect = document.getElementById(
    "account-software",
  ) as HTMLSelectElement;
  const instanceField = document.getElementById(
    "instance-field",
  ) as HTMLElement;
  const instanceInput = document.getElementById(
    "account-instance",
  ) as HTMLInputElement;
  const errorMessage = document.getElementById(
    "add-account-error",
  ) as HTMLParagraphElement;
  const cancelButton = document.getElementById(
    "cancel-add-account",
  ) as HTMLButtonElement;
  const submitButton = document.getElementById(
    "submit-add-account",
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
      void handleMastodonSubmit();
      return;
    }

    void buildMockAccountConfig()
      .then(addAccount)
      .then(() => {
        form.reset();
        syncInstanceField();
        callbacks.onAccountAdded();
      });
  });

  async function handleMastodonSubmit(): Promise<void> {
    const instance = instanceInput.value.trim().replace(/^https?:\/\//, "");
    if (!instance) {
      errorMessage.textContent = getMessage("mastodonInstanceRequired");
      errorMessage.classList.remove("hidden");
      return;
    }

    submitButton.disabled = true;
    errorMessage.classList.add("hidden");

    try {
      const accountId = crypto.randomUUID();
      await startMastodonOAuth(instance, accountId);
      // OAuth tab opened — popup will remain open but user switches to the OAuth tab.
      // The callback page handles account creation; popup updates via storage change listener.
      errorMessage.textContent = getMessage("mastodonOAuthStarted");
      errorMessage.classList.remove("hidden");
      errorMessage.style.color = "#2a6a2a";
    } catch (err) {
      // Only the sentence is localized: the reason is a diagnostic string from
      // `MastodonApiError` (the operation that failed and the HTTP status), which
      // has no translation to show in its place.
      const reason =
        err instanceof Error ? err.message : getMessage("unknownError");
      errorMessage.textContent = getMessage("mastodonOAuthError", reason);
      errorMessage.classList.remove("hidden");
      errorMessage.style.color = "";
    } finally {
      submitButton.disabled = false;
    }
  }

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
    label: getMessage("mockAccountLabel", [String(mockCount + 1)]),
    mockAuthState: "authenticated",
  };
}
