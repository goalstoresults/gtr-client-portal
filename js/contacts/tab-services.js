// js/contacts/tab-services.js

import { escapeHtml } from "../utilities.js";

export async function renderContactServicesTab(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Services</h2>
      <div id="contact-services-content">(loading…)</div>
    </section>
  `;

  const content = container.querySelector("#contact-services-content");

  // Load services for this project
  const rows = await fetchServices(portalState.project);

  // No active services?
  const active = rows.filter(r => r.is_active);

  if (active.length === 0) {
    content.innerHTML = `
      <p style="margin-top:12px; font-size:1.1em; color:#666;">
        There are No Active Services setup at this time.
      </p>
    `;
    return;
  }

  // Otherwise show grid + Add button
  content.innerHTML = `
    <div style="margin-bottom: 16px;">
      <button id="add-service-btn" class="btn">Add Service</button>
    </div>
    <div id="contact-services-grid"></div>
  `;

  const grid = content.querySelector("#contact-services-grid");
  const addBtn = content.querySelector("#add-service-btn");

  loadGrid();

  addBtn.addEventListener("click", () => {
    openServiceModal({
      project: portalState.project,
      onSave: async (payload) => {
        await createService(payload);
        loadGrid();
      }
    });
  });

  async function loadGrid() {
    const rows = await fetchServices(portalState.project);
    renderGrid(rows);
  }

  function renderGrid(rows) {
    if (!rows.length) {
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
      .map(s => `
        <tr>
          <td>${escapeHtml(s.service_name)}</td>
          <td>${escapeHtml(s.category)}</td>
          <td>$${Number(s.default_price).toFixed(2)}</td>
          <td>${s.is_active ? "Yes" : "No"}</td>
          <td>
            <button class="btn-small" data-edit="${s.id}">Edit</button>
            <button class="btn-small btn-danger" data-delete="${s.id}">Delete</button>
          </td>
        </tr>
      `)
      .join("");

    grid.innerHTML = `
      <table class="notes-table">
        <thead>${header}</thead>
        <tbody>${body}</tbody>
      </table>
    `;

    grid.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        const svc = rows.find(r => r.id === id);

        openServiceModal({
          project: portalState.project,
          service: svc,
          onSave: async (payload) => {
            await updateService(id, payload);
            loadGrid();
          }
        });
      });
    });

    grid.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if (!confirm("Delete this service?")) return;
        await deleteService(id);
        loadGrid();
      });
    });
  }
}

/* ------------------------------------------------------------
   API HELPERS (same as Operations)
------------------------------------------------------------ */
async function fetchServices(project) {
  const url = `https://operations-module.dennis-e64.workers.dev/services/list?project=${project}`;
  const res = await fetch(url, { cache: "no-cache" });
  return await res.json();
}

async function createService(payload) {
  const url = `https://operations-module.dennis-e64.workers.dev/services/create`;
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });
  return await res.json();
}

async function updateService(id, payload) {
  const url = `https://operations-module.dennis-e64.workers.dev/services/update?id=${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });
  return await res.json();
}

async function deleteService(id) {
  const url = `https://operations-module.dennis-e64.workers.dev/services/delete?id=${id}`;
  await fetch(url, { method: "DELETE" });
}
