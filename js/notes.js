// js/notes.js v1.1.6
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
    if (header) header.textContent = "Notes (v1.1.6)";
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
  const historyBtn = document.querySelector('#notes-subtabs button[data-subtab="history"]');
  if (historyBtn) historyBtn.classList.add('active');  
  
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

/* History (GET /notes-history-module) */
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
        renderReview(container, portalState, noteId);
      })
    );
  } catch (err) {
    container.innerHTML = `<p>Error loading history: ${err.message}</p>`;
  }
}

/* Add (POST /notes-history-module) */
function renderAdd(container, portalState) {
  container.innerHTML = `<h4>Add Note</h4>
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

/* Review (GET /note_review) */
async function renderReview(container, portalState, noteId) {
  console.log("[Review] Called with noteId:", noteId);

  if (!noteId) {
    container.innerHTML = `<p>Select a note from History to review.</p>`;
    return;
  }

  try {
    const params = new URLSearchParams({ project: portalState.project, id: noteId });
    const url = `https://notes-history-module.dennis-e64.workers.dev/note_review?${params}`;
    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    if (!res.ok || !data.note) {
      container.innerHTML = `<p>Error loading note review: ${data.error || "Not found"}</p>`;
      return;
    }

    const note = data.note;
    const relationships = data.relationships || [];

    container.innerHTML = `
      <section class="card">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <h2 style="margin:0;">Note Review (1.2.8)</h2>
          <button id="btnSetClient" class="primary"
                  style="background:#2979ff; color:#fff; border:none; border-radius:6px; padding:8px 14px; font-weight:500; cursor:pointer;">
            Set Client
          </button>
        </div>

        <!-- 👇 Form directly below heading/button -->
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

        ${note.raw_text ? `
          <details style="margin-top:12px;">
            <summary>Raw Text (click to expand)</summary>
            <pre style="margin-top:8px;">${note.raw_text}</pre>
          </details>
        ` : ""}

        ${Array.isArray(relationships) && relationships.length > 0 ? `
          <h3 style="margin-top:20px;">Relationships Detected in Note</h3>
          <table class="notes-table">
            <thead>
              <tr>
                <th>Raw Name</th>
                <th>AI First</th>
                <th>AI Last</th>
                <th>Role/Type</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              ${relationships.map(r => `
                <tr>
                  <td>${escapeHtml(r.raw_name || "")}</td>
                  <td>${escapeHtml(r.first_name_ai || "")}</td>
                  <td>${escapeHtml(r.last_name_ai || "")}</td>
                  <td>${escapeHtml(r.role_label_ai || "")}</td>
                  <td>${escapeHtml(r.context_description_ai || "")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}
      </section>
    `;

    // Toggle Set Client form
    document.getElementById("btnSetClient").addEventListener("click", () => {
      const form = document.getElementById("setClientForm");
      form.style.display = form.style.display === "none" ? "block" : "none";
    });

    // Find client handler (name-only search)
    document.getElementById("btnFindClient").addEventListener("click", async () => {
      const first = document.getElementById("filter-first").value.trim();
      const last = document.getElementById("filter-last").value.trim();

      if (!first && !last) { alert("Enter at least a first or last name."); return; }
      if ((first && first.length < 3) || (last && last.length < 3)) {
        alert("Names must be at least 3 characters."); return;
      }

      const params = new URLSearchParams();
      const selectCols = "contact_id,first_name,last_name,email,contact_type";

      const filters = [`project.eq.${portalState.project}`];
      if (first) filters.push(`first_name.ilike.*${first}*`);
      if (last)  filters.push(`last_name.ilike.*${last}*`);

      if (filters.length > 1) {
        params.set("and", `(${filters.join(",")})`);
      } else {
        const [filter] = filters;
        const [key, operator, value] = filter.split(".");
        params.set(`${key}.${operator}`, value);
      }

      const searchUrl = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${params.toString()}&select=${encodeURIComponent(selectCols)}`;
      console.log("[SetClient] Searching contacts:", searchUrl);

      try {
        const resp = await fetch(searchUrl);
        if (!resp.ok) {
          const msg = await resp.text().catch(() => "");
          alert(`Search failed (${resp.status}). ${msg}`);
          return;
        }
        const rows = await resp.json();
        const container = document.getElementById("clientSearchResults");
        container.innerHTML = rows.length > 0
          ? rows.map(r => {
              const fullName = `${r.first_name || ""} ${r.last_name || ""}`.trim();
              const typeLabel = (r.contact_type || "contact").toLowerCase();
              const emailSafe = r.email || "";
              return `
                <div style="padding:8px; border-bottom:1px solid #eee; cursor:pointer;"
                onclick="attachClientToNote('${r.contact_id}', '${fullName}', '${typeLabel}', '${emailSafe}', { selectedNoteId: '${portalState.selectedNoteId}', project: '${portalState.project}' })">
                  <strong>${fullName}</strong>
                  <span style="background:#eef; color:#336; padding:2px 6px; border-radius:12px; font-size:0.75em; margin-left:6px;">
                    ${typeLabel}
                  </span><br/>
                  <small>${emailSafe}</small>
                </div>
              `;
            }).join("")
          : "<div class='muted'>No contacts found.</div>";
      } catch (err) {
        alert("Network error searching contacts");
        console.error(err);
      }
    });
  } catch (err) {
    container.innerHTML = `<p>Error loading note review: ${err.message}</p>`;
  }
}


/* Add Client to Note */
async function attachClientToNote(contactId, contactName, contactType, contactEmail, portalState) {
  try {
    const payload = {
      id: portalState.selectedNoteId,
      updates: {
        contact_id: contactId,
        contact_name: contactName,
        contact_type: contactType,
        contact_email: contactEmail || null,
        updated_at: new Date().toISOString()
      }
    };

    const res = await fetch(
      "https://notes-history-module.dennis-e64.workers.dev",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok || data.status !== "ok") {
      alert(`❌ Failed to attach client: ${data.error || "Unknown error"}`);
      console.error("Attach error:", data);
      return;
    }

    alert("✅ Client attached to note.");

    // 🔄 Refresh Note Review so the updated client info shows immediately
    const container = document.getElementById("notesContent");
    if (container) {
      await renderReview(container, portalState, portalState.selectedNoteId);
    }
  } catch (err) {
    alert("Error attaching client: " + err.message);
    console.error(err);
  }
}


// 🔧 Make it globally accessible for inline onclick
window.attachClientToNote = attachClientToNote;




/* Relationships (GET /note_relationships) */
function renderRelationships(container, portalState) {
  console.log("[Relationships] Called with noteId:", portalState.selectedNoteId);

  if (!portalState.selectedNoteId) {
    container.innerHTML = `<p>Select a note from History to view relationships.</p>`;
    return;
  }
  container.innerHTML = `<h4>Relationships</h4><p>Note ID: ${portalState.selectedNoteId}</p>
    <div style="margin-top:8px;"><button id="btnRelFetch">Fetch relationships</button></div>
    <div id="relResult" style="margin-top:8px;"></div>`;
  document.getElementById("btnRelFetch").addEventListener("click", async () => {
    try {
      const params = new URLSearchParams({ project: portalState.project, note_id: portalState.selectedNoteId });
      const url = `https://notes-history-module.dennis-e64.workers.dev/note_relationships?${params}`;
      console.log("[Relationships] Fetching URL:", url);
      const res = await fetch(url, { cache: "no-cache" });
      console.log("[Relationships] Response JSON:", data);
      const data = await res.json();
      const result = document.getElementById("relResult");
      if (res.ok && data.status === "ok" && Array.isArray(data.relationships)) {
        const items = data.relationships.map(r =>
          `id ${r.id ?? "?"}: ${r.relationship_type ?? "type?"} — ${r.relationship_role ?? "role?"} — ${r.related_email ?? "email?"}`
        );
        result.innerHTML = items.length
          ? `<ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
          : "No relationships.";
      } else {
        result.textContent = `Error: ${data.error || "Unknown error"}`;
      }
    } catch (err) {
      document.getElementById("relResult").textContent = `Error: ${err.message}`;
    }
  });
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
