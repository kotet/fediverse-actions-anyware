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
  "popupSoftwareMastodonOption",
  "popupInstanceLabel",
  "popupCancelButton",
  "popupSubmitButton",
  "oauthCallbackPageTitle",
  "oauthCallbackProcessing",
  "oauthCallbackDenied",
  "oauthCallbackCodeMissing",
  "oauthCallbackStateMissing",
  "oauthCallbackSucceeded",
  "oauthCallbackFailed",
  "unknownError",
  "authStateAuthenticated",
  "authStateUnauthenticated",
  "authStateError",
  "accountActivateTitle",
  "accountRemoveTitle",
  "accountLoginButton",
  "accountReauthenticateButton",
  "accountLogoutButton",
  "popupActiveAccountNotUsable",
  "popupNoHostAccess",
  "mastodonInstanceRequired",
  "mastodonOAuthStarted",
  "mastodonOAuthError",
  "mockAccountLabel",
  "actionLabelReply",
  "actionLabelFavourite",
  "actionLabelBoost",
  "actionLabelBookmark",
  "actionButtonHomeAccountTitle",
  "actionStateRunning",
  "actionStateSucceeded",
  "actionStateUndone",
  "actionStateActive",
  "actionErrorUnauthenticated",
  "actionErrorNetwork",
  "actionErrorNotFound",
  "actionErrorForbidden",
  "actionErrorRateLimited",
  "actionErrorFailed",
] as const;

export type MessageKey = (typeof MESSAGE_KEYS)[number];

export function getMessage(key: MessageKey, substitutions?: string | string[]): string {
  return browser.i18n.getMessage(key, substitutions);
}

/**
 * Fills every element carrying a `data-i18n` attribute with the message it names,
 * and declares the document to be in the locale those messages came from.
 *
 * Extension pages leave such elements empty in the markup and name a message key
 * instead, so one document serves every locale. Until this runs the element
 * renders as nothing, which is why each page calls it before anything the user
 * would wait in front of.
 *
 * `<title>` is localized the same way: it is an element with text content, and
 * assigning to it sets the window title.
 */
export function localizeHtml(): void {
  // The markup can only name one language, and which one it is now depends on the
  // locale the messages resolve in, so it is stated here rather than there.
  document.documentElement.lang = browser.i18n.getUILanguage();
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const key = element.getAttribute("data-i18n") as MessageKey;
    element.textContent = getMessage(key);
  }
}
