// js/notes.js v1.3.0
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
  // ✅ Expose a stable reference for cross-tab navigation
  window.portalState = portalState;
  
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

/* Notes History (GET /notes-history-module) */
async function renderHistory(container, portalState) {
  try {
    const reviewOnly = document.getElementById("filter-review-only")?.checked ?? true;

    // Worker call unchanged, always limit 500
    const params = new URLSearchParams({
      project: portalState.project,
      reviewOnly: reviewOnly ? "true" : "false",
      limit: "500"
    });
    const url = `https://notes-history-module.dennis-e64.workers.dev/notes_history?${params.toString()}`;
    console.log("[History] Fetching:", url);

    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();
    const notes = Array.isArray(data?.notes) ? data.notes : [];

    // Track sort state
    if (!portalState.notesSort) {
      portalState.notesSort = { column: "created_at", direction: "desc" };
    }

    // Sort helper
    function sortNotes(notes, column, direction) {
      return [...notes].sort((a, b) => {
        let va = a[column] || "";
        let vb = b[column] || "";
        if (column === "created_at") {
          va = new Date(va);
          vb = new Date(vb);
        } else {
          va = va.toString().toLowerCase();
          vb = vb.toString().toLowerCase();
        }
        if (va < vb) return direction === "asc" ? -1 : 1;
        if (va > vb) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    const sortedNotes = sortNotes(notes, portalState.notesSort.column, portalState.notesSort.direction);

    // Build UI
    container.innerHTML = `
      <h4>Notes History (Total: ${sortedNotes.length})</h4>
      <div style="margin-bottom:12px; display:flex; align-items:center; gap:12px;">
        <label>
          <input type="checkbox" id="filter-review-only" ${reviewOnly ? "checked" : ""}>
          Needs Review Only
        </label>
        <button id="btnApplyFilter" class="secondary">Apply Filter</button>
        <button id="btnClearFilter" class="secondary">Clear Filter</button>
      </div>
      <table class="notes-table">
        <thead>
          <tr>
            <th>
              Created
              <button class="sort-btn" data-col="created_at" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="created_at" data-dir="desc">▼</button>
            </th>
            <th>
              Subject
              <button class="sort-btn" data-col="subject" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="subject" data-dir="desc">▼</button>
            </th>
            <th>
              From
              <button class="sort-btn" data-col="from_name" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="from_name" data-dir="desc">▼</button>
            </th>
            <th>
              Client
              <button class="sort-btn" data-col="contact_name" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="contact_name" data-dir="desc">▼</button>
            </th>
            <th>
              Needs Review
              <button class="sort-btn" data-col="needs_review" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="needs_review" data-dir="desc">▼</button>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${sortedNotes.length > 0
            ? sortedNotes.map(n => `
                <tr>
                  <td>${formatDateTimeSafe(n.created_at)}</td>
                  <td>${n.subject || ""}</td>
                  <td>${n.from_name || ""}</td>
                  <td>${n.contact_name || ""}</td>
                  <td>${n.needs_review ? "Yes" : "No"}</td>
                  <td><button class="btn-primary btn-review" data-id="${n.id}">Review</button></td>
                </tr>
              `).join("")
            : `<tr><td colspan="6">(no notes found)</td></tr>`
          }
        </tbody>
      </table>
    `;

    // Wire Review buttons
    container.querySelectorAll(".btn-review").forEach(btn => {
      btn.addEventListener("click", () => {
        const noteId = btn.dataset.id;
        portalState.selectedNoteId = noteId;
        setSubtabEnabled("review", true);
        setSubtabEnabled("relationships", true);
        document.querySelectorAll("#notes-subtabs button").forEach(b => b.classList.remove("active"));
        document.querySelector('#notes-subtabs button[data-subtab="review"]')?.classList.add("active");
        renderReview(container, portalState, noteId);
      });
    });

    // Wire filter buttons
    document.getElementById("btnApplyFilter").addEventListener("click", () => {
      renderHistory(container, portalState);
    });
    document.getElementById("btnClearFilter").addEventListener("click", () => {
      document.getElementById("filter-review-only").checked = true;
      renderHistory(container, portalState);
    });

    // Wire sort buttons (client-side)
    container.querySelectorAll(".sort-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const col = btn.dataset.col;
        const dir = btn.dataset.dir;
        portalState.notesSort = { column: col, direction: dir };
        renderHistory(container, portalState); // re-render with new sort
      });
    });

  } catch (err) {
    container.innerHTML = `<h4>Notes History</h4><p>Error loading history: ${err.message}</p>`;
  }
}

