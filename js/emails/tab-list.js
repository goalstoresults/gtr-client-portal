// /emails/tab-list.js
// Renders the campaign list for the staff-selected project

import { escapeHtml, formatDateOnly } from "../utilities.js";
import { renderEmailReview } from "./tab-review.js";
import { renderEmailData } from "./tab-email-data.js";

/* =========================================================
   RENDER: Email Campaign List (Revenue-style grid)
========================================================= */

export async function renderEmailList(container, portalState) {
  /* ---------------------------------------------------------
     1) Require staff-selected project
  --------------------------------------------------------- */
  if (!portalState.staffSelectedProjectId) {
    container.innerHTML = `
      <section class="card warning">
        <p>Please select a project to continue.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h3>Email – Campaigns for ${escapeHtml(portalState.staffSelectedProjectName || "")}</h3>
      <div id="emailListGrid" style="margin-top:16px;"></div>
    </section>
  `;

  const grid = document.getElementById("emailListGrid");

  /* ---------------------------------------------------------
     2) Fetch campaigns from Worker
  --------------------------------------------------------- */
  let campaigns = [];
  try {
    const res = await fetch(
      `https://emails-module.dennis-e64.workers.dev/campaigns/list?project=${encodeURIComponent(
        portalState.staffSelectedProjectId
      )}`,
      { cache: "no-cache" }
    );

    const text = await res.text();
    campaigns = text ? JSON.parse(text) : [];
  } catch {
    campaigns = [];
  }

  /* ---------------------------------------------------------
     3) Normalize rows
  --------------------------------------------------------- */
  campaigns = campaigns.map(c => ({
    ...c,
    campaign_id: c.campaign_id,
    campaign_name: c.campaign_name || "",
    subject_line: c.subject_line || "",
    send_date: c.send_date || null
  }));

  /* ---------------------------------------------------------
     4) Sorting state
  --------------------------------------------------------- */
  let currentSortField = "send_date";
  let currentSortDirection = "desc";

  const columns = [
    { key: "campaign_name", label: "Campaign Name" },
    { key: "subject_line", label: "Subject Line" },
    { key: "send_date", label: "Send Date", isDate: true },
    { key: "actions", label: "Actions" }
  ];

  function sortCampaigns() {
    campaigns.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      const col = columns.find(c => c.key === currentSortField);

      if (col?.isDate) {
        A = A ? new Date(A) : 0;
        B = B ? new Date(B) : 0;
      } else {
        A = (A || "").toString().toLowerCase();
        B = (B || "").toString().toLowerCase();
      }

      if (A < B) return currentSortDirection === "asc" ? -1 : 1;
      if (A > B) return currentSortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  /* ---------------------------------------------------------
     5) Render table
  --------------------------------------------------------- */
  function renderTable() {
    sortCampaigns();

    /* ---------- HEADER ---------- */
    const headerHtml = columns
      .map(col => {
        const isSorted = currentSortField === col.key;
        const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="${col.key !== 'actions' ? 'sortable' : ''}" data-field="${col.key}">
            ${escapeHtml(col.label)}
            ${col.key !== 'actions' ? `
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">${upArrow}</span>
                <span class="sort-down">${downArrow}</span>
              </span>` : ""}
          </th>
        `;
      })
      .join("");

    /* ---------- ROWS ---------- */
    const rowsHtml = campaigns
      .map(c => {
        const sendDate = c.send_date
          ? formatDateOnly(c.send_date)
          : "—";

        return `
          <tr data-id="${c.campaign_id}">
            <td>${escapeHtml(c.campaign_name)}</td>
            <td>${escapeHtml(c.subject_line)}</td>
            <td>${escapeHtml(sendDate)}</td>
            <td>
              <button class="btn-secondary btn-sm" data-action="review" data-id="${c.campaign_id}">Review</button>
              <button class="btn-primary btn-sm" data-action="data" data-id="${c.campaign_id}">Email Data</button>
            </td>
          </tr>
        `;
      })
      .join("");

    /* ---------- FINAL HTML ---------- */
    grid.innerHTML = `
      <table class="notes-table">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="4">(no campaigns found)</td></tr>`}
        </tbody>
      </table>
    `;

    /* ---------- SORT EVENTS ---------- */
    grid.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        currentSortDirection =
          currentSortField === field
            ? currentSortDirection === "asc"
              ? "desc"
              : "asc"
            : "asc";

        currentSortField = field;
        renderTable();
      });
    });

    /* ---------- ACTION EVENTS ---------- */
    grid.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;

        portalState.selectedCampaignId = id;

        if (action === "review") {
          await renderEmailReview(container, portalState);
        }

        if (action === "data") {
          await renderEmailData(container, portalState);
        }
      });
    });
  }

  renderTable();
}
