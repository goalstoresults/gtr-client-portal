// js/pipeline/tab-current.js

export async function renderPipelineCurrent(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Current Pipeline</h2>
      <p>Loading...</p>
    </section>
  `;

  const res = await fetch(
    `https://pipeline-module.dennis-e64.workers.dev/list?project=${portalState.project}&status=active`,
    { cache: "no-cache" }
  );

  const leads = await res.json();

  // Group by stage
  const grouped = {};
  leads.forEach(lead => {
    if (!grouped[lead.stage]) grouped[lead.stage] = [];
    grouped[lead.stage].push(lead);
  });

  const stages = Object.keys(grouped);

  container.innerHTML = `
    <div class="kanban-container">
      ${stages.map(stage => `
        <div class="kanban-column">
          <h3>${stage}</h3>
          ${grouped[stage].map(lead => `
            <div class="kanban-card" data-lead="${lead.lead_id}">
              <strong>${lead.lead_name}</strong><br>
              ${lead.amount ? `$${lead.amount}` : ""}
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;

  // Click → Details
  container.querySelectorAll(".kanban-card").forEach(card => {
    card.addEventListener("click", () => {
      portalState.selectedLeadId = card.dataset.lead;
      portalState.selectedLeadName = card.querySelector("strong").textContent;

      document.querySelector('#pipeline-subtabs button[data-subtab="details"]').click();
    });
  });
}