// Helper
function formatDateTimeSafe(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("en-US", {
    month: "2-digit", day: "2-digit", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true
  });
}





/* Add (POST /notes-history-module) */
function renderAdd(container, portalState) {
  container.innerHTML = `<h4>Add Note (v1.2.7)</h4>
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

    // ✅ Hydrate clientId if note already has a client
    if (note.client_id) {
      portalState.clientId = note.client_id;
    } else if (note.contact_id) {
      portalState.clientId = note.contact_id;
    }

    console.log("[Review] Hydrated clientId:", portalState.clientId);
    
    container.innerHTML = `
      <section class="card">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <h2 style="margin:0;">Note Review: ${escapeHtml(note.subject || "(no subject)")}</h2>
          <button id="btnSetClient" class="primary"
                  style="background:#2979ff; color:#fff; border:none; border-radius:6px; padding:8px 14px; font-weight:500; cursor:pointer;">
            Set Client
          </button>
          <button id="btnDeleteNote" class="primary"
                  style="background:#e53935; color:#fff; border:none; border-radius:6px; padding:8px 14px; font-weight:500; cursor:pointer;">
            Delete
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
          <div style="display:flex; align-items:center; gap:12px; margin-top:20px;">
            <h3 style="margin:0;">Relationships Detected in Note</h3>
            ${
              note.contact_id
                ? `<button id="btnRelationships" class="primary"
                           style="background:#2979ff; color:#fff; border:none; border-radius:6px; padding:8px 14px; font-weight:500; cursor:pointer;">
                     Notes Relationships
                   </button>`
                : `<span style="color:#999; font-size:0.9em;">(need to set client to continue)</span>`
            }
          </div>
          <table class="notes-table" style="margin-top:12px;">
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

    // Delete note + relationships
    document.getElementById("btnDeleteNote").addEventListener("click", async () => {
      if (!confirm("Are you sure you want to delete this note and all its relationships?")) return;

      try {
        const noteId = portalState.selectedNoteId;
        const project = portalState.project;

        // Delete relationships first
        const relUrl = `https://notes-history-module.dennis-e64.workers.dev/note_relationships?project=${project}&note_id=${noteId}`;
        const relRes = await fetch(relUrl, { method: "DELETE" });
        if (!relRes.ok) {
          const msg = await relRes.text().catch(() => "");
          alert(`Failed to delete relationships: ${msg}`);
          return;
        }

        // Delete note itself
        const noteUrl = `https://notes-history-module.dennis-e64.workers.dev/note_history?id=${noteId}&project=${project}`;
        const noteRes = await fetch(noteUrl, { method: "DELETE" });
        if (!noteRes.ok) {
          const msg = await noteRes.text().catch(() => "");
          alert(`Failed to delete note: ${msg}`);
          return;
        }

        alert("✅ Note and relationships deleted.");

        // Reset UI back to History view
        const container = document.getElementById("notesContent");
        if (container) {
          await renderHistory(container, portalState);
          document.querySelectorAll("#notes-subtabs button").forEach(b => b.classList.remove("active"));
          document.querySelector('#notes-subtabs button[data-subtab="history"]')?.classList.add("active");
        }
      } catch (err) {
        alert("Error deleting note: " + err.message);
        console.error(err);
      }
    });

    // Relationships button handler
    const relBtn = document.getElementById("btnRelationships");
    if (relBtn) {
      relBtn.addEventListener("click", () => {
        // Switch tab highlight to Relationships
        document.querySelectorAll("#notes-subtabs button").forEach(b => b.classList.remove("active"));
        document.querySelector('#notes-subtabs button[data-subtab="relationships"]')?.classList.add("active");

        // Render Relationships tab
        renderRelationships(container, portalState);
      });
    }

document.getElementById("btnFindClient").addEventListener("click", async () => {
  const first = document.getElementById("filter-first").value.trim();
  const last = document.getElementById("filter-last").value.trim();

  if (!first && !last) {
    alert("Enter at least a first or last name.");
    return;
  }
  if ((first && first.length < 3) || (last && last.length < 3)) {
    alert("Names must be at least 3 characters.");
    return;
  }

  const filters = [`project.eq.${portalState.project}`];
  if (first) filters.push(`first_name.ilike.*${first}*`);
  if (last)  filters.push(`last_name.ilike.*${last}*`);

  const filterClause = filters.length > 1
    ? `and=(${filters.join(",")})`
    : filters[0];

  const selectCols = "contact_id,first_name,last_name,email,contact_type";
  const searchUrl = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${filterClause}&select=${selectCols}`;
  console.log("[SetClient] Searching contacts:", searchUrl);

  try {
    const resp = await fetch(searchUrl);
    if (!resp.ok) {
      const msg = await resp.text().catch(() => "");
      alert(`Search failed (${resp.status}). ${msg}`);
      return;
    }
    const rows = await resp.json();
    const resultsDiv = document.getElementById("clientSearchResults");
    resultsDiv.innerHTML = rows.length > 0
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
    console.error(err);
  }
}




      
/* Add Client to Note */
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

    // ✅ Set clientId so Relationships tab can use it
    portalState.clientId = contactId;

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
// Frontend helper: attach a contact to a relationship row
// Attach a relationship contact from the "Detected Relationships" table
async function attachRelationshipContact(row, project, noteId) {
  try {
    // Grab values from the row
    const rawName = (row.querySelector(".rel-raw")?.textContent || "").trim();
    const typeVal = (row.querySelector(".rel-type select")?.value || "").trim();
    const roleVal = (row.querySelector(".rel-role select")?.value || "").trim();


    // ✅ Validation: both dropdowns must have valid values
    if (!typeVal || typeVal === "Select" || !roleVal || roleVal === "Select") {
      alert("❌ Please select both Relationship Type and Role before getting Contact ID.");
      return;
    }

    // Build payload for backend
    const payload = {
      project,
      note_id: noteId,
      raw_name: rawName,
      relationship_type: typeVal,
      relationship_role: roleVal
    };

    console.log("📤 attachRelationshipContact payload:", JSON.stringify(payload, null, 2));

    // Call your Worker endpoint
    const res = await fetch(`/api/relationships_bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project, rows: [payload] })
    });

    const data = await res.json();
    console.log("📥 attachRelationshipContact response:", data);

    if (!data.success) {
      alert("❌ Failed to attach relationship: " + (data.error || "Unknown error"));
      return;
    }

    // ✅ Update the row with returned contact info
    const rel = data.relationships[0];
    row.querySelector(".rel-contact-id").textContent = rel.related_contact_id || "";
    row.querySelector(".rel-contact-name").textContent = rel.related_name || "";
    row.querySelector(".rel-contact-type").textContent = rel.related_type || "";
    row.querySelector(".rel-contact-email").textContent = rel.related_email || "";

    alert("✅ Contact ID attached successfully.");
  } catch (err) {
    console.error("attachRelationshipContact error:", err);
    alert("❌ Error attaching relationship: " + err.message);
  }
}

