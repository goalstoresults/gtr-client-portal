// js/leads/tab-list.js
// Lead List with Entered Stage and inline status editing.
// Delete button temporarily commented out.
// To ISN is hidden when stage_name is "Sent to ISN".
// Successful ISN order creation updates the stage to "Sent to ISN".

import { escapeHtml, formatDateTime } from "../utilities.js";

const LEADS_API_URL =
  "https://leads-module.dennis-e64.workers.dev";

const CSI_ISN_GATEWAY_URL =
  "https://csi-isn-gateway.dennis-e64.workers.dev";

const LEAD_STATUSES = ["Open", "Won", "Lost", "Abandoned"];

export async function renderLeadsList(container, portalState) {
  let tableDiv = null;

  try {
    /* -------------------------------------------------------
       INTERNAL STATE
    ------------------------------------------------------- */

    const project = portalState.project;

    let leads = [];
    let currentSortField = "updated_at";
    let currentSortDirection = "desc";

    let editingLeadId = null;
    let draftStatus = "";
    let statusError = "";
    let statusSaving = false;
    let loading = false;

    // Keep uncertain/completed transfers from being resent
    // by another table render during this list session.
    const transferLocks = new Map();

    /* -------------------------------------------------------
       RENDER FILTER BAR + TABLE SHELL
    ------------------------------------------------------- */

    container.innerHTML = `
      <section class="card">
        <h2>Leads</h2>

        <div style="
          display:flex;
          align-items:flex-start;
          gap:20px;
          flex-wrap:wrap;
          margin-bottom:6px;
        ">
          <label style="display:flex; flex-direction:column;">
            <span>
              Search Lead /
              ${escapeHtml(portalState.contactLabel || "Contact")}
              / Status
            </span>

            <input
              type="text"
              id="leadSearchInput"
              style="min-width:240px;"
            >

            <div style="
              font-size:0.75em;
              color:#666;
              margin-top:2px;
            ">
              Tip: Leave blank for full list.
            </div>
          </label>
        </div>

        <div style="
          display:flex;
          gap:10px;
          margin-bottom:12px;
        ">
          <button
            type="button"
            id="btnApplyLeadFilter"
            class="secondary"
          >
            Apply Filter
          </button>

          <button
            type="button"
            id="btnClearLeadFilter"
            class="secondary"
          >
            Clear Filter
          </button>

          ${
            portalState.canEdit
              ? `
                <button
                  type="button"
                  id="btnAddLead"
                  class="btn-primary"
                >
                  Add Lead
                </button>
              `
              : ""
          }
        </div>

        <p
          id="leadListMessage"
          role="status"
          aria-live="polite"
          hidden
        ></p>

        <div id="leadTable">(loading…)</div>
      </section>
    `;

    const card = container.querySelector(".card");

    tableDiv = container.querySelector("#leadTable");

    const searchInput =
      container.querySelector("#leadSearchInput");

    const applyButton =
      container.querySelector("#btnApplyLeadFilter");

    const clearButton =
      container.querySelector("#btnClearLeadFilter");

    const addLeadButton =
      container.querySelector("#btnAddLead");

    const listMessage =
      container.querySelector("#leadListMessage");

    const isCurrent = () =>
      card.isConnected &&
      portalState.project === project;

    const canDeleteLead = () =>
      portalState.full_admin === true &&
      portalState.canEdit === true &&
      portalState.isDemoAccount !== true;

    /* -------------------------------------------------------
       GENERAL HELPERS
    ------------------------------------------------------- */

    function safe(value) {
      return escapeHtml(String(value ?? ""));
    }

    function canonicalStatus(value) {
      const raw = String(value || "").trim().toLowerCase();

      return LEAD_STATUSES.find(
        status => status.toLowerCase() === raw
      ) || "";
    }

    function displayStatus(value) {
      return canonicalStatus(value) || String(value || "");
    }

    function showMessage(message, isError = false) {
      listMessage.textContent = message;
      listMessage.hidden = !message;
      listMessage.style.color = isError ? "#b91c1c" : "";
    }

    function closeStatusEditor() {
      editingLeadId = null;
      draftStatus = "";
      statusError = "";
    }

    function updateFilterControls() {
      const disabled = loading || statusSaving;

      searchInput.disabled = disabled;
      applyButton.disabled = disabled;
      clearButton.disabled = disabled;

      if (addLeadButton) {
        addLeadButton.disabled = disabled;
      }
    }

    function timestampValue(value) {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {
        return null;
      }

      const raw = String(value).trim();

      const hasTimezone =
        /(?:Z|[+-]\d{2}:?\d{2}|[+-]\d{2})$/i.test(raw);

      const normalized =
        hasTimezone ? raw : raw + "Z";

      const parsed = Date.parse(normalized);

      return Number.isFinite(parsed) ? parsed : null;
    }

    function compareTimestamps(a, b, direction) {
      const aTime = timestampValue(a);
      const bTime = timestampValue(b);

      // Unknown dates remain last in either direction.
      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;

      return direction === "asc"
        ? aTime - bTime
        : bTime - aTime;
    }

    function renderDate(value, missingTitle = "") {
      const timestamp = timestampValue(value);

      if (timestamp === null) {
        return missingTitle
          ? `<span title="${safe(missingTitle)}">—</span>`
          : "—";
      }

      const normalizedValue =
        new Date(timestamp).toISOString();

      return safe(formatDateTime(normalizedValue));
    }

    function isSentToIsn(lead) {
      return String(lead.stage_name || "")
        .trim()
        .toLowerCase() === "sent to isn";
    }

    /* -------------------------------------------------------
       FETCH LEADS
    ------------------------------------------------------- */

    async function fetchLeads() {
      const url =
        `${LEADS_API_URL}/leads/list` +
        `?project=${encodeURIComponent(project)}`;

      const response = await fetch(url, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          `Lead list request failed (HTTP ${response.status}).`
        );
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Unexpected lead list response.");
      }

      return data;
    }

    /* -------------------------------------------------------
       LOAD DEFAULT / APPLY SEARCH
    ------------------------------------------------------- */

    async function loadList(useSearch = false) {
      if (loading || statusSaving || !isCurrent()) return;

      const term = useSearch
        ? searchInput.value.trim().toLowerCase()
        : "";

      loading = true;
      updateFilterControls();
      showMessage("");

      try {
        let loaded = await fetchLeads();

        if (!isCurrent()) return;

        if (term) {
          loaded = loaded.filter(lead =>
            String(lead.lead_name || "")
              .toLowerCase()
              .includes(term) ||
            String(lead.contact_search_name || "")
              .toLowerCase()
              .includes(term) ||
            String(lead.status || "")
              .toLowerCase()
              .includes(term)
          );
        }

        leads = loaded;
        closeStatusEditor();

        currentSortField = useSearch
          ? "lead_name"
          : "updated_at";

        currentSortDirection = useSearch
          ? "asc"
          : "desc";

        renderTable();
      } catch (error) {
        if (!isCurrent()) return;

        console.error("[Leads] Load failed:", error);

        showMessage(
          "Unable to load leads. Please try Apply Filter or Clear Filter again.",
          true
        );

        if (!tableDiv.querySelector("table")) {
          tableDiv.innerHTML =
            `<p class="error">Error loading leads.</p>`;
        }
      } finally {
        loading = false;

        if (isCurrent()) {
          updateFilterControls();
        }
      }
    }

    /* -------------------------------------------------------
       SORTING HELPERS
    ------------------------------------------------------- */

    function sortableHeader(field, label) {
      const isSorted = currentSortField === field;

      const up =
        isSorted && currentSortDirection === "asc"
          ? "▲"
          : "△";

      const down =
        isSorted && currentSortDirection === "desc"
          ? "▼"
          : "▽";

      return `
        <th class="sortable" data-field="${field}">
          ${safe(label)}

          <span class="sort-arrows"
            style="margin-left:4px; font-size:0.8em;">
            <span>${up}</span>
            <span>${down}</span>
          </span>
        </th>
      `;
    }

    function sortedLeads() {
      const sorted = [...leads];

      const timestampFields = new Set([
        "created_at",
        "updated_at",
        "current_stage_entered_at"
      ]);

      sorted.sort((a, b) => {
        if (timestampFields.has(currentSortField)) {
          return compareTimestamps(
            a[currentSortField],
            b[currentSortField],
            currentSortDirection
          );
        }

        const A =
          String(a[currentSortField] || "").toLowerCase();

        const B =
          String(b[currentSortField] || "").toLowerCase();

        return currentSortDirection === "asc"
          ? A.localeCompare(B)
          : B.localeCompare(A);
      });

      return sorted;
    }

    /* -------------------------------------------------------
       INLINE STATUS EDITOR
    ------------------------------------------------------- */

    function renderStatusEditor(lead) {
      if (
        editingLeadId !== String(lead.lead_id) ||
        !portalState.canEdit
      ) {
        return "";
      }

      const unknownOption = !draftStatus
        ? `
          <option value="" disabled selected>
            Choose a status
          </option>
        `
        : "";

      const options = LEAD_STATUSES.map(status => `
        <option
          value="${status}"
          ${draftStatus === status ? "selected" : ""}
        >
          ${status}
        </option>
      `).join("");

      return `
        <tr class="inline-editor lead-status-editor">
          <td colspan="7" style="
            background:#fafafa;
            border-top:1px solid #ddd;
            padding:12px;
          ">
            <form class="lead-status-form">
              <label style="
                display:flex;
                align-items:center;
                gap:10px;
                flex-wrap:wrap;
                font-weight:bold;
              ">
                <span>Status</span>

                <select
                  class="edit-lead-status form-control"
                  style="min-width:240px;"
                  required
                  ${statusSaving ? "disabled" : ""}
                >
                  ${unknownOption}
                  ${options}
                </select>
              </label>

              <p class="muted" style="
                margin:8px 0 0;
                font-size:13px;
              ">
                This updates the lead's status without deleting
                the lead or changing its stage.
              </p>

              ${
                statusError
                  ? `
                    <p role="alert" style="
                      color:#b91c1c;
                      margin:10px 0 0;
                    ">
                      ${safe(statusError)}
                    </p>
                  `
                  : ""
              }

              <div style="
                margin-top:12px;
                display:flex;
                gap:12px;
              ">
                <button
                  type="submit"
                  class="btn-primary save-lead-status"
                  ${statusSaving ? "disabled" : ""}
                >
                  ${statusSaving ? "Saving…" : "Save"}
                </button>

                <button
                  type="button"
                  class="secondary cancel-lead-status"
                  ${statusSaving ? "disabled" : ""}
                >
                  Cancel
                </button>
              </div>
            </form>
          </td>
        </tr>
      `;
    }

    /* -------------------------------------------------------
       RENDER LEAD ROW
    ------------------------------------------------------- */

    function renderRow(lead) {
      const id = safe(lead.lead_id);
      const name = safe(lead.lead_name || "");
      const contact = safe(lead.contact_search_name || "");

      const showToIsn =
        project === "csi" &&
        !isSentToIsn(lead) &&
        (
          lead.stage_name === "Ready to Transfer" ||
          lead.stage_name === "Send to ISN"
        );

      const transferLock =
        transferLocks.get(String(lead.lead_id));

      const isEditing =
        editingLeadId === String(lead.lead_id);

      // DELETE BUTTON TEMPORARILY DISABLED FOR ALL USERS.
      // Restore this block and its interpolation only when needed.
      /*
      const deleteButton = canDeleteLead()
        ? `
          <button
            type="button"
            class="btn-danger btn-delete-lead"
            data-id="${id}"
            ${statusSaving ? "disabled" : ""}
          >
            Delete
          </button>
        `
        : "";
      */

      return `
        <tr data-id="${id}">
          <td>${name}</td>
          <td>${contact}</td>
          <td>${safe(lead.stage_name || "")}</td>

          <td>
            ${renderDate(
              lead.current_stage_entered_at,
              "No reliable stage-entry history is available."
            )}
          </td>

          <td>${safe(displayStatus(lead.status))}</td>

          <td>${renderDate(lead.created_at)}</td>

          <td>
            <button
              type="button"
              class="btn-primary btn-select-lead"
              data-id="${id}"
              data-name="${name}"
              data-contact="${contact}"
              ${statusSaving ? "disabled" : ""}
            >
              Select
            </button>

            ${
              showToIsn
                ? `
                  <button
                    type="button"
                    class="secondary btn-to-isn"
                    data-lead-id="${id}"
                    ${
                      statusSaving || transferLock
                        ? "disabled"
                        : ""
                    }
                  >
                    ${safe(transferLock || "To ISN")}
                  </button>
                `
                : ""
            }

            ${
              portalState.canEdit
                ? `
                  <button
                    type="button"
                    class="secondary btn-change-status"
                    data-id="${id}"
                    aria-expanded="${isEditing}"
                    ${statusSaving ? "disabled" : ""}
                  >
                    Change Status
                  </button>
                `
                : ""
            }
          </td>
        </tr>

        ${renderStatusEditor(lead)}
      `;
    }

    /* -------------------------------------------------------
       RENDER TABLE / ATTACH HANDLERS
    ------------------------------------------------------- */

    function renderTable() {
      const sorted = sortedLeads();

      tableDiv.innerHTML = `
        <h4>Showing ${sorted.length} leads</h4>

        <table class="notes-table">
          <thead>
            <tr>
              ${sortableHeader("lead_name", "Lead Name")}
              ${sortableHeader(
                "contact_search_name",
                portalState.contactLabel || "Contact"
              )}
              ${sortableHeader("stage_name", "Stage")}
              ${sortableHeader(
                "current_stage_entered_at",
                "Entered Stage"
              )}
              ${sortableHeader("status", "Status")}
              ${sortableHeader("created_at", "Created")}
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            ${
              sorted.length
                ? sorted.map(renderRow).join("")
                : `
                  <tr>
                    <td colspan="7">(no leads found)</td>
                  </tr>
                `
            }
          </tbody>
        </table>
      `;

      // Sort columns.
      tableDiv.querySelectorAll("th.sortable").forEach(th => {
        th.addEventListener("click", () => {
          if (statusSaving || loading) return;

          const field = th.dataset.field;

          if (currentSortField === field) {
            currentSortDirection =
              currentSortDirection === "asc"
                ? "desc"
                : "asc";
          } else {
            currentSortField = field;
            currentSortDirection = "asc";
          }

          renderTable();
        });
      });

      // Select a lead.
      tableDiv.querySelectorAll(".btn-select-lead").forEach(btn => {
        btn.addEventListener("click", () => {
          if (statusSaving) return;

          const id = btn.dataset.id;
          const name = btn.dataset.name;
          const contact = btn.dataset.contact;

          portalState.activeLeadId = id;
          portalState.activeLeadName = name;
          portalState.activeLeadContactName = contact;

          localStorage.setItem("activeLeadId", id);
          localStorage.setItem("activeLeadName", name);
          localStorage.setItem("activeLeadContactName", contact);

          const bar =
            document.getElementById("lead-context-bar");

          if (bar) {
            bar.textContent = `Lead: ${name} (${contact})`;
            bar.style.display = "block";
          }

          const detailsButton = document.querySelector(
            '#leads-subtabs button[data-subtab="details"]'
          );

          if (detailsButton) detailsButton.click();
        });
      });

      // Transfer to ISN.
      tableDiv.querySelectorAll(".btn-to-isn").forEach(btn => {
        btn.addEventListener("click", () => {
          if (statusSaving) return;
          void handleTransferToIsn(btn);
        });
      });

      // DELETE BUTTON HANDLERS TEMPORARILY DISABLED.
      /*
      tableDiv.querySelectorAll(".btn-delete-lead").forEach(btn => {
        btn.addEventListener("click", () => {
          void handleDeleteLead(btn);
        });
      });
      */

      // Expand/collapse the status editor.
      tableDiv.querySelectorAll(".btn-change-status").forEach(btn => {
        btn.addEventListener("click", () => {
          if (
            statusSaving ||
            loading ||
            !portalState.canEdit
          ) {
            return;
          }

          const id = btn.dataset.id;

          if (editingLeadId === id) {
            closeStatusEditor();
            renderTable();
            return;
          }

          const lead = leads.find(
            item => String(item.lead_id) === id
          );

          if (!lead) return;

          editingLeadId = id;
          draftStatus = canonicalStatus(lead.status);
          statusError = "";

          renderTable();

          tableDiv
            .querySelector(".edit-lead-status")
            ?.focus();
        });
      });

      // Keep the dropdown selection in local draft state.
      const statusSelect =
        tableDiv.querySelector(".edit-lead-status");

      if (statusSelect) {
        statusSelect.addEventListener("change", () => {
          draftStatus = statusSelect.value;
          statusError = "";
        });
      }

      // Cancel without saving.
      const cancelButton =
        tableDiv.querySelector(".cancel-lead-status");

      if (cancelButton) {
        cancelButton.addEventListener("click", () => {
          if (statusSaving) return;

          closeStatusEditor();
          renderTable();
        });
      }

      // Save the selected status.
      const statusForm =
        tableDiv.querySelector(".lead-status-form");

      if (statusForm) {
        statusForm.addEventListener("submit", event => {
          event.preventDefault();
          void saveLeadStatus();
        });
      }
    }

    /* -------------------------------------------------------
       SAVE LEAD STATUS
    ------------------------------------------------------- */

    async function saveLeadStatus() {
      if (
        statusSaving ||
        loading ||
        !editingLeadId ||
        !isCurrent()
      ) {
        return;
      }

      if (!portalState.canEdit) {
        statusError =
          "You do not have permission to change lead status.";

        renderTable();
        return;
      }

      const leadId = editingLeadId;
      const nextStatus = draftStatus;

      const lead = leads.find(
        item => String(item.lead_id) === leadId
      );

      if (!lead) {
        statusError =
          "This lead could not be found. Reload the list.";

        renderTable();
        return;
      }

      if (!LEAD_STATUSES.includes(nextStatus)) {
        statusError = "Choose a valid status.";
        renderTable();
        return;
      }

      if (canonicalStatus(lead.status) === nextStatus) {
        closeStatusEditor();
        renderTable();
        return;
      }

      const leadName = lead.lead_name || "Lead";

      statusSaving = true;
      statusError = "";

      showMessage("");
      updateFilterControls();
      renderTable();

      try {
        const response = await fetch(
          `${LEADS_API_URL}/leads/update`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              id: leadId,
              updates: {
                status: nextStatus
              }
            })
          }
        );

        const data =
          await response.json().catch(() => null);

        if (!response.ok) {
          const detail =
            typeof data?.error === "string"
              ? ` ${data.error}`
              : "";

          throw new Error(
            `The update could not be confirmed (HTTP ${response.status}).${detail} Reload the list before retrying.`
          );
        }

        const savedLead =
          Array.isArray(data) ? data[0] : null;

        if (
          !savedLead ||
          String(savedLead.lead_id) !== leadId ||
          savedLead.project !== project ||
          canonicalStatus(savedLead.status) !== nextStatus
        ) {
          throw new Error(
            "The server did not confirm the expected status. Reload the list before retrying."
          );
        }

        if (!isCurrent()) return;

        leads = leads.map(item =>
          String(item.lead_id) === leadId
            ? {
                ...item,
                status: savedLead.status,
                updated_at: savedLead.updated_at,
                end_date: savedLead.end_date
              }
            : item
        );

        closeStatusEditor();

        showMessage(
          `${leadName}: status changed to ${nextStatus}.`
        );
      } catch (error) {
        console.error("[Lead Status] Save failed:", error);

        if (!isCurrent()) return;

        statusError =
          error.message || "Unable to save the status.";
      } finally {
        statusSaving = false;

        if (isCurrent()) {
          updateFilterControls();
          renderTable();
        }
      }
    }

    /* -------------------------------------------------------
       DELETE LEAD — RETAINED BUT NOT WIRED TO THE UI

       Delete button and event bindings are commented out.
    ------------------------------------------------------- */

    async function handleDeleteLead(btn) {
      if (
        statusSaving ||
        loading ||
        !isCurrent() ||
        !canDeleteLead()
      ) {
        return;
      }

      const leadId = btn.dataset.id;

      const lead = leads.find(
        item => String(item.lead_id) === String(leadId)
      );

      if (!lead) {
        showMessage(
          "This lead could not be found. Reload the list.",
          true
        );
        return;
      }

      const leadName = lead.lead_name || "Unnamed lead";

      const confirmed = window.confirm(
        `Permanently delete lead "${leadName}"?\n\n` +
        "This is intended for test or incorrectly created leads. " +
        "This action cannot be undone."
      );

      if (!confirmed) return;

      if (!isCurrent() || !canDeleteLead()) return;

      closeStatusEditor();
      statusSaving = true;

      showMessage(`Deleting "${leadName}"…`);
      updateFilterControls();
      renderTable();

      try {
        const response = await fetch(
          `${LEADS_API_URL}/leads/delete?id=${encodeURIComponent(leadId)}`,
          {
            method: "DELETE",
            cache: "no-store"
          }
        );

        const data =
          await response.json().catch(() => null);

        if (!response.ok) {
          const detail =
            typeof data?.error === "string"
              ? ` ${data.error}`
              : "";

          throw new Error(
            `Deletion could not be confirmed (HTTP ${response.status}).${detail} Reload the list before retrying.`
          );
        }

        const deletedLead = Array.isArray(data)
          ? data.find(
              item =>
                String(item.lead_id) === String(leadId) &&
                item.project === project
            )
          : null;

        if (!deletedLead) {
          throw new Error(
            "The server did not confirm deletion of this lead. " +
            "Reload the list before retrying."
          );
        }

        if (!isCurrent()) return;

        leads = leads.filter(
          item => String(item.lead_id) !== String(leadId)
        );

        if (
          String(portalState.activeLeadId) === String(leadId)
        ) {
          portalState.activeLeadId = null;
          portalState.activeLeadName = "";
          portalState.activeLeadContactName = "";

          localStorage.removeItem("activeLeadId");
          localStorage.removeItem("activeLeadName");
          localStorage.removeItem("activeLeadContactName");

          const bar =
            document.getElementById("lead-context-bar");

          if (bar) {
            bar.textContent = "No Lead Selected";
            bar.style.display = "block";
          }
        }

        showMessage(`Deleted "${leadName}".`);
      } catch (error) {
        console.error("[Delete Lead] Failed:", error);

        if (isCurrent()) {
          showMessage(
            error.message || "Unable to delete the lead.",
            true
          );
        }
      } finally {
        statusSaving = false;

        if (isCurrent()) {
          updateFilterControls();
          renderTable();
        }
      }
    }

    /* -------------------------------------------------------
       TRANSFER TO ISN (CSI ONLY)

       Step 1: create/reuse the ISN client.
       Step 2: create the ISN order.
       Step 3: update the portal stage to Sent to ISN.
    ------------------------------------------------------- */

    async function handleTransferToIsn(btn) {
      if (loading || statusSaving || !isCurrent()) return;

      const leadId = btn.dataset.leadId;

      if (transferLocks.has(String(leadId))) return;

      const lead = leads.find(
        item => String(item.lead_id) === String(leadId)
      );

      if (!lead) {
        showMessage(
          "This lead could not be found. Reload the list.",
          true
        );
        return;
      }

      if (isSentToIsn(lead)) {
        btn.hidden = true;
        return;
      }

      let orderCreated = false;
      let orderRequestStarted = false;
      let orderCreationRejected = false;
      let stageUpdated = false;

      closeStatusEditor();

      statusSaving = true;
      updateFilterControls();
      renderTable();

      const activeButton = Array.from(
        tableDiv.querySelectorAll(".btn-to-isn")
      ).find(
        button =>
          String(button.dataset.leadId) === String(leadId)
      );

      function setButtonText(text) {
        if (activeButton?.isConnected) {
          activeButton.textContent = text;
        }
      }

      showMessage("");
      setButtonText("Sending…");

      try {
        /* ---------------------------------------------------
           STEP 1: CREATE / REUSE ISN CLIENT
        --------------------------------------------------- */

        const clientResponse = await fetch(
          `${CSI_ISN_GATEWAY_URL}/lead/transfer-client`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              lead_id: leadId,
              project
            })
          }
        );

        const clientData =
          await clientResponse.json().catch(() => null);

        if (
          !clientResponse.ok ||
          clientData?.success !== true
        ) {
          throw new Error(
            `Transfer to ISN failed (client step): ${
              clientData?.error ||
              "The client sync could not be confirmed."
            }`
          );
        }

        /* ---------------------------------------------------
           STEP 2: CREATE ISN ORDER
        --------------------------------------------------- */

        setButtonText("Creating order…");
        orderRequestStarted = true;

        const orderResponse = await fetch(
          `${CSI_ISN_GATEWAY_URL}/order/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              lead_id: leadId,
              isnClientId: clientData.isnClientId,
              project
            })
          }
        );

        const orderData =
          await orderResponse.json().catch(() => null);

        if (
          !orderResponse.ok ||
          orderData?.success !== true
        ) {
          orderCreationRejected = true;

          const missing = Array.isArray(orderData?.unresolved)
            ? ` Missing: ${orderData.unresolved.join(", ")}.`
            : "";

          throw new Error(
            `Client synced to ISN, but order creation was not confirmed: ${
              orderData?.error || "Unknown error."
            }${missing} Check ISN before attempting another transfer.`
          );
        }

        orderCreated = true;

        const orderDisplayNumber =
          orderData.isnOrderOid ??
          orderData.isn_order_oid ??
          orderData.isnResponse?.oid ??
          orderData.isnResponse?.order?.oid ??
          orderData.isnOrderId;

        const orderLabel =
          orderDisplayNumber !== null &&
          orderDisplayNumber !== undefined
            ? `ISN order #${orderDisplayNumber}`
            : "ISN order";

        /* ---------------------------------------------------
           STEP 3: UPDATE PORTAL STAGE
        --------------------------------------------------- */

        setButtonText("Updating stage…");

        const updates = {
          stage_name: "Sent to ISN"
        };

        if (portalState.user_id) {
          updates.updated_user_id =
            String(portalState.user_id);
        }

        const stageResponse = await fetch(
          `${LEADS_API_URL}/leads/update`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              id: leadId,
              updates,
              change_source: "isn_transfer"
            })
          }
        );

        const stageData =
          await stageResponse.json().catch(() => null);

        const savedLead = Array.isArray(stageData)
          ? stageData.find(
              item =>
                String(item.lead_id) === String(leadId) &&
                item.project === project
            )
          : null;

        if (
          !stageResponse.ok ||
          savedLead?.stage_name !== "Sent to ISN"
        ) {
          const detail =
            typeof stageData?.error === "string"
              ? ` ${stageData.error}`
              : "";

          throw new Error(
            `${orderLabel} was created, but the portal stage update could not be confirmed.${detail} ` +
            "Do not send this lead to ISN again. " +
            'Reload the list; if needed, change its stage to "Sent to ISN" in Lead Details.'
          );
        }

        stageUpdated = true;

        if (!isCurrent()) return;

        // Update the local row immediately.
        leads = leads.map(item => {
          if (
            String(item.lead_id) !== String(leadId)
          ) {
            return item;
          }

          const updated = {
            ...item,
            stage_name: "Sent to ISN"
          };

          if (
            Object.prototype.hasOwnProperty.call(
              savedLead,
              "updated_at"
            )
          ) {
            updated.updated_at = savedLead.updated_at;
          }

          if (
            Object.prototype.hasOwnProperty.call(
              savedLead,
              "current_stage_entered_at"
            )
          ) {
            updated.current_stage_entered_at =
              savedLead.current_stage_entered_at;
          } else {
            updated.current_stage_entered_at = null;
          }

          return updated;
        });

        showMessage(
          `${orderLabel} created. Stage changed to Sent to ISN.`
        );

        // Refresh server-supplied stage-entry data.
        // Keep the confirmed local stage if a stale response arrives.
        try {
          const refreshedLeads = await fetchLeads();

          if (isCurrent()) {
            leads = refreshedLeads.map(item => {
              if (
                String(item.lead_id) === String(leadId) &&
                !isSentToIsn(item)
              ) {
                return (
                  leads.find(
                    existing =>
                      String(existing.lead_id) ===
                      String(leadId)
                  ) || item
                );
              }

              return item;
            });
          }
        } catch (refreshError) {
          console.error(
            "[To ISN] Transfer succeeded; list refresh failed:",
            refreshError
          );
        }
      } catch (error) {
        console.error("[To ISN] Transfer failed:", error);

        if (isCurrent()) {
          let message =
            error.message ||
            "Transfer to ISN could not be confirmed.";

          if (
            orderRequestStarted &&
            !orderCreated &&
            !orderCreationRejected
          ) {
            message =
              "The ISN order request was sent, but its result could not be confirmed. " +
              "Check ISN before trying again to avoid creating a duplicate order.";
          }

          showMessage(message, true);
          alert(message);
        }
      } finally {
        if (orderRequestStarted) {
          transferLocks.set(
            String(leadId),
            stageUpdated
              ? "Order Created"
              : orderCreated
                ? "Order Created — Check Stage"
                : "Check ISN Before Retrying"
          );
        }

        statusSaving = false;

        if (isCurrent()) {
          updateFilterControls();
          renderTable();
        }
      }
    }

    /* -------------------------------------------------------
       FILTER BUTTONS
    ------------------------------------------------------- */

    searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        void loadList(true);
      }
    });

    applyButton.addEventListener("click", () => {
      void loadList(true);
    });

    clearButton.addEventListener("click", () => {
      if (loading || statusSaving) return;

      searchInput.value = "";
      void loadList(false);
    });

    /* -------------------------------------------------------
       ADD LEAD
    ------------------------------------------------------- */

    if (addLeadButton) {
      addLeadButton.addEventListener("click", () => {
        if (loading || statusSaving) return;

        portalState.activeLeadId = null;
        portalState.activeLeadName = "";
        portalState.activeLeadContactName = "";

        localStorage.removeItem("activeLeadId");
        localStorage.removeItem("activeLeadName");
        localStorage.removeItem("activeLeadContactName");

        const bar =
          document.getElementById("lead-context-bar");

        if (bar) {
          bar.textContent = "No Lead Selected";
          bar.style.display = "block";
        }

        const contactButton = document.querySelector(
          '#leads-subtabs button[data-subtab="contact"]'
        );

        if (contactButton) contactButton.click();
      });
    }

    /* -------------------------------------------------------
       INITIAL LOAD
    ------------------------------------------------------- */

    await loadList(false);
  } catch (error) {
    console.error("[Leads] Error:", error);

    const target = tableDiv || container;

    target.innerHTML =
      `<p class="error">Error loading leads.</p>`;
  }
}
