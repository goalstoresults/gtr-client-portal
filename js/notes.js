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
    console.log("[Review] Fetching URL:", url);
    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();
    console.log("[Review] Response JSON:", data);

    if (!res.ok || !data.note) {
      container.innerHTML = `<p>Error loading note review: ${data.error || "Not found"}</p>`;
      return;
    }

    const note = data.note;
    const relationships = data.relationships || [];

    container.innerHTML = `
      <section class="card">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <h2 style="margin:0;">Note Review</h2>
          <button id="btnSetClient" class="primary">Set Client</button>
        </div>

        <p><strong>Subject:</strong> ${note.subject || "(no subject)"}</p>
        <p><strong>From:</strong> ${note.from_name || "(unknown)"} (${note.from_email || "no email"})</p>
        <p><strong>Created:</strong> ${note.created}</p>
        <p><strong>Client:</strong> ${note.client_name || "(unknown)"}</p>
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

      <section id="setClientForm" class="card" style="display:none; margin-top:16px;">
        <h3>Attach Client to Note</h3>
        <div class="row" style="gap:12px; margin-bottom:12px;">
          <input id="filter-first" placeholder="First name" />
          <input id="filter-last" placeholder="Last name" />
          <input id="filter-email" placeholder="Email" />
          <button id="btnFindClient" class="primary">Find</button>
        </div>
        <div id="clientSearchResults" class="muted">Enter criteria and click Find.</div>
      </section>
    `;

    // Toggle Set Client form
    document.getElementById("btnSetClient").addEventListener("click", () => {
      const form = document.getElementById("setClientForm");
      form.style.display = form.style.display === "none" ? "block" : "none";
    });

    // Find client handler
    document.getElementById("btnFindClient").addEventListener("click", async () => {
      const first = document.getElementById("filter-first").value.trim();
      const last = document.getElementById("filter-last").value.trim();
      const email = document.getElementById("filter-email").value.trim();

      if (email) {
        if (email.length < 3) { alert("Email must be at least 3 characters."); return; }
      } else {
        if (!first || !last) { alert("Both first and last name required."); return; }
        if (first.length < 3 || last.length < 3) { alert("Names must be at least 3 characters."); return; }
      }

      const base = "https://client-portal-api.dennis-e64.workers.dev/api/contacts";
      const qs = new URLSearchParams();
      qs.set("select", "contact_id,first_name,last_name,email,type");

      if (email) {
        qs.set("project.eq", portalState.project);
        qs.set("email.ilike", `*${email}*`);
      } else {
        qs.set("project.eq", portalState.project);
        qs.set("first_name.ilike", `*${first}*`);
        qs.set("last_name.ilike", `*${last}*`);
      }

      const searchUrl = `${base}?${qs.toString()}`;
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
          ? rows.map(r => `
              <div style="padding:8px; border-bottom:1px solid #eee; cursor:pointer;"
                   onclick="attachClientToNote('${r.contact_id}', '${(r.first_name || "")} ${(r.last_name || "")}', '${(r.type || "contact")}', '${(r.email || "")}')">
                <strong>${(r.first_name || "")} ${(r.last_name || "")}</strong>
                <span class="muted">${r.email || ""}</span>
              </div>
            `).join("")
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

// Helper to attach client
async function attachClientToNote(contactId, contactName, contactType, contactEmail) {
  try {
    const res = await fetch(
      `https://notes-history-module.dennis-e64.workers.dev?project=${encodeURIComponent(activeProject)}&id=eq.${selectedNoteId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          contact_name: contactName,
          contact_type: contactType,
          contact_email: contactEmail || null,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      alert(`❌ Failed to attach client (${res.status}). ${msg}`);
      return;
    }

    alert("✅ Client attached to note.");
  } catch (err) {
    alert("Error attaching client: " + err.message);
  }
}




// Helper stays the same; ensure it uses your current globals or pass args
async function attachClientToNote(contactId, contactName, contactType, contactEmail) {
  try {
    const res = await fetch(
      `https://notes-history-module.dennis-e64.workers.dev?project=${encodeURIComponent(activeProject)}&id=eq.${selectedNoteId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          contact_name: contactName,
          contact_type: contactType,
          contact_email: contactEmail || null,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      alert(`❌ Failed to attach client (${res.status}). ${msg}`);
      return;
    }

    alert("✅ Client attached to note.");
  } catch (err) {
    alert("Error attaching client: " + err.message);
  }
}



// Attach client helper
async function attachClientToNote(contactId, contactName, contactType, contactEmail) {
  try {
    const res = await fetch(
      `https://notes-history-module.dennis-e64.workers.dev?project=${encodeURIComponent(activeProject)}&id=eq.${selectedNoteId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          contact_name: contactName,
          contact_type: contactType,
          contact_email: contactEmail || null,
          updated_at: new Date().toISOString()
        })
      }
    );

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      alert(`❌ Failed to attach client (${res.status}). ${msg}`);
      return;
    }

    alert("✅ Client attached to note.");
  } catch (err) {
    alert("Error attaching client: " + err.message);
  }
}




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
