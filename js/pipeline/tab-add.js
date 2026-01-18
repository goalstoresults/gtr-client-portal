// js/pipeline/tab-add.js

export async function renderPipelineAdd(container, portalState) {
  const isBroker = portalState.projects_config?.is_broker === true;

  container.innerHTML = `
    <section class="card">
      <h2>Add Lead</h2>

      <form id="pipeline-add-form" class="form-grid">

        <label>Lead Name</label>
        <input type="text" id="lead_name" placeholder="Lead name" />

        <label>Contact ID</label>
        <input type="text" id="contact_id" placeholder="Contact ID" />

        <label>Stage</label>
        <input type="text" id="stage" placeholder="Stage (lookup)" />

        <label>Status</label>
        <input type="text" id="status" placeholder="active, closed_won, etc." />

        <label>Amount</label>
        <input type="number" id="amount" />

        <label>Lead Level</label>
        <input type="text" id="lead_level" />

        <label>Start Date</label>
        <input type="date" id="start_date" />

        <label>Owner</label>
        <input type="text" id="owner" />

        ${isBroker ? `
          <label>Initial Size</label>
          <input type="text" id="initial_size" />

          <label>Initial Area</label>
          <input type="text" id="initial_area" />

          <label>No. Places Shown</label>
          <input type="number" id="no_places_shown" />
        ` : ""}

        <button type="submit" class="primary">Save Lead</button>
      </form>
    </section>
  `;

  document.getElementById("pipeline-add-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      project: portalState.project,
      lead_name: document.getElementById("lead_name").value,
      contact_id: document.getElementById("contact_id").value,
      stage: document.getElementById("stage").value,
      status: document.getElementById("status").value,
      amount: document.getElementById("amount").value,
      lead_level: document.getElementById("lead_level").value,
      start_date: document.getElementById("start_date").value,
      owner: document.getElementById("owner").value,
    };

    if (isBroker) {
      payload.initial_size = document.getElementById("initial_size").value;
      payload.initial_area = document.getElementById("initial_area").value;
      payload.no_places_shown = document.getElementById("no_places_shown").value;
    }

    const res = await fetch(
      "https://pipeline-module.dennis-e64.workers.dev/add",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();
    alert("Lead saved");
  });
}
