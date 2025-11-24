// js/notes.js v1.1.7
// Notes module with full Worker URLs (notes-history-module.dennis-e64.workers.dev)

console.log("[Notes.js] loaded");

export async function loadNotesTab({ portalState, tabContent }) {
  await loadPartial("/components/notes.html", tabContent);
  initNotes(portalState);
}

async function loadPartial(url, tabContent) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const html = await res.text();
    tabContent.innerHTML = html;
    const header = tabContent.querySelector("h2");
    if (header) header.textContent = "Notes (v1.1.7)";
  } catch (err) {
    tabContent.innerHTML = `<section class="card"><p>Error loading partial (${url}): ${err.message}</p></section>`;
  }
}

function setActiveSubtab(tabId) {
  const tabs = document.querySelectorAll("nav#notes-subtabs button");
  tabs.forEach(t => t.classList.remove("active"));
  const selected = document.getElementById(tabId);
  if (selected) selected.classList.add("active");
}

function initNotes(portalState) {
  const container = document.getElementById("notesContent");
  if (container) container.innerHTML = `<p>Select a subtab to begin.</p>`;
  document.querySelectorAll("#notes-subtabs button").forEach(btn =>
    btn.addEventListener("click", () => loadNotesSubtab(btn.dataset.subtab, portalState))
  );
  setSubtabEnabled("review", false);
  setSubtabEnabled("relationships", false);
}

function setSubtabEnabled(subtab, enabled) {
  const btn = document.querySelector(`#notes-subtabs button[data-subtab="${subtab}"]`);
  if (btn) { btn.disabled = !enabled; btn.classList.toggle("disabled", !enabled); }
}

async function loadNotesSubtab(subtab, portalState) {
  const container = document.getElementById("notesContent");
  if (!container) return;
  if (!portalState.project) { container.innerHTML = `<p>No project selected.</p>`; return; }
  container.innerHTML = `<p>Loading ${subtab}...</p>`;

  document.querySelectorAll("#notes-subtabs button").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`#notes-subtabs button[data-subtab="${subtab}"]`)?.classList.add("active");

  if (subtab === "history") return renderHistory(container, portalState);
  if (subtab === "add") return renderAdd(container, portalState);
  if (subtab === "review") return renderReview(container, portalState, portalState.selectedNoteId);
  if (subtab === "relationships") return renderRelationships(container, portalState);
  container.innerHTML = `<p>Unknown subtab</p>`;
}

/* History */
async function renderHistory(container, portalState) {
  try {
    const now = new Date(), sevenDaysAgo = new Date(now.getTime() - 7*24*60*60*1000);
    const params = new URLSearchParams({
      project: portalState.project,
      table: "notes_history",
      start_date: sevenDaysAgo.toISOString(),
      end_date: now.toISOString(),
      needs_review: "true"
    });
    const url = `https://notes-history-module.dennis-e64.workers.dev?${params}`;
    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    if (!res.ok || data.status !== "ok" || !Array.isArray(data.notes) || data.notes.length === 0) {
      container.innerHTML = `<p>No notes found.</p>`;
      return;
    }

    container.innerHTML = `<h4>Notes History</h4>`;
    const table = document.createElement("table");
    table.className = "notes-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Created</th>
          <th>Subject</th>
          <th>From</th>
          <th>Client</th>
          <th>Needs Review</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${data.notes.map(n => {
          const created = n.created_at ? new Date(n.created_at).toLocaleString() : "(no date)";
          const subject = n.subject || "(no subject)";
          const from = n.from_name || "(unknown)";
          const client = n.contact_name || "(unknown)";
          const needsReview = n.needs_review ? "Yes" : "No";
          return `
            <tr>
              <td>${escapeHtml(created)}</td>
              <td>${escapeHtml(subject)}</td>
              <td>${escapeHtml(from)}</td>
              <td>${escapeHtml(client)}</td>
              <td>${escapeHtml(needsReview)}</td>
              <td><button data-note-id="${n.id||""}" class="secondary">Review</button></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    `;
    container.appendChild(table);

    table.querySelectorAll("button[data-note-id]").forEach(btn =>
      btn.addEventListener("click", () => {
        const noteId = btn.getAttribute("data-note-id");
        portalState.selectedNoteId = noteId;
        console.log("[History] Selected note ID:", noteId);
        setSubtabEnabled("review", true);
        setSubtabEnabled("relationships", true);
        document.querySelectorAll("#notes-subtabs button").forEach(b => b.classList.remove("active"));
        document.querySelector('#notes-subtabs button[data-subtab="review"]')?.classList.add("active");
        renderReview(container, portalState, noteId);
      })
    );
  } catch (err) {
    container.innerHTML = `<p>Error loading history: ${err.message}</p>`;
  }
}

/* Add */
function renderAdd(container, portalState) {
  container.innerHTML = `<h4>Add Note (v1.2.5)</h4>
    <textarea id="noteContent" placeholder="Enter note text..." style="width:100%;min-height:100px;"></textarea>
    <div style="margin-top:8px;"><button id="btnSaveNote" class="primary">Save</button></div>
    <div id="noteAddResult" style="margin-top:8px;"></div>`;
  document.getElementById("btnSaveNote").addEventListener("click", async () => {
    const content = document.getElementById("noteContent").value.trim();
    if (!content) return;
    try {
      const res = await fetch("https://add-note-module.dennis-e64.workers.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: portalState.project,
          raw_text: content
        })
      });
      const data = await res.json();
      document.getElementById("noteAddResult").textContent =
        data.success || data.status === "ok" ? "Note saved!" : `Error: ${data.error||"Unknown error"}`;
    } catch (err) {
      document.getElementById("noteAddResult").textContent = `Error: ${err.message}`;
    }
  });
}

