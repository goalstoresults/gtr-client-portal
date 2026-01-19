// js/groups.js — NEW TOP LEVEL CONTROLLER

import { renderGroupAdd } from "./groups/tab-add.js";
import { renderGroupList } from "./groups/tab-list.js";
import { renderGroupDetails } from "./groups/tab-details.js";
import { renderGroupMembers } from "./groups/tab-members.js";
import { renderGroupFees } from "./groups/tab-fees.js";

export async function loadGroupsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/groups.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // Inject blue context bar (same class as Financials)
  let contextBar = document.getElementById("groups-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "groups-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }

  contextBar.textContent = portalState.selectedGroupName
    ? `Group: ${portalState.selectedGroupName}`
    : "No group selected";

  const content = tabContent.querySelector("#groupsContent");
  const buttons = tabContent.querySelectorAll("#groups-subtabs button");

  // Wire subtabs
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      switch (subtab) {
        case "add":
          await renderGroupAdd(content, portalState);
          break;

        case "list":
          await renderGroupList(content, portalState);
          break;

        case "details":
          if (portalState.selectedGroupId) {
            await renderGroupDetails(content, portalState, portalState.selectedGroupId);
          } else {
            content.innerHTML = `<section class="card"><p>Select a group to view details.</p></section>`;
          }
          break;

        case "members":
          if (portalState.selectedGroupId) {
            await renderGroupMembers(content, portalState, portalState.selectedGroupId);
          } else {
            content.innerHTML = `<section class="card"><p>Select a group to view members.</p></section>`;
          }
          break;

        case "fees":
          if (portalState.selectedGroupId) {
            await renderGroupFees(content, portalState, portalState.selectedGroupId);
          } else {
            content.innerHTML = `<section class="card"><p>Select a group to view fees.</p></section>`;
          }
          break;

        default:
          content.innerHTML = `<section class="card"><p>Select a subtab to begin.</p></section>`;
      }
    });
  });

  // Default to List
  const defaultBtn = tabContent.querySelector('#groups-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderGroupList(content, portalState);
  }
}
