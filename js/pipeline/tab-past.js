// js/pipeline/tab-past.js

export async function renderPipelinePast(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Past Leads</h2>
      <p>Loading...</p>
    </section>
  `;

  const res = await fetch(
    `https://pipeline-module.dennis-e64.workers.dev/list?project=${portalState.project}&status=closed`,
    { cache: "no-cache" }
  );

  const leads = await res.json();

  container.innerHTML = `
    <section class="card">
      <h2>Past Leads</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Lead</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${leads.map(lead => `
            <tr data-lead="${lead.lead_id}">
              <td>${lead.lead_name}</td>
              <td>${lead.stage}</td>
              <td>${lead.status}</td>
              <td>${lead.amount || ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;

  container.querySelectorAll("tr[data-lead]").forEach(row => {
    row.addEventListener("click", () => {
      portalState.selectedLeadId = row.dataset.lead;
      portalState.selectedLeadName = row.children[0].textContent;

      document.querySelector('#pipeline-subtabs button[data-subtab="details"]').click();
    });
  });
}
