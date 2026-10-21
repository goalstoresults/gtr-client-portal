// js/contacts/tab-documents.js
// Contact Documents Tab
// List documents, download, delete, upload a final LOA PDF,
// and retry GHL link sync if the upload succeeds but sync fails.

import { escapeHtml, formatDateTime } from "../utilities.js";

const API_BASE = "https://client-portal-api.dennis-e64.workers.dev";
const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Prevent responses from an older render updating a newer view.
const renderVersions = new WeakMap();

/* -------------------------------------------------------
   MAIN ENTRY
------------------------------------------------------- */
export async function renderContactDocuments(container, portalState) {
  const renderVersion = (renderVersions.get(container) || 0) + 1;
  renderVersions.set(container, renderVersion);

  const isCurrentRender = () =>
    renderVersions.get(container) === renderVersion;

  const contactId = portalState.selectedContactId;
  const project = portalState.project;

  if (!contactId) {
    container.innerHTML = `
      <section class="card">
        <h2>Documents</h2>
        <p>Select a contact from the List tab first.</p>
      </section>
    `;
    return;
  }

  if (!project) {
    container.innerHTML = `
      <section class="card">
        <h2>Documents</h2>
        <p>Unable to load documents: missing project.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
        margin-bottom:12px;
      ">
        <h2 style="margin:0;">
          Documents for ${
            escapeHtml(portalState.selectedContactName || "")
          }
        </h2>

        <button
          type="button"
          class="btn-primary"
          data-action="show-upload"
          aria-expanded="false"
        >
          Upload PDF
        </button>
      </div>

      <section
        data-role="upload-panel"
        hidden
        style="
          border:1px solid #d7dce2;
          border-radius:6px;
          padding:16px;
          margin-bottom:16px;
          background:#fafbfc;
        "
      >
        <h3 style="margin-top:0;">Upload Final LOA PDF</h3>

        <p>
          Select the final PDF exported from the reviewed Word document.
          The PDF will be added to this contact's Documents list.
        </p>

        <p style="color:#704c00;">
          Uploading also requests an update to GHL's
          loa_pdf_link field. If your GHL workflow is enabled,
          that update may send the client email.
        </p>

        <form data-role="upload-form">
          <div
            data-role="drop-zone"
            style="
              border:2px dashed #aab4c0;
              border-radius:6px;
              padding:24px 16px;
              text-align:center;
              background:#fff;
              margin-bottom:12px;
            "
          >
            <p style="margin-top:0;">
              Drop a PDF here, or choose a file below.
            </p>

            <input
              type="file"
              data-role="pdf-input"
              accept=".pdf,application/pdf"
              aria-label="Choose final LOA PDF"
            >

            <p
              data-role="selected-file"
              style="margin-bottom:0; overflow-wrap:anywhere;"
            >
              No file selected.
            </p>
          </div>

          <p style="font-size:0.9em; color:#555;">
            PDF only. Maximum file size: 10 MB.
          </p>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button
              type="submit"
              class="btn-primary"
              data-role="upload-submit"
              disabled
            >
              Upload PDF &amp; Sync to GHL
            </button>

            <button
              type="button"
              data-action="cancel-upload"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <div
        data-role="documents-message"
        role="status"
        aria-live="polite"
        style="margin-bottom:12px;"
      ></div>

      <div
        data-role="sync-retry-panel"
        hidden
        style="margin-bottom:12px;"
      >
        <button
          type="button"
          class="btn-primary"
          data-action="retry-sync"
        >
          Retry GHL Sync
        </button>
      </div>

      <div data-role="documents-table">(loading…)</div>
    </section>
  `;

  const tableDiv = container.querySelector(
    '[data-role="documents-table"]'
  );
  const messageDiv = container.querySelector(
    '[data-role="documents-message"]'
  );
  const uploadPanel = container.querySelector(
    '[data-role="upload-panel"]'
  );
  const uploadForm = container.querySelector(
    '[data-role="upload-form"]'
  );
  const showUploadButton = container.querySelector(
    '[data-action="show-upload"]'
  );
  const cancelUploadButton = container.querySelector(
    '[data-action="cancel-upload"]'
  );
  const uploadSubmitButton = container.querySelector(
    '[data-role="upload-submit"]'
  );
  const fileInput = container.querySelector(
    '[data-role="pdf-input"]'
  );
  const selectedFileText = container.querySelector(
    '[data-role="selected-file"]'
  );
  const dropZone = container.querySelector(
    '[data-role="drop-zone"]'
  );
  const syncRetryPanel = container.querySelector(
    '[data-role="sync-retry-panel"]'
  );
  const retrySyncButton = container.querySelector(
    '[data-action="retry-sync"]'
  );

  let selectedFile = null;
  let uploadBusy = false;
  let fileCheckVersion = 0;
  let uploadId = null;
  let pendingSyncDocumentId = null;
  let tableLoadVersion = 0;

  /* -------------------------------------------------------
     MESSAGES
  ------------------------------------------------------- */
  function showMessage(text, type = "info") {
    if (!isCurrentRender()) return;

    const colors = {
      info: "#333",
      success: "#166534",
      warning: "#8a5700",
      error: "#b42318"
    };

    messageDiv.textContent = text || "";
    messageDiv.style.color = colors[type] || colors.info;
  }

  function setUploadBusy(busy) {
    uploadBusy = busy;
    fileInput.disabled = busy;
    cancelUploadButton.disabled = busy;
    showUploadButton.disabled = busy;

    uploadSubmitButton.disabled = busy || !selectedFile;
    uploadSubmitButton.textContent = busy
      ? "Uploading and syncing…"
      : "Upload PDF & Sync to GHL";
  }

  function resetFileSelection() {
    fileCheckVersion += 1;
    selectedFile = null;
    uploadId = null;
    fileInput.value = "";
    selectedFileText.textContent = "No file selected.";
    uploadSubmitButton.disabled = true;
    dropZone.style.borderColor = "#aab4c0";
  }

  function closeUploadPanel() {
    if (uploadBusy) return;

    resetFileSelection();
    uploadPanel.hidden = true;
    showUploadButton.setAttribute("aria-expanded", "false");
  }

  function setPendingSync(documentId) {
    pendingSyncDocumentId =
      documentId === undefined || documentId === null
        ? null
        : String(documentId);

    syncRetryPanel.hidden = !pendingSyncDocumentId;
  }

  /* -------------------------------------------------------
     SELECT / VALIDATE PDF
  ------------------------------------------------------- */
  async function selectPdf(file) {
    if (uploadBusy || !isCurrentRender()) return;

    resetFileSelection();
    const checkVersion = fileCheckVersion;

    if (!file) return;

    selectedFileText.textContent = "Checking PDF…";

    try {
      await validatePdf(file);

      if (
        !isCurrentRender() ||
        checkVersion !== fileCheckVersion
      ) {
        return;
      }

      selectedFile = file;
      uploadId = crypto.randomUUID();

      selectedFileText.textContent =
        `${file.name} (${formatFileSize(file.size)})`;

      uploadSubmitButton.disabled = false;
      showMessage("");
    } catch (error) {
      if (
        !isCurrentRender() ||
        checkVersion !== fileCheckVersion
      ) {
        return;
      }

      selectedFileText.textContent = "No valid PDF selected.";
      showMessage(error.message || "Invalid PDF.", "error");
    }
  }

  showUploadButton.addEventListener("click", () => {
    uploadPanel.hidden = false;
    showUploadButton.setAttribute("aria-expanded", "true");
    fileInput.focus();
  });

  cancelUploadButton.addEventListener("click", closeUploadPanel);

  fileInput.addEventListener("change", () => {
    void selectPdf(fileInput.files?.[0] || null);
  });

  dropZone.addEventListener("dragover", event => {
    event.preventDefault();

    if (!uploadBusy) {
      dropZone.style.borderColor = "#2878c8";
      event.dataTransfer.dropEffect = "copy";
    }
  });

  dropZone.addEventListener("dragleave", event => {
    if (!dropZone.contains(event.relatedTarget)) {
      dropZone.style.borderColor = "#aab4c0";
    }
  });

  dropZone.addEventListener("drop", event => {
    event.preventDefault();
    dropZone.style.borderColor = "#aab4c0";

    if (uploadBusy) return;

    const files = event.dataTransfer?.files;

    if (!files || files.length !== 1) {
      showMessage("Please select one PDF at a time.", "error");
      return;
    }

    void selectPdf(files[0]);
  });

  /* -------------------------------------------------------
     UPLOAD FINAL PDF

     Backend contract:
       POST /api/contact_documents/upload
       multipart/form-data:
         project
         contact_id
         upload_id
         title
         description
         file

     Success or partial success:
       {
         success: true,
         document: { id: ... },
         ghl_sync: {
           success: true | false,
           error?: "..."
         }
       }

     The backend must:
       1. Save PDF to private storage.
       2. Insert document row.
       3. Request GHL sync.
       4. Return the saved document even if GHL sync fails.
       5. Reuse upload_id on retries to avoid duplicate uploads.
  ------------------------------------------------------- */
  uploadForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (uploadBusy || !selectedFile) return;

    const fileToUpload = selectedFile;
    setUploadBusy(true);
    showMessage("Uploading PDF and updating GHL…");

    try {
      const formData = new FormData();
      formData.append("project", String(project));
      formData.append("contact_id", String(contactId));
      formData.append("upload_id", uploadId);
      formData.append("title", "Letter of Agreement (PDF)");
      formData.append(
        "description",
        "Final PDF uploaded by staff"
      );
      formData.append("file", fileToUpload, fileToUpload.name);

      const response = await fetch(
        `${API_BASE}/api/contact_documents/upload`,
        {
          method: "POST",
          body: formData
        }
      );

      const result = await readJsonResponse(response);

      if (!isCurrentRender()) return;

      // A saved document takes precedence over the HTTP status:
      // the backend may return partial success if GHL sync failed.
      const documentSaved =
        result.success === true &&
        result.document?.id !== undefined &&
        result.document?.id !== null;

      if (!documentSaved) {
        throw new Error(
          getApiError(result, response.status, "Upload failed")
        );
      }

      setUploadBusy(false);
      closeUploadPanel();

      if (result.ghl_sync?.success === true) {
        setPendingSync(null);

        showMessage(
          "PDF uploaded and loa_pdf_link updated in GHL.",
          "success"
        );
      } else {
        setPendingSync(result.document.id);

        const detail =
          result.ghl_sync?.error ||
          "GHL did not confirm the link update.";

        showMessage(
          `PDF uploaded, but GHL sync was not confirmed. ` +
          `${detail} Use Retry GHL Sync; do not upload again.`,
          "warning"
        );
      }

      await loadDocuments();
    } catch (error) {
      if (!isCurrentRender()) return;

      console.error("[Documents] Upload failed:", error);

      showMessage(
        `${error.message || "Upload failed."} ` +
        "If the request was interrupted, check the document list " +
        "before selecting the file again. Retrying this same " +
        "selection reuses its upload ID.",
        "error"
      );

      await loadDocuments();
    } finally {
      if (isCurrentRender()) {
        setUploadBusy(false);
      }
    }
  });

  /* -------------------------------------------------------
     RETRY GHL SYNC
     Does not re-upload the PDF.

     Backend contract:
       POST /api/contact_documents/sync-loa
       {
         project,
         contact_id,
         document_id
       }

     Response:
       {
         success: true
       }
  ------------------------------------------------------- */
  retrySyncButton.addEventListener("click", async () => {
    if (!pendingSyncDocumentId) return;

    const documentId = pendingSyncDocumentId;
    retrySyncButton.disabled = true;
    retrySyncButton.textContent = "Syncing…";
    showUploadButton.disabled = true;

    try {
      const response = await fetch(
        `${API_BASE}/api/contact_documents/sync-loa`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            project,
            contact_id: contactId,
            document_id: documentId
          })
        }
      );

      const result = await readJsonResponse(response);

      if (!response.ok || result.success !== true) {
        throw new Error(
          getApiError(result, response.status, "GHL sync failed")
        );
      }

      if (!isCurrentRender()) return;

      setPendingSync(null);

      showMessage(
        "loa_pdf_link updated in GHL. The PDF was not uploaded again.",
        "success"
      );
    } catch (error) {
      if (!isCurrentRender()) return;

      console.error("[Documents] GHL sync failed:", error);

      showMessage(
        `The PDF is saved, but GHL sync failed: ` +
        `${error.message || "Unknown error"}`,
        "warning"
      );
    } finally {
      if (isCurrentRender()) {
        retrySyncButton.disabled = false;
        retrySyncButton.textContent = "Retry GHL Sync";
        showUploadButton.disabled = uploadBusy;
      }
    }
  });

  /* -------------------------------------------------------
     LOAD / REFRESH DOCUMENTS
  ------------------------------------------------------- */
  async function loadDocuments() {
    const loadVersion = ++tableLoadVersion;

    tableDiv.innerHTML = "<p>Loading documents…</p>";

    try {
      const params = new URLSearchParams({
        project,
        contact_id: contactId
      });

      const response = await fetch(
        `${API_BASE}/api/contact_documents?${params}`,
        { cache: "no-cache" }
      );

      const result = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(
          getApiError(
            result,
            response.status,
            "Could not load documents"
          )
        );
      }

      if (!Array.isArray(result)) {
        throw new Error("The document list response was not an array.");
      }

      if (
        !isCurrentRender() ||
        loadVersion !== tableLoadVersion
      ) {
        return;
      }

      renderTable(result);
    } catch (error) {
      if (
        !isCurrentRender() ||
        loadVersion !== tableLoadVersion
      ) {
        return;
      }

      tableDiv.innerHTML = `
        <p>
          Error loading documents:
          ${escapeHtml(error.message || "Unknown error")}
        </p>
        <button type="button" data-action="reload-documents">
          Reload Documents
        </button>
      `;

      tableDiv
        .querySelector('[data-action="reload-documents"]')
        .addEventListener("click", () => {
          void loadDocuments();
        });

      console.error("[Documents] List failed:", error);
    }
  }

  /* -------------------------------------------------------
     RENDER TABLE
  ------------------------------------------------------- */
  function renderTable(docs) {
    const rows = docs.map(document => `
      <tr>
        <td>
          ${escapeHtml(
            String(document.title || document.file_name || "")
          )}
        </td>
        <td>
          ${escapeHtml(String(document.description || ""))}
        </td>
        <td>
          ${escapeHtml(formatStatus(document.status))}
        </td>
        <td>
          ${escapeHtml(
            String(formatDateTime(document.created_at) || "")
          )}
        </td>
        <td style="white-space:nowrap;">
          <button
            type="button"
            class="btn-primary btn-download"
            data-id="${escapeHtml(String(document.id))}"
          >
            Download
          </button>

          <button
            type="button"
            class="btn-danger btn-delete-doc"
            data-id="${escapeHtml(String(document.id))}"
            data-title="${escapeHtml(
              String(
                document.title ||
                document.file_name ||
                "this document"
              )
            )}"
            style="
              background:#dc3545;
              color:#fff;
              border-color:#dc3545;
              margin-left:6px;
            "
          >
            Delete
          </button>
        </td>
      </tr>
    `).join("");

    tableDiv.innerHTML = `
      <h4>
        Showing ${docs.length}
        document${docs.length === 1 ? "" : "s"}
      </h4>

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
          ${
            rows ||
            '<tr><td colspan="5">(no documents yet)</td></tr>'
          }
        </tbody>
      </table>
    `;

    bindDownloadButtons();
    bindDeleteButtons();
  }

  /* -------------------------------------------------------
     DOWNLOAD
     Preserves the existing staff download behavior.
     The client-facing loa_pdf_link is separate.
  ------------------------------------------------------- */
  function bindDownloadButtons() {
    tableDiv.querySelectorAll(".btn-download").forEach(button => {
      button.addEventListener("click", async () => {
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = "Preparing…";

        try {
          const params = new URLSearchParams({
            project,
            contact_id: contactId,
            id: button.dataset.id
          });

          const response = await fetch(
            `${API_BASE}/api/contact_documents/download?${params}`,
            { cache: "no-cache" }
          );

          const result = await readJsonResponse(response);

          if (!response.ok || !result.url) {
            throw new Error(
              getApiError(
                result,
                response.status,
                "Could not prepare download"
              )
            );
          }

          if (!isCurrentRender()) return;

          const link = document.createElement("a");
          link.href = result.url;
          link.download = result.file_name || "";
          document.body.appendChild(link);
          link.click();
          link.remove();
        } catch (error) {
          console.error("[Documents] Download failed:", error);

          if (isCurrentRender()) {
            alert(
              `Download failed: ${error.message || "Unknown error"}`
            );
          }
        } finally {
          button.disabled = false;
          button.textContent = originalText;
        }
      });
    });
  }

  /* -------------------------------------------------------
     DELETE
  ------------------------------------------------------- */
  function bindDeleteButtons() {
    tableDiv.querySelectorAll(".btn-delete-doc").forEach(button => {
      button.addEventListener("click", async () => {
        const title = button.dataset.title || "this document";

        if (!confirm(
          `Are you sure you want to delete "${title}"?\n\n` +
          "This cannot be undone. If it is a linked LOA PDF, " +
          "the client will no longer be able to view that file."
        )) {
          return;
        }

        button.disabled = true;
        button.textContent = "Deleting…";

        try {
          const params = new URLSearchParams({
            project,
            id: button.dataset.id
          });

          const response = await fetch(
            `${API_BASE}/api/contact_documents?${params}`,
            { method: "DELETE" }
          );

          const result = await readJsonResponse(response);

          if (!response.ok || result.success !== true) {
            throw new Error(
              getApiError(
                result,
                response.status,
                "Could not delete document"
              )
            );
          }

          if (!isCurrentRender()) return;

          if (
            pendingSyncDocumentId === String(button.dataset.id)
          ) {
            setPendingSync(null);
          }

          showMessage("Document deleted.", "success");
          await loadDocuments();
        } catch (error) {
          console.error("[Documents] Delete failed:", error);

          if (isCurrentRender()) {
            showMessage(
              `Delete failed: ${error.message || "Unknown error"}`,
              "error"
            );

            button.disabled = false;
            button.textContent = "Delete";
          }
        }
      });
    });
  }

  await loadDocuments();
}

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */
function formatStatus(status) {
  const value = String(status || "");
  return value
    ? value.charAt(0).toUpperCase() + value.slice(1)
    : "";
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function validatePdf(file) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Please select a PDF file.");
  }

  if (!/\.pdf$/i.test(file.name || "")) {
    throw new Error("The selected file must have a .pdf extension.");
  }

  if (file.size === 0) {
    throw new Error("The selected PDF is empty.");
  }

  if (file.size > MAX_PDF_BYTES) {
    throw new Error("The PDF exceeds the 10 MB limit.");
  }

  // Basic signature check only.
  // The backend must independently validate every upload.
  const firstBytes = new Uint8Array(
    await file.slice(0, 5).arrayBuffer()
  );

  const signature = Array.from(
    firstBytes,
    byte => String.fromCharCode(byte)
  ).join("");

  if (signature !== "%PDF-") {
    throw new Error(
      "The selected file does not have a valid PDF header."
    );
  }
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    throw new Error(
      `The server returned an empty response (HTTP ${response.status}).`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `The server did not return JSON (HTTP ${response.status}). ` +
      "Check that the matching backend route is deployed."
    );
  }
}

function getApiError(result, status, fallback) {
  const parts = [
    typeof result?.error === "string"
      ? result.error
      : typeof result?.message === "string"
        ? result.message
        : `${fallback} (HTTP ${status})`,

    typeof result?.detail === "string"
      ? result.detail
      : ""
  ];

  return parts.filter(Boolean).join(" — ");
}
