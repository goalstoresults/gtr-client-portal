// js/goals/goals.js
import { escapeHtml, formatCurrency } from "../utilities.js";

export async function loadGoalsTab({ portalState, content }) {
  await renderGoalsTab(content, portalState);
}

async function renderGoalsTab(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2>Goals</h2>
        <div>
          <button id="goals-create-year" class="btn">Create Year</button>
          <button id="goals-refresh-year" class="btn">Refresh Year</button>
        </div>
      </div>

      <label style="display:flex; align-items:center; gap:12px; margin-bottom:12px; margin-top:12px;">
        <span>Year:</span>
        <select id="goals-year"></select>
        <button id="goals-update-totals" class="btn">Update Totals</button>
      </label>

      <div id="goals-empty-message" style="margin:20px 0; display:none;">
        <em>No goals exist for this year. Click "Create Year" to begin.</em>
      </div>

      <div id="goals-leads-grid"></div>
      <div style="height:32px;"></div>
      <div id="goals-clients-grid"></div>
      <div style="height:32px;"></div>
      <div id="goals-revenue-grid"></div>
    </section>

    <div id="toast" style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 12px 18px;
      border-radius: 6px;
      font-size: 14px;
      display: none;
      z-index: 9999;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    ">Saved!</div>
  `;

  const yearSelect = container.querySelector("#goals-year");
  const leadsGrid = container.querySelector("#goals-leads-grid");
  const clientsGrid = container.querySelector("#goals-clients-grid");
  const revenueGrid = container.querySelector("#goals-revenue-grid");
  const emptyMessage = container.querySelector("#goals-empty-message");

  const btnCreate = container.querySelector("#goals-create-year");
  const btnRefresh = container.querySelector("#goals-refresh-year");

  await loadYearDropdown();

  yearSelect.addEventListener("change", loadYear);
  btnCreate.addEventListener("click", () => createYear(portalState));
  btnRefresh.addEventListener("click", () => refreshYear(portalState));
  
  const btnUpdateTotals = container.querySelector("#goals-update-totals");
  btnUpdateTotals.addEventListener("click", () => updateTotals(portalState));


  loadYear();

  /* ------------------------------------------------------------
     LOAD YEAR DROPDOWN
  ------------------------------------------------------------ */
  async function loadYearDropdown() {
    const years = await fetchYears(portalState.project);

    yearSelect.innerHTML = years
      .map(y => `<option value="${y}">${y}</option>`)
      .join("");

    if (years.length === 0) {
      yearSelect.innerHTML = "";
    }
  }

  /* ------------------------------------------------------------
     LOAD YEAR DATA
  ------------------------------------------------------------ */
  async function loadYear() {
    const year = Number(yearSelect.value);
    if (!year) {
      clearGrids();
      emptyMessage.style.display = "block";
      return;
    }

    const [services, goals] = await Promise.all([
      fetchServices(portalState.project),
      fetchGoals(portalState.project, year)
    ]);

    // Only active services should appear in Goals UI
    const activeServices = services.filter(s => s.is_active !== false);
    window._servicesCache = activeServices;

    if (!goals || goals.length === 0) {
      clearGrids();
      emptyMessage.style.display = "block";
      return;
    }

    emptyMessage.style.display = "none";

    renderLeadIndicatorsGrid(goals, year);
    renderClientsGrid(activeServices, goals);
    renderRevenueGrid(activeServices);

    attachAutosaveHandlers(portalState, year);
  }

  function clearGrids() {
    leadsGrid.innerHTML = "";
    clientsGrid.innerHTML = "";
    revenueGrid.innerHTML = "";
  }

  /* ------------------------------------------------------------
     CREATE YEAR
  ------------------------------------------------------------ */
  async function createYear(portalState) {
    const year = prompt("Enter year to create:");
    if (!year) return;

    await fetch(`https://goals-module.dennis-e64.workers.dev/create-year`, {
      method: "POST",
      body: JSON.stringify({ project: portalState.project, year }),
      headers: { "Content-Type": "application/json" }
    });

    await loadYearDropdown();
    yearSelect.value = year;

    showToast("Year created");
    loadYear();
  }

    /* ------------------------------------------------------------
       UPDATE TOTALS (manual refresh)
    ------------------------------------------------------------ */
    async function updateTotals(portalState) {
      const year = Number(yearSelect.value);
      if (!year) return;
    
      // Force blur to trigger autosave if a cell is active
      if (document.activeElement) {
        document.activeElement.blur();
      }
    
      // Wait a moment for autosave to complete
      await new Promise(r => setTimeout(r, 150));
    
      // Fetch fresh goals
      const goals = await fetchGoals(portalState.project, year);
    
      // Re-render all grids
      renderLeadIndicatorsGrid(goals, year);
      renderClientsGrid(window._servicesCache, goals);
      renderRevenueGrid(window._servicesCache);
    
      // Re-attach autosave handlers
      attachAutosaveHandlers(portalState, year);
    
      showToast("Totals updated");
    }

  
  /* ------------------------------------------------------------
     REFRESH YEAR
  ------------------------------------------------------------ */
  async function refreshYear(portalState) {
    const year = Number(yearSelect.value);
    if (!year) return;

    await fetch(`https://goals-module.dennis-e64.workers.dev/refresh-year`, {
      method: "POST",
      body: JSON.stringify({ project: portalState.project, year }),
      headers: { "Content-Type": "application/json" }
    });

    showToast("Year refreshed");
    loadYear();
  }

  /* ------------------------------------------------------------
     AUTOSAVE
  ------------------------------------------------------------ */
