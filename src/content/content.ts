import { buildActionButtons, createHomeAccount } from "../app";
import {
  getActiveAccount,
  loadAccountStore,
  onAccountStoreChanged,
  type ButtonRenderModeKind,
} from "../core";
import { MockButtonRenderMode, MockPageAdapter } from "../mocks";

/**
 * Content script orchestration.
 *
 * Wires up the design flow of "get active account → check auth → extract posts
 * via page adapter → render via button render mode" using all mock implementations
 * for now. Can be tested without a real server or real Mastodon pages.
 */

// Currently fixed to mock. In the future, the adapter will be selected by page URL and the render mode by settings.
const RENDER_MODE: ButtonRenderModeKind = "replace";

async function renderActionButtons(): Promise<void> {
  const store = await loadAccountStore();
  const activeConfig = getActiveAccount(store);
  if (activeConfig === null) {
    console.log(
      "[content] No active home account. Not displaying buttons.",
    );
    return;
  }

  const account = createHomeAccount(activeConfig);
  const authState = await account.getAuthState();
  if (authState !== "authenticated") {
    console.log(
      `[content] Active account is not authenticated (${authState}). Not displaying buttons.`,
    );
    return;
  }

  const pageAdapter = new MockPageAdapter();
  if (!pageAdapter.isSupportedPage()) {
    return;
  }

  const renderMode = new MockButtonRenderMode(RENDER_MODE);
  const posts = pageAdapter.extractPosts();
  console.log(`[content] Extracted ${posts.length} post(s).`);
  for (const post of posts) {
    renderMode.render(post, buildActionButtons(account, post));
  }
}

console.log("Fediverse Actions Anyware content script loaded.");
void renderActionButtons();

// Re-renders when account store changes (e.g., adding or switching accounts in the popup).
onAccountStoreChanged(() => {
  void renderActionButtons();
});
