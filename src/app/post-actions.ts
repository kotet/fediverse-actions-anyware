import type {
  ActionButtonSpec,
  ActionResult,
  ApiActionKind,
  ExtractedPost,
  HomeAccount,
  PostActionKind,
} from "../core";
import { getMessage, type MessageKey } from "../i18n";

/** API action kinds offered to the user, with the message key for their label. */
const API_ACTION_LABEL_KEYS: ReadonlyArray<{
  kind: ApiActionKind;
  labelKey: MessageKey;
}> = [
  { kind: "favourite", labelKey: "actionLabelFavourite" },
  { kind: "boost", labelKey: "actionLabelBoost" },
  { kind: "bookmark", labelKey: "actionLabelBookmark" },
];

/**
 * Reports a failed action.
 *
 * Only reaches the console for now. Stage 2 of the release plan turns this into a
 * notification the user can see, which is what the error kinds exist for.
 */
function reportActionResult(kind: PostActionKind, result: ActionResult): void {
  if (result.ok) return;
  console.error(
    `[content] Action failed: ${kind} (${result.error.kind}) ${result.error.message}`,
  );
}

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
        reportActionResult(kind, await account.performAction(kind, post.postUrl));
      },
    }),
  );

  // Replying takes the user to the post on their own instance instead of calling
  // an API, because writing a reply needs a composer this extension does not have.
  const replyButton: ActionButtonSpec = {
    kind: "reply",
    label: getMessage("actionLabelReply"),
    onClick: async () => {
      reportActionResult("reply", await account.openPost(post.postUrl));
    },
  };

  return [...apiButtons, replyButton];
}
