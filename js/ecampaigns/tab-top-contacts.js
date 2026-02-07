// ------------------------------------------------------------
// RENDER E‑CAMPAIGNS → TOP CONTACTS (FULL GRID + SORTING)
// ------------------------------------------------------------
export async function renderECTopContacts(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Top Contacts</h3>
      <p>Loading top contacts...</p>
    </section>
  `;

  const project = portalState.project;

  // Fetch aggregated data
  let rows = [];
  try {
    const url = new URL(`${portalState.apiBase}/analytics/top-contacts`);
    url.searchParams.set("project", project);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
  } catch (err) {
    container.innerHTML = `
      <section class="card">
        <h3>Top Contacts</h3>
        <p class="error">Error loading top contacts: ${err.message}</p>
      </section>
    `;
    return;
  }

  // -----------------------------
  // SORTING STATE
  // -----------------------------
  let currentSortField = "total_clicks";   // default sort
  let currentSortDirection = "desc";

  const columns = [
    { key: "contact_name", label: "Contact Name" },
    { key: "contact_type", label: "Type" },
    { key: "total_opens", label: "Opens (All)", numeric: true },
    { key: "total_clicks", label: "Clicks (All)", numeric: true },
    { key: "last_activity", label: "Last Activity", date: true }
  ];

  // -----------------------------
  // SORT FUNCTION
  // -----------------------------
  function sortRows() {
    rows.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (A == null) A = "";
      if (B == null) B = "";

      // Numeric sort
      if (columns.find(c => c.key === currentSortField)?.numeric) {
        const numA = Number(A) || 0;
        const numB = Number(B) || 0;
        return currentSortDirection === "asc" ? numA - numB : numB - numA;
      }

      // Date sort
      if (columns.find(c => c.key === currentSortField)?.date) {
        const dateA = A ? new Date(A).getTime() : 0;
        const dateB = B ? new Date(B).getTime() : 0;
        return currentSortDirection === "asc" ? dateA - dateB : dateB - dateA;
      }

      // String sort
      const strA = String(A).toLowerCase();
      const strB = String(B).toLowerCase();
      return currentSortDirection === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
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
      .map(r => {
        const last = r.last_activity
          ? new Date(r.last_activity).toLocaleString()
          : "-";

        return `
          <tr>
            <td>${escapeHtml(r.contact_name || "")}</td>
            <td>${escapeHtml(r.contact_type || "")}</td>
            <td>${r.total_opens || 0}</td>
            <td>${r.total_clicks || 0}</td>
            <td>${last}</td>
            <td><button class="btn-primary btn-view" data-id="${r.contact_id}">View</button></td>
          </tr>
        `;
      })
      .join("");

    container.innerHTML = `
      <section class="card">
        <h3>Top Contacts</h3>
        <p>Contacts with the highest engagement across all campaigns.</p>

        <table class="notes-table">
          <thead>
            <tr>
              ${headerHtml}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              `<tr><td colspan="6" style="text-align:center; padding:20px;">No engagement found.</td></tr>`
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

    // View Contact buttons
    container.querySelectorAll(".btn-view").forEach(btn => {
      btn.addEventListener("click", () => {
        const contactId = btn.dataset.id;

        // Switch to Contact Activity tab
        const buttons = document.querySelectorAll("#ecampaigns-subtabs button");
        buttons.forEach(b => b.classList.remove("active"));

        const activityBtn = document.querySelector(
          '#ecampaigns-subtabs button[data-subtab="contact-activity"]'
        );
        if (activityBtn) activityBtn.classList.add("active");

        portalState.selectedContactId = contactId;

        const content = document.querySelector("#ecampaignsContent");
        renderECContactActivity(content, portalState);
      });
    });
  }

  // Initial render
  renderTable();
}

// ------------------------------------------------------------
// HELPER: escapeHtml (same as Groups module)
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
