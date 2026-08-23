// /jobs/tab-list.js

import { escapeHtml, formatDateTime } from "../utilities.js";

export async function renderJobsList(container, portalState) {

  container.innerHTML = `
    <section class="card">
      <h2>Jobs</h2>

      <div style="display:flex; gap:20px; margin-bottom:6px;">
        <label style="display:flex; flex-direction:column;">
          <span>Search Job / Contact / Status</span>
          <input type="text" id="jobSearchInput" style="min-width:240px;">
        </label>
      </div>

      <div style="display:flex; gap:10px; margin-bottom:12px;">
        <button id="btnApplyJobFilter" class="secondary">Apply Filter</button>
        <button id="btnClearJobFilter" class="secondary">Clear Filter</button>
        <button id="btnAddJob" class="btn-primary">Add Job</button>
      </div>

      <div id="jobTable">(loading…)</div>
    </section>
  `;

  const tableDiv = document.getElementById("jobTable");
  const searchInput = document.getElementById("jobSearchInput");

  let jobs = [];
  let currentSortField = null;
  let currentSortDirection = "asc";

  async function fetchJobs() {
    const url = `
      https://jobs-module.dennis-e64.workers.dev/jobs/list?
      project=${encodeURIComponent(portalState.project)}
    `.replace(/\s+/g, "");

    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadDefault() {
    jobs = await fetchJobs();
    jobs.sort((a, b) => {
      const da = a.updated_at ? new Date(a.updated_at) : new Date(0);
      const db = b.updated_at ? new Date(b.updated_at) : new Date(0);
      return db - da;
    });

    currentSortField = "updated_at";
    currentSortDirection = "desc";
    renderTable();
  }

  async function applyFilter() {
    const term = searchInput.value.trim().toLowerCase();
    jobs = await fetchJobs();

    if (term !== "") {
      jobs = jobs.filter(j =>
        (j.job_name || "").toLowerCase().includes(term) ||
        (j.contact_search_name || "").toLowerCase().includes(term) ||
        (j.job_status_name || "").toLowerCase().includes(term)
      );
    }

    jobs.sort((a, b) => a.job_name.localeCompare(b.job_name));
    currentSortField = "job_name";
    currentSortDirection = "asc";
    renderTable();
  }

  function renderTable() {
    const sorted = [...jobs];

    if (currentSortField) {
      sorted.sort((a, b) => {
        if (currentSortField === "created_at" || currentSortField === "updated_at") {
          const aUTC = a[currentSortField] ? Date.parse(a[currentSortField]) : 0;
          const bUTC = b[currentSortField] ? Date.parse(b[currentSortField]) : 0;
          return currentSortDirection === "asc" ? aUTC - bUTC : bUTC - aUTC;
        }

        const A = (a[currentSortField] || "").toLowerCase();
        const B = (b[currentSortField] || "").toLowerCase();
        return currentSortDirection === "asc" ? A.localeCompare(B) : B.localeCompare(A);
      });
    }

    tableDiv.innerHTML = `
      <h4>Showing ${sorted.length} jobs</h4>
      <table class="notes-table">
        <thead>
          <tr>
            ${sortableHeader("job_name", "Job Name")}
            ${sortableHeader("contact_search_name", "Contact")}
            ${sortableHeader("job_status_name", "Status")}
            ${sortableHeader("created_at", "Created")}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${
            sorted.length
              ? sorted.map(renderRow).join("")
              : `<tr><td colspan="5">(no jobs found)</td></tr>`
          }
        </tbody>
      </table>
    `;

    tableDiv.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;
        if (currentSortField === field) {
          currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }
        renderTable();
      });
    });

    tableDiv.querySelectorAll(".btn-select-job").forEach(btn => {
      btn.addEventListener("click", () => {
        portalState.activeJobId = btn.dataset.id;
        const detailsBtn = document.querySelector('#jobs-subtabs button[data-subtab="details"]');
        if (detailsBtn) detailsBtn.click();
      });
    });
  }

  function sortableHeader(field, label) {
    const isSorted = currentSortField === field;
    const up = isSorted && currentSortDirection === "asc" ? "▲" : "△";
    const down = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

    return `
      <th class="sortable" data-field="${field}">
        ${label}
        <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
          <span>${up}</span>
          <span>${down}</span>
        </span>
      </th>
    `;
  }

  function renderRow(j) {
    const safeName = (j.job_name || "").replace(/"/g, '&quot;');
    const safeContact = (j.contact_search_name || "").replace(/"/g, '&quot;');

    return `
      <tr>
        <td>${escapeHtml(j.job_name || "")}</td>
        <td>${escapeHtml(j.contact_search_name || "")}</td>
        <td>${escapeHtml(j.job_status_name || "")}</td>
        <td>${formatDateTime(j.created_at)}</td>
        <td>
          <button class="btn-primary btn-select-job"
            data-id="${j.job_id}"
            data-name="${safeName}"
            data-contact="${safeContact}">
            Select
          </button>
        </td>
      </tr>
    `;
  }

  document.getElementById("btnApplyJobFilter").addEventListener("click", applyFilter);
  document.getElementById("btnClearJobFilter").addEventListener("click", async () => {
    searchInput.value = "";
    await loadDefault();
  });

  document.getElementById("btnAddJob").addEventListener("click", () => {
    portalState.activeJobId = null;
    const detailsBtn = document.querySelector('#jobs-subtabs button[data-subtab="details"]');
    if (detailsBtn) detailsBtn.click();
  });

  await loadDefault();
}
