// js/operations/goals.js

import { escapeHtml, formatCurrency } from "../utilities.js";

export async function loadGoalsTab({ portalState, content }) {
  await renderGoalsTab(content, portalState);
}

async function renderGoalsTab(container, portalState) {
container.innerHTML = `
  <section class="card">
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

    console.log("SERVICES RAW:", services);
    console.log("GOALS RAW:", goals);

    const safeServices = Array.isArray(services) ? services : [];
    const safeGoals = Array.isArray(goals) ? goals : [];

    if (!Array.isArray(services)) {
      leadsGrid.innerHTML = "<p>Error loading services.</p>";
      clientsGrid.innerHTML = "<p>Error loading services.</p>";
      revenueGrid.innerHTML = "<p>Error loading services.</p>";
      return;
    }

    if (!Array.isArray(goals)) {
      leadsGrid.innerHTML = "<p>Error loading goals.</p>";
      clientsGrid.innerHTML = "<p>Error loading goals.</p>";
      revenueGrid.innerHTML = "<p>Error loading goals.</p>";
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
      await saveAllGoals(portalState.project, year, indicators);
      const refreshedGoals = await fetchMonthlyGoals(portalState.project, year);
      renderLeadIndicatorsGrid(Array.isArray(refreshedGoals) ? refreshedGoals : []);
      renderClientsGrid(safeServices, Array.isArray(refreshedGoals) ? refreshedGoals : []);
      renderRevenueGrid(safeServices);
    };
  }

  function renderLeadIndicatorsGrid(goals) {
    const safeGoals = Array.isArray(goals) ? goals : [];

    const header = `
      <tr>
        <th>Indicator</th>
        ${months.map(m => `<th>${m}</th>`).join("")}
      </tr>
    `;

    const body = indicators.map(ind => {
      const cells = months.map((_, idx) => {
        const month = idx + 1;
        const gForMonth = safeGoals.find(g => g.month === month);
        const value = gForMonth?.[ind.key] || 0;

        return `
          <td>
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

    leadsGrid.innerHTML = `
      <h3>Lead Indicators (Goals)</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function renderClientsGrid(services, goals) {
    const safeGoals = Array.isArray(goals) ? goals : [];

    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th>${m}</th>`).join("")}
      </tr>
    `;

    const body = services.map(s => {
      const row = months.map((_, idx) => {
        const month = idx + 1;
        const g = safeGoals.find(g => g.service_id === s.id && g.month === month);
        const value = g?.goal_clients || 0;

        return `
          <td>
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

    clientsGrid.innerHTML = `
      <h3>Client Count Goals</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

  function renderRevenueGrid(services) {
    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th>${m}</th>`).join("")}
        <th>Total</th>
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
          ${monthlyValues.map(v => `<td>${formatCurrency(v)}</td>`).join("")}
          <td>${formatCurrency(total)}</td>
        </tr>
      `;
    }).join("");

    revenueGrid.innerHTML = `
      <h3>Revenue Goals (Calculated)</h3>
      <div class="goals-scroll-container">
        <table class="notes-table goals-table">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  }

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
