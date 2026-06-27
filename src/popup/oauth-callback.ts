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
    throw new Error("Authentication state not found. Please try again.");
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
    showStatus(`Authentication denied: ${error}`, "error");
    return;
  }

  if (!code) {
    showStatus("Authentication code not found.", "error");
    return;
  }

  try {
    await completeOAuth(code);
    showStatus("Account successfully added.", "success");
  } catch (err) {
    showStatus(
      `An error occurred: ${err instanceof Error ? err.message : "Unknown error"}`,
      "error",
    );
  }
}

void main();
