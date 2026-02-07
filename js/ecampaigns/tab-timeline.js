// ------------------------------------------------------------
// RENDER E‑CAMPAIGNS → TIMELINE
// ------------------------------------------------------------
export async function renderECTimeline(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Timeline</h3>
      <p>Loading engagement timeline...</p>
    </section>
  `;

  const project = portalState.project;
  const base = "https://ecampaigns-module.dennis-e64.workers.dev";

  let rows = [];
  try {
    const url = new URL(`${base}/analytics/timeline`);
    url.searchParams.set("project", project);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
  } catch (err) {
    container.innerHTML = `
      <section class="card">
        <h3>Timeline</h3>
        <p class="error">Error loading timeline: ${err.message}</p>
      </section>
    `;
    return;
  }

  // Sorting state
  let currentSortField = "action_date";
  let currentSortDirection = "asc";

  const columns = [
    { key: "action_date", label: "Date/Time", date: true },
    { key: "status", label: "Status" },
    { key: "campaign_name", label: "Campaign" },
    { key: "contact_name", label: "Contact" }
  ];

  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (columns.find(c => c.key === currentSortField)?.date) {
        const dA = A ? new Date(A).getTime() : 0;
        const dB = B ? new Date(B).getTime() : 0;
        return currentSortDirection === "asc" ? dA - dB : dB - dA;
      }

      const sA = String(A || "").toLowerCase();
      const sB = String(B || "").toLowerCase();
      return currentSortDirection === "asc"
        ? sA.localeCompare(sB)
        : sB.localeCompare(sA);
    });
  }

  function renderTable() {
    sortRows();

    const headerHtml = columns
      .map(col => {
        const isSorted = currentSortField === col.key;
        const upArrow = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="sortable" data-field="${col.key}">
            ${col.label}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span class="sort-up">${upArrow}</span>
              <span class="sort-down">${downArrow}</span>
            </span>
          </th>
        `;
      })
      .join("");

    const rowsHtml = rows
      .map(r => {
        const when = r.action_date
          ? new Date(r.action_date).toLocaleString()
          : "-";
        return `
          <tr>
            <td>${when}</td>
            <td>${escapeHtml(r.status || "")}</td>
            <td>${escapeHtml(r.campaign_name || "")}</td>
            <td>${escapeHtml(r.contact_name || "")}</td>
          </tr>
        `;
      })
      .join("");

    container.innerHTML = `
      <section class="card">
        <h3>Timeline</h3>
        <p>Chronological view of opens and clicks across all campaigns.</p>

        <table class="notes-table">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              `<tr><td colspan="4" style="text-align:center; padding:20px;">No engagement events found.</td></tr>`
            }
          </tbody>
        </table>
      </section>
    `;

    container.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;
        if (currentSortField === field) {
          currentSortDirection =
            currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }
        renderTable();
      });
    });
  }

  renderTable();
}
