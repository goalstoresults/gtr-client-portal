// /js/operations/services.js

export async function loadServicesTab({ portalState, content }) {
  content.innerHTML = `
    <section class="card">
      <h2>Services</h2>

      <div style="margin-bottom: 16px;">
        <button id="add-service-btn" class="btn">Add Service</button>
      </div>

      <div id="services-grid"></div>
    </section>
  `;

  const grid = document.getElementById("services-grid");
  const addBtn = document.getElementById("add-service-btn");

  // Load initial list
  loadServices();

  addBtn.addEventListener("click", () => {
    openServiceModal({
      project: portalState.project,
      onSave: async (payload) => {
        await createService(payload);
        loadServices();
      }
    });
  });

  // ------------------------------------------------------------
  // LOAD SERVICES
  // ------------------------------------------------------------
  async function loadServices() {
    const rows = await fetchServices(portalState.project);
    renderGrid(rows);
  }

  // ------------------------------------------------------------
  // RENDER GRID (striped table using notes-table class)
  // ------------------------------------------------------------
  function renderGrid(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      grid.innerHTML = `<p>No services found.</p>`;
      return;
    }

    const header = `
      <tr>
        <th>Name</th>
        <th>Category</th>
        <th>Default Price</th>
        <th>Active</th>
        <th>Actions</th>
      </tr>
    `;

    const body = rows
      .map(s => {
        return `
          <tr>
            <td>${s.service_name}</td>
            <td>${s.category || ""}</td>
            <td>${s.default_price != null ? "$" + Number(s.default_price).toFixed(2) : ""}</td>
            <td>${s.is_active ? "Yes" : "No"}</td>
            <td>
              <button class="btn-small" data-edit="${s.id}">Edit</button>
              <button class="btn-small btn-danger" data-delete="${s.id}">Delete</button>
            </td>
          </tr>
        `;
      })
      .join("");

    grid.innerHTML = `
      <table class="notes-table">
        <thead>${header}</thead>
        <tbody>${body}</tbody>
      </table>
    `;

    // Attach action listeners
    grid.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        const svc = rows.find(r => r.id === id);

        openServiceModal({
          project: portalState.project,
          service: svc,
          onSave: async (payload) => {
            await updateService(id, payload);
            loadServices();
          }
        });
      });
    });

    grid.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if (!confirm("Delete this service?")) return;
        await deleteService(id);
        loadServices();
      });
    });
  }
}

// ------------------------------------------------------------
// MODAL FOR ADD / EDIT SERVICE
// ------------------------------------------------------------
function openServiceModal({ project, service = null, onSave }) {
  const isEdit = !!service;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <h3>${isEdit ? "Edit Service" : "Add Service"}</h3>

      <label>Name</label>
      <input id="svc-name" type="text" value="${service?.service_name || ""}">

      <label>Category</label>
      <input id="svc-category" type="text" value="${service?.category || ""}">

      <label>Default Price</label>
      <input id="svc-price" type="number" step="0.01" value="${service?.default_price || ""}">

      <label>Active</label>
      <select id="svc-active">
        <option value="true" ${service?.is_active !== false ? "selected" : ""}>Yes</option>
        <option value="false" ${service?.is_active === false ? "selected" : ""}>No</option>
      </select>

      <div class="modal-actions">
        <button id="svc-save" class="btn">${isEdit ? "Save" : "Create"}</button>
        <button id="svc-cancel" class="btn-secondary">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector("#svc-cancel").addEventListener("click", () => {
    modal.remove();
  });

  modal.querySelector("#svc-save").addEventListener("click", async () => {
    const payload = {
      project,
      service_name: modal.querySelector("#svc-name").value.trim(),
      category: modal.querySelector("#svc-category").value.trim(),
      default_price: modal.querySelector("#svc-price").value || null,
      is_active: modal.querySelector("#svc-active").value === "true"
    };

    await onSave(payload);
    modal.remove();
  });
}

// ------------------------------------------------------------
// API HELPERS
// ------------------------------------------------------------

async function fetchServices(project) {
  try {
    const url = `https://operations-module.dennis-e64.workers.dev/services/list?project=${project}`;
    const res = await fetch(url, { cache: "no-cache" });
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch services:", err);
    return [];
  }
}

async function createService(payload) {
  try {
    const url = `https://operations-module.dennis-e64.workers.dev/services/create`;
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    return await res.json();
  } catch (err) {
    console.error("Failed to create service:", err);
  }
}

async function updateService(id, payload) {
  try {
    const url = `https://operations-module.dennis-e64.workers.dev/services/update?id=${id}`;
    const res = await fetch(url, {
      method: "PATCH",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    return await res.json();
  } catch (err) {
    console.error("Failed to update service:", err);
  }
}

async function deleteService(id) {
  try {
    const url = `https://operations-module.dennis-e64.workers.dev/services/delete?id=${id}`;
    await fetch(url, { method: "DELETE" });
  } catch (err) {
    console.error("Failed to delete service:", err);
  }
}
