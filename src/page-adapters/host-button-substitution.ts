import type { ButtonKind, ExtractedPost } from "../core";

/**
 * Attribute marking an element this extension put in place of a host button.
 * The value is the action kind the element serves.
 *
 * Written by {@link substituteHostButton}, read back by {@link isExtensionButton}
 * and {@link restoreHostButtons}, so both sides of the contract stay inside this
 * module.
 */
const EXTENSION_BUTTON_ATTRIBUTE = "data-faa-action";

/**
 * Whether `element` is one this extension put in place of a host button.
 *
 * A substitute keeps the host's markup, so an adapter scanning an action bar
 * would otherwise pick it up and let it shadow the real host button.
 */
export function isExtensionButton(element: Element): boolean {
  return element.hasAttribute(EXTENSION_BUTTON_ATTRIBUTE);
}

/**
 * Puts a copy of `original` in front of it and hides `original`.
 *
 * A deep clone reproduces the icon, sizing and hover styling. Event listeners are
 * not cloned, so the host's behavior is dropped without any extra work; what the
 * markup alone still ties to the host (a disabled state, a class a delegated
 * handler selects on) is for `neutralize` to strip, since only the adapter knows
 * what its client puts there.
 *
 * The original is only hidden, never removed, because a client-side framework
 * rendering it keeps a reference to it and would fail on a later re-render.
 *
 * @param neutralize Called on the copy before it is inserted.
 * @returns The inserted copy, or `null` if `original` is not in the document.
 */
export function substituteHostButton(
  original: HTMLElement,
  kind: ButtonKind,
  neutralize: (copy: HTMLElement) => void,
): HTMLElement | null {
  const parent = original.parentElement;
  if (parent === null) return null;

  const substitute = original.cloneNode(true);
  if (!(substitute instanceof HTMLElement)) return null;

  neutralize(substitute);
  substitute.setAttribute(EXTENSION_BUTTON_ATTRIBUTE, kind);

  // Inserting before the original keeps the host button last in DOM order, which
  // guards against scans that resolve duplicates by taking the last match.
  parent.insertBefore(substitute, original);
  original.style.display = "none";
  return substitute;
}

/**
 * Removes every substitute placed on `post` and shows its host buttons again.
 * Safe to call when nothing has been placed.
 */
export function restoreHostButtons(post: ExtractedPost): void {
  for (const substitute of post.insertionTarget.querySelectorAll(
    `[${EXTENSION_BUTTON_ATTRIBUTE}]`,
  )) {
    substitute.remove();
  }
  for (const original of Object.values(post.existingButtons)) {
    original.style.display = "";
  }
}
