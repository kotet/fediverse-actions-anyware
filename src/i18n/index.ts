// prettier-ignore
const MESSAGE_KEYS = [
  "extensionName",
  "extensionDescription",
  "popupHomeAccountsHeading",
  "popupEmptyAccountsMessage",
  "popupShowAddAccountButton",
  "popupAddAccountHeading",
  "popupSoftwareLabel",
  "popupSoftwareMockOption",
  "popupInstanceLabel",
  "popupCancelButton",
  "popupSubmitButton",
  "authStateAuthenticated",
  "authStateUnauthenticated",
  "authStateError",
  "accountActivateTitle",
  "accountRemoveTitle",
  "mastodonNotImplementedError",
  "mockAccountLabel",
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];

export function getMessage(key: MessageKey, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key, substitutions);
}
