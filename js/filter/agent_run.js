// /js/filter/agent_run.js
// Agent Filter — Phase 1: duplicate of run.js but with checkbox UI for NH + SqFt

import { escapeHtml, formatDateOnly } from "../utilities.js";

export async function renderAgentFilter(container, portalState) {

  // ------------------------------------------------------------
  // Initialize sort state (same as run.js)
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

      <label>Neighborhoods</label>
      <div id="agent-nh-list" class="checkbox-list"></div>
      <div class="btn-row">
        <button id="agent-nh-selectall" class="secondary">Select All</button>
        <button id="agent-nh-clear" class="secondary">Clear</button>
      </div>

      <label>Square Footage</label>
      <div id="agent-sqft-list" class="checkbox-list"></div>
      <div class="btn-row">
        <button id="agent-sqft-selectall" class="secondary">Select All</button>
        <button id="agent-sqft-clear" class="secondary">Clear</button>
      </div>

      <label>Run By</label>
      <select id="agent-runby"></select>

      <label>Filename</label>
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

      <div class="btn-row" style="margin-top:12px;">
        <button id="agent-clear" class="secondary">Clear</button>
        <button id="agent-savecsv" class="secondary">Save CSV</button>
      </div>

      <table id="agent-results" class="notes-table" style="display:none; margin-top:16px;">
        <thead>
          <tr id="agent-header-row">
            <th>Email</th>
            <th>Name</th>
            <th>Neighborhood</th>
            <th>Square Footage</th>
            <th>Lead Level</th>
            <th>Type</th>
            <th>Last Email</th>
            <th>Last Reply</th>
          </tr>
        </thead>
        <tbody id="agent-results-body"></tbody>
      </table>
    </div>

  </section>
  `;

  // ------------------------------------------------------------
  // Load Lookups (same endpoint as run.js)
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
  // Render checkbox lists
  // ------------------------------------------------------------
  const nhList = document.getElementById("agent-nh-list");
  const sqftList = document.getElementById("agent-sqft-list");

  nhList.innerHTML = NEIGHBORHOODS.map(n => `
    <label><input type="checkbox" value="${n}" checked> ${n}</label>
  `).join("");

  sqftList.innerHTML = SQFT.map(s => `
    <label><input type="checkbox" value="${s}" checked> ${s}</label>
  `).join("");

  // ------------------------------------------------------------
  // Select/Clear logic
  // ------------------------------------------------------------
  document.getElementById("agent-nh-selectall").onclick = () => {
    nhList.querySelectorAll("input").forEach(cb => cb.checked = true);
  };
  document.getElementById("agent-nh-clear").onclick = () => {
    nhList.querySelectorAll("input").forEach(cb => cb.checked = false);
  };

  document.getElementById("agent-sqft-selectall").onclick = () => {
    sqftList.querySelectorAll("input").forEach(cb => cb.checked = true);
  };
  document.getElementById("agent-sqft-clear").onclick = () => {
    sqftList.querySelectorAll("input").forEach(cb => cb.checked = false);
  };

  // ------------------------------------------------------------
  // Run By choices (same as run.js)
  // ------------------------------------------------------------
  const runBySelect = document.getElementById("agent-runby");
  const RUNNERS = ["Jacob", "Benji"];
  runBySelect.innerHTML = RUNNERS.map(r => `<option value="${r}">${r}</option>`).join("");

  const savedRunner = localStorage.getItem("jw_user_label");
  if (savedRunner && RUNNERS.includes(savedRunner)) {
    runBySelect.value = savedRunner;
  }

  // ------------------------------------------------------------
  // Clear Results
  // ------------------------------------------------------------
  document.getElementById("agent-clear").onclick = () => {
    document.getElementById("agent-message").textContent = "";
    document.getElementById("agent-results").style.display = "none";
    document.getElementById("agent-results-body").innerHTML = "";
    document.getElementById("agent-total").textContent = "";
    window.currentContactIds = [];
  };

  // ------------------------------------------------------------
  // Run Filter (same logic as run.js, but using checkbox values)
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
    window.currentContactIds = [];

    const neighborhoods = Array.from(
      nhList.querySelectorAll("input:checked")
    ).map(cb => cb.value);

    const sqft = Array.from(
      sqftList.querySelectorAll("input:checked")
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
      // AUTO-SAVE COMMIT (same as run.js)
      // ------------------------------------------------------------
      const autoSave = document.getElementById("agent-autosave").checked;
      if (autoSave) {
        try {
          await fetch("https://filter-module.dennis-e64.workers.dev/commit-run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_label: runBy,
              neighborhoods,
              square_footage: sqft,
              contact_ids: window.currentContactIds,
              result_count: results.length,
              results
            })
          });
        } catch (err) {
          console.error("Auto-save failed:", err);
        }
      }

      // ------------------------------------------------------------
      // SORT + RENDER TABLE (same as run.js)
      // ------------------------------------------------------------
      function sortResults() {
        const { column, direction } = portalState.agentFilterSort;
        results.sort((a, b) => {
          let A = a[column];
          let B = b[column];

          if (column === "last_email_date" || column === "last_reply_date") {
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
          { key: "email", label: "Email" },
          { key: "name", label: "Name" },
          { key: "neighborhood", label: "Neighborhood" },
          { key: "square_footage", label: "Square Footage" },
          { key: "lead_level", label: "Lead Level" },
          { key: "type", label: "Type" },
          { key: "last_email_date", label: "Last Email" },
          { key: "last_reply_date", label: "Last Reply" }
        ];

        const headerHtml = headerConfig.map(col => {
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

        body.innerHTML = results.map(c => {
          const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
          const nh = Array.isArray(c.neighborhood) ? c.neighborhood.join(", ") : (c.neighborhood || "");
          const sq = Array.isArray(c.square_footage) ? c.square_footage.join(", ") : (c.square_footage || "");

          return `
            <tr>
              <td>${escapeHtml(c.email || "")}</td>
              <td>${escapeHtml(name)}</td>
              <td>${escapeHtml(nh)}</td>
              <td>${escapeHtml(sq)}</td>
              <td>${escapeHtml(c.lead_level || "")}</td>
              <td>${escapeHtml(c.type || "")}</td>
              <td>${formatDateOnly(c.last_email_date)}</td>
              <td>${formatDateOnly(c.last_reply_date)}</td>
            </tr>
          `;
        }).join("");

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
      }

      renderResultsTable();

    } catch (err) {
      msg.textContent = "Error fetching data: " + err.message;
    }
  };

  // ------------------------------------------------------------
  // Save CSV (same as run.js)
  // ------------------------------------------------------------
  document.getElementById("agent-savecsv").onclick = async () => {
    const table = document.getElementById("agent-results");
    const rows = Array.from(document.querySelectorAll("#agent-results-body tr"));
    if (!rows.length) return alert("No data to save");

    const trs = Array.from(table.querySelectorAll("tr"));
    const csv = trs
      .map(tr =>
        Array.from(tr.querySelectorAll("th,td"))
          .map(td => `"${td.textContent.replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jw_contacts_agent.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

}
