import type {
  ActionButtonSpec,
  ApiActionKind,
  ExtractedPost,
  HomeAccount,
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
      // Each of these puts the post into a state the home account keeps: the
      // button goes on showing it once the call succeeds.
      activatesOnSuccess: true,
      onClick: () => account.performAction(kind, post.postUrl),
    }),
  );

  // Replying takes the user to the post on their own instance instead of calling
  // an API, because writing a reply needs a composer this extension does not have.
  const replyButton: ActionButtonSpec = {
    kind: "reply",
    label: getMessage("actionLabelReply"),
    // Opening a tab changes nothing about the post, and the tab arriving in front
    // of the user is itself the acknowledgement.
    activatesOnSuccess: false,
    onClick: () => account.openPost(post.postUrl),
  };

  return [...apiButtons, replyButton];
}
