// /js/staff-filter/run-filter.js

// Staff Filter — Run Filter tab (formerly intern.js)

import { escapeHtml, formatDateOnly } from "../utilities.js";

export async function renderStaffRunFilter(container, portalState) {

  // ------------------------------------------------------------
  // Initialize sort state (use internFilterSort instead of agentFilterSort)
  // ------------------------------------------------------------
  if (!portalState.internFilterSort) {
    portalState.internFilterSort = {
      column: "email",
      direction: "asc"
    };
  }

  container.innerHTML = `
<section class="card two-col">

<!-- LEFT PANEL -->
<div class="left-panel">
<h3>Run Filter</h3>

<!-- NEIGHBORHOODS BOX -->
<div class="fieldset-box">
<label>Neighborhoods</label>
<div id="agent-nh-grid" class="checkbox-grid-nh"></div>
<div class="btn-row">
<button id="agent-nh-selectall" class="secondary">Select All</button>
<button id="agent-nh-clear" class="secondary">Clear</button>
</div>
</div>

<!-- SQFT BOX -->
<div class="fieldset-box" style="margin-top:20px;">
<label>Square Footage</label>
<div id="agent-sqft-grid" class="checkbox-grid-sqft"></div>
<div class="btn-row">
<button id="agent-sqft-selectall" class="secondary">Select All</button>
<button id="agent-sqft-clear" class="secondary">Clear</button>
</div>
</div>

<!-- Hidden Agent-only block preserved -->
<button id="agent-run" class="primary" style="margin-top:20px;">Run Filter</button>
</div>

<!-- RIGHT PANEL -->
<div class="right-panel">
<h3>Results</h3>

<div id="agent-message" class="mini-label"></div>
<div id="agent-total" style="font-weight:bold; margin-top:8px;"></div>
<div id="agent-selected" style="font-weight:bold; margin-top:4px;"></div>

<div class="btn-row" style="margin-top:12px;">
<button id="agent-selectall" class="secondary">Select All</button>
<button id="agent-clearall" class="secondary">Clear All</button>
<button id="agent-savecsv" class="secondary">Save CSV</button>
</div>

<table id="agent-results" class="notes-table" style="display:none; margin-top:16px;">
<thead>
<tr id="agent-header-row">
<th>Select</th>
<th>Email</th>
<th>Name</th>
<th>Business</th>
<th>Industry</th>
<th>Vertical</th>
<th>Neighborhood</th>
<th>Square Footage</th>
<th>Lead Level</th>
<th>Type</th>
<th>Last Email</th>
</tr>
</thead>
<tbody id="agent-results-body"></tbody>
</table>
</div>

</section>

<style>
.checkbox-grid-nh {
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: 6px 18px;
margin-bottom: 12px;
}

.checkbox-grid-sqft {
display: grid;
grid-template-columns: repeat(5, 1fr);
gap: 6px 18px;
margin-bottom: 12px;
}

.sqft-spacer { visibility: hidden; }

.checkbox-grid-nh label,
.checkbox-grid-sqft label {
display: flex;
align-items: center;
gap: 6px;
font-size: 14px;
white-space: nowrap;
}

.checkbox-grid-nh input[type="checkbox"],
.checkbox-grid-sqft input[type="checkbox"] {
margin: 0;
}

.fieldset-box {
border: 1px solid #ccc;
padding: 12px;
border-radius: 6px;
background: #fafafa;
}

tr.selected-row { background-color: #fff9d6; }

th.sortable {
cursor: pointer;
user-select: none;
}
</style>
`;

  // ------------------------------------------------------------
  // Load Lookups
  // ------------------------------------------------------------
  const LOOKUP_URL = "https://filter-module.dennis-e64.workers.dev/lookups";

  let NEIGHBORHOODS = [];
  let SQFT = [];

  try {
    const res = await fetch(LOOKUP_URL);
    const data = await res.json();
    NEIGHBORHOODS = data.neighborhoods || [];
    SQFT = data.square_footage || [];
  } catch (err) {
    console.error("Lookup load error:", err);
  }

  // ------------------------------------------------------------
  // Render checkbox grids
  // ------------------------------------------------------------
  const nhGrid = document.getElementById("agent-nh-grid");
  const sqftGrid = document.getElementById("agent-sqft-grid");

  nhGrid.innerHTML = NEIGHBORHOODS.map(n => `
<label><input type="checkbox" value="${n}"> ${n}</label>
`).join("");

  sqftGrid.innerHTML = SQFT.map(s => `
<label><input type="checkbox" value="${s}"> ${s}</label>
`).join("");

  // ------------------------------------------------------------
  // Select/Clear logic
  // ------------------------------------------------------------
  document.getElementById("agent-nh-selectall").onclick = () =>
    nhGrid.querySelectorAll("input").forEach(cb => cb.checked = true);

  document.getElementById("agent-nh-clear").onclick = () =>
    nhGrid.querySelectorAll("input").forEach(cb => cb.checked = false);

  document.getElementById("agent-sqft-selectall").onclick = () =>
    sqftGrid.querySelectorAll("input").forEach(cb => cb.checked = true);

  document.getElementById("agent-sqft-clear").onclick = () =>
    sqftGrid.querySelectorAll("input").forEach(cb => cb.checked = false);

  // ------------------------------------------------------------
  // Selected count helper
  // ------------------------------------------------------------
  function updateSelectedCount() {
    const selected = document.querySelectorAll(".row-check:checked").length;
    document.getElementById("agent-selected").textContent = `Selected: ${selected}`;
  }

  // ------------------------------------------------------------
  // Row selection helpers
  // ------------------------------------------------------------
  function wireRowSelection() {
    const body = document.getElementById("agent-results-body");
    body.querySelectorAll(".row-check").forEach(cb => {
      cb.addEventListener("change", () => {
        const tr = cb.closest("tr");
        if (!tr) return;

        if (cb.checked) tr.classList.add("selected-row");
        else tr.classList.remove("selected-row");

        updateSelectedCount();
      });
    });
  }

  document.getElementById("agent-selectall").onclick = () => {
    document.querySelectorAll(".row-check").forEach(cb => {
      cb.checked = true;
      const tr = cb.closest("tr");
      if (tr) tr.classList.add("selected-row");
    });
    updateSelectedCount();
  };

  document.getElementById("agent-clearall").onclick = () => {
    document.querySelectorAll(".row-check").forEach(cb => {
      cb.checked = false;
      const tr = cb.closest("tr");
      if (tr) tr.classList.remove("selected-row");
    });
    updateSelectedCount();
  };

  // ------------------------------------------------------------
  // Clear Results
  // ------------------------------------------------------------
  document.getElementById("agent-message").textContent = "";
  document.getElementById("agent-results-body").innerHTML = "";
  document.getElementById("agent-total").textContent = "";
  document.getElementById("agent-selected").textContent = "";
  window.currentContactIds = [];

  // ------------------------------------------------------------
  // Run Filter
  // ------------------------------------------------------------
  document.getElementById("agent-run").onclick = async () => {

    const msg = document.getElementById("agent-message");
    const table = document.getElementById("agent-results");
    const body = document.getElementById("agent-results-body");
    const total = document.getElementById("agent-total");

    msg.textContent = "Loading...";
    table.style.display = "none";
    body.innerHTML = "";
    total.textContent = "";
    document.getElementById("agent-selected").textContent = "";
    window.currentContactIds = [];

    const neighborhoods = Array.from(
      nhGrid.querySelectorAll("input:checked")
    ).map(cb => cb.value);

    const sqft = Array.from(
      sqftGrid.querySelectorAll("input:checked")
    ).map(cb => cb.value);

    if (!neighborhoods.length || !sqft.length) {
      msg.textContent = "Please select at least one Neighborhood and one Square Footage.";
      return;
    }

    const payload = {
      neighborhoods,
      square_footage: sqft
    };

    try {
      const res = await fetch("https://filter-module.dennis-e64.workers.dev/intern-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");

      const results = data.results || [];
      if (!results.length) {
        msg.textContent = "No matching records found.";
        return;
      }

      msg.textContent = "";
      table.style.display = "";
      total.textContent = `Total Rows: ${results.length}`;

      window.currentContactIds = results.map(c => String(c.contact_id));

      // ------------------------------------------------------------
      // SORT + RENDER TABLE
      // ------------------------------------------------------------
      function sortResults() {
        const { column, direction } = portalState.internFilterSort;

        if (column === "select") return;

        results.sort((a, b) => {
          let A = a[column];
          let B = b[column];

          if (column === "last_email_date") {
            A = A ? new Date(A) : 0;
            B = B ? new Date(B) : 0;
          } else {
            A = (A || "").toString().toLowerCase();
            B = (B || "").toString().toLowerCase();
          }

          if (A < B) return direction === "asc" ? -1 : 1;
          if (A > B) return direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      function renderResultsTable() {
        sortResults();

        const headerConfig = [
          { key: "select", label: "Select" },
          { key: "email", label: "Email" },
          { key: "name", label: "Name" },
          { key: "business_name", label: "Business" },
          { key: "industry", label: "Industry" },
          { key: "vertical_market", label: "Vertical" },
          { key: "neighborhood", label: "Neighborhood" },
          { key: "square_footage", label: "Square Footage" },
          { key: "lead_level", label: "Lead Level" },
          { key: "type", label: "Type" },
          { key: "last_email_date", label: "Last Email" }
        ];

        const headerHtml = headerConfig.map(col => {
          if (col.key === "select") return `<th>${col.label}</th>`;

          const isSorted = portalState.internFilterSort.column === col.key;
          const up = isSorted && portalState.internFilterSort.direction === "asc" ? "▲" : "△";
          const down = isSorted && portalState.internFilterSort.direction === "desc" ? "▼" : "▽";

          return `
<th class="sortable" data-field="${col.key}">
${col.label}
<span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
<span>${up}</span>
<span>${down}</span>
</span>
</th>
`;
        }).join("");

        document.getElementById("agent-header-row").innerHTML = headerHtml;

        body.innerHTML = results.map(c => {
          const name = c.first_name || "";
          const nh = Array.isArray(c.neighborhood) ? c.neighborhood.join(", ") : (c.neighborhood || "");
          const sq = Array.isArray(c.square_footage) ? c.square_footage.join(", ") : (c.square_footage || "");

          return `
<tr>
<td><input type="checkbox" class="row-check" data-id="${c.contact_id}"></td>
<td>${escapeHtml(c.email || "")}</td>
<td>${escapeHtml(name)}</td>
<td>${escapeHtml(c.business_name || "")}</td>
<td>${escapeHtml(c.industry || "")}</td>
<td>${escapeHtml(c.vertical_market || "")}</td>
<td>${escapeHtml(nh)}</td>
<td>${escapeHtml(sq)}</td>
<td>${escapeHtml(c.lead_level || "")}</td>
<td>${escapeHtml(c.type || "")}</td>
<td>${formatDateOnly(c.last_email_date)}</td>
</tr>
`;
        }).join("");

        document.querySelectorAll("th.sortable").forEach(th => {
          th.addEventListener("click", () => {
            const field = th.dataset.field;

            if (portalState.internFilterSort.column === field) {
              portalState.internFilterSort.direction =
                portalState.internFilterSort.direction === "asc" ? "desc" : "asc";
            } else {
              portalState.internFilterSort.column = field;
              portalState.internFilterSort.direction = "asc";
            }

            renderResultsTable();
          });
        });

        wireRowSelection();
        updateSelectedCount();
      }

      renderResultsTable();

    } catch (err) {
      msg.textContent = "Error fetching data: " + err.message;
    }
  };

  // ------------------------------------------------------------
  // Save CSV
  // ------------------------------------------------------------
  const csvBtn = document.getElementById("agent-savecsv");

  if (csvBtn) {
    csvBtn.onclick = async () => {

      const rows = Array.from(document.querySelectorAll("#agent-results-body tr"));
      const checkedRows = rows.filter(r => r.querySelector(".row-check")?.checked);

      if (!checkedRows.length) {
        alert("No rows selected.");
        return;
      }

      const headers = [
        "Email",
        "Name",
        "Business",
        "Industry",
        "Vertical",
        "Neighborhood",
        "Square Footage",
        "Lead Level",
        "Type",
        "Last Email"
      ];

      let csv = headers.join(",") + "\n";

      checkedRows.forEach(tr => {
        const tds = Array.from(tr.querySelectorAll("td")).slice(1);
        const row = tds.map(td =>
          `"${td.textContent.replace(/"/g, '""')}"`
        ).join(",");
        csv += row + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "jw_contacts_selected.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };
  }
}
