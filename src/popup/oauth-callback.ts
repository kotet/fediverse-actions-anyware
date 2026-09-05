import { addAccount } from "../core/account-store";
import {
  clearPendingOAuth,
  loadPendingOAuth,
  saveMastodonCredentials,
} from "../mastodon/mastodon-credentials";
import {
  exchangeAuthCode,
  verifyCredentials,
} from "../mastodon/mastodon-api-client";
import { getMessage, localizeHtml } from "../i18n";

const statusEl = document.getElementById("status")!;

function showStatus(
  message: string,
  kind: "loading" | "success" | "error",
): void {
  statusEl.textContent = message;
  statusEl.className = `status-${kind}`;
}

async function completeOAuth(code: string): Promise<void> {
  const pending = await loadPendingOAuth();
  if (!pending) {
    // Thrown with the text the page will show, since `main` reports whatever
    // reaches it as the reason the authentication did not finish.
    throw new Error(getMessage("oauthCallbackStateMissing"));
  }

  const accessToken = await exchangeAuthCode(
    pending.instance,
    pending.clientId,
    pending.clientSecret,
    code,
    pending.redirectUri,
  );

  const mastodonAccount = await verifyCredentials(pending.instance, accessToken);
  const label = `${mastodonAccount.username}@${pending.instance}`;

  await saveMastodonCredentials(pending.accountId, {
    instance: pending.instance,
    clientId: pending.clientId,
    clientSecret: pending.clientSecret,
    redirectUri: pending.redirectUri,
    accessToken,
  });

  await addAccount({
    id: pending.accountId,
    software: "mastodon",
    label,
    mastodonInstance: pending.instance,
  });

  await clearPendingOAuth();
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const error = params.get("error");
  const code = params.get("code");

  if (error) {
    showStatus(getMessage("oauthCallbackDenied", error), "error");
    return;
  }

  if (!code) {
    showStatus(getMessage("oauthCallbackCodeMissing"), "error");
    return;
  }

  try {
    await completeOAuth(code);
    showStatus(getMessage("oauthCallbackSucceeded"), "success");
  } catch (err) {
    // The reason comes from the instance or from `MastodonApiError`, so it is a
    // diagnostic string rather than a translated one, and only the sentence
    // around it is localized.
    const reason =
      err instanceof Error ? err.message : getMessage("unknownError");
    showStatus(getMessage("oauthCallbackFailed", reason), "error");
  }
}

// The initial "authenticating" text is a message key in the markup, and `main`
// leaves it on screen for as long as the token exchange takes, so it has to be
// resolved into the active locale's text first.
localizeHtml();
void main();
