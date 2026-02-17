// js/contacts/tab-notes.js
// Modularized Contact Notes Tab

import { escapeHtml, formatDateTime } from "../utilities.js";

/* -------------------------------------------------------
   MAIN ENTRY: Render Contact Notes
------------------------------------------------------- */
export async function renderContactNotes(container, portalState, contactId) {
  if (!portalState.project || !contactId) {
    container.innerHTML = `
      <section class="card">
        <h2>Contact Notes</h2>
        <p>Select a contact from the list first, then open Notes.</p>
      </section>
    `;
    return;
  }

  const url = `https://contacts-module.dennis-e64.workers.dev/notes_history?project=${portalState.project}&contact_id=${contactId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let notes = await res.json();
  if (!Array.isArray(notes)) notes = [];

  /* -------------------------------------------------------
     RENDER NOTES TABLE + ADD BUTTON
  ------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">

      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2>Notes</h2>
        <button id="contactAddNoteBtn" class="btn-primary">+ Add Note</button>
      </div>

      <table class="notes-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Subject</th>
            <th>Summary</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="notesRows">
          ${
            notes.length > 0
              ? notes.map((n, idx) => `
                  <tr>
                    <td>${n.note_date ? formatDateTime(n.note_date) : ""}</td>
                    <td>${escapeHtml(n.subject || "")}</td>
                    <td>${escapeHtml(n.summary || "")}</td>
                    <td>
                      <button class="btn-secondary btn-expand" data-idx="${idx}" style="display:flex; align-items:center; gap:4px;">
                        ▶ Expand
                      </button>
                    </td>
                  </tr>

                  <tr class="note-details" data-idx="${idx}" style="display:none;">
                    <td colspan="4" style="background:#f9f9f9; padding:12px;">
                      <div><strong>From:</strong> ${escapeHtml(n.from_name || "")} (${escapeHtml(n.from_email || "")})</div>
                      <div><strong>Status:</strong> ${escapeHtml(n.review_status || "")}</div>
                      <div><strong>Needs Review:</strong> ${n.needs_review ? "Yes" : "No"}</div>

                      <div style="margin-top:8px;"><strong>Raw Text:</strong></div>
${
  /<(p|div|br|ul|ol|li|strong|em|span|html|body|a)(\s|>)/i.test(n.raw_text)
    ? `
        <div class="html-note-block">
          ${n.raw_text}
        </div>
      `
    : `
        <div class="raw-text-block">
          ${n.raw_text}
        </div>
      `
}

                      <button class="btn-primary btn-review-note" data-id="${n.id}" style="margin-top:8px; margin-right:8px;">
                        Review Note
                      </button>

                      <button class="btn-danger btn-delete-note" data-id="${n.id}" style="margin-top:8px;">
                        Delete Note
                      </button>
                    </td>
                  </tr>
                `).join("")
              : `<tr><td colspan="4">(no notes yet)</td></tr>`
          }
        </tbody>
      </table>
    </section>
  `;

  /* -------------------------------------------------------
     ADD NOTE BUTTON HANDLER
  ------------------------------------------------------- */
  document.getElementById("contactAddNoteBtn")
    ?.addEventListener("click", () =>
      showContactAddNoteForm(container, portalState, contactId)
    );

  /* -------------------------------------------------------
     EXPAND / COLLAPSE HANDLERS
  ------------------------------------------------------- */
  container.querySelectorAll(".btn-expand").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.idx;
      const row = container.querySelector(`.note-details[data-idx="${idx}"]`);
      const isVisible = row.style.display !== "none";

      row.style.display = isVisible ? "none" : "table-row";
      btn.innerHTML = isVisible ? "▶ Expand" : "▼ Collapse";
    });
  });

  /* -------------------------------------------------------
     DELETE NOTE HANDLERS
  ------------------------------------------------------- */
  container.querySelectorAll(".btn-delete-note").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this note?")) return;

      const noteId = btn.dataset.id;

      await fetch(
        `https://notes-history-module.dennis-e64.workers.dev/note_history?id=${noteId}&project=${portalState.project}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json", "x-internal-call": "internal" }
        }
      );


      await renderContactNotes(container, portalState, contactId);
    });
  });

  /* -------------------------------------------------------
     REVIEW NOTE HANDLER — JUMP TO NOTES → REVIEW
  ------------------------------------------------------- */
  container.querySelectorAll(".btn-review-note").forEach(btn => {
    btn.addEventListener("click", () => {
      const noteId = btn.dataset.id;

      portalState.selectedNoteId = noteId;

      const notesTabBtn = document.querySelector('#tabs button[data-tab="3"]');
      if (notesTabBtn) notesTabBtn.click();

      const waitForReviewTab = setInterval(() => {
        const reviewBtn = document.querySelector('#notes-subtabs button[data-subtab="review"]');
        if (reviewBtn) {
          clearInterval(waitForReviewTab);
          reviewBtn.click();
        }
      }, 50);
    });
  });
}

/* -------------------------------------------------------
   ADD NOTE FORM (Contacts → Notes)
------------------------------------------------------- */
function showContactAddNoteForm(container, portalState, contactId) {
  container.innerHTML = `
    <section class="card">
      <h3>Add Note for ${portalState.selectedContactName}</h3>

      <label>Date:</label>
      <input type="date" id="noteDate"
             value="${new Date().toISOString().split('T')[0]}"
             style="width:200px;margin-bottom:8px;" />

      <br/>
      <label>Subject:</label>
      <input type="text" id="noteSubject" style="width:100%;margin-bottom:8px;" />

      <label>Note:</label>
      <textarea id="noteContent" rows="6" style="width:100%;"></textarea>

      <div style="margin-top:12px;">
        <button id="saveContactNoteBtn" class="btn-primary">Save Note</button>
        <button id="cancelContactNoteBtn" class="btn-secondary" style="margin-left:8px;">Cancel</button>
      </div>

      <div id="contactNoteAddResult" style="margin-top:8px;"></div>
    </section>
  `;

  document.getElementById("saveContactNoteBtn")
    .addEventListener("click", () =>
      saveContactNote(portalState, contactId, container)
    );

  document.getElementById("cancelContactNoteBtn")
    .addEventListener("click", () =>
      renderContactNotes(container, portalState, contactId)
    );
}

/* -------------------------------------------------------
   SAVE NOTE (same logic as Notes → Add)
------------------------------------------------------- */
async function saveContactNote(portalState, contactId, container) {
  const noteDate = document.getElementById("noteDate").value;
  const subject = document.getElementById("noteSubject").value.trim();
  const content = document.getElementById("noteContent").value.trim();

  if (!content) {
    document.getElementById("contactNoteAddResult").textContent =
      "Note text is required.";
    return;
  }

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
        subject: subject || null,
        contact_id: contactId,
        contact_name: portalState.selectedContactName,
        contact_email: portalState.selectedContactEmail
      })
    });

    const data = await res.json();

    if (data.success || data.status === "ok") {
      await renderContactNotes(container, portalState, contactId);
    } else {
      document.getElementById("contactNoteAddResult").textContent =
        `Error: ${data.error || "Unknown error"}`;
    }
  } catch (err) {
    document.getElementById("contactNoteAddResult").textContent =
      `Error: ${err.message}`;
  }
}
