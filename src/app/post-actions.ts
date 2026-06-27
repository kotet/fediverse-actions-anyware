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
  { kind: "favourite", label: "お気に入り" },
  { kind: "boost", label: "ブースト" },
  { kind: "bookmark", label: "ブックマーク" },
  { kind: "reply", label: "返信" },
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
            `[content] アクション失敗: ${kind} (${result.error.kind}) ${result.error.message}`,
          );
        }
      },
    }),
  );

  const openHomeButton: ActionButtonSpec = {
    kind: "open-home",
    label: "ホームインスタンスで開く",
    onClick: async () => {
      const resolvedUrl = await account.resolvePost(post.postUrl);
      console.log(`[content] ホームインスタンスで開く: ${resolvedUrl}`);
    },
  };

  return [...apiButtons, openHomeButton];
}
