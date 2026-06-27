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
    throw new Error("認証処理の状態が見つかりません。もう一度お試しください。");
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
    showStatus(`認証が拒否されました: ${error}`, "error");
    return;
  }

  if (!code) {
    showStatus("認証コードが見つかりません。", "error");
    return;
  }

  try {
    await completeOAuth(code);
    showStatus("アカウントが正常に追加されました。", "success");
  } catch (err) {
    showStatus(
      `エラーが発生しました: ${err instanceof Error ? err.message : "不明なエラー"}`,
      "error",
    );
  }
}

void main();
