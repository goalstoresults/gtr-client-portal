// ------------------------------------------------------------
// RENDER E‑CAMPAIGNS → SEGMENTATION (BEHAVIORAL SHARE MODEL)
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

  // Sorting state
  let currentSortField = "opened";
  let currentSortDirection = "desc";

  const columns = [
    { key: "contact_type", label: "Contact Type" },
    { key: "opened", label: "Opens", numeric: true },
    { key: "open_share", label: "% of Opens", numeric: true },
    { key: "clicked", label: "Clicks", numeric: true },
    { key: "click_share", label: "% of Clicks", numeric: true },
    { key: "unsubscribed", label: "Unsubs", numeric: true },
    { key: "unsub_share", label: "% of Unsubs", numeric: true }
  ];

  function sortRows() {
    rows.sort((a, b) => {
      const A = a[currentSortField] ?? 0;
      const B = b[currentSortField] ?? 0;
      return currentSortDirection === "asc" ? A - B : B - A;
    });
  }

  function renderTable() {
    sortRows();

    const headerHtml = columns
      .map(col => {
        const isSorted = currentSortField === col.key;
        const up = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const down = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

        return `
          <th class="sortable" data-field="${col.key}">
            ${col.label}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span>${up}</span>
              <span>${down}</span>
            </span>
          </th>
        `;
      })
      .join("");

    const rowsHtml = rows
      .map(r => `
        <tr>
          <td>${escapeHtml(r.contact_type)}</td>
          <td>${r.opened}</td>
          <td>${formatPct(r.open_share)}</td>
          <td>${r.clicked}</td>
          <td>${formatPct(r.click_share)}</td>
          <td>${r.unsubscribed}</td>
          <td>${formatPct(r.unsub_share)}</td>
        </tr>
      `)
      .join("");

    container.innerHTML = `
      <section class="card">
        <h3>Segmentation</h3>
        <p>Behavioral distribution across your audience.</p>

        <table class="notes-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>
            ${
              rowsHtml ||
              `<tr><td colspan="7" style="text-align:center; padding:20px;">No segmentation data found.</td></tr>`
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

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, m => {
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

function formatPct(v) {
  return (v * 100).toFixed(1) + "%";
}
