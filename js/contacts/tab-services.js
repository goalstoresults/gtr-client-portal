// js/contacts/tab-services.js

import { escapeHtml } from "../utilities.js";

export async function renderContactServicesTab(container, portalState) {
  const contactId = portalState.selectedContactId;

  if (!contactId) {
    container.innerHTML = `
      <section class="card">
        <h2>Services</h2>
        <p>Select a contact from the list to view their services.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Services</h2>

      <div style="margin-bottom: 16px;">
        <button id="add-client-service-btn" class="btn">Add Service</button>
      </div>

      <div id="client-services-grid">(loading…)</div>
    </section>
  `;

  const grid = container.querySelector("#client-services-grid");
  const addBtn = container.querySelector("#add-client-service-btn");

  loadGrid();

  addBtn.addEventListener("click", async () => {
    const catalog = await fetchProjectServices(portalState.project);

    openClientServiceModal({
      project: portalState.project,
      client_id: contactId,
      catalog,
      onSave: async (payload) => {
        await createClientService(payload);
        loadGrid();
      }
    });
  });

  async function loadGrid() {
    const rows = await fetchClientServices(portalState.project, contactId);
    renderGrid(rows);
  }

  function renderGrid(rows) {
    if (!rows.length) {
      grid.innerHTML = `
        <p>This client has no services assigned yet.</p>
      `;
      return;
    }

    const header = `
      <tr>
        <th>Service</th>
        <th>Start</th>
        <th>End</th>
        <th>Price</th>
        <th>Source</th>
        <th>Notes</th>
        <th>Actions</th>
      </tr>
    `;

    const body = rows
      .map(s => `
        <tr>
          <td>${escapeHtml(s.service_name)}</td>
          <td>${escapeHtml(s.start_date)}</td>
          <td>${escapeHtml(s.end_date || "")}</td>
          <td>${s.price != null ? "$" + Number(s.price).toFixed(2) : ""}</td>
          <td>${escapeHtml(s.price_source || "")}</td>
          <td>${escapeHtml(s.notes || "")}</td>
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
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit");
        const svc = rows.find(r => r.id === id);
        const catalog = await fetchProjectServices(portalState.project);

        openClientServiceModal({
          project: portalState.project,
          client_id: contactId,
          catalog,
          service: svc,
          onSave: async (payload) => {
            await updateClientService(id, payload);
            loadGrid();
          }
        });
      });
    });

    grid.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete");
        if (!confirm("Remove this service from the client?")) return;
        await deleteClientService(id);
        loadGrid();
      });
    });
  }
}

/* ------------------------------------------------------------
   API HELPERS
------------------------------------------------------------ */

async function fetchClientServices(project, client_id) {
  const url = `https://operations-module.dennis-e64.workers.dev/client_services/list?project=${project}&client_id=${client_id}`;
  const res = await fetch(url, { cache: "no-cache" });
  return await res.json();
}

async function fetchProjectServices(project) {
  const url = `https://operations-module.dennis-e64.workers.dev/services/list?project=${project}`;
  const res = await fetch(url, { cache: "no-cache" });
  return await res.json();
}

async function createClientService(payload) {
  const url = `https://operations-module.dennis-e64.workers.dev/client_services/create`;
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });
  return await res.json();
}

async function updateClientService(id, payload) {
  const url = `https://operations-module.dennis-e64.workers.dev/client_services/update?id=${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });
  return await res.json();
}

async function deleteClientService(id) {
  const url = `https://operations-module.dennis-e64.workers.dev/client_services/delete?id=${id}`;
  await fetch(url, { method: "DELETE" });
}

/* ------------------------------------------------------------
   MODAL
------------------------------------------------------------ */

function openClientServiceModal({ project, client_id, catalog, service = null, onSave }) {
  const isEdit = !!service;

  const modal = document.createElement("div");
  modal.className = "modal-overlay";

  const options = catalog
    .map(s => `<option value="${s.id}" ${service?.service_id === s.id ? "selected" : ""}>${escapeHtml(s.service_name)}</option>`)
    .join("");

  modal.innerHTML = `
    <div class="modal">
      <h3>${isEdit ? "Edit Service" : "Add Service"}</h3>

      <label>Service</label>
      <select id="svc-service">${options}</select>

      <label>Start Date</label>
      <input id="svc-start" type="date" value="${service?.start_date || ""}">

      <label>End Date</label>
      <input id="svc-end" type="date" value="${service?.end_date || ""}">

      <label>Price</label>
      <input id="svc-price" type="number" step="0.01" value="${service?.price || ""}">

      <label>Price Source</label>
      <input id="svc-source" type="text" value="${service?.price_source || ""}">

      <label>Notes</label>
      <textarea id="svc-notes">${service?.notes || ""}</textarea>

      <div class="modal-actions">
        <button id="svc-save" class="btn">${isEdit ? "Save" : "Create"}</button>
        <button id="svc-cancel" class="btn-secondary">Cancel</button>
      </div>
    </div>
  `;

  document.querySelector("#contactsContent").prepend(modal);

  modal.querySelector("#svc-cancel").addEventListener("click", () => modal.remove());

  modal.querySelector("#svc-save").addEventListener("click", async () => {
    const payload = {
      project,
      client_id,
      service_id: modal.querySelector("#svc-service").value,
      start_date: modal.querySelector("#svc-start").value,
      end_date: modal.querySelector("#svc-end").value || null,
      price: modal.querySelector("#svc-price").value || null,
      price_source: modal.querySelector("#svc-source").value.trim() || null,
      notes: modal.querySelector("#svc-notes").value.trim() || null
    };

    await onSave(payload);
    modal.remove();
  });
}

