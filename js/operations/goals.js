// js/operations/goals.js

import { escapeHtml, formatCurrency } from "../utilities.js";

export async function loadGoalsTab({ portalState, content }) {
  await renderGoalsTab(content, portalState);
}

async function renderGoalsTab(container, portalState) {
  container.innerHTML = `
    <section class="card">

      <!-- Header with Save Button -->
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2>Goals</h2>
        <button id="goals-save-active" class="btn">Save</button>
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

    <!-- Toast -->
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
    ">
      Saved!
    </div>
  `;

  const yearSelect = container.querySelector("#goals-year");
  const leadsGrid = container.querySelector("#goals-leads-grid");
  const clientsGrid = container.querySelector("#goals-clients-grid");
  const revenueGrid = container.querySelector("#goals-revenue-grid");
  const saveActiveButton = container.querySelector("#goals-save-active");

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  yearSelect.innerHTML = years
    .map(y => `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`)
    .join("");

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const indicators = [
    { key: "outreach_past_clients", label: "Outreach to Clients (Current/Past)" },
    { key: "outreach_networks", label: "Outreach to Networks" },
    { key: "outreach_referrals", label: "Outreach to Referral Partners" },
    { key: "new_leads", label: "New Leads" },
    { key: "discovery_calls", label: "Discovery Calls" },
    { key: "sales_calls", label: "Sales Calls" }
  ];

  yearSelect.addEventListener("change", () => loadYear());

  loadYear();

  async function loadYear() {
    const year = Number(yearSelect.value);

    const services = await fetchServices(portalState.project);
    const goals = await fetchMonthlyGoals(portalState.project, year);

    const safeServices = Array.isArray(services) ? services : [];
    const safeGoals = Array.isArray(goals) ? goals : [];

    renderLeadIndicatorsGrid(safeGoals, year);
    renderClientsGrid(safeServices, safeGoals, year);
    renderRevenueGrid(safeServices, year);

    attachAutosaveHandlers(portalState, year);
    attachSaveActiveHandler(portalState, year);
  }
  /* ------------------------------------------------------------
     AUTOSAVE HANDLERS
  ------------------------------------------------------------ */

  function attachAutosaveHandlers(portalState, year) {
    // Lead Indicators
    document.querySelectorAll(".li-input").forEach(input => {
      input.addEventListener("blur", async (e) => {
        const key = e.target.dataset.liKey;
        const month = Number(e.target.dataset.month);
        const value = Number(e.target.value) || 0;

        await updateIndicatorCell(
          portalState.project,
          year,
          month,
          key,
          value
        );

        showToast("Saved");
      });
    });

    // Client Goals
    document.querySelectorAll(".client-goal-input").forEach(input => {
      input.addEventListener("blur", async (e) => {
        const service_id = e.target.dataset.service;
        const month = Number(e.target.dataset.month);
        const value = Number(e.target.value) || 0;

        await updateClientCell(
          portalState.project,
          year,
          month,
          service_id,
          value
        );

        showToast("Saved");
        renderRevenueGrid(window._servicesCache, year); // recalc revenue
      });
    });
  }

  /* ------------------------------------------------------------
     SAVE ACTIVE CELL BUTTON
  ------------------------------------------------------------ */

  function attachSaveActiveHandler(portalState, year) {
    saveActiveButton.onclick = async () => {
      const active = document.activeElement;

      if (active && active.classList.contains("client-goal-input")) {
        await updateClientCell(
          portalState.project,
          year,
          Number(active.dataset.month),
          active.dataset.service,
          Number(active.value) || 0
        );
        showToast("Saved");
        renderRevenueGrid(window._servicesCache, year);
        return;
      }

      if (active && active.classList.contains("li-input")) {
        await updateIndicatorCell(
          portalState.project,
          year,
          Number(active.dataset.month),
          active.dataset.liKey,
          Number(active.value) || 0
        );
        showToast("Saved");
        return;
      }

      showToast("Nothing to save");
    };
  }
  /* ------------------------------------------------------------
     GRID 1 — LEAD INDICATORS (with TOTAL row)
  ------------------------------------------------------------ */
  function renderLeadIndicatorsGrid(goals, year) {
    const safeGoals = Array.isArray(goals) ? goals : [];

    const header = `
      <tr>
        <th>Indicator</th>
        ${months.map(m => `<th class="amount">${m}</th>`).join("")}
      </tr>
    `;

    const body = indicators.map(ind => {
      const cells = months.map((_, idx) => {
        const month = idx + 1;
        const gForMonth = safeGoals.find(g => g.month === month);
        const value = gForMonth?.[ind.key] || 0;

        return `
          <td class="amount">
            <input
              type="number"
              class="li-input"
              data-li-key="${ind.key}"
              data-month="${month}"
              value="${value}"
              min="0"
            >
          </td>
        `;
      }).join("");

      return `
        <tr>
          <td>${escapeHtml(ind.label)}</td>
          ${cells}
        </tr>
      `;
    }).join("");

    // TOTAL ROW (sum of each month across all indicators)
    const totals = months.map((_, idx) => {
      const month = idx + 1;
      let sum = 0;

      indicators.forEach(ind => {
        const gForMonth = safeGoals.find(g => g.month === month);
        const value = gForMonth?.[ind.key] || 0;
        sum += Number(value) || 0;
      });

      return `<td class="amount"><strong>${sum}</strong></td>`;
    }).join("");

    const totalRow = `
      <tr>
        <td><strong>TOTAL</strong></td>
        ${totals}
      </tr>
    `;

    leadsGrid.innerHTML = `
      <h3>Lead Indicators (Goals)</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
          <tfoot>${totalRow}</tfoot>
        </table>
      </div>
    `;
  }

  /* ------------------------------------------------------------
     GRID 2 — CLIENT COUNT GOALS (with TOTAL row)
  ------------------------------------------------------------ */
  function renderClientsGrid(services, goals, year) {
    const safeGoals = Array.isArray(goals) ? goals : [];
    const safeServices = Array.isArray(services) ? services : [];

    // cache services for revenue recalculation
    window._servicesCache = safeServices;

    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th class="amount">${m}</th>`).join("")}
      </tr>
    `;

    const body = safeServices.map(s => {
      const row = months.map((_, idx) => {
        const month = idx + 1;
        const g = safeGoals.find(g => g.service_id === s.id && g.month === month);
        const value = g?.goal_clients || 0;

        return `
          <td class="amount">
            <input
              type="number"
              class="client-goal-input"
              data-service="${s.id}"
              data-month="${month}"
              value="${value}"
              min="0"
            >
          </td>
        `;
      }).join("");

      return `
        <tr>
          <td>${escapeHtml(s.service_name)}</td>
          ${row}
        </tr>
      `;
    }).join("");

    // TOTAL ROW (sum of each month across all services)
    const totals = months.map((_, idx) => {
      const month = idx + 1;
      let sum = 0;

      safeServices.forEach(s => {
        const g = safeGoals.find(g => g.service_id === s.id && g.month === month);
        const value = g?.goal_clients || 0;
        sum += Number(value) || 0;
      });

      return `<td class="amount"><strong>${sum}</strong></td>`;
    }).join("");

    const totalRow = `
      <tr>
        <td><strong>TOTAL</strong></td>
        ${totals}
      </tr>
    `;

    clientsGrid.innerHTML = `
      <h3>Client Count Goals</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
          <tfoot>${totalRow}</tfoot>
        </table>
      </div>
    `;
  }

  /* ------------------------------------------------------------
     GRID 3 — REVENUE GOALS (with TOTAL row + TOTAL column)
  ------------------------------------------------------------ */
  function renderRevenueGrid(services, year) {
    const safeServices = Array.isArray(services) ? services : [];

    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th class="amount">${m}</th>`).join("")}
        <th class="amount">Total</th>
      </tr>
    `;

    const body = safeServices.map(s => {
      const monthlyValues = months.map((_, idx) => {
        const month = idx + 1;
        const input = document.querySelector(
          `.client-goal-input[data-service="${s.id}"][data-month="${month}"]`
        );
        const clients = input ? Number(input.value) || 0 : 0;
        const price = s.default_price || 0;
        return clients * price;
      });

      const total = monthlyValues.reduce((a, b) => a + b, 0);

      return `
        <tr>
          <td>${escapeHtml(s.service_name)}</td>
          ${monthlyValues.map(v => `<td class="amount">${formatCurrency(v)}</td>`).join("")}
          <td class="amount"><strong>${formatCurrency(total)}</strong></td>
        </tr>
      `;
    }).join("");

    // TOTAL ROW (sum of each month across all services)
    const totals = months.map((_, idx) => {
      const month = idx + 1;
      let sum = 0;

      safeServices.forEach(s => {
        const input = document.querySelector(
          `.client-goal-input[data-service="${s.id}"][data-month="${month}"]`
        );
        const clients = input ? Number(input.value) || 0 : 0;
        const price = s.default_price || 0;
        sum += clients * price;
      });

      return `<td class="amount"><strong>${formatCurrency(sum)}</strong></td>`;
    }).join("");

    // TOTAL of TOTAL column
    let grandTotal = 0;
    safeServices.forEach(s => {
      months.forEach((_, idx) => {
        const month = idx + 1;
        const input = document.querySelector(
          `.client-goal-input[data-service="${s.id}"][data-month="${month}"]`
        );
        const clients = input ? Number(input.value) || 0 : 0;
        const price = s.default_price || 0;
        grandTotal += clients * price;
      });
    });

    const totalRow = `
      <tr>
        <td><strong>TOTAL</strong></td>
        ${totals}
        <td class="amount"><strong>${formatCurrency(grandTotal)}</strong></td>
      </tr>
    `;

    revenueGrid.innerHTML = `
      <h3>Revenue Goals (Calculated)</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
          <tfoot>${totalRow}</tfoot>
        </table>
      </div>
    `;
  }
  /* ------------------------------------------------------------
     TOAST
  ------------------------------------------------------------ */
  function showToast(message = "Saved!") {
    const toast = document.getElementById("toast");
    if (!toast) return;

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

/* ------------------------------------------------------------
   API HELPERS
------------------------------------------------------------ */

async function fetchServices(project) {
  const url = `https://operations-module.dennis-e64.workers.dev/services/list?project=${project}`;
  const res = await fetch(url);
  return await res.json();
}

async function fetchMonthlyGoals(project, year) {
  const url = `https://operations-module.dennis-e64.workers.dev/goals/monthly/list?project=${project}&year=${year}`;
  const res = await fetch(url);
  return await res.json();
}

/* ------------------------------------------------------------
   ATOMIC UPDATE HELPERS (AUTOSAVE)
------------------------------------------------------------ */

async function updateClientCell(project, year, month, service_id, value) {
  const url = `https://operations-module.dennis-e64.workers.dev/goals/update-client-cell`;
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ project, year, month, service_id, value }),
    headers: { "Content-Type": "application/json" }
  });

  // Drain body to avoid stalled responses
  await res.text();

  if (!res.ok) {
    console.error("updateClientCell failed");
  }
}

async function updateIndicatorCell(project, year, month, key, value) {
  const url = `https://operations-module.dennis-e64.workers.dev/goals/update-indicator-cell`;
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ project, year, month, key, value }),
    headers: { "Content-Type": "application/json" }
  });

  // Drain body to avoid stalled responses
  await res.text();

  if (!res.ok) {
    console.error("updateIndicatorCell failed");
  }
}