function attachAutosaveHandlers(portalState, year) {

  // LEAD INDICATORS
  document.querySelectorAll(".li-input").forEach(input => {
    input.addEventListener("blur", async e => {
      const key = e.target.dataset.liKey;
      const month = Number(e.target.dataset.month);
      const value = Number(e.target.value) || 0;

      await updateIndicatorCell(portalState.project, year, month, key, value);
      showToast();
    });
  });

  // CLIENT GOALS
  document.querySelectorAll(".client-goal-input").forEach(input => {
    input.addEventListener("blur", async e => {
      const service_id = e.target.dataset.service;
      const month = Number(e.target.dataset.month);
      const value = Number(e.target.value) || 0;

      await updateClientCell(portalState.project, year, month, service_id, value);
      showToast();
    });
  });
}

  /* ------------------------------------------------------------
     API HELPERS
  ------------------------------------------------------------ */

  async function fetchYears(project) {
    const res = await fetch(
      `https://goals-module.dennis-e64.workers.dev/years?project=${project}`
    );
    return await res.json();
  }

  async function fetchServices(project) {
    const res = await fetch(
      `https://operations-module.dennis-e64.workers.dev/services/list?project=${project}`
    );
    return await res.json();
  }

  async function fetchGoals(project, year) {
    const res = await fetch(
      `https://goals-module.dennis-e64.workers.dev/list?project=${project}&year=${year}`
    );
    return await res.json();
  }

  async function updateClientCell(project, year, month, service_id, value) {
    await fetch(`https://goals-module.dennis-e64.workers.dev/update-client`, {
      method: "POST",
      body: JSON.stringify({ project, year, month, service_id, value }),
      headers: { "Content-Type": "application/json" }
    });
  }

  async function updateIndicatorCell(project, year, month, key, value) {
    await fetch(`https://goals-module.dennis-e64.workers.dev/update-indicator`, {
      method: "POST",
      body: JSON.stringify({ project, year, month, key, value }),
      headers: { "Content-Type": "application/json" }
    });
  }

  /* ------------------------------------------------------------
     TOAST
  ------------------------------------------------------------ */
  function showToast(message = "Saved!") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.style.display = "block";
    toast.style.opacity = "1";

    setTimeout(() => {
      toast.style.transition = "opacity 0.6s";
      toast.style.opacity = "0";
      setTimeout(() => {
        toast.style.display = "none";
        toast.style.transition = "";
      }, 600);
    }, 1500);
  }

  /* ------------------------------------------------------------
     GRID RENDERING — LEAD INDICATORS (WITH TOTALS AT TOP)
  ------------------------------------------------------------ */

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const indicators = [
    { key: "outreach_past_clients", label: "Outreach to Clients (Current/Past)" },
    { key: "outreach_networks", label: "Outreach to Networks" },
    { key: "outreach_referrals", label: "Outreach to Referral Partners" },
    { key: "new_leads", label: "New Leads" },
    { key: "discovery_calls", label: "Discovery Calls" },
    { key: "sales_calls", label: "Sales Calls" }
  ];

