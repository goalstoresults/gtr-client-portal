// js/contacts/tab-documents.js
// Contact Documents Tab — grid of documents for the selected contact
// with Upload PDF + Download + Delete buttons

import { escapeHtml, formatDateTime } from "../utilities.js";

// Client API worker (has /api/contact_documents)
const API_BASE = "https://client-portal-api.dennis-e64.workers.dev";

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

      <button type="button" class="btn-primary" id="showUploadPdf"
              style="margin-bottom:12px;">
        Upload PDF
      </button>

      <form id="uploadPdfForm" hidden
            style="border:1px solid #ccc; padding:16px; margin-bottom:16px;">
        <h3 style="margin-top:0;">Upload PDF</h3>

        <label for="documentPdfFile">Select a PDF file:</label>
        <input type="file" id="documentPdfFile" name="file"
               accept=".pdf,application/pdf" required
               style="display:block; margin:10px 0 14px;">

        <button type="submit" class="btn-primary" id="submitUploadPdf">
          Upload
        </button>

        <button type="button" id="cancelUploadPdf"
                style="margin-left:6px;">
          Cancel
        </button>

        <p id="uploadPdfMessage" role="status"></p>
      </form>

      <div id="documentsTable">(loading…)</div>
    </section>
  `;

  const tableDiv = container.querySelector("#documentsTable");

  /* -------------------------------------------------------
     UPLOAD PDF
  ------------------------------------------------------- */
  const showUploadBtn = container.querySelector("#showUploadPdf");
  const uploadForm = container.querySelector("#uploadPdfForm");
  const fileInput = container.querySelector("#documentPdfFile");
  const uploadBtn = container.querySelector("#submitUploadPdf");
  const cancelBtn = container.querySelector("#cancelUploadPdf");
  const uploadMessage = container.querySelector("#uploadPdfMessage");

  showUploadBtn.addEventListener("click", () => {
    uploadForm.hidden = false;
    showUploadBtn.hidden = true;
    fileInput.focus();
  });

  cancelBtn.addEventListener("click", () => {
    uploadForm.reset();
    uploadMessage.textContent = "";
    uploadForm.hidden = true;
    showUploadBtn.hidden = false;
  });

  uploadForm.addEventListener("submit", async event => {
    event.preventDefault();

    const file = fileInput.files[0];

    if (!file || !/\.pdf$/i.test(file.name)) {
      uploadMessage.textContent = "Please select a PDF file.";
      return;
    }

    uploadBtn.disabled = true;
    cancelBtn.disabled = true;
    fileInput.disabled = true;
    uploadBtn.textContent = "Uploading…";
    uploadMessage.textContent = "";

    try {
      const formData = new FormData();
      formData.append("project", portalState.project);
      formData.append("contact_id", contactId);
      formData.append("file", file);

      const uploadRes = await fetch(
        `${API_BASE}/api/contact_documents/upload`,
        {
          method: "POST",
          body: formData
        }
      );

      const result = await uploadRes.json();

      if (!uploadRes.ok || !result.success) {
        throw new Error(
          [result?.error || `HTTP ${uploadRes.status}`, result?.detail]
            .filter(Boolean)
            .join(" — ")
        );
      }

      // The backend returns ghl_sync.success=false if the PDF
      // saved successfully but the server-to-server GHL update failed.
      if (result.ghl_sync?.success === false) {
        alert(
          "The PDF was uploaded, but the GHL link update failed. " +
          "Do not upload the PDF again.\n\n" +
          (result.ghl_sync.error || "Check the backend sync result.")
        );
      }

      // Reload the existing document grid.
      await renderContactDocuments(container, portalState);
    } catch (err) {
      console.error("[Documents] Upload failed:", err);
      uploadMessage.textContent =
        `Upload failed: ${err.message || "Unknown error"}`;
    } finally {
      uploadBtn.disabled = false;
      cancelBtn.disabled = false;
      fileInput.disabled = false;
      uploadBtn.textContent = "Upload";
    }
  });

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
        <td>${escapeHtml(formatStatus(d.status))}</td>
        <td>${formatDateTime(d.created_at)}</td>
        <td style="white-space:nowrap;">
          <button class="btn-primary btn-download" data-id="${d.id}">Download</button>
          <button class="btn-danger btn-delete-doc" data-id="${d.id}"
                  data-title="${escapeHtml(d.title || d.file_name || "this document")}"
                  style="background:#dc3545; color:#fff; border-color:#dc3545; margin-left:6px;">Delete</button>
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
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5">(no documents yet)</td></tr>`}
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

    /* -------------------------------------------------------
       DELETE BUTTONS
       Confirm first, then delete the file and the table row
    ------------------------------------------------------- */
    tableDiv.querySelectorAll(".btn-delete-doc").forEach(btn => {
      btn.addEventListener("click", async () => {
        const title = btn.dataset.title || "this document";
        if (!confirm(`Are you sure you want to delete "${title}"?\n\nThis cannot be undone.`)) {
          return;
        }

        btn.disabled = true;
        btn.textContent = "Deleting…";

        try {
          const delParams = new URLSearchParams({
            project: portalState.project,
            id: btn.dataset.id
          });

          const delRes = await fetch(
            `${API_BASE}/api/contact_documents?${delParams}`,
            { method: "DELETE" }
          );
          const result = await delRes.json().catch(() => ({}));

          if (!delRes.ok || !result.success) {
            throw new Error([result?.error || `HTTP ${delRes.status}`, result?.detail].filter(Boolean).join(" — "));
          }

          // Reload the grid
          await renderContactDocuments(container, portalState);
        } catch (err) {
          console.error("[Documents] Delete failed:", err);
          alert(`Delete failed: ${err.message || "Unknown error"}`);
          btn.disabled = false;
          btn.textContent = "Delete";
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

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */
function formatStatus(status) {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
