import { onAccountStoreChanged } from "../core";
import { localizeHtml } from "../i18n";
import { refreshAccountList } from "./account-list-view";
import { setupAddAccountView } from "./add-account-view";

/** Views to switch between in the popup. */
type ViewName = "list" | "add";

/** Shows only the specified view and hides the others. */
function showView(view: ViewName): void {
  const listView = document.getElementById("view-list") as HTMLElement;
  const addView = document.getElementById("view-add") as HTMLElement;
  listView.classList.toggle("hidden", view !== "list");
  addView.classList.toggle("hidden", view !== "add");
}

document.addEventListener("DOMContentLoaded", () => {
  localizeHtml();

  const showAddButton = document.getElementById(
    "show-add-account",
  ) as HTMLButtonElement;
  showAddButton.addEventListener("click", () => {
    showView("add");
  });

  setupAddAccountView({
    onAccountAdded: () => {
      void refreshAccountList();
      showView("list");
    },
    onCancel: () => {
      showView("list");
    },
  });

  // A Mastodon account is only registered once the OAuth tab reaches the callback
  // page, which is another realm and finishes while this popup is already open.
  onAccountStoreChanged(() => {
    void refreshAccountList();
  });

  void refreshAccountList();
});
