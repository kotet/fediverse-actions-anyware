import { loadAccountStore } from "../core";
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

document.addEventListener("DOMContentLoaded", () => {
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
