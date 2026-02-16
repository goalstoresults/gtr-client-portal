// /notes.js
// Notes module controller — loads HTML, initializes subtabs, routes to tab modules

import { renderHistory } from "./notes/tab-history.js";
import { renderAdd } from "./notes/tab-add.js";
import { renderReview } from "./notes/tab-review.js";
import { renderRelationships } from "./notes/tab-relationships.js";

console.log("[Notes.js] loaded");

// ------------------------------------------------------------
// Load Notes Tab
// ------------------------------------------------------------
export async function loadNotesTab({ portalState, tabContent }) {
  await loadPartial("/components/notes.html", tabContent);
  initNotes(portalState);
}

// ------------------------------------------------------------
// Load HTML partial
// ------------------------------------------------------------
async function loadPartial(url, tabContent) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

    const html = await res.text();
    tabContent.innerHTML = html;

    const header = tabContent.querySelector("h2");
    if (header) header.textContent = "Notes";
  } catch (err) {
    tabContent.innerHTML = `
      <section class="card">
        <p>Error loading partial (${url}): ${err.message}</p>
      </section>
    `;
  }
}

// ------------------------------------------------------------
// Initialize Notes module
// ------------------------------------------------------------
function initNotes(portalState) {
  // Expose for cross-tab navigation (consistent with Contacts)
  window.portalState = portalState;

  // Inject context bar above subtabs
  let contextBar = document.getElementById("contact-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "contact-context-bar";
    contextBar.className = "contact-context-bar";

    const notesNav = document.getElementById("notes-subtabs");
    if (notesNav) notesNav.parentNode.insertBefore(contextBar, notesNav);
  }

  contextBar.textContent = portalState.selectedContactName
    ? `Contact: ${portalState.selectedContactName}`
    : "No contact selected";

  // Base message
  const container = document.getElementById("notesContent");
  if (container) container.innerHTML = `<p>Select a subtab to begin.</p>`;

  // Wire subtab buttons
  document.querySelectorAll("#notes-subtabs button").forEach(btn => {
    btn.addEventListener("click", () =>
      loadNotesSubtab(btn.dataset.subtab, portalState)
    );
  });

  // ⭐ DEFAULT TO HISTORY VIEW (MATCHES CONTACTS BEHAVIOR)
  const defaultBtn = document.querySelector(
    '#notes-subtabs button[data-subtab="history"]'
  );

  if (defaultBtn) {
    defaultBtn.classList.add("active");
    loadNotesSubtab("history", portalState);
  }
}

// ------------------------------------------------------------
// Subtab Router
// ------------------------------------------------------------
async function loadNotesSubtab(subtab, portalState) {
  const container = document.getElementById("notesContent");
  if (!container) return;

  if (!portalState.project) {
    container.innerHTML = `<p>No project selected.</p>`;
    return;
  }

  container.innerHTML = `<p>Loading ${subtab}...</p>`;

  // Update active tab UI
  document
    .querySelectorAll("#notes-subtabs button")
    .forEach(btn => btn.classList.remove("active"));

  document
    .querySelector(`#notes-subtabs button[data-subtab="${subtab}"]`)
    ?.classList.add("active");

  // Route to tab modules
  if (subtab === "history") return renderHistory(container, portalState);
  if (subtab === "add") return renderAdd(container, portalState);
  if (subtab === "review")
    return renderReview(container, portalState, portalState.selectedNoteId);
  if (subtab === "relationships")
    return renderRelationships(container, portalState);

  container.innerHTML = `<p>Unknown subtab</p>`;
}
