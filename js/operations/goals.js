// js/operations/goals.js

import { escapeHtml, formatCurrency } from "../utilities.js";

export async function loadGoalsTab({ portalState, content }) {
  await renderGoalsTab(content, portalState);
}

async function renderGoalsTab(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Goals</h2>

      <label style="display:block; margin-bottom:12px;">
        Year:
        <select id="goals-year"></select>
      </label>

      <div id="goals-clients-grid">(loading…)</div>
      <div style="height:32px;"></div>
      <div id="goals-revenue-grid">(loading…)</div>
      <div style="height:32px;"></div>
      <div id="goals-leads-grid">(loading…)</div>
    </section>
  `;

  const yearSelect = container.querySelector("#goals-year");
  const clientsGrid = container.querySelector("#goals-clients-grid");
  const revenueGrid = container.querySelector("#goals-revenue-grid");
  const leadsGrid = container.querySelector("#goals-leads-grid");

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  yearSelect.innerHTML = years
    .map(y => `<option value="${y}" ${y === currentYear ? "selected" : ""}>${y}</option>`)
    .join("");

  yearSelect.addEventListener("change", () => loadYear());

  loadYear();

  async function loadYear() {
    const year = Number(yearSelect.value);

    const services = await fetchServices(portalState.project);
    const goals = await fetchMonthlyGoals(portalState.project, year);
    const actuals = await fetchActuals(portalState.project, year);

    console.log("SERVICES RAW:", services);
    console.log("GOALS RAW:", goals);
    console.log("ACTUALS RAW:", actuals);

    const safeServices = Array.isArray(services) ? services : [];
    const safeGoals = Array.isArray(goals) ? goals : [];
    const safeActuals = Array.isArray(actuals) ? actuals : [];

    if (!Array.isArray(services)) {
      clientsGrid.innerHTML = "<p>Error loading services.</p>";
      revenueGrid.innerHTML = "<p>Error loading services.</p>";
      leadsGrid.innerHTML = "<p>Error loading services.</p>";
      return;
    }

    if (!Array.isArray(goals)) {
      leadsGrid.innerHTML = "<p>Error loading goals.</p>";
      return;
    }

    renderClientsGrid(safeServices, safeGoals, safeActuals, year);
    renderRevenueGrid(safeServices, safeGoals, safeActuals, year);
    renderLeadIndicatorsGrid(safeGoals, year);
  }

  function renderClientsGrid(services, goals, actuals, year) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const safeActuals = Array.isArray(actuals) ? actuals : [];

    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th>${m}</th>`).join("")}
        <th>Total</th>
      </tr>
    `;

    const body = services.map(s => {
      const rowActuals = months.map((_, idx) => {
        const a = safeActuals.find(a => a.service_id === s.id && a.month === idx + 1);
        return a?.actual_clients || 0;
      });

      const totalActual = rowActuals.reduce((a,b) => a+b, 0);

      return `
        <tr>
          <td>${escapeHtml(s.service_name)}</td>
          ${rowActuals.map((v,i) => `
            <td class="clickable" data-month="${i+1}" data-service="${s.id}">
              ${v}
            </td>
          `).join("")}
          <td>${totalActual}</td>
        </tr>
      `;
    }).join("");

    clientsGrid.innerHTML = `
      <h3>Client Counts (Actual)</h3>
      <table class="notes-table">
        <thead>${header}</thead>
        <tbody>${body}</tbody>
      </table>
    `;

    clientsGrid.querySelectorAll("td.clickable").forEach(td => {
      td.addEventListener("click", () => {
        const month = Number(td.dataset.month);
        openGoalsModal(
          services,
          goals,
          month,
          Number(yearSelect.value),
          portalState.project,
          () => loadYear()
        );
      });
    });
  }

  function renderRevenueGrid(services, goals, actuals, year) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const safeActuals = Array.isArray(actuals) ? actuals : [];

    const header = `
      <tr>
        <th>Service</th>
        ${months.map(m => `<th>${m}</th>`).join("")}
        <th>Total</th>
      </tr>
    `;

    const body = services.map(s => {
      const rowActuals = months.map((_, idx) => {
        const a = safeActuals.find(a => a.service_id === s.id && a.month === idx + 1);
        return a?.actual_revenue || 0;
      });

      const totalActual = rowActuals.reduce((a,b) => a+b, 0);

      return `
        <tr>
          <td>${escapeHtml(s.service_name)}</td>
          ${rowActuals.map(v => `<td>${formatCurrency(v)}</td>`).join("")}
          <td>${formatCurrency(totalActual)}</td>
        </tr>
      `;
    }).join("");

    revenueGrid.innerHTML = `
      <h3>Revenue (Actual)</h3>
      <table class="notes-table">
        <thead>${header}</thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  function renderLeadIndicatorsGrid(goals, year) {
    const safeGoals = Array.isArray(goals) ? goals : [];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const indicators = [
      { key: "outreach_past_clients", label: "Outreach to Past Clients" },
      { key: "outreach_networks", label: "Outreach to Networks" },
      { key: "outreach_referrals", label: "Outreach to Referral Partners" },
      { key: "new_leads", label: "New Leads" },
      { key: "discovery_calls", label: "Discovery Calls" },
      { key: "sales_calls", label: "Sales Calls" }
    ];

    const header = `
      <tr>
        <th>Indicator</th>
        ${months.map(m => `<th>${m}</th>`).join("")}
        <th>Total</th>
      </tr>
    `;

    const body = indicators.map(ind => {
      const row = months.map((_, idx) => {
        const g = safeGoals.find(g => g.month === idx + 1);
        return g?.[ind.key] || 0;
      });

      const total = row.reduce((a,b) => a+b, 0);

      return `
        <tr>
          <td>${ind.label}</td>
          ${row.map(v => `<td>${v}</td>`).join("")}
          <td>${total}</td>
        </tr>
      `;
    }).join("");

    leadsGrid.innerHTML = `
      <h3>Lead Indicators (Goals)</h3>
      <table class="notes-table">
        <thead>${header}</thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }
}

/* ------------------------------------------------------------
   MODAL
------------------------------------------------------------ */

function openGoalsModal(services, goals, month, year, project, onSave) {
  const safeGoals = Array.isArray(goals) ? goals : [];

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const goalsForMonth = safeGoals.find(g => g.month === month);

  const serviceRows = services.map(s => {
    const g = safeGoals.find(g => g.service_id === s.id && g.month === month);
    return `
      <label>${escapeHtml(s.service_name)}</label>
      <input type="number" class="goal-input" data-service="${s.id}" value="${g?.goal_clients || 0}">
    `;
  }).join("");

  modal.innerHTML = `
    <div class="modal">
      <h3>Edit Goals — ${year} / ${month}</h3>

      ${serviceRows}

      <h4 style="margin-top:20px;">Lead Indicators</h4>

      <label>Outreach to Past Clients</label>
      <input type="number" id="li-past" value="${goalsForMonth?.outreach_past_clients || 0}">

      <label>Outreach to Networks</label>
      <input type="number" id="li-networks" value="${goalsForMonth?.outreach_networks || 0}">

      <label>Outreach to Referral Partners</label>
      <input type="number" id="li-referrals" value="${goalsForMonth?.outreach_referrals || 0}">

      <label>New Leads</label>
      <input type="number" id="li-leads" value="${goalsForMonth?.new_leads || 0}">

      <label>Discovery Calls</label>
      <input type="number" id="li-discovery" value="${goalsForMonth?.discovery_calls || 0}">

      <label>Sales Calls</label>
      <input type="number" id="li-sales" value="${goalsForMonth?.sales_calls || 0}">

      <div class="modal-actions">
        <button id="goals-save" class="btn">Save</button>
        <button id="goals-cancel" class="btn-secondary">Cancel</button>
      </div>
    </div>
  `;

  document.querySelector("#operationsContent").prepend(modal);

  modal.querySelector("#goals-cancel").addEventListener("click", () => modal.remove());

  modal.querySelector("#goals-save").addEventListener("click", async () => {
    const inputs = modal.querySelectorAll(".goal-input");
    const payload = [];

    inputs.forEach(i => {
      payload.push({
        service_id: i.dataset.service,
        goal_clients: Number(i.value)
      });
    });

    const leadIndicators = {
      outreach_past_clients: Number(modal.querySelector("#li-past").value),
      outreach_networks: Number(modal.querySelector("#li-networks").value),
      outreach_referrals: Number(modal.querySelector("#li-referrals").value),
      new_leads: Number(modal.querySelector("#li-leads").value),
      discovery_calls: Number(modal.querySelector("#li-discovery").value),
      sales_calls: Number(modal.querySelector("#li-sales").value)
    };

    const res = await fetch(
      "https://operations-module.dennis-e64.workers.dev/goals/monthly/update",
      {
        method: "POST",
        body: JSON.stringify({ project, year, month, goals: payload, lead_indicators: leadIndicators }),
        headers: { "Content-Type": "application/json" }
      }
    );

    if (!res.ok) {
      console.error("UPDATE GOALS ERROR:", await res.text());
    }

    modal.remove();
    onSave();
  });
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

async function fetchActuals(project, year) {
  const url = `https://operations-module.dennis-e64.workers.dev/goals/actuals?project=${project}&year=${year}`;
  const res = await fetch(url);
  return await res.json();
}

async function updateMonthlyGoals(project, year, month, goals, lead_indicators) {
  const url = `https://operations-module.dennis-e64.workers.dev/goals/monthly/update`;
  await fetch(url, {
    method: "POST",
    body: JSON.stringify({ project, year, month, goals, lead_indicators }),
    headers: { "Content-Type": "application/json" }
  });
}

