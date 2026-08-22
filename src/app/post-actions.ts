import type {
  ActionButtonSpec,
  ApiActionKind,
  ExtractedPost,
  HomeAccount,
} from "../core";
import { getMessage, type MessageKey } from "../i18n";

/**
 * API action kinds offered to the user, with the message key for their label.
 *
 * `reply` is intentionally absent: `HomeAccount.performAction` has no reply
 * implementation yet, so offering the action would only produce a button that
 * silently fails. It is added back once composing a reply is supported.
 */
const API_ACTION_LABEL_KEYS: ReadonlyArray<{
  kind: ApiActionKind;
  labelKey: MessageKey;
}> = [
  { kind: "favourite", labelKey: "actionLabelFavourite" },
  { kind: "boost", labelKey: "actionLabelBoost" },
  { kind: "bookmark", labelKey: "actionLabelBookmark" },
];

/**
 * Builds action button specs from the active account and post to pass to the render mode.
 *
 * Binds click behavior (API execution, post resolution) to the home account here,
 * delegating only the rendering method to the render mode.
 *
 * @param account The active account that executes actions.
 * @param post The target post.
 */
export function buildActionButtons(
  account: HomeAccount,
  post: ExtractedPost,
): ActionButtonSpec[] {
  const apiButtons: ActionButtonSpec[] = API_ACTION_LABEL_KEYS.map(
    ({ kind, labelKey }) => ({
      kind,
      label: getMessage(labelKey),
      onClick: async () => {
        const result = await account.performAction(kind, post.postUrl);
        if (!result.ok) {
          console.error(
            `[content] Action failed: ${kind} (${result.error.kind}) ${result.error.message}`,
          );
        }
      },
    }),
  );

  const openHomeButton: ActionButtonSpec = {
    kind: "open-home",
    label: getMessage("actionLabelOpenHome"),
    onClick: async () => {
      const resolvedUrl = await account.resolvePost(post.postUrl);
      console.log(`[content] Open in home instance: ${resolvedUrl}`);
    },
  };

  return [...apiButtons, openHomeButton];
}
