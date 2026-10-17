// js/leads/tab-list.js
// Lead List Tab — using project_pipeline_leads_view
import { escapeHtml, formatDateTime } from "../utilities.js";

const CSI_ISN_GATEWAY_URL =
  "https://csi-isn-gateway.dennis-e64.workers.dev";

export async function renderLeadsList(container, portalState) {
  let tableDiv = null;

  try {
    /* -------------------------------------------------------
       RENDER FILTER BAR + TABLE SHELL
    ------------------------------------------------------- */

    container.innerHTML = `
      <section class="card">
        <h2>Leads</h2>

        <!-- ROW 1: SEARCH INPUT -->
        <div style="display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:6px;">
          <label style="display:flex; flex-direction:column;">
            <span>Search Lead / ${escapeHtml(portalState.contactLabel || "Contact")} / Status</span>
            <input type="text" id="leadSearchInput" style="min-width:240px;">
            <div style="font-size:0.75em; color:#666; margin-top:2px;">
              Tip: Leave blank for full list.
            </div>
          </label>
        </div>

        <!-- ROW 2: BUTTONS -->
        <div style="display:flex; gap:10px; margin-bottom:12px;">
          <button id="btnApplyLeadFilter" class="secondary">Apply Filter</button>
          <button id="btnClearLeadFilter" class="secondary">Clear Filter</button>
          ${portalState.canEdit ? `<button id="btnAddLead" class="btn-primary">Add Lead</button>` : ``}
        </div>

        <div id="leadTable">(loading…)</div>
      </section>
    `;

    tableDiv = container.querySelector("#leadTable");

    const searchInput =
      container.querySelector("#leadSearchInput");

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();

        container
          .querySelector("#btnApplyLeadFilter")
          .click();
      }
    });

    /* -------------------------------------------------------
       INTERNAL STATE
    ------------------------------------------------------- */

    let leads = [];
    let currentSortField = null;
    let currentSortDirection = "asc";

    /* -------------------------------------------------------
       TIMESTAMP HELPERS

       Preserve explicit UTC offsets.
       Retain the previous UTC interpretation for timestamps
       that do not include an offset.
    ------------------------------------------------------- */

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

      // Keep unknown/missing timestamps last in either direction.
      if (aTime === null && bTime === null) return 0;
      if (aTime === null) return 1;
      if (bTime === null) return -1;

      return direction === "asc"
        ? aTime - bTime
        : bTime - aTime;
    }

    /* -------------------------------------------------------
       FETCH LEADS (FROM VIEW)
    ------------------------------------------------------- */

    async function fetchLeads() {
      const url =
        "https://leads-module.dennis-e64.workers.dev/leads/list" +
        `?project=${encodeURIComponent(portalState.project)}`;

      const res = await fetch(url, {
        cache: "no-cache"
      });

      if (!res.ok) {
        throw new Error(
          `Lead list request failed (HTTP ${res.status}).`
        );
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        throw new Error("Unexpected lead list response.");
      }

      return data;
    }

    /* -------------------------------------------------------
       LOAD DEFAULT (SORT BY UPDATED DESC)
    ------------------------------------------------------- */

    async function loadDefault() {
      leads = await fetchLeads();

      currentSortField = "updated_at";
      currentSortDirection = "desc";

      renderTable();
    }

    /* -------------------------------------------------------
       APPLY FILTER
    ------------------------------------------------------- */

    async function applyFilter() {
      const term =
        searchInput.value.trim().toLowerCase();

      leads = await fetchLeads();

      if (term !== "") {
        leads = leads.filter(l =>
          (l.lead_name || "").toLowerCase().includes(term) ||
          (l.contact_search_name || "").toLowerCase().includes(term) ||
          (l.status || "").toLowerCase().includes(term)
        );
      }

      currentSortField = "lead_name";
      currentSortDirection = "asc";

      renderTable();
    }

    /* -------------------------------------------------------
       RENDER TABLE
    ------------------------------------------------------- */

    function renderTable() {
      const sorted = [...leads];

      if (currentSortField) {
        sorted.sort((a, b) => {
          const timestampFields = [
            "created_at",
            "updated_at",
            "current_stage_entered_at"
          ];

          if (timestampFields.includes(currentSortField)) {
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
      }

      const headerText =
        `<h4>Showing ${sorted.length} leads</h4>`;

      tableDiv.innerHTML = `
        ${headerText}
        <table class="notes-table">
          <thead>
            <tr>
              ${sortableHeader("lead_name", "Lead Name")}
              ${sortableHeader("contact_search_name", portalState.contactLabel || "Contact")}
              ${sortableHeader("stage_name", "Stage")}
              ${sortableHeader("current_stage_entered_at", "Entered Stage")}
              ${sortableHeader("status", "Status")}
              ${sortableHeader("created_at", "Created")}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              sorted.length
                ? sorted.map(renderRow).join("")
                : `<tr><td colspan="7">(no leads found)</td></tr>`
            }
          </tbody>
        </table>
      `;

      // Sorting handlers
      tableDiv
        .querySelectorAll("th.sortable")
        .forEach(th => {
          th.addEventListener("click", () => {
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

      // Row select → go to Details tab
      tableDiv
        .querySelectorAll(".btn-select-lead")
        .forEach(btn => {
          btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            const contact = btn.dataset.contact;

            portalState.activeLeadId = id;
            portalState.activeLeadName = name;
            portalState.activeLeadContactName = contact;

            localStorage.setItem("activeLeadId", id);
            localStorage.setItem("activeLeadName", name);
            localStorage.setItem(
              "activeLeadContactName",
              contact
            );

            const bar =
              document.getElementById("lead-context-bar");

            if (bar) {
              bar.textContent =
                `Lead: ${name} (${contact})`;

              bar.style.display = "block";
            }

            const detailsBtn = document.querySelector(
              '#leads-subtabs button[data-subtab="details"]'
            );

            if (detailsBtn) detailsBtn.click();
          });
        });

      // "To ISN" transfer buttons
      tableDiv
        .querySelectorAll(".btn-to-isn")
        .forEach(btn => {
          btn.addEventListener(
            "click",
            () => handleTransferToIsn(btn)
          );
        });

      // Delete lead buttons
      tableDiv
        .querySelectorAll(".btn-delete-lead")
        .forEach(btn => {
          btn.addEventListener(
            "click",
            () => handleDeleteLead(btn)
          );
        });
    }

    /* -------------------------------------------------------
       TRANSFER TO ISN (CSI only)

       Two-step chain: create/reuse the ISN client, then
       create the ISN order using the returned isnClientId.
    ------------------------------------------------------- */

    async function handleTransferToIsn(btn) {
      const leadId = btn.dataset.leadId;
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Sending…";

      try {
        // Step 1: create or reuse the ISN client.
        const clientRes = await fetch(
          `${CSI_ISN_GATEWAY_URL}/lead/transfer-client`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              lead_id: leadId,
              project: portalState.project,
            }),
          }
        );

        const clientData = await clientRes.json();

        if (!clientRes.ok || !clientData.success) {
          console.error(
            "[To ISN] Client transfer failed:",
            clientData
          );

          alert(
            `Transfer to ISN failed (client step): ${clientData.error || "Unknown error"}`
          );

          btn.disabled = false;
          btn.textContent = originalText;
          return;
        }

        // Step 2: create the ISN order.
        btn.textContent = "Creating order…";

        const orderRes = await fetch(
          `${CSI_ISN_GATEWAY_URL}/order/create`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              lead_id: leadId,
              isnClientId: clientData.isnClientId,
              project: portalState.project,
            }),
          }
        );

        const orderData = await orderRes.json();

        if (!orderRes.ok || !orderData.success) {
          console.error(
            "[To ISN] Order creation failed:",
            orderData
          );

          alert(
            `Client synced to ISN, but order creation failed: ${orderData.error || "Unknown error"}` +
            (
              orderData.unresolved
                ? `\n\nMissing: ${orderData.unresolved.join(", ")}`
                : ""
            )
          );

          // Client sync succeeded, but order creation failed.
          btn.disabled = false;
          btn.textContent = "Retry Order";
          return;
        }

        const orderDisplayNumber =
          orderData.isnOrderOid ??
          orderData.isn_order_oid ??
          orderData.isnResponse?.oid ??
          orderData.isnResponse?.order?.oid ??
          orderData.isnOrderId;

        btn.textContent =
          `Order #${orderDisplayNumber} Created`;

        btn.classList.add("btn-to-isn-done");
      } catch (err) {
        console.error(
          "[To ISN] Network error:",
          err
        );

        alert(
          "Transfer to ISN failed — network error. Check console."
        );

        btn.disabled = false;
        btn.textContent = originalText;
      }
    }

    /* -------------------------------------------------------
       DELETE LEAD
    ------------------------------------------------------- */

    async function handleDeleteLead(btn) {
      const leadId = btn.dataset.id;
      const leadName = btn.dataset.name;

      const confirmed = confirm(
        `Delete lead "${leadName}"? This cannot be undone.`
      );

      if (!confirmed) return;

      btn.disabled = true;
      btn.textContent = "Deleting…";

      try {
        const res = await fetch(
          `https://leads-module.dennis-e64.workers.dev/leads/delete?id=${encodeURIComponent(leadId)}`,
          {
            method: "DELETE"
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));

          alert(
            `❌ Failed to delete lead: ${data.error || "Unknown error"}`
          );

          btn.disabled = false;
          btn.textContent = "Delete";
          return;
        }

        // Remove from local state and re-render.
        leads = leads.filter(
          l => l.lead_id !== leadId
        );

        renderTable();

        // Clear the active lead context when appropriate.
        if (portalState.activeLeadId === leadId) {
          portalState.activeLeadId = null;
          portalState.activeLeadName = "";
          portalState.activeLeadContactName = "";

          localStorage.removeItem("activeLeadId");
          localStorage.removeItem("activeLeadName");
          localStorage.removeItem(
            "activeLeadContactName"
          );

          const bar =
            document.getElementById("lead-context-bar");

          if (bar) {
            bar.textContent = "No Lead Selected";
            bar.style.display = "block";
          }
        }
      } catch (err) {
        console.error(
          "[Delete Lead] Network error:",
          err
        );

        alert(
          "Delete failed — network error. Check console."
        );

        btn.disabled = false;
        btn.textContent = "Delete";
      }
    }

    /* -------------------------------------------------------
       HELPERS
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
          ${escapeHtml(label)}
          <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
            <span>${up}</span>
            <span>${down}</span>
          </span>
        </th>
      `;
    }

    function renderEnteredStage(value) {
      const timestamp = timestampValue(value);

      if (timestamp === null) {
        return `
          <span title="No reliable stage-entry history is available.">—</span>
        `;
      }

      const fullDateTime = formatDateTime(value);

      return `
        <span title="${escapeHtml(String(fullDateTime))}">
          ${escapeHtml(String(fullDateTime))}
        </span>
      `;
    }

    /* -------------------------------------------------------
       RENDER ROW
    ------------------------------------------------------- */

    function renderRow(l) {
      const safeName =
        escapeHtml(String(l.lead_name || ""));

      const safeContact =
        escapeHtml(String(l.contact_search_name || ""));

      const safeId =
        escapeHtml(String(l.lead_id || ""));

      const showToIsn =
        (
          l.stage_name === "Ready to Transfer" ||
          l.stage_name === "Send to ISN"
        ) &&
        portalState.project === "csi";

      const toIsnButton = showToIsn
        ? `<button class="secondary btn-to-isn" data-lead-id="${safeId}">To ISN</button>`
        : "";

      return `
        <tr>
          <td>${escapeHtml(l.lead_name || "")}</td>
          <td>${escapeHtml(l.contact_search_name || "")}</td>
          <td>${escapeHtml(l.stage_name || "")}</td>
          <td>${renderEnteredStage(l.current_stage_entered_at)}</td>
          <td>${escapeHtml(l.status || "")}</td>
          <td>${formatDateTime(l.created_at)}</td>
          <td>
            <button class="btn-primary btn-select-lead"
              data-id="${safeId}"
              data-name="${safeName}"
              data-contact="${safeContact}">
              Select
            </button>
            ${toIsnButton}
            ${portalState.deleteAllowed ? `
              <button class="btn-danger btn-delete-lead"
                data-id="${safeId}"
                data-name="${safeName}">
                Delete
              </button>
            ` : ``}
          </td>
        </tr>
      `;
    }

    /* -------------------------------------------------------
       BUTTONS
    ------------------------------------------------------- */

    container
      .querySelector("#btnApplyLeadFilter")
      .addEventListener("click", applyFilter);

    container
      .querySelector("#btnClearLeadFilter")
      .addEventListener("click", async () => {
        searchInput.value = "";
        await loadDefault();
      });

    const addLeadBtn =
      container.querySelector("#btnAddLead");

    if (addLeadBtn) {
      addLeadBtn.addEventListener("click", () => {
        portalState.activeLeadId = null;
        portalState.activeLeadName = "";
        portalState.activeLeadContactName = "";

        localStorage.removeItem("activeLeadId");
        localStorage.removeItem("activeLeadName");
        localStorage.removeItem(
          "activeLeadContactName"
        );

        const bar =
          document.getElementById("lead-context-bar");

        if (bar) {
          bar.textContent = "No Lead Selected";
          bar.style.display = "block";
        }

        const contactBtn = document.querySelector(
          '#leads-subtabs button[data-subtab="contact"]'
        );

        if (contactBtn) contactBtn.click();
      });
    }

    /* -------------------------------------------------------
       INITIAL LOAD
    ------------------------------------------------------- */

    await loadDefault();
  } catch (err) {
    if (tableDiv) {
      tableDiv.innerHTML =
        `<p class="error">Error loading leads.</p>`;
    } else {
      container.innerHTML =
        `<p class="error">Error loading leads.</p>`;
    }

    console.error("[Leads] Error:", err);
  }
}
