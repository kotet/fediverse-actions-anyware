/**
 * Id of the element Mastodon's server puts the web client's boot payload in, as
 * JSON. It sits in the document head, written before any script runs.
 *
 * Written by the same helper (`ApplicationHelper#render_initial_state`) into the
 * public pages of Mastodon 3.x, next to their `.public-layout` root
 * (`layouts/public.html.haml`), and into the web client of 4.x, next to its
 * `#mastodon` mount point (`shared/_web_app.html.haml`).
 */
const INITIAL_STATE_ELEMENT_ID = "initial-state";

/**
 * Reads the id of the account the page was served to out of the boot payload.
 *
 * `meta.me` is Mastodon's own definition of being signed in: the server writes
 * it only when the request carried a session (`InitialStateSerializer#meta`),
 * and the client derives `signedIn` from nothing else (`identity_context.tsx`).
 *
 * 3.x writes it the same way, as checked against the 3.5.18 source:
 * `render_initial_state` hands the serializer an account only when
 * `user_signed_in?`, `InitialStateSerializer#meta` sets `me` only when it has
 * one, and the client takes the viewer from `meta.me` (`initial_state.js`).
 *
 * @returns The account id, or `null` when the payload is unreadable or carries
 *   no account, both of which are answered as "not signed in".
 */
function viewerAccountId(payload: string): string | null {
  let state: unknown;
  try {
    state = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof state !== "object" || state === null) return null;
  const meta = (state as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null) return null;
  const me = (meta as { me?: unknown }).me;
  return typeof me === "string" ? me : null;
}

/** Whether the document carries Mastodon's boot payload at all. */
export function hasInitialState(): boolean {
  return document.getElementById(INITIAL_STATE_ELEMENT_ID) !== null;
}

/**
 * Whether the boot payload says the page was served to a signed-in account.
 *
 * Read afresh on every call rather than kept: the payload is fixed for the life
 * of the document, but a page that does not carry one would otherwise have its
 * answer cached before the document is fully in place.
 *
 * @returns `false` when the payload is absent as well.
 */
export function initialStateHasSignedInViewer(): boolean {
  const element = document.getElementById(INITIAL_STATE_ELEMENT_ID);
  if (element === null) return false;
  return viewerAccountId(element.textContent ?? "") !== null;
}
