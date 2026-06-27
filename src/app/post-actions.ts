import type {
  ActionButtonSpec,
  ApiActionKind,
  ExtractedPost,
  HomeAccount,
} from "../core";

/** Mapping of API action kinds to display labels. */
const API_ACTION_LABELS: ReadonlyArray<{
  kind: ApiActionKind;
  label: string;
}> = [
  { kind: "favourite", label: "Favourite" },
  { kind: "boost", label: "Boost" },
  { kind: "bookmark", label: "Bookmark" },
  { kind: "reply", label: "Reply" },
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
  const apiButtons: ActionButtonSpec[] = API_ACTION_LABELS.map(
    ({ kind, label }) => ({
      kind,
      label,
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
    label: "Open in home instance",
    onClick: async () => {
      const resolvedUrl = await account.resolvePost(post.postUrl);
      console.log(`[content] Open in home instance: ${resolvedUrl}`);
    },
  };

  return [...apiButtons, openHomeButton];
}
