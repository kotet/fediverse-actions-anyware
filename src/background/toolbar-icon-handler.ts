import type { ToolbarIconRequest } from "../app";

// Absolute, so that they do not depend on the URL of the page the background
// script runs in.
const NORMAL_ICON_PATH = "/icons/icon.svg";
const REPLACING_ICON_PATH = "/icons/icon-replacing.svg";

/**
 * Shows on the sender's tab whether the extension replaces its action buttons.
 *
 * The icon is set for that tab alone, and Firefox puts the manifest icon back
 * when the tab navigates to another page, so other tabs and later pages keep the
 * usual icon. A sender without a tab, such as the popup, is ignored.
 */
export async function handleToolbarIconRequest(
  request: ToolbarIconRequest,
  sender: browser.runtime.MessageSender,
): Promise<void> {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return;
  await browser.action.setIcon({
    tabId,
    path: request.replacing ? REPLACING_ICON_PATH : NORMAL_ICON_PATH,
  });
}
