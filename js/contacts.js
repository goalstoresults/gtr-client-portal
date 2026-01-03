contacts.js

import { renderAddContactForm } from "./contacts/tab-add.js";
import { renderContactList } from "./contacts/tab-list.js";
import { renderContactDetails } from "./contacts/tab-details.js";
import { renderContactRelationships } from "./contacts/tab-relationships.js";
import { renderContactNotes } from "./contacts/tab-notes.js";


// js/contacts.js v2.0
// 🔧 Load Contacts Tab with subtab switching

export async function loadContactsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/contacts.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // 🔧 Inject contact context bar (above subtabs)
  let contextBar = document.getElementById("contact-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "contact-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }
  contextBar.textContent = portalState.selectedContactName
    ? `Contact: ${portalState.selectedContactName}`
    : "No contact selected";

  const content = tabContent.querySelector("#contactsContent");
  const buttons = tabContent.querySelectorAll("#contacts-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;
      switch (subtab) {
        case "add":
          await renderAddContactForm(content, portalState);
          break;

        case "list":
          await renderContactList(content, portalState);
          break;

        case "details":
          if (portalState.selectedContactId) {
            await renderContactDetails(content, portalState, portalState.selectedContactId);
          } else {
            content.innerHTML = `
              <section class="card">
                <h2>Contact Details</h2>
                <p>Select a contact from the list to view details.</p>
              </section>
            `;
          }
          break;

        case "relationships":
          if (portalState.selectedContactId) {
            await renderContactRelationships(content, portalState, portalState.selectedContactId);
          } else {
            content.innerHTML = `
              <section class="card">
                <h2>Relationships</h2>
                <p>Select a contact from the list to view relationships.</p>
              </section>
            `;
          }
          break;

        case "notes":
          if (portalState.selectedContactId) {
            await renderContactNotes(content, portalState, portalState.selectedContactId);
          } else {
            content.innerHTML = `
              <section class="card">
                <h2>Contact Notes</h2>
                <p>Select a contact from the list first, then open Notes.</p>
              </section>
            `;
          }
          break;

        default:
          content.innerHTML = `
            <section class="card">
              <p>Select a subtab to begin.</p>
            </section>
          `;
      }
    });
  });

  // ✅ Default to List view when tab first loads
  const defaultBtn = tabContent.querySelector('#contacts-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderContactList(content, portalState);
  }
}
