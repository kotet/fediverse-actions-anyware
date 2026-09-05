import type {
  ActionButtonSpec,
  ApiActionKind,
  ExtractedPost,
  HomeAccount,
} from "../core";
import { getMessage, type MessageKey } from "../i18n";
import type { PostActionStateMemory } from "./post-action-state-memory";

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
 * @param stateMemory Where the states these actions leave on posts are kept, so
 *   that buttons built for a later render start out showing them.
 */
export function buildActionButtons(
  account: HomeAccount,
  post: ExtractedPost,
  stateMemory: PostActionStateMemory,
): ActionButtonSpec[] {
  // Every action begins by resolving the post onto the home instance, so pressing
  // any of these buttons gets the same work started.
  const startResolving = (): void => {
    void account.startResolvingPost(post.postUrl);
  };

  const apiButtons: ActionButtonSpec[] = API_ACTION_LABEL_KEYS.map(
    ({ kind, labelKey }) => ({
      kind,
      label: getMessage(labelKey),
      initiallyActive: stateMemory.isActive(post.postUrl, kind),
      onPressStart: startResolving,
      onClick: async (direction) => {
        const result = await account.performAction(
          kind,
          direction,
          post.postUrl,
        );
        // Recorded on the way past rather than by the render mode, because it has
        // to outlive the button the render mode is showing it on.
        if (result.ok && result.active !== null) {
          stateMemory.remember(post.postUrl, kind, result.active);
        }
        return result;
      },
    }),
  );

  // Replying takes the user to the post on their own instance instead of calling
  // an API, because writing a reply needs a composer this extension does not have.
  const replyButton: ActionButtonSpec = {
    kind: "reply",
    label: getMessage("actionLabelReply"),
    // Opening a tab changes nothing about the post, so there is never a state to
    // start from and the tab arriving in front of the user is the acknowledgement.
    initiallyActive: false,
    onPressStart: startResolving,
    onClick: () => account.openPost(post.postUrl),
  };

  return [...apiButtons, replyButton];
}