/* Review */
async function renderReview(container, portalState, noteId) {
  console.log("[Review] Called with noteId:", noteId);
  if (!noteId) { container.innerHTML = `<p>Select a note from History to review.</p>`; return; }

  try {
    const params = new URLSearchParams({ project: portalState.project, id: noteId });
    const url = `https://notes-history-module.dennis-e64.workers.dev/note_review?${params}`;
    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();
    if (!res.ok || !data.note) { container.innerHTML = `<p>Error loading note review: ${data.error || "Not found"}</p>`; return; }

    const note = data.note;
    const relationships = data.relationships || [];

    container.innerHTML = `
      <section class="card">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <h2 style="margin:0;">Note Review for Note Id (${noteId})</h2>
          <button id="btnSetClient" class="primary">Set Client</button>
          <button id="btnDeleteNote" class="primary" style="background:#e53935;">Delete</button>
        </div>
        <section id="setClientForm" class="card" style="display:none; margin-bottom:16px;">
          <h3>Attach Client to Note</h3>
          <div class="row" style="gap:12px; margin-bottom:12px;">
            <input id="filter-first" placeholder="First name" />
            <input id="filter-last" placeholder="Last name" />
            <button id="btnFindClient" class="primary">Find</button>
          </div>
          <div id="clientSearchResults" class="muted">Enter criteria and click Find.</div>
        </section>

        <p><strong>Subject:</strong> ${note.subject || "(no subject)"}</p>
        <p><strong>From:</strong> ${note.from_name || "(unknown)"} (${note.from_email || "no email"})</p>
        <p><strong>Created:</strong> ${note.created}</p>
        <p><strong>Client:</strong> ${note.contact_name || "(unknown)"} (${note.contact_email || ""})</p>
        <p><strong>Status:</strong> ${note.status || "pending"} • 
           <strong>Needs review:</strong> ${note.needs_review ? "Yes" : "No"}</p>
        <p><strong>Summary:</strong></p>
        <p>${note.summary || "(no summary available)"}</p>
      </section>
    `;

    // Toggle Set Client form
    document.getElementById("btnSetClient").addEventListener("click", () => {
      const form = document.getElementById("setClientForm");
      form.style.display = form.style.display === "none" ? "block" : "none";
    });

    // Delete note handler
    document.getElementById("btnDeleteNote").addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete this note and all its relationships?")) return;
      try {
        const project = portalState.project;
        const noteId = portalState.selectedNoteId;
        const relUrl = `https://notes-history-module.dennis-e64.workers.dev/note_relationships?project=${project}&note_id=${noteId}`;
        await fetch(relUrl, { method: "DELETE" });
        const noteUrl = `https://notes-history-module.dennis-e64.workers.dev/note_history?id=${noteId}&project=${project}`;
        await fetch(noteUrl, { method: "DELETE" });
        alert("✅ Note and relationships deleted.");
        await renderHistory(container, portalState);
      } catch (err) {
        alert("Error deleting note: " + err.message);
      }
    });

    // Find client handler
    document.getElementById("btnFindClient").addEventListener("click", async () => {
      const first = document.getElementById("filter-first").value.trim();
      const last = document.getElementById("filter-last").value.trim();
      if (!first && !last) { alert("Enter at least a first or last name."); return; }

      const params = new URLSearchParams();
      const selectCols = "contact_id,first_name,last_name,email,contact_type";
      const filters = [`project.eq.${portalState.project}`];
      if (first) filters.push(`first_name.ilike.*${first}*`);
      if (last) filters.push(`last_name.ilike.*${last}*`);
      params.set("and", `(${filters.join(",")})`);

      const searchUrl = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${params.toString()}&select=${encodeURIComponent(selectCols)}`;
      const resp = await fetch(searchUrl);
      const rows = await resp.json();
      const resultsDiv = document.getElementById("clientSearchResults");
      resultsDiv.innerHTML = rows.length > 0
        ? rows.map(r => `
            <div class="client-result"
                 data-contactid="${r.contact_id}"
                 data-name="${r.first_name} ${r.last_name}"
                 data-type="${r.contact_type}"
                 data-email="${r.email}">
              <strong>${r.first_name} ${r.last_name}</strong> (${r.contact_type})<br/>
              <small>${r.email}</small>
            </div>
          `).join("")
        : "<div class='muted'>No contacts found.</div>";

      // Attach listeners to each result
      resultsDiv.querySelectorAll(".client-result").forEach(el => {
        el.addEventListener("click", () => {
          attachClientToNote(
            el.dataset.contactid,
            el.dataset.name,
            el.dataset.type,
            el.dataset.email,
            portalState
          );
        });
      });
    });
  } catch (err) {
    container.innerHTML = `<p>Error loading note review: ${err.message}</p>`;
  }
}

/* -------------------------
   Utils
------------------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
