// /js/filter/history.js
// History Subtab — Phase 1 parity with cleaner UI + portal table styling

import { escapeHtml, formatDateTime } from "../utilities.js";

export async function renderFilterHistory(container, portalState) {
  container.innerHTML = `
    <section class="card">

      <h3>History</h3>

      <div class="inline" style="flex-wrap:wrap; gap:16px; margin-bottom:16px;">

        <label>
          Past
          <input type="number" id="hist-days" value="30" min="1" max="3650" style="width:80px;">
          days
        </label>

        <label>
          Max rows
          <input type="number" id="hist-limit" value="100" min="0" max="1000" style="width:80px;">
          <span class="mini-label">(0 = no limit)</span>
        </label>

        <label>
          User
          <select id="hist-user"></select>
        </label>

        <button id="hist-load" class="primary">Load</button>

      </div>

      <div id="hist-status" class="mini-label" style="margin-bottom:8px;"></div>

      <table class="notes-table" id="hist-table" style="display:none;">
        <thead>
          <tr>
            <th>Run At</th>
            <th>User</th>
            <th>Filter Name</th>
            <th>Neighborhoods</th>
            <th>Square Footage</th>
            <th>Result Count</th>
          </tr>
        </thead>
        <tbody id="hist-body"></tbody>
      </table>

    </section>
  `;

  // ------------------------------------------------------------
  // Initialize Choices.js for User filter
  // ------------------------------------------------------------
  const userSelect = new Choices("#hist-user", {
    removeItemButton: false,
    searchEnabled: false,
    shouldSort: false
  });

  const RUNNERS = ["Jacob", "Benji"];
  userSelect.setChoices(
    [{ value: "", label: "All" }, ...RUNNERS.map(r => ({ value: r, label: r }))],
    "value",
    "label",
    false
  );

  // ------------------------------------------------------------
  // Load History
  // ------------------------------------------------------------
  document.getElementById("hist-load").onclick = async () => {
    const days = Math.max(1, Math.min(3650, parseInt(document.getElementById("hist-days").value || "30", 10)));
    let limit = parseInt(document.getElementById("hist-limit").value || "100", 10);
    if (!Number.isFinite(limit) || limit < 0) limit = 100;

    const user = userSelect.getValue(true);

    const status = document.getElementById("hist-status");
    const table = document.getElementById("hist-table");
    const body = document.getElementById("hist-body");

    status.textContent = "Loading…";
    table.style.display = "none";
    body.innerHTML = "";

    const qs = new URLSearchParams();
    qs.set("days", String(days));
    if (limit > 0) qs.set("limit", String(limit));
    if (user) qs.set("user", user);

    try {
      const res = await fetch(
        `https://filter-module.dennis-e64.workers.dev/history?${qs.toString()}`,
        { headers: { accept: "application/json" } }
      );

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || `HTTP ${res.status}`);

      const runs = Array.isArray(data.runs) ? data.runs : [];

      if (!runs.length) {
        status.textContent = `No runs in the last ${data.window_days ?? days} days.`;
        return;
      }

      body.innerHTML = runs
        .map(run => {
          const nh = Array.isArray(run.neighborhoods)
            ? run.neighborhoods.join(", ")
            : (run.neighborhoods || "");

          const sq = Array.isArray(run.square_footage)
            ? run.square_footage.join(", ")
            : (run.square_footage || "");

          const fname = run.filter_name || "";

          return `
            <tr>
              <td>${formatDateTime(run.run_at)}</td>
              <td>${escapeHtml(run.user_label || "")}</td>
              <td title="${escapeHtml(fname)}">${escapeHtml(fname)}</td>
              <td>${escapeHtml(nh)}</td>
              <td>${escapeHtml(sq)}</td>
              <td>${run.result_count ?? ""}</td>
            </tr>
          `;
        })
        .join("");

      table.style.display = "";
      status.textContent = `Showing ${runs.length} run(s) from last ${data.window_days ?? days} days${user ? ` for ${user}` : ""}${limit > 0 ? ` (limit ${limit})` : ""}.`;

    } catch (err) {
      status.textContent = "Error: " + err.message;
    }
  };
}
