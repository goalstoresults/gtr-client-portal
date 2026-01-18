// js/pipeline/tab-details.js

export async function renderPipelineDetails(container, portalState, leadId) {
  container.innerHTML = `
    <section class="card">
      <h2>Lead Details</h2>
      <p>Loading...</p>
    </section>
  `;

  const res = await fetch(
    `https://pipeline-module.dennis-e64.workers.dev/get?project=${portalState.project}&lead_id=${leadId}`,
    { cache: "no-cache" }
  );

  const lead = await res.json();

  const historyRes = await fetch(
    `https://pipeline-module.dennis-e64.workers.dev/history?project=${portalState.project}&lead_id=${leadId}`,
    { cache: "no-cache" }
  );

  const history = await historyRes.json();

  container.innerHTML = `
    <section class="card">
      <h2>${lead.lead_name}</h2>

      <p><strong>Stage:</strong> ${lead.stage}</p>
      <p><strong>Status:</strong> ${lead.status}</p>
      <p><strong>Amount:</strong> ${lead.amount || ""}</p>
      <p><strong>Lead Level:</strong> ${lead.lead_level || ""}</p>
      <p><strong>Owner:</strong> ${lead.owner || ""}</p>

      <h3>Journey History</h3>
      <ul>
        ${history.map(h => `
          <li>
            <strong>${h.field}</strong> changed from 
            "${h.old_value}" → "${h.new_value}"
            <em>(${h.changed_at})</em>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}
