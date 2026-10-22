// js/contacts/tab-documents.js
// Contact Documents Tab — grid of documents for the selected contact
// with Upload PDF + Download + Delete buttons

import { escapeHtml, formatDateTime } from "../utilities.js";

// Client API worker (has /api/contact_documents)
const API_BASE = "https://client-portal-api.dennis-e64.workers.dev";

// Branded route assigned to the portal-to-ghl-sync Worker.
// That Worker must handle POST /loa/update-loa-pdf-link.
const GHL_SYNC_BASE = "https://gtr-tools.com/loa";

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

  let uploadInProgress = false;

  showUploadBtn.addEventListener("click", () => {
    uploadForm.hidden = false;
    showUploadBtn.hidden = true;
    fileInput.focus();
  });

  cancelBtn.addEventListener("click", () => {
    if (uploadInProgress) return;

    uploadForm.reset();
    uploadMessage.textContent = "";
    uploadForm.hidden = true;
    showUploadBtn.hidden = false;
  });

  uploadForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (uploadInProgress) return;

    const file = fileInput.files[0];

    if (!file || !/\.pdf$/i.test(file.name)) {
      uploadMessage.textContent = "Please select a PDF file.";
      return;
    }

    if (!portalState.project) {
      uploadMessage.textContent =
        "Missing project. Reload the portal before uploading.";
      return;
    }

    const project = portalState.project;
    const syncEndpoint =
      `${GHL_SYNC_BASE.replace(/\/+$/, "")}/update-loa-pdf-link`;

    // Do not redraw another contact if the user switches tabs
    // or selects a different contact while these requests run.
    const stillViewingThisContact = () =>
      portalState.selectedContactId === contactId &&
      portalState.project === project &&
      container.contains(uploadForm);

    uploadInProgress = true;
    uploadBtn.disabled = true;
    cancelBtn.disabled = true;
    fileInput.disabled = true;
    uploadBtn.textContent = "Uploading…";
    uploadMessage.textContent = "Uploading and saving the PDF…";

    let pdfSaved = false;
    let saveUncertain = false;
    let phase = "upload";

    try {
      /* ---------------------------------------------------
         CALL 1: CLIENT API
         Upload PDF + save document row + return PDF URL

         No GHL update occurs in client-portal-api.
      --------------------------------------------------- */
      const formData = new FormData();
      formData.append("project", project);
      formData.append("contact_id", contactId);
      formData.append("file", file);

      let uploadRes;

      try {
        uploadRes = await fetch(
          `${API_BASE}/api/contact_documents/upload`,
          {
            method: "POST",
            body: formData
          }
        );
      } catch (error) {
        // A lost response does not prove the file was not saved.
        saveUncertain = true;
        throw error;
      }

      let result;

      try {
        result = await uploadRes.json();
      } catch {
        saveUncertain = true;
        throw new Error("The upload response could not be read.");
      }

      if (!uploadRes.ok || !result?.success) {
        pdfSaved = result?.uploaded === true;
        saveUncertain =
          result?.save_uncertain === true ||
          (uploadRes.ok && !result?.success);

        throw new Error(
          [
            result?.error || `HTTP ${uploadRes.status}`,
            result?.detail
          ]
            .filter(Boolean)
            .join(" — ")
        );
      }

      pdfSaved = true;
      phase = "sync";

      const documentId = result.document?.id;
      const pdfUrl = result.pdf_url;

      if (!documentId || !pdfUrl) {
        throw new Error(
          "The upload succeeded, but its response did not include " +
          "the saved document ID and PDF URL."
        );
      }

      /* ---------------------------------------------------
         CALL 2: GHL SYNC WORKER
         Branded endpoint:
         https://gtr-tools.com/loa/update-loa-pdf-link

         Updates the contact's loa_pdf_link field.
      --------------------------------------------------- */
      uploadBtn.textContent = "Updating GHL…";
      uploadMessage.textContent =
        "PDF saved. Updating the contact's GHL PDF link…";

      const syncRes = await fetch(syncEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          project,
          contact_id: contactId,
          document_id: documentId,
          pdf_url: pdfUrl
        })
      });

      let syncResult;

      try {
        syncResult = await syncRes.json();
      } catch {
        throw new Error(
          "The GHL update response could not be read. " +
          "The update may have completed, but was not confirmed."
        );
      }

      if (!syncRes.ok || !syncResult?.success) {
        throw new Error(
          [
            syncResult?.error || `HTTP ${syncRes.status}`,
            syncResult?.detail
          ]
            .filter(Boolean)
            .join(" — ")
        );
      }

      /* ---------------------------------------------------
         BOTH CALLS COMPLETE: REFRESH DOCUMENT TABLE
      --------------------------------------------------- */
      phase = "refresh";
      uploadMessage.textContent =
        "PDF saved and GHL link updated. Refreshing documents…";

      if (stillViewingThisContact()) {
        await renderContactDocuments(container, portalState);
      }
    } catch (err) {
      console.error(`[Documents] ${phase} failed:`, err);

      if (pdfSaved) {
        const message = phase === "refresh"
          ? (
              "The PDF was saved and the GHL link was updated, " +
              "but refreshing the document table failed.\n\n" +
              "Do not upload the PDF again.\n\n" +
              (err.message || "Unknown error")
            )
          : (
              "The PDF is already saved in the portal, but the GHL " +
              "link update was not confirmed.\n\n" +
              "Do not upload the PDF again.\n\n" +
              (err.message || "Unknown error")
            );

        alert(message);

        // Refresh even when the separate GHL update fails,
        // because the PDF and document row are already saved.
        if (stillViewingThisContact()) {
          await renderContactDocuments(container, portalState);
        }
      } else if (saveUncertain) {
        alert(
          "The PDF upload could not be confirmed. It may already " +
          "have been saved.\n\n" +
          "Check the document table before uploading again. " +
          "The GHL update was not started.\n\n" +
          (err.message || "Unknown error")
        );

        if (stillViewingThisContact()) {
          await renderContactDocuments(container, portalState);
        }
      } else {
        uploadMessage.textContent =
          `Upload failed: ${err.message || "Unknown error"}`;
      }
    } finally {
      uploadInProgress = false;
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

    const res = await fetch(
      `${API_BASE}/api/contact_documents?${params}`,
      { cache: "no-cache" }
    );
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    }

    const docs = Array.isArray(data) ? data : [];

    /* -------------------------------------------------------
       RENDER TABLE
       Replaces the Status column with a clickable link column.
       The link is the same branded URL saved into GHL's
       loa_pdf_link field, so staff see exactly what the
       customer would see in their email.
    ------------------------------------------------------- */
    const rows = docs.map(d => `
      <tr>
        <td>${escapeHtml(d.title || d.file_name || "")}</td>
        <td>${escapeHtml(d.description || "")}</td>
        <td>
          ${
            d.public_token
              ? `<a href="${GHL_SYNC_BASE}/${encodeURIComponent(d.public_token)}"
                     target="_blank"
                     rel="noopener noreferrer"
                     title="Open the branded PDF link in a new tab"
                     style="color:#1a73e8; text-decoration:underline;">
                     View PDF
                   </a>`
              : `<span style="color:#888;">—</span>`
          }
        </td>
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
            <th>Link</th>
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
            throw new Error(
              [
                result?.error || `HTTP ${delRes.status}`,
                result?.detail
              ]
                .filter(Boolean)
                .join(" — ")
            );
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
