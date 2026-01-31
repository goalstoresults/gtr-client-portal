// /js/filter/run.js
// Run Filter — Phase 1 parity with cleaner UI + Choices.js

import { escapeHtml, formatDateOnly } from "../utilities.js";

export async function renderRunFilter(container, portalState) {
  container.innerHTML = `
    <section class="card two-col">

      <!-- LEFT PANEL -->
      <div class="left-panel">

        <h3>Filter Criteria</h3>

        <label>Neighborhoods</label>
        <select id="flt-neighborhoods" multiple></select>
        <div class="btn-row">
          <button id="flt-nh-selectall" class="secondary">Select All</button>
          <button id="flt-nh-clear" class="secondary">Clear</button>
        </div>

        <label>Square Footage</label>
        <select id="flt-sqft" multiple></select>
        <div class="btn-row">
          <button id="flt-sqft-selectall" class="secondary">Select All</button>
          <button id="flt-sqft-clear" class="secondary">Clear</button>
        </div>

        <label>Run By</label>
        <select id="flt-runby"></select>

        <label>No emails recently</label>
        <div class="inline">
          <input type="checkbox" id="flt-apply-noemail" checked />
          <span>Show contacts with no emails in the last</span>
          <input type="number" id="flt-noemail-days" value="30" min="1" max="3650" />
          <span>days</span>
        </div>

        <div class="inline" style="margin-top:12px;">
          <input type="checkbox" id="flt-hot" />
          <label for="flt-hot">Include Hot Leads</label>
        </div>

        <div class="inline">
          <input type="checkbox" id="flt-customers" />
          <label for="flt-customers">Include Customers</label>
        </div>

        <button id="flt-run" class="primary" style="margin-top:20px;">Run Filter</button>

      </div>

      <!-- RIGHT PANEL -->
      <div class="right-panel">
        <h3>Results</h3>
        <div id="flt-message" class="mini-label"></div>

        <div id="flt-total" style="font-weight:bold; margin-top:8px;"></div>

        <div class="btn-row" style="margin-top:12px;">
          <button id="flt-clear" class="secondary">Clear</button>
          <button id="flt-savecsv" class="secondary">Save CSV</button>
        </div>

        <table id="flt-results" class="notes-table" style="display:none; margin-top:16px;">
          <thead>
            <tr>
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
          <tbody id="flt-results-body"></tbody>
        </table>
      </div>

    </section>
  `;

  // ------------------------------------------------------------
  // Initialize Choices.js
  // ------------------------------------------------------------
  const nhSelect = new Choices("#flt-neighborhoods", {
    removeItemButton: true,
    searchEnabled: true,
    shouldSort: false
  });

  const sqftSelect = new Choices("#flt-sqft", {
    removeItemButton: true,
    searchEnabled: true,
    shouldSort: false
  });

  const runBySelect = new Choices("#flt-runby", {
    removeItemButton: false,
    searchEnabled: false,
    shouldSort: false
  });

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

    nhSelect.setChoices(
      NEIGHBORHOODS.map(n => ({ value: n, label: n })),
      "value",
      "label",
      false
    );

    sqftSelect.setChoices(
      SQFT.map(s => ({ value: s, label: s })),
      "value",
      "label",
      false
    );
  } catch (err) {
    console.error("Lookup load error:", err);
  }

  // ------------------------------------------------------------
  // Run By choices
  // ------------------------------------------------------------
  const RUNNERS = ["Jacob", "Benji"];
  runBySelect.setChoices(
    RUNNERS.map(r => ({ value: r, label: r })),
    "value",
    "label",
    false
  );

  // Restore last used runner
  const savedRunner = localStorage.getItem("jw_user_label");
  if (savedRunner && RUNNERS.includes(savedRunner)) {
    runBySelect.setChoiceByValue(savedRunner);
  }

  // ------------------------------------------------------------
  // Select/Clear buttons
  // ------------------------------------------------------------
  document.getElementById("flt-nh-selectall").onclick = () =>
    nhSelect.setChoiceByValue(NEIGHBORHOODS);

  document.getElementById("flt-nh-clear").onclick = () =>
    nhSelect.removeActiveItems();

  document.getElementById("flt-sqft-selectall").onclick = () =>
    sqftSelect.setChoiceByValue(SQFT);

  document.getElementById("flt-sqft-clear").onclick = () =>
    sqftSelect.removeActiveItems();

  // ------------------------------------------------------------
  // Clear Results
  // ------------------------------------------------------------
  document.getElementById("flt-clear").onclick = () => {
    document.getElementById("flt-message").textContent = "";
    document.getElementById("flt-results").style.display = "none";
    document.getElementById("flt-results-body").innerHTML = "";
    document.getElementById("flt-total").textContent = "";
  };

  // ------------------------------------------------------------
  // Run Filter
  // ------------------------------------------------------------
  document.getElementById("flt-run").onclick = async () => {
    const msg = document.getElementById("flt-message");
    const table = document.getElementById("flt-results");
    const body = document.getElementById("flt-results-body");
    const total = document.getElementById("flt-total");

    msg.textContent = "Loading...";
    table.style.display = "none";
    body.innerHTML = "";
    total.textContent = "";

    const neighborhoods = nhSelect.getValue(true);
    const sqft = sqftSelect.getValue(true);

    if (!neighborhoods.length || !sqft.length) {
      msg.textContent = "Please select at least one Neighborhood and one Square Footage.";
      return;
    }

    const runBy = runBySelect.getValue(true);
    if (!runBy) {
      msg.textContent = "Please select who ran this.";
      return;
    }

    localStorage.setItem("jw_user_label", runBy);

    const includeHot = document.getElementById("flt-hot").checked;
    const includeCustomers = document.getElementById("flt-customers").checked;
    const applyNoEmail = document.getElementById("flt-apply-noemail").checked;

    let days = parseInt(document.getElementById("flt-noemail-days").value, 10);
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
        const tr = document.createElement("tr");

        const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
        const nh = Array.isArray(c.neighborhood) ? c.neighborhood.join(", ") : (c.neighborhood || "");
        const sq = Array.isArray(c.square_footage) ? c.square_footage.join(", ") : (c.square_footage || "");

        tr.innerHTML = `
          <td>${escapeHtml(c.email || "")}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(nh)}</td>
          <td>${escapeHtml(sq)}</td>
          <td>${escapeHtml(c.lead_level || "")}</td>
          <td>${escapeHtml(c.type || "")}</td>
          <td>${formatDateOnly(c.last_email_date)}</td>
          <td>${formatDateOnly(c.last_reply_date)}</td>
        `;

        body.appendChild(tr);
        if (c.contact_id) window.currentContactIds.push(String(c.contact_id));
      });

    } catch (err) {
      msg.textContent = "Error fetching data: " + err.message;
    }
  };

  // ------------------------------------------------------------
  // Save CSV + Log Run + Mark Emailed
  // ------------------------------------------------------------
  document.getElementById("flt-savecsv").onclick = async () => {
    const table = document.getElementById("flt-results");
    const rows = Array.from(document.querySelectorAll("#flt-results-body tr"));
    if (!rows.length) return alert("No data to save");

    const runBy = runBySelect.getValue(true);
    if (!runBy) return alert("Please select who ran this.");

    const neighborhoods = nhSelect.getValue(true);
    const sqft = sqftSelect.getValue(true);

    // Log run
    try {
      await fetch("https://filter-module.dennis-e64.workers.dev/log-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_label: runBy,
          filter_name: "",
          neighborhoods,
          square_footage: sqft,
          result_count: rows.length
        })
      });
    } catch (_) {}

    // Mark emailed
    try {
      if (window.currentContactIds?.length) {
        await fetch("https://filter-module.dennis-e64.workers.dev/mark-emailed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contact_ids: window.currentContactIds })
        });
      }
    } catch (_) {}

    // CSV export
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
    a.download = "jw_contacts.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };
}
