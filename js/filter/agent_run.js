// /js/filter/agent_run.js
// Agent Filter — with business_name, industry, vertical_market, row selection, Selected count, and CSV of selected rows

import { escapeHtml, formatDateOnly } from "../utilities.js";

export async function renderRunFilter(container, portalState) {

  // ------------------------------------------------------------
  // Initialize sort state
  // ------------------------------------------------------------
  if (!portalState.agentFilterSort) {
    portalState.agentFilterSort = {
      column: "email",
      direction: "asc"
    };
  }

  container.innerHTML = `
  <section class="card two-col">

    <!-- LEFT PANEL -->
    <div class="left-panel">
      <h3>Agent Filter</h3>

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

      <!-- RUN BY -->
      <label style="margin-top:20px;">Run By</label>
      <select id="agent-runby"></select>

      <!-- FILENAME ON ITS OWN ROW -->
      <label style="margin-top:12px;">Filename</label>
      <input id="agent-filename" type="text" placeholder="e.g. Bryant Park — Q4 Outreach" style="width:100%;" />

      <div class="inline" style="margin-top:12px;">
        <input type="checkbox" id="agent-autosave" checked />
        <label for="agent-autosave">Save Data Automatically</label>
      </div>

      <label>No emails recently</label>
      <div class="inline">
        <input type="checkbox" id="agent-apply-noemail" checked />
        <span>Show contacts with no emails in the last</span>
        <input type="number" id="agent-noemail-days" value="30" min="1" max="3650" />
        <span>days</span>
      </div>

      <div class="inline" style="margin-top:12px;">
        <input type="checkbox" id="agent-hot" />
        <label for="agent-hot">Include Hot Leads</label>
      </div>

      <div class="inline">
        <input type="checkbox" id="agent-customers" />
        <label for="agent-customers">Include Customers</label>
      </div>

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
    /* Neighborhoods = 4 columns */
    .checkbox-grid-nh {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px 18px;
      margin-bottom: 12px;
    }

    /* SqFt = 5 columns */
    .checkbox-grid-sqft {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px 18px;
      margin-bottom: 12px;
    }

    .sqft-spacer {
      visibility: hidden;
    }



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

    /* Highlight selected rows */
    tr.selected-row {
      background-color: #fff9d6;
    }

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
  // Render checkbox grids (unchecked by default)
  // ------------------------------------------------------------
  const nhGrid = document.getElementById("agent-nh-grid");
  const sqftGrid = document.getElementById("agent-sqft-grid");

  nhGrid.innerHTML = NEIGHBORHOODS.map(n => `
    <label><input type="checkbox" value="${n}"> ${n}</label>
  `).join("");

  // Hard-coded SQFT in 5-across order so each column reads top→bottom sorted
  sqftGrid.innerHTML = `
    <label><input type="checkbox" value=".5K - 1K"> 0.5K - 1K</label>
    <label><input type="checkbox" value="6.5K - 7K"> 6.5K - 7K</label>
    <label><input type="checkbox" value="18.5K - 20K"> 18.5K - 20K</label>
    <label><input type="checkbox" value="75K - 85K"> 75K - 85K</label>
    <label><input type="checkbox" value="400K - 450K"> 400K - 450K</label>

    <label><input type="checkbox" value="1K - 1.5K"> 1K - 1.5K</label>
    <label><input type="checkbox" value="7K - 7.5K"> 7K - 7.5K</label>
    <label><input type="checkbox" value="20K - 23K"> 20K - 23K</label>
    <label><input type="checkbox" value="85K - 100K"> 85K - 100K</label>
    <label><input type="checkbox" value="450K - 500K"> 450K - 500K</label>

    <label><input type="checkbox" value="1.5K - 2K"> 1.5K - 2K</label>
    <label><input type="checkbox" value="7.5K - 8K"> 7.5K - 8K</label>
    <label><input type="checkbox" value="23K - 25K"> 23K - 25K</label>
    <label><input type="checkbox" value="100K - 120K"> 100K - 120K</label>
    <label><input type="checkbox" value="500K - 600K"> 500K - 600K</label>

    <label><input type="checkbox" value="2K - 2.5K"> 2K - 2.5K</label>
    <label><input type="checkbox" value="8K - 8.5K"> 8K - 8.5K</label>
    <label><input type="checkbox" value="25K - 26K"> 25K - 26K</label>
    <label><input type="checkbox" value="120K - 140K"> 120K - 140K</label>
    <label><input type="checkbox" value="600K - 700K"> 600K - 700K</label>

    <label><input type="checkbox" value="2.5K - 3K"> 2.5K - 3K</label>
    <label><input type="checkbox" value="8.5K - 9.5K"> 8.5K - 9.5K</label>
    <label><input type="checkbox" value="26K - 29K"> 26K - 29K</label>
    <label><input type="checkbox" value="140K - 160K"> 140K - 160K</label>
    <label><input type="checkbox" value="700K - 800K"> 700K - 800K</label>

    <label><input type="checkbox" value="3K - 3.5K"> 3K - 3.5K</label>
    <label><input type="checkbox" value="9.5K - 10.5K"> 9.5K - 10.5K</label>
    <label><input type="checkbox" value="29K - 33K"> 29K - 33K</label>
    <label><input type="checkbox" value="160K - 180K"> 160K - 180K</label>
    <label><input type="checkbox" value="800K - 900K"> 800K - 900K</label>

    <label><input type="checkbox" value="3.5K - 4K"> 3.5K - 4K</label>
    <label><input type="checkbox" value="10.5K - 11.5K"> 10.5K - 11.5K</label>
    <label><input type="checkbox" value="33K - 37K"> 33K - 37K</label>
    <label><input type="checkbox" value="180K - 200K"> 180K - 200K</label>
    <label><input type="checkbox" value="900K - 1M"> 900K - 1M</label>

    <label><input type="checkbox" value="4K - 4.5K"> 4K - 4.5K</label>
    <label><input type="checkbox" value="11.5K - 12.5K"> 11.5K - 12.5K</label>
    <label><input type="checkbox" value="37K - 42K"> 37K - 42K</label>
    <label><input type="checkbox" value="200K - 240K"> 200K - 240K</label>
    <label><input type="checkbox" value="1M+"> 1M+</label>

    <label><input type="checkbox" value="4.5K - 5K"> 4.5K - 5K</label>
    <label><input type="checkbox" value="12.5K - 13.5K"> 12.5K - 13.5K</label>
    <label><input type="checkbox" value="42K - 47K"> 42K - 47K</label>
    <label><input type="checkbox" value="240K - 270K"> 240K - 270K</label>
    <span class="sqft-spacer"></span>

    <label><input type="checkbox" value="5K - 5.5K"> 5K - 5.5K</label>
    <label><input type="checkbox" value="13.5K - 15K"> 13.5K - 15K</label>
    <label><input type="checkbox" value="47K - 55K"> 47K - 55K</label>
    <label><input type="checkbox" value="270K - 300K"> 270K - 300K</label>
    <span class="sqft-spacer"></span>

    <label><input type="checkbox" value="5.5K - 6K"> 5.5K - 6K</label>
    <label><input type="checkbox" value="15K - 16.5K"> 15K - 16.5K</label>
    <label><input type="checkbox" value="55K - 65K"> 55K - 65K</label>
    <label><input type="checkbox" value="300K - 350K"> 300K - 350K</label>
    <span class="sqft-spacer"></span>
    
    <label><input type="checkbox" value="6K - 6.5K"> 6K - 6.5K</label>
    <label><input type="checkbox" value="16.5K - 18.5K"> 16.5K - 18.5K</label>
    <label><input type="checkbox" value="65K - 75K"> 65K - 75K</label>
    <label><input type="checkbox" value="350K - 400K"> 350K - 400K</label>
    <span class="sqft-spacer"></span>
  `;



  // ------------------------------------------------------------
  // Select/Clear logic for lookups
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
  // Run By choices
  // ------------------------------------------------------------
  const runBySelect = document.getElementById("agent-runby");
  const RUNNERS = ["Jacob", "Benji"];
  runBySelect.innerHTML = RUNNERS.map(r => `<option value="${r}">${r}</option>`).join("");

  const savedRunner = localStorage.getItem("jw_user_label");
  if (savedRunner && RUNNERS.includes(savedRunner)) {
    runBySelect.value = savedRunner;
  }

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
        if (cb.checked) {
          tr.classList.add("selected-row");
        } else {
          tr.classList.remove("selected-row");
        }
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
  // Clear Results (leftover UI reset)
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

    const runBy = runBySelect.value;
    if (!runBy) {
      msg.textContent = "Please select who ran this.";
      return;
    }

    localStorage.setItem("jw_user_label", runBy);

    const includeHot = document.getElementById("agent-hot").checked;
    const includeCustomers = document.getElementById("agent-customers").checked;
    const applyNoEmail = document.getElementById("agent-apply-noemail").checked;

    let days = parseInt(document.getElementById("agent-noemail-days").value, 10);
    if (!Number.isFinite(days) || days <= 0) days = 30;

    const payload = {
      neighborhoods,
      square_footage: sqft,
      includeHotLeads: includeHot,
      includeCustomers,
      applyNoEmail,
      noEmailDays: days
    };

    try {
      const res = await fetch("https://filter-module.dennis-e64.workers.dev", {
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

      window.currentContactIds = [];
      results.forEach(c => {
        if (c.contact_id) window.currentContactIds.push(String(c.contact_id));
      });

      // ------------------------------------------------------------
      // SORT + RENDER TABLE
      // ------------------------------------------------------------
      function sortResults() {
        const { column, direction } = portalState.agentFilterSort;

        // Do not sort on the "select" column
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
          if (col.key === "select") {
            return `<th>${col.label}</th>`;
          }

          const isSorted = portalState.agentFilterSort.column === col.key;
          const up = isSorted && portalState.agentFilterSort.direction === "asc" ? "▲" : "△";
          const down = isSorted && portalState.agentFilterSort.direction === "desc" ? "▼" : "▽";

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

        const body = document.getElementById("agent-results-body");
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

        // Wire sorting
        document.querySelectorAll("th.sortable").forEach(th => {
          th.addEventListener("click", () => {
            const field = th.dataset.field;
            if (portalState.agentFilterSort.column === field) {
              portalState.agentFilterSort.direction =
                portalState.agentFilterSort.direction === "asc" ? "desc" : "asc";
            } else {
              portalState.agentFilterSort.column = field;
              portalState.agentFilterSort.direction = "asc";
            }
            renderResultsTable();
          });
        });

        // Wire row selection highlighting
        wireRowSelection();

        // Update selected count
        updateSelectedCount();
      }

      renderResultsTable();

    } catch (err) {
      msg.textContent = "Error fetching data: " + err.message;
    }
  };

  // ------------------------------------------------------------
  // Save CSV (only selected rows)
  // ------------------------------------------------------------
document.getElementById("agent-savecsv").onclick = async () => {
  const rows = Array.from(document.querySelectorAll("#agent-results-body tr"));
  const checkedRows = rows.filter(r => r.querySelector(".row-check")?.checked);

  if (!checkedRows.length) {
    alert("No rows selected.");
    return;
  }

  // Build CSV from selected rows
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

  const selectedResults = [];

checkedRows.forEach(tr => {
  const cb = tr.querySelector(".row-check");
  const contactId = cb?.dataset.id || null;
  const tds = Array.from(tr.querySelectorAll("td")).slice(1);
  const rowValues = tds.map(td => td.textContent);
  csv += rowValues
    .map(v => `"${v.replace(/"/g, '""')}"`)
    .join(",") + "\n";

  // Pull the DB payload from the ORIGINAL result object, not the rendered <td> text —
  // this keeps neighborhood/square_footage as real arrays (matches text[] columns)
  const original = results.find(r => String(r.contact_id) === String(contactId));

  selectedResults.push({
    contact_id: contactId,                                     // REQUIRED
    email: original?.email || "",
    first_name: original?.first_name || "",                    // REQUIRED (even empty)
    last_name: original?.last_name || "",                       // REQUIRED (even empty)
    business_name: original?.business_name || "",
    industry: original?.industry || "",
    vertical_market: original?.vertical_market || "",
    neighborhood: Array.isArray(original?.neighborhood) ? original.neighborhood : [],
    square_footage: Array.isArray(original?.square_footage) ? original.square_footage : [],
    lead_level: original?.lead_level || "",
    type: original?.type || "",
    last_email_date: original?.last_email_date || null,
    last_reply_date: null                                        // REQUIRED (even null)
  });
});

  // Download CSV
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "jw_contacts_selected.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 🔹 NOW commit to backend (ONLY on Save CSV)
  const runBy = document.getElementById("agent-runby").value;
  const neighborhoods = Array.from(
    document.querySelectorAll("#agent-nh-grid input:checked")
  ).map(cb => cb.value);
  const sqft = Array.from(
    document.querySelectorAll("#agent-sqft-grid input:checked")
  ).map(cb => cb.value);

  const contactIds = selectedResults
    .map(r => r.contact_id)
    .filter(Boolean)
    .map(String);

try {
  const commitResp = await fetch("https://filter-module.dennis-e64.workers.dev/commit-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_label: runBy,
      neighborhoods,
      square_footage: sqft,
      contact_ids: contactIds,
      result_count: selectedResults.length,
      results: selectedResults
    })
  });

  const commitJson = await commitResp.json();
  console.log("COMMIT RESPONSE:", commitJson);

} catch (err) {
  console.error("Save CSV commit failed:", err);
}

};


}
