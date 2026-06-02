// inspections/tab-add.js
// Manual Add Inspection Form

export function renderInspectionAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Add Inspection</h2>

      <form id="inspectionAddForm" class="form-grid">

        <label>Inspection Date
          <input type="date" name="inspection_date" required />
        </label>

        <label>Inspection Time
          <input type="time" name="inspection_time" required />
        </label>

        <label>Client First Name
          <input type="text" name="client_first_name" required />
        </label>

        <label>Client Last Name
          <input type="text" name="client_last_name" required />
        </label>

        <label>Client Email
          <input type="email" name="client_email" />
        </label>

        <label>Client Phone
          <input type="text" name="client_phone" />
        </label>

        <label>Property Address
          <input type="text" name="property_address" required />
        </label>

        <label>City
          <input type="text" name="property_city" required />
        </label>

        <label>State
          <input type="text" name="property_state" required />
        </label>

        <label>Zip
          <input type="text" name="property_zip" required />
        </label>

        <label>Agent Name
          <input type="text" name="agent_name" />
        </label>

        <label>Agent Email
          <input type="email" name="agent_email" />
        </label>

        <label>Agent Phone
          <input type="text" name="agent_phone" />
        </label>

        <label>Inspection Type
          <input type="text" name="inspection_type" required />
        </label>

        <label>Fee
          <input type="number" name="fee" step="0.01" required />
        </label>

        <label>Paid
          <input type="number" name="paid" step="0.01" />
        </label>

        <label>Balance
          <input type="number" name="balance" step="0.01" />
        </label>

        <button type="submit" class="primary">Add Inspection</button>
      </form>

      <div id="inspectionAddResult"></div>
    </section>
  `;

  const form = container.querySelector("#inspectionAddForm");
  const result = container.querySelector("#inspectionAddResult");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(form).entries());
    formData.project = portalState.project;

    result.innerHTML = `<p>Saving…</p>`;

    const res = await fetch(
      "https://client-portal-api.dennis-e64.workers.dev/api/inspections/add",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      }
    );

    const data = await res.json();

    if (!res.ok) {
      result.innerHTML = `<p style="color:red;">${data.error}</p>`;
      return;
    }

    result.innerHTML = `<p style="color:green;">Inspection added successfully.</p>`;
    form.reset();
  });
}

