// js/contacts/tab-documents.js
// Contact Documents Tab — grid of documents for the selected contact with Download buttons

import { escapeHtml, formatDateTime } from "../utilities.js";

// ⚠️ Set this to your client API worker's URL (the one with /api/contact_documents)
const API_BASE = "https://YOUR-CLIENT-API-WORKER.dennis-e64.workers.dev";

/* -------------------------------------------------------
   MAIN ENTRY: Render Contact Documents
------------------------------------------------------- */
export async function renderContactDocuments(container, portalState) {
  const contactId = portalState.selectedContactId;

  if (!contactId) {
    container.innerHTML = `
      <section class="card">
        <h2>Documents</h2>
        <p>Select a contact from the List tab first.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Documents for ${escapeHtml(portalState.selectedContactName || "")}</h2>
      <div id="documentsTable">(loading…)</div>
    </section>
  `;

  const tableDiv = container.querySelector("#documentsTable");

  try {
    /* -------------------------------------------------------
       LOAD DOCUMENTS
    ------------------------------------------------------- */
    const params = new URLSearchParams({
      project: portalState.project,
      contact_id: contactId
    });

    const res = await fetch(`${API_BASE}/api/contact_documents?${params}`, { cache: "no-cache" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    }

    const docs = Array.isArray(data) ? data : [];

    /* -------------------------------------------------------
       RENDER TABLE
    ------------------------------------------------------- */
    const rows = docs.map(d => `
      <tr>
        <td>${escapeHtml(d.title || d.file_name || "")}</td>
        <td>${escapeHtml(d.description || "")}</td>
        <td>${formatDateTime(d.created_at)}</td>
        <td>
          <button class="btn-primary btn-download" data-id="${d.id}">Download</button>
        </td>
      </tr>
    `).join("");

    tableDiv.innerHTML = `
      <h4>Showing ${docs.length} document${docs.length === 1 ? "" : "s"}</h4>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="4">(no documents yet)</td></tr>`}
        </tbody>
      </table>
    `;

    /* -------------------------------------------------------
       DOWNLOAD BUTTONS
       Asks the API for a 60-second signed link, then downloads it
    ------------------------------------------------------- */
    tableDiv.querySelectorAll(".btn-download").forEach(btn => {
      btn.addEventListener("click", async () => {
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Preparing…";

        try {
          const dlParams = new URLSearchParams({
            project: portalState.project,
            contact_id: contactId,
            id: btn.dataset.id
          });

          const dlRes = await fetch(
            `${API_BASE}/api/contact_documents/download?${dlParams}`,
            { cache: "no-cache" }
          );
          const dl = await dlRes.json();

          if (!dlRes.ok || !dl.url) {
            throw new Error(dl?.error || `HTTP ${dlRes.status}`);
          }

          // Trigger the download without leaving the portal
          const a = document.createElement("a");
          a.href = dl.url;
          a.download = dl.file_name || "";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (err) {
          console.error("[Documents] Download failed:", err);
          alert(`Download failed: ${err.message || "Unknown error"}`);
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });

  } catch (err) {
    tableDiv.innerHTML = `
      <p>Error loading documents: ${escapeHtml(err.message || "Unknown error")}</p>
    `;
    console.error("[Documents] Error in renderContactDocuments:", err);
  }
}
