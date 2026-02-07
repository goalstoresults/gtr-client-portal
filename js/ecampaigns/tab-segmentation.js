// ------------------------------------------------------------
// RENDER E‑CAMPAIGNS → SEGMENTATION
// ------------------------------------------------------------
export async function renderECSegmentation(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Segmentation</h3>
      <p>Loading segmentation...</p>
    </section>
  `;

  const project = portalState.project;
  const base = "https://ecampaigns-module.dennis-e64.workers.dev";

  let rows = [];
  try {
    const url = new URL(`${base}/analytics/segmentation`);
    url.searchParams.set("project", project);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
  } catch (err) {
    container.innerHTML = `
      <section class="card">
        <h3>Segmentation</h3>
        <p class="error">Error loading segmentation: ${err.message}</p>
      </section>
    `;
    return;
  }

  // -----------------------------
  // SORTING STATE
  // -----------------------------
  let currentSortField = "delivered"; // default
  let currentSortDirection = "desc";

  const columns = [
    { key: "contact_type", label: "Contact Type" },
    { key: "delivered", label: "Delivered", numeric: true },
    { key: "opened", label: "Opened", numeric: true },
    { key: "clicked", label: "Clicked", numeric: true },
    { key: "unsubscribed", label: "Unsubscribed", numeric: true },
    { key: "open_rate", label: "Open Rate", numeric: true },
    { key: "click_rate", label: "Click Rate", numeric: true },
    { key: "unsub_rate", label: "Unsub Rate", numeric: true }
  ];

  // -----------------------------
  // SORT FUNCTION
  // -----------------------------
  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (A == null) A = 0;
      if (B == null) B = 0;

      // numeric sort
      const numA = Number(A) || 0;
      const numB = Number(B) || 0;

      return currentSortDirection === "asc" ? numA - numB : numB - numA;
    });
  }

  // -----------------------------
  // RENDER TABLE
  // -----------------------------
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
      .map(r => `
        <tr>
          <td>${escapeHtml(r.contact_type || "(none)")}</td>
          <td>${r.delivered}</td>
          <td>${r.opened}</td>
          <td>${r.clicked}</td>
          <td>${r.unsubscribed}</td>
          <td>${formatRate(r.open_rate)}</td>
          <td>${formatRate(r.click_rate)}</td>
          <td>${formatRate(r.unsub_rate)}</td>
        </tr>
      `)
      .join("");

    container.innerHTML = `
      <section class="card">
        <h3>Segmentation</h3>
        <p>Engagement metrics grouped by contact type.</p>

        <table class="notes-table">
          <thead>
            <tr>${headerHtml}</tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              `<tr><td colspan="8" style="text-align:center; padding:20px;">No segmentation data found.</td></tr>`
            }
          </tbody>
        </table>
      </section>
    `;

    // Sorting events
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

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, m => {
    return (
      {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m] || m
    );
  });
}

function formatRate(rate) {
  if (!rate || isNaN(rate)) return "0%";
  return (rate * 100).toFixed(1) + "%";
}
