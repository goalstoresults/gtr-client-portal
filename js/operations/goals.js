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
        <button id="goals-save-all" class="btn">Save Goals</button>
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
  const saveButton = container.querySelector("#goals-save-all");

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

    if (!Array.isArray(services) || !Array.isArray(goals)) {
      leadsGrid.innerHTML = "<p>Error loading data.</p>";
      clientsGrid.innerHTML = "<p>Error loading data.</p>";
      revenueGrid.innerHTML = "<p>Error loading data.</p>";
      return;
    }

    renderLeadIndicatorsGrid(safeGoals);
    renderClientsGrid(safeServices, safeGoals);
    renderRevenueGrid(safeServices);

    clientsGrid.addEventListener("input", (e) => {
      if (e.target.classList.contains("client-goal-input")) {
        renderRevenueGrid(safeServices);
      }
    });

    saveButton.onclick = async () => {
      saveButton.disabled = true;
      saveButton.textContent = "Saving…";

      await saveAllGoals(portalState.project, year, indicators);

      saveButton.disabled = false;
      saveButton.textContent = "Save Goals";

      showToast("Goals saved!");

      const refreshedGoals = await fetchMonthlyGoals(portalState.project, year);
      renderLeadIndicatorsGrid(Array.isArray(refreshedGoals) ? refreshedGoals : []);
      renderClientsGrid(safeServices, Array.isArray(refreshedGoals) ? refreshedGoals : []);
      renderRevenueGrid(safeServices);
    };
  }

  /* ------------------------------------------------------------
     GRID 1 — LEAD INDICATORS (with TOTAL row)
  ------------------------------------------------------------ */
  function renderLeadIndicatorsGrid(goals) {
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

    // TOTAL ROW
    const totals = months.map((_, idx) => {
      const month = idx + 1;
      let sum = 0;

      indicators.forEach(ind => {
        const input = document.querySelector(
          `.li-input[data-li-key="${ind.key}"][data-month="${month}"]`
        );
        sum += input ? Number(input.value) || 0 : 0;
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
  function renderClientsGrid(services, goals) {
    const safeGoals = Array.isArray(goals) ? goals : [];

    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th class="amount">${m}</th>`).join("")}
      </tr>
    `;

    const body = services.map(s => {
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

    // TOTAL ROW
    const totals = months.map((_, idx) => {
      const month = idx + 1;
      let sum = 0;

      services.forEach(s => {
        const input = document.querySelector(
          `.client-goal-input[data-service="${s.id}"][data-month="${month}"]`
        );
        sum += input ? Number(input.value) || 0 : 0;
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
  function renderRevenueGrid(services) {
    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th class="amount">${m}</th>`).join("")}
        <th class="amount">Total</th>
      </tr>
    `;

    const body = services.map(s => {
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

      services.forEach(s => {
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
    services.forEach(s => {
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
     SAVE ALL GOALS
  ------------------------------------------------------------ */
  async function saveAllGoals(project, year, indicators) {
    for (let month = 1; month <= 12; month++) {
      const leadIndicators = {};
      for (const ind of indicators) {
        const input = document.querySelector(
          `.li-input[data-li-key="${ind.key}"][data-month="${month}"]`
        );
        leadIndicators[ind.key] = input ? Number(input.value) || 0 : 0;
      }

      const clientInputs = document.querySelectorAll(
        `.client-goal-input[data-month="${month}"]`
      );

      const goalsPayload = [];
      clientInputs.forEach(input => {
        goalsPayload.push({
          service_id: input.dataset.service,
          goal_clients: Number(input.value) || 0
        });
      });

      const res = await updateMonthlyGoals(project, year, month, goalsPayload, leadIndicators);
      if (!res.ok) {
        console.error(`UPDATE GOALS ERROR (month ${month}):`, await res.text());
      }
    }
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

async function updateMonthlyGoals(project, year, month, goals, lead_indicators) {
  const url = `https://operations-module.dennis-e64.workers.dev/goals/monthly/update`;
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ project, year, month, goals, lead_indicators }),
    headers: { "Content-Type": "application/json" }
  });
  return res;
}
