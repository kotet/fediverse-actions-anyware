/**
 * Message that tells the background script whether the action buttons on the
 * sending tab are being replaced, so that the toolbar icon can show it.
 *
 * Content scripts have no `action` API, so the icon can only be changed from the
 * background script.
 */
export interface ToolbarIconRequest {
  readonly type: "toolbar-icon:set-replacing";
  readonly replacing: boolean;
}

/**
 * Narrows an arbitrary message to a toolbar icon request.
 *
 * The background script receives every `runtime.sendMessage` the extension
 * sends, so other messages have to be left for other listeners.
 */
export function isToolbarIconRequest(
  message: unknown,
): message is ToolbarIconRequest {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as { type?: unknown; replacing?: unknown };
  return (
    candidate.type === "toolbar-icon:set-replacing" &&
    typeof candidate.replacing === "boolean"
  );
}

/** Asks the background script to show `replacing` on the sender's tab icon. */
export async function sendToolbarIconRequest(replacing: boolean): Promise<void> {
  const request: ToolbarIconRequest = {
    type: "toolbar-icon:set-replacing",
    replacing,
  };
  await browser.runtime.sendMessage(request);
}
