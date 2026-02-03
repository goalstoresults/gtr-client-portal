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

      <label style="display:block; margin-bottom:12px; margin-top:12px;">
        Year:
        <select id="goals-year"></select>
      </label>

      <div id="goals-leads-grid">(loading…)</div>
      <div style="height:32px;"></div>
      <div id="goals-clients-grid">(loading…)</div>
      <div style="height:32px;"></div>
      <div id="goals-revenue-grid">(loading…)</div>
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

  const btnCreate = container.querySelector("#goals-create-year");
  const btnRefresh = container.querySelector("#goals-refresh-year");

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  yearSelect.innerHTML = years
    .map(y => `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`)
    .join("");

  yearSelect.addEventListener("change", loadYear);
  btnCreate.addEventListener("click", () => createYear(portalState));
  btnRefresh.addEventListener("click", () => refreshYear(portalState));

  loadYear();

  async function loadYear() {
    const year = Number(yearSelect.value);

    const [services, goals] = await Promise.all([
      fetchServices(portalState.project),
      fetchGoals(portalState.project, year)
    ]);

    window._servicesCache = services;

    renderLeadIndicatorsGrid(goals);
    renderClientsGrid(services, goals);
    renderRevenueGrid(services);

    attachAutosaveHandlers(portalState, year);
  }

  async function createYear(portalState) {
    const year = Number(yearSelect.value);

    await fetch(`https://goals-module.dennis-e64.workers.dev/create-year`, {
      method: "POST",
      body: JSON.stringify({ project: portalState.project, year }),
      headers: { "Content-Type": "application/json" }
    });

    showToast("Year created");
    loadYear();
  }

  async function refreshYear(portalState) {
    const year = Number(yearSelect.value);

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
    document.querySelectorAll(".li-input").forEach(input => {
      input.addEventListener("blur", async e => {
        const key = e.target.dataset.liKey;
        const month = Number(e.target.dataset.month);
        const value = Number(e.target.value) || 0;

        await updateIndicatorCell(portalState.project, year, month, key, value);
        showToast();
      });
    });

    document.querySelectorAll(".client-goal-input").forEach(input => {
      input.addEventListener("blur", async e => {
        const service_id = e.target.dataset.service;
        const month = Number(e.target.dataset.month);
        const value = Number(e.target.value) || 0;

        await updateClientCell(portalState.project, year, month, service_id, value);
        showToast();
        renderRevenueGrid(window._servicesCache);
      });
    });
  }

  /* ------------------------------------------------------------
     GRID RENDERING
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

  function renderLeadIndicatorsGrid(goals) {
    const header = `
      <tr>
        <th>Indicator</th>
        ${months.map(m => `<th class="amount">${m}</th>`).join("")}
      </tr>
    `;

    const body = indicators.map(ind => {
      const cells = months.map((_, idx) => {
        const month = idx + 1;
        const row = goals.find(g => g.month === month && g.service_id === null);
        const value = row?.[ind.key] || 0;

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

    const totals = months.map((_, idx) => {
      const month = idx + 1;
      let sum = 0;
      indicators.forEach(ind => {
        const row = goals.find(g => g.month === month && g.service_id === null);
        sum += Number(row?.[ind.key] || 0);
      });
      return `<td class="amount"><strong>${sum}</strong></td>`;
    }).join("");

    leadsGrid.innerHTML = `
      <h3>Lead Indicators (Goals)</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
          <tfoot><tr><td><strong>TOTAL</strong></td>${totals}</tr></tfoot>
        </table>
      </div>
    `;
  }

  function renderClientsGrid(services, goals) {
    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th class="amount">${m}</th>`).join("")}
      </tr>
    `;

    const body = services.map(s => {
      const row = months.map((_, idx) => {
        const month = idx + 1;
        const g = goals.find(g => g.service_id === s.id && g.month === month);
        const value = g?.goal_clients || 0;

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

    const totals = months.map((_, idx) => {
      const month = idx + 1;
      let sum = 0;
      services.forEach(s => {
        const g = goals.find(g => g.service_id === s.id && g.month === month);
        sum += Number(g?.goal_clients || 0);
      });
      return `<td class="amount"><strong>${sum}</strong></td>`;
    }).join("");

    clientsGrid.innerHTML = `
      <h3>Client Count Goals</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
          <tfoot><tr><td><strong>TOTAL</strong></td>${totals}</tr></tfoot>
        </table>
      </div>
    `;
  }

  function renderRevenueGrid(services) {
    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th class="amount">${m}</th>`).join("")}
        <th class="amount">Total</th>
      </tr>
    `;

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

    const totals = months.map((_, idx) => {
      const month = idx + 1;
      let sum = 0;
      services.forEach(s => {
        const input = document.querySelector(
          `.client-goal-input[data-service="${s.id}"][data-month="${month}"]`
        );
        const clients = Number(input?.value || 0);
        sum += clients * (s.default_price || 0);
      });
      return `<td class="amount"><strong>${formatCurrency(sum)}</strong></td>`;
    }).join("");

    let grandTotal = 0;
    services.forEach(s => {
      months.forEach((_, idx) => {
        const month = idx + 1;
        const input = document.querySelector(
          `.client-goal-input[data-service="${s.id}"][data-month="${month}"]`
        );
        const clients = Number(input?.value || 0);
        grandTotal += clients * (s.default_price || 0);
      });
    });

    revenueGrid.innerHTML = `
      <h3>Revenue Goals (Calculated)</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
          <tfoot>
            <tr>
              <td><strong>TOTAL</strong></td>
              ${totals}
              <td class="amount"><strong>${formatCurrency(grandTotal)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  /* ------------------------------------------------------------
     API HELPERS
  ------------------------------------------------------------ */

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
}

