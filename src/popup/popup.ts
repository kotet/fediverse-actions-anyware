import { loadAccountStore } from "../core";
import { getMessage, type MessageKey } from "../i18n";
import { renderAccountList } from "./account-list-view";
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

/** Replaces text content of elements that have a data-i18n attribute. */
function localizeHtml(): void {
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key = el.getAttribute("data-i18n") as MessageKey;
    el.textContent = getMessage(key);
  }
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
    onAccountAdded: (state) => {
      renderAccountList(state);
      showView("list");
    },
    onCancel: () => {
      showView("list");
    },
  });

  void loadAccountStore().then(renderAccountList);
});
