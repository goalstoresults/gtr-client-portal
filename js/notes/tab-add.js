// /notes/tab-add.js
// Add Note Tab
// Handles: UI rendering, client search, note creation

import { escapeHtml } from "../utilities.js";

export function renderAdd(container, portalState) {
  container.innerHTML = `
    <h4>Add Note</h4>

    <label>Date:</label>
    <input type="date" id="noteDate" style="width:200px;margin-bottom:8px;" />

    <div class="row" style="gap:8px; align-items:center; margin-bottom:8px;">
      <label style="min-width:120px;">Contact Name:</label>
      <input id="add-first" placeholder="First name" style="width:140px;" />
      <input id="add-last" placeholder="Last name" style="width:140px;" />
      <button id="btnAddFindClient" class="btn-primary">Find</button>
    </div>

    <div id="addClientSearchResults" class="muted" style="margin-bottom:12px;">
      Enter a first or last name and click Find.
    </div>

    <textarea id="noteContent" placeholder="Enter note text..." style="width:100%;min-height:100px;"></textarea>

    <div style="margin-top:8px;">
      <button id="btnSaveNote" class="primary">Save</button>
    </div>

    <div id="noteAddResult" style="margin-top:8px;"></div>
  `;

  // Reset selected client state
  portalState.clientId = null;
  portalState.clientName = null;
  portalState.clientEmail = null;

  // --------------------------
  // FIND CLIENT
  // --------------------------
  document.getElementById("btnAddFindClient").addEventListener("click", async () => {
    const first = document.getElementById("add-first").value.trim();
    const last = document.getElementById("add-last").value.trim();
    const resultsDiv = document.getElementById("addClientSearchResults");

    resultsDiv.innerHTML = "Searching...";

    if (!first && !last) {
      resultsDiv.textContent = "❌ Enter at least a first or last name.";
      return;
    }

    const filters = [`project.eq.${portalState.project}`];
    if (first) filters.push(`first_name.ilike.${first}*`);
    if (last) filters.push(`last_name.ilike.${last}*`);

    const query =
      filters.length > 1
        ? `and=(${filters.join(",")})`
        : filters[0];

    const url = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${query}&select=contact_id,first_name,last_name,email,contact_type`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        resultsDiv.textContent = `❌ Search failed (${res.status}). ${msg}`;
        return;
      }

      const contacts = await res.json();

      if (!Array.isArray(contacts) || contacts.length === 0) {
        resultsDiv.innerHTML = "<div class='muted'>No contacts found.</div>";
        return;
      }

      // Render results
      resultsDiv.innerHTML = contacts
        .map(
          c => `
            <div class="contact-result"
                 data-id="${c.contact_id}"
                 data-name="${escapeHtml(c.first_name || "")} ${escapeHtml(c.last_name || "")}"
                 data-email="${escapeHtml(c.email || "")}">
              <strong>${escapeHtml(c.first_name || "")} ${escapeHtml(c.last_name || "")}</strong>
              (${escapeHtml(c.contact_type || "No type")})<br/>
              <small>${escapeHtml(c.email || "No email")}</small>
            </div>
          `
        )
        .join("");

      // Wire click handlers
      resultsDiv.querySelectorAll(".contact-result").forEach(el => {
        el.addEventListener("click", () => {
          portalState.clientId = el.dataset.id;
          portalState.clientName = el.dataset.name;
          portalState.clientEmail = el.dataset.email;

          resultsDiv.innerHTML = `
            <div class="success">
              Selected: <strong>${escapeHtml(el.dataset.name)}</strong>
            </div>
          `;
        });
      });
    } catch (err) {
      resultsDiv.textContent = "❌ Network error searching contacts.";
    }
  });

  // --------------------------
  // SAVE NOTE
  // --------------------------
  document.getElementById("btnSaveNote").addEventListener("click", async () => {
    const content = document.getElementById("noteContent").value.trim();
    const noteDate = document.getElementById("noteDate").value;

    if (!content) return;

    try {
      const res = await fetch("https://add-note-module.dennis-e64.workers.dev", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-internal-call": "internal"
        },
        body: JSON.stringify({
          project: portalState.project,
          raw_text: content,
          note_date: noteDate || null,
          contact_id: portalState.clientId || null,
          contact_name: portalState.clientName || null,
          contact_email: portalState.clientEmail || null
        })
      });

      const data = await res.json();
      document.getElementById("noteAddResult").textContent =
        data.success || data.status === "ok"
          ? "Note saved!"
          : `Error: ${data.error || "Unknown error"}`;
    } catch (err) {
      document.getElementById("noteAddResult").textContent = `Error: ${err.message}`;
    }
  });
}