// 🔧 Make it globally accessible for inline onclick
window.attachRelationshipContact = attachRelationshipContact;


/* Relationships (GET /note_relationships) */
async function renderRelationships(container, portalState) {
  const noteId = portalState.selectedNoteId;
  const project = portalState.project;

  if (!noteId) {
    container.innerHTML = `<p>Select a note from History to view relationships.</p>`;
    return;
  }

  try {
    // --- Step 1: Fetch note review (subject + detected relationships) ---
    const reviewUrl = `https://notes-history-module.dennis-e64.workers.dev/note_review?project=${project}&id=${noteId}`;
    const res = await fetch(reviewUrl);
    const data = await res.json();

    const subject = data.note?.subject || "(no subject)";
    const clientName = data.note?.contact_name || "(unknown)";
    const clientEmail = data.note?.contact_email || "";

    const rows = data.relationships || [];

    // --- Step 2: Fetch lookups for dropdowns ---
    const lookupUrl = `https://client-portal-api.dennis-e64.workers.dev/api/lookups?project=${project}`;
    const lookupRes = await fetch(lookupUrl);
    const lookupData = await lookupRes.json();

    const roles = lookupData
      .filter(l => l.lookup_type === "relationship_role")
      .sort((a, b) => a.sort_order - b.sort_order);

    const types = lookupData
      .filter(l => l.lookup_type === "relationship_type")
      .sort((a, b) => a.sort_order - b.sort_order);

    const contactTypes = lookupData
      .filter(l => l.lookup_type === "contact_type" && l.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    function buildDropdown(options, selectedValue, className = "") {
      return `<select class="${className}">
        <option value="">-- Select --</option>
        ${options.map(opt => `
          <option value="${escapeHtml(opt.value)}"
                  ${opt.value === selectedValue ? "selected" : ""}>
            ${escapeHtml(opt.value)}
          </option>`).join("")}
      </select>`;
    }


    // --- Step 3: Build base UI ---
    container.innerHTML = `
      <section class="card">
        <h2>Relationships for Note: ${escapeHtml(subject)}</h2>

        <!-- 👇 Client reference line -->
        <p>
          Client: ${escapeHtml(clientName)} (${escapeHtml(clientEmail)})
        </p>

        <div id="existingRelationships" class="card" style="margin-bottom:16px;">
          <h3>Existing Contact Relationships</h3>
          <div id="existingRelGrid"></div>
        </div>

        <h3 style="margin-top:20px;">Detected Relationships in Note</h3>
        <table class="notes-table">
          <thead>
            <tr>
              <th>Raw Name</th>
              <th>Relationship Type</th>
              <th>Relationship Role</th>
              <th>Contact ID</th>
              <th>Contact Name</th>
              <th>Contact Type</th>
              <th>Contact Email</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="relationshipsGrid"></tbody>
        </table>

        <div style="margin-top:12px;">
          <button id="btnSaveRelationships" class="primary"
                  style="background:#2979ff; color:#fff; border:none; border-radius:6px; padding:8px 14px; font-weight:500; cursor:pointer;">
            Save Relationships
          </button>
          <label style="margin-left:12px;">
            <input type="checkbox" id="chkReviewComplete" checked />
            Review Complete
          </label>
        </div>

      </section>
    `;

// --- Step 4: Populate detected relationships with dropdowns ---
const grid = document.getElementById("relationshipsGrid");
grid.innerHTML = rows.map(r => `
  <tr data-relid="${r.id}">
    <td class="rel-raw">${escapeHtml(r.raw_name || "")}</td>
    <td class="rel-type">${buildDropdown(types, r.relationship_type, "rel-type-dropdown")}</td>
    <td class="rel-role">${buildDropdown(roles, r.relationship_role, "rel-role-dropdown")}</td>
    <td class="rel-contact-id">${escapeHtml(r.contact_id || "")}</td>
    <td class="rel-contact-name">${escapeHtml(r.contact_name || "")}</td>
    <td class="rel-contact-type">
      ${buildDropdown(contactTypes, r.contact_type, "contact-type-dropdown")}
    </td>
    <td class="rel-contact-email">${escapeHtml(r.contact_email || "")}</td>
    <td>
      ${
        r.contact_id
          ? `<input type="checkbox" class="promote-checkbox"/>`
          : `<button class="get-id-btn">Get Contact ID</button>`
      }
    </td>
  </tr>
`).join("");

grid.querySelectorAll(".get-id-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    const row = e.target.closest("tr");
    const relId = row.dataset.relid;

    const typeSelect = row.querySelector(".rel-type select");
    const roleSelect = row.querySelector(".rel-role select");

    const type = typeSelect?.value?.trim() || "";
    const role = roleSelect?.value?.trim() || "";

    if (!type || !role) {
      alert("❌ Please select both Relationship Type and Role before searching for a contact.");
      return;
    }

    // ✅ Render search form HTML
    row.querySelector("td:last-child").innerHTML = `
      <div class="inline-search">
        <input class="search-first" placeholder="First name"/>
        <input class="search-last" placeholder="Last name"/>
        <button class="do-search">Find</button>
        <div class="search-results muted">Enter criteria and click Find.</div>
      </div>
    `;

      // ✅ Create and append "+ Add Contact 2" link
      // const searchContainer = row.querySelector(".inline-search");
      // if (searchContainer) {
      //   const addContactLink = document.createElement("a");
      //  addContactLink.href = "#";
      //  addContactLink.textContent = "+ Add Contact 2";
      //  addContactLink.className = "notes-link";
      //  addContactLink.style.marginLeft = "12px";
      
        // Capture portalState in closure
       // addContactLink.addEventListener("click", ev => {
       //   ev.preventDefault();
       //   openQuickAddContactModal(row, project);
       //   });
      
       // searchContainer.appendChild(addContactLink);
      //  }

      // ✅ Wire up Find button click
      row.querySelector(".do-search").addEventListener("click", async () => {
        const first = row.querySelector(".search-first").value.trim();
        const last = row.querySelector(".search-last").value.trim();
        if (!first && !last) {
          alert("Enter at least a first or last name.");
          return;
        }
      
        // ✅ Always include project filter, using dot notation
        const filters = [`project.eq.${project}`];
        if (first) filters.push(`first_name.ilike.*${first}*`);
        if (last)  filters.push(`last_name.ilike.*${last}*`);
      
        const query = filters.length > 1
          ? `and=(${filters.join(",")})`
          : filters[0];
      
        const searchUrl = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${query}&select=contact_id,first_name,last_name,email,contact_type`;
        console.log("[GetID] Search URL:", searchUrl);
      
        try {
          const resp = await fetch(searchUrl);
          if (!resp.ok) {
            const msg = await resp.text().catch(() => "");
            alert(`Search failed (${resp.status}). ${msg}`);
            return;
          }
      
          const contacts = await resp.json();
          const resultsDiv = row.querySelector(".search-results");
          resultsDiv.innerHTML = contacts.length > 0
            ? contacts.map(c => `
                <div class="contact-result"
                     data-relid="${relId}"
                     data-contactid="${c.contact_id}"
                     data-name="${c.first_name} ${c.last_name}"
                     data-type="${c.contact_type}"
                     data-email="${c.email}">
                  <strong>${c.first_name} ${c.last_name}</strong> (${c.contact_type})<br/>
                  <small>${c.email}</small>
                </div>
              `).join("")
            : "<div class='muted'>No contacts found.</div>";
      
          // ✅ Attach click handlers to results
          resultsDiv.querySelectorAll(".contact-result").forEach(el => {
            el.addEventListener("click", () => {
              const targetRow = document.querySelector(`tr[data-relid="${el.dataset.relid}"]`);
      
              // Hydrate the row with selected contact info
              targetRow.querySelector(".rel-contact-id").textContent = el.dataset.contactid || "";
              targetRow.querySelector(".rel-contact-name").textContent = el.dataset.name || "";
      
              const typeDropdown = targetRow.querySelector(".contact-type-dropdown");
              if (typeDropdown) {
                typeDropdown.value = el.dataset.type || "";
              }
      
              targetRow.querySelector(".rel-contact-email").textContent = el.dataset.email || "";
      
              // Swap Action cell to promotion checkbox
              targetRow.querySelector("td:last-child").innerHTML = `<input type="checkbox" class="promote-checkbox"/>`;
      
              alert("✅ Contact populated into relationship row.");
            });
          });
        } catch (err) {
          alert("Network error searching contacts");
          console.error(err);
        }
      });
  });
});


// --- Step 5: Populate existing contact relationships ---
const relUrl = `https://client-portal-api.dennis-e64.workers.dev/api/contact_relationships?project=${project}&source_contact_id=${portalState.clientId}`;
try {
  const relRes = await fetch(relUrl);
  const relData = await relRes.json();

  const existingGrid = document.getElementById("existingRelGrid");
  if (Array.isArray(relData) && relData.length > 0) {
    existingGrid.innerHTML = `
      <table class="notes-table">
        <thead>
          <tr>
            <th>Related Name</th>
            <th>Relationship Type</th>
            <th>Relationship Role</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          ${relData.map(r => {
            const relatedName = r.contacts
              ? `${r.contacts.first_name} ${r.contacts.last_name}`.trim()
              : "(unknown)";
            return `
              <tr>
                <td>${escapeHtml(relatedName)}</td>
                <td>${escapeHtml(r.relationship_type || "")}</td>
                <td>${escapeHtml(r.relationship_role || "")}</td>
                <td>${escapeHtml(r.created_at || "")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  } else {
    existingGrid.innerHTML = "<p>No existing relationships found.</p>";
  }
} catch (err) {
  console.error("Existing relationships fetch error:", err);
  document.getElementById("existingRelGrid").innerHTML = "<p>Error loading existing relationships.</p>";
}

// --- Step 6: Save Relationships handler ---
document.getElementById("btnSaveRelationships").addEventListener("click", async () => {
  const promoteRows = [...grid.querySelectorAll("tr")].filter(r => r.querySelector(".promote-checkbox")?.checked);

  if (promoteRows.length === 0) {
    alert("No relationships selected.");
    return;
  }

  for (const row of promoteRows) {
    const relId = row.dataset.relid;
    const contactId = row.querySelector("td:nth-child(4)").textContent.trim();
    const type = row.querySelector("td:nth-child(2) select").value.trim();
    const role = row.querySelector("td:nth-child(3) select").value.trim();

    if (!contactId) {
      alert("❌ Cannot save relationship without a Contact ID.");
      continue;
    }
    if (!role || !type) {
      alert("❌ Relationship Type and Role cannot be blank.");
      continue;
    }

    // Step 1: PATCH notes_relationships
    const contactName = row.querySelector(".rel-contact-name").textContent.trim();
    // 🔧 FIX: use dropdown instead of old input
    const contactType = row.querySelector(".contact-type-dropdown")?.value || "";
    const contactEmail = row.querySelector(".rel-contact-email").textContent.trim();

    const patchPayload = {
      relationship_type: type,
      relationship_role: role,
      contact_id: contactId,
      contact_name: contactName,
      contact_type: contactType,
      contact_email: contactEmail
    };

    try {
      const patchRes = await fetch(
        `https://notes-history-module.dennis-e64.workers.dev/notes_relationships?id=eq.${relId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchPayload)
        }
      );
      if (!patchRes.ok) {
        const patchText = await patchRes.text();
        alert(`❌ Failed to update note relationship: ${patchText}`);
        continue;
      }
    } catch (err) {
      console.error("PATCH error:", err);
      alert("Network error while updating note relationship.");
      continue;
    }

    // Step 2: POST contact_relationships
    const insertPayload = {
      project: portalState.project,
      source_contact_id: portalState.clientId,
      related_contact_id: contactId,
      relationship_role: role,
      relationship_type: type,
      notes: "", // schema has notes, not email
      created_at: new Date().toISOString()
    };

    console.log("[SaveRelationships] Insert payload:", JSON.stringify(insertPayload, null, 2));

    try {
      const res = await fetch("https://client-portal-api.dennis-e64.workers.dev/api/contact_relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(insertPayload)
      });

      const text = await res.text();
      console.log("[SaveRelationships] POST contact_relationships:", res.status, text);

      if (!res.ok) {
        alert(`❌ Failed to save relationship: ${text}`);
      } else {
        console.log("Relationship saved successfully");
      }
    } catch (err) {
      console.error("Relationship error:", err);
      alert("Network error while saving relationship.");
    }

    // Step 3: PATCH contacts table to update master contact_type
    if (contactId && contactType) {
      try {
        const url = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?contact_id=eq.${encodeURIComponent(contactId)}`;
        const payload = { contact_type: contactType };
    
        console.log("[PATCH contacts] URL:", url);
        console.log("[PATCH contacts] Payload:", payload);
    
        const contactPatchRes = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
    
        const responseText = await contactPatchRes.text();
        console.log("[PATCH contacts] Status:", contactPatchRes.status, responseText);
    
        if (!contactPatchRes.ok) {
          console.warn(`⚠️ Failed to update contact_type in contacts: ${responseText}`);
        } else {
          console.log(`✅ Contact ${contactId} type updated to ${contactType}`);
        }
      } catch (err) {
        console.error("Contact PATCH error:", err);
      }
    }
  }

  // ✅ Handle Review Complete checkbox
  const reviewComplete = document.getElementById("chkReviewComplete").checked;
  if (reviewComplete) {
    try {
      await fetch(
        "https://notes-history-module.dennis-e64.workers.dev/notes_history",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            id: noteId,
            updates: { needs_review: false }
          })
        }
      );
      console.log("Note marked as reviewed.");
    } catch (err) {
      console.error("Failed to update needs_review:", err);
    }
  }

  alert("✅ Relationships saved.");
  
  // Reset UI back to History view
  await renderHistory(container, portalState);
  document.querySelectorAll("#notes-subtabs button").forEach(b => b.classList.remove("active"));
  document.querySelector('#notes-subtabs button[data-subtab="history"]')?.classList.add("active");

});
} catch (err) {
  console.error("renderRelationships error:", err);
  container.innerHTML = `<p>Error loading relationships: ${err.message}</p>`;
}
} // end of renderRelationships


function buildDropdown(options, selectedValue, className = "") {
  return `<select class="${className}">
    <option value="">-- Select --</option>
    ${options.map(opt => `
      <option value="${escapeHtml(opt.value)}"
              ${opt.value === selectedValue ? "selected" : ""}>
        ${escapeHtml(opt.value)}
      </option>`).join("")}
  </select>`;
}

function openQuickAddContactModal(row, project) {
  const modal = document.createElement("div");
  modal.className = "notes-modal";

  modal.innerHTML = `
    <div class="notes-modal-card">
      <h4 style="margin:0 0 8px;">Quick Add Contact</h4>
      <div class="row" style="gap:8px; margin-bottom:8px;">
        <input class="qc-first" placeholder="First name" />
        <input class="qc-last" placeholder="Last name" />
      </div>
      <div class="row" style="gap:8px; margin-bottom:8px;">
        <input class="qc-email" placeholder="Email" />
        <input class="qc-type" placeholder="Contact type" />
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button class="qc-cancel secondary">Cancel</button>
        <button class="qc-save primary">Save</button>
      </div>
      <div class="qc-status muted" style="margin-top:8px;"></div>
    </div>
  `;

  document.body.appendChild(modal);

  // Cancel closes modal
  modal.querySelector(".qc-cancel").addEventListener("click", () => modal.remove());

  // Save creates contact
  modal.querySelector(".qc-save").addEventListener("click", async () => {
    const first  = modal.querySelector(".qc-first").value.trim();
    const last   = modal.querySelector(".qc-last").value.trim();
    const email  = modal.querySelector(".qc-email").value.trim();
    const type   = modal.querySelector(".qc-type").value.trim();
    const status = modal.querySelector(".qc-status");

    if (!first || !last) {
      status.textContent = "First and last name are required.";
      return;
    }

    const payload = {
      project,
      first_name: first,
      last_name: last,
      email: email || null,
      contact_type: type || null,
      created_at: new Date().toISOString()
    };
    
    try {
      const resp = await fetch("https://client-portal-api.dennis-e64.workers.dev/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await resp.text();
      let created = null;
      try { created = JSON.parse(text); } catch {}

      // Supabase proxy may return an array or a single object
      const contactId =
        (Array.isArray(created) && created[0]?.contact_id) ||
        created?.contact_id ||
        null;

      if (!contactId) {
        status.textContent = "Contact saved, but ID not returned.";
        return;
      }

      // Hydrate relationship row
      const fullName = `${first} ${last}`.trim();
      row.querySelector(".rel-contact-id").textContent = contactId;
      row.querySelector(".rel-contact-name").textContent = fullName;
      row.querySelector(".rel-contact-email").textContent = email || "";
      const typeDropdown = row.querySelector(".contact-type-dropdown");
      if (typeDropdown) typeDropdown.value = type || "";

      // Replace Action cell with promote checkbox
      row.querySelector("td:last-child").innerHTML = `<input type="checkbox" class="promote-checkbox"/>`;

      modal.remove();
      alert("✅ Contact created and populated into the relationship row.");
    } catch (err) {
      status.textContent = "Network error creating contact.";
      console.error(err);
    }
  });
}

window.openQuickAddContactModal = openQuickAddContactModal;




/* -------------------------
   Utils
------------------------- */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