function renderLeadIndicatorsGrid(goals, year) {

  // 1. Compute monthly totals
  const monthlyTotals = months.map((_, idx) => {
    const month = idx + 1;

    return indicators.reduce((sum, ind) => {
      const sid = `${portalState.project}-${year}-${month}-indicators`;
      const row = goals.find(g => g.month === month && g.service_id === sid);
      const value = Number(row?.[ind.key] ?? 0);
      return sum + value;
    }, 0);
  });

  // 2. Header row (months)
  const header = `
    <tr>
      <th>Indicator</th>
      ${months.map(m => `<th class="amount">${m}</th>`).join("")}
    </tr>
  `;

  // 3. Totals row (gold background)
  const totalsRow = `
    <tr style="background:#f7e7c3; font-weight:bold;">
      <td style="text-align:left;">TOTAL</td>
      ${monthlyTotals.map(t => `<td class="amount">${t}</td>`).join("")}
    </tr>
  `;

  // 4. Data rows
  const body = indicators.map(ind => {
    const cells = months.map((_, idx) => {
      const month = idx + 1;

      const sid = `${portalState.project}-${year}-${month}-indicators`;
      const row = goals.find(g => g.month === month && g.service_id === sid);

      const value = Number(row?.[ind.key] ?? 0);

      return `
        <td class="amount">
          <input type="number" class="li-input"
            data-li-key="${ind.key}"
            data-month="${month}"
            value="${value}" min="0">
        </td>
      `;
    }).join("");

    return `<tr><td>${escapeHtml(ind.label)}</td>${cells}</tr>`;
  }).join("");

  // 5. Render
  leadsGrid.innerHTML = `
    <h3>Lead Indicators (Goals)</h3>
    <div class="goals-scroll-container">
      <table class="notes-table goals-table">
        <thead>
          ${header}
          ${totalsRow}
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

  /* ------------------------------------------------------------
     GRID RENDERING — CLIENT GOALS (WITH TOTALS AT TOP)
  ------------------------------------------------------------ */

function renderClientsGrid(services, goals) {

  // 1. Monthly totals
  const monthlyTotals = months.map((_, idx) => {
    const month = idx + 1;

    return services.reduce((sum, s) => {
      const g = goals.find(g => g.service_id === s.id && g.month === month);
      const value = Number(g?.goal_clients ?? 0);
      return sum + value;
    }, 0);
  });

  // 2. Header row
  const header = `
    <tr>
      <th>Service</th>
      ${months.map(m => `<th class="amount">${m}</th>`).join("")}
    </tr>
  `;

  // 3. Totals row (gold)
  const totalsRow = `
    <tr style="background:#f7e7c3; font-weight:bold;">
      <td style="text-align:left;">TOTAL</td>
      ${monthlyTotals.map(t => `<td class="amount">${t}</td>`).join("")}
    </tr>
  `;

  // 4. Data rows
  const body = services.map(s => {
    const row = months.map((_, idx) => {
      const month = idx + 1;
      const g = goals.find(g => g.service_id === s.id && g.month === month);
      const value = Number(g?.goal_clients ?? 0);

      return `
        <td class="amount">
          <input type="number" class="client-goal-input"
            data-service="${s.id}"
            data-month="${month}"
            value="${value}" min="0">
        </td>
      `;
    }).join("");

    return `<tr><td>${escapeHtml(s.service_name)}</td>${row}</tr>`;
  }).join("");

  // 5. Render
  clientsGrid.innerHTML = `
    <h3>Client Count Goals</h3>
    <div class="goals-scroll-container">
      <table class="notes-table goals-table">
        <thead>
          ${header}
          ${totalsRow}
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}


  /* ------------------------------------------------------------
     GRID RENDERING — REVENUE (WITH TOTALS AT TOP)
  ------------------------------------------------------------ */

function renderRevenueGrid(services) {

  // 1. Monthly totals
  const monthlyTotals = months.map((_, idx) => {
    const month = idx + 1;

    return services.reduce((sum, s) => {
      const input = document.querySelector(
        `.client-goal-input[data-service="${s.id}"][data-month="${month}"]`
      );
      const clients = Number(input?.value || 0);
      const revenue = clients * (s.default_price || 0);
      return sum + revenue;
    }, 0);
  });

  // 2. Grand total
  const grandTotal = monthlyTotals.reduce((a, b) => a + b, 0);

  // 3. Header row
  const header = `
    <tr>
      <th>Service</th>
      ${months.map(m => `<th class="amount">${m}</th>`).join("")}
      <th class="amount">Total</th>
    </tr>
  `;

  // 4. Totals row (gold)
  const totalsRow = `
    <tr style="background:#f7e7c3; font-weight:bold;">
      <td style="text-align:left;">TOTAL</td>
      ${monthlyTotals.map(t => `<td class="amount">${formatCurrency(t)}</td>`).join("")}
      <td class="amount"><strong>${formatCurrency(grandTotal)}</strong></td>
    </tr>
  `;

  // 5. Data rows
  const body = services.map(s => {
    const monthly = months.map((_, idx) => {
      const month = idx + 1;
      const input = document.querySelector(
        `.client-goal-input[data-service="${s.id}"][data-month="${month}"]`
      );
      const clients = Number(input?.value || 0);
      return clients * (s.default_price || 0);
    });

    const total = monthly.reduce((a, b) => a + b, 0);

    return `
      <tr>
        <td>${escapeHtml(s.service_name)}</td>
        ${monthly.map(v => `<td class="amount">${formatCurrency(v)}</td>`).join("")}
        <td class="amount"><strong>${formatCurrency(total)}</strong></td>
      </tr>
    `;
  }).join("");

  // 6. Render
  revenueGrid.innerHTML = `
    <h3>Revenue Goals (Calculated)</h3>
    <div class="goals-scroll-container">
      <table class="notes-table goals-table">
        <thead>
          ${header}
          ${totalsRow}
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}
}
