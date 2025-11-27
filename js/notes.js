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
    // --- Build query params ---
    const fromDate = document.getElementById("filter-from")?.value;
    const toDate   = document.getElementById("filter-to")?.value;
    const reviewOnly = document.getElementById("filter-review-only")?.checked ?? true;

    const params = new URLSearchParams({
      project: portalState.project,
      reviewOnly: reviewOnly ? "true" : "false"
    });
    if (fromDate) params.append("from", fromDate);
    if (toDate)   params.append("to", toDate);

    const url = `https://notes-history-module.dennis-e64.workers.dev/notes_history?${params.toString()}`;
    console.log("[History] Fetching:", url);

    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    // --- Build filter UI first ---
    container.innerHTML = `
      <h4>Notes History ${Array.isArray(data.notes) ? `(Total: ${data.notes.length})` : ""}</h4>
      <div style="margin-bottom:12px;">
        <label>From: <input type="date" id="filter-from" value="${fromDate || ""}"></label>
        <label style="margin-left:12px;">To: <input type="date" id="filter-to" value="${toDate || ""}"></label>
        <label style="margin-left:12px;">
          <input type="checkbox" id="filter-review-only" ${reviewOnly ? "checked" : ""}>
          Needs Review Only
        </label>
        <button id="btnApplyFilter" class="secondary" style="margin-left:12px;">Apply Filter</button>
        <button id="btnClearFilter" class="secondary" style="margin-left:12px;">Clear Filter</button>
      </div>
    `;

    // --- Show table or "No notes found" ---
    if (!res.ok || data.status !== "ok" || !Array.isArray(data.notes) || data.notes.length === 0) {
      container.innerHTML += `<p>No notes found.</p>`;
    } else {
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

      // Attach Review button handlers
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
    }

    // --- Attach filter button handlers (always present) ---
    document.getElementById("btnApplyFilter").addEventListener("click", () => {
      renderHistory(container, portalState);
    });
    document.getElementById("btnClearFilter").addEventListener("click", () => {
      document.getElementById("filter-from").value = "";
      document.getElementById("filter-to").value = "";
      document.getElementById("filter-review-only").checked = true;
      renderHistory(container, portalState);
    });

  } catch (err) {
    container.innerHTML = `
      <h4>Notes History</h4>
      <p>Error loading history: ${err.message}</p>
    `;
  }
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

    function buildDropdown(options, selectedValue) {
      return `<select>
        <option value="Select">-- Select --</option>
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
        <td class="rel-type">${buildDropdown(types, r.relationship_type)}</td>
        <td class="rel-role">${buildDropdown(roles, r.relationship_role)}</td>
        <td class="rel-contact-id">${escapeHtml(r.contact_id || "")}</td>
        <td class="rel-contact-name">${escapeHtml(r.contact_name || "")}</td>
        <td>
          <input type="text"
                 class="contact-type-input"
                 value="${escapeHtml(r.contact_type || "")}"
                 style="width:120px;"
                 ${!r.contact_id ? "disabled" : ""}>
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
    
    const type = typeSelect?.value?.trim();
    const role = roleSelect?.value?.trim();
    
    if (!type || type === "Select" || !role || role === "Select") {
      alert("❌ Please select both Relationship Type and Role before searching for a contact.");
      return;
    }
    

    // ✅ Always render the inline search form
    row.querySelector("td:last-child").innerHTML = `
      <div>
        <input class="search-first" placeholder="First name"/>
        <input class="search-last" placeholder="Last name"/>
        <button class="do-search">Find</button>
        <div class="search-results muted">Enter criteria and click Find.</div>
      </div>
    `;

    // ✅ Wire up Find button click
    row.querySelector(".do-search").addEventListener("click", async () => {
      const first = row.querySelector(".search-first").value.trim();
      const last = row.querySelector(".search-last").value.trim();
      if (!first && !last) {
        alert("Enter at least a first or last name.");
        return;
      }

      const filters = [];
      if (first) filters.push(`first_name.ilike.*${first}*`);
      if (last)  filters.push(`last_name.ilike.*${last}*`);

      const query = filters.length > 1
        ? `and=(${filters.join(",")})`
        : filters[0];

      const searchUrl = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${query}&select=contact_id,first_name,last_name,email,contact_type`;
      console.log("[GetID] Search URL:", searchUrl);

      try {
        const resp = await fetch(searchUrl);
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
              const row = document.querySelector(`tr[data-relid="${el.dataset.relid}"]`);
          
              // Hydrate the row with selected contact info
              row.querySelector(".rel-contact-id").textContent = el.dataset.contactid || "";
              row.querySelector(".rel-contact-name").textContent = el.dataset.name || "";
              row.querySelector(".rel-contact-type").textContent = el.dataset.type || "";
              row.querySelector(".rel-contact-email").textContent = el.dataset.email || "";
          
              // Swap Action cell to promotion checkbox
              row.querySelector("td:last-child").innerHTML = `<input type="checkbox" class="promote-checkbox"/>`;
          
              alert("✅ Contact populated into relationship row.");
            });
          });
        
      } catch (err) {
        console.error("Search error:", err);
        alert("Network error during search.");
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
    const contactType = row.querySelector(".contact-type-input")?.value.trim() || "";
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
