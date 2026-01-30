// js/setup/tab-staff.js
// v1.0 — Staff Setup Subtab (NEW)
// Inline editing, full CRUD for projects_staff

import { escapeHtml } from "../utilities.js";

export async function renderStaffSetup(container, portalState) {
  if (!portalState.setup_project_id) {
    container.innerHTML = `
      <section class="card">
        <p>Please select a project in the Client tab before configuring Staff.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
        <h2 style="margin:0;">Staff for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>
        <button id="btnAddStaff" class="btn-primary">+ Add Staff</button>
      </div>

      <div id="staffGrid">Loading...</div>
    </section>
  `;

  const staffGrid = container.querySelector("#staffGrid");

  await loadStaffGrid(staffGrid, portalState);
}

/* ---------------------------------------------
   LOAD STAFF GRID
--------------------------------------------- */
async function loadStaffGrid(staffGrid, portalState) {
  const project = portalState.setup_project_id;

  const url = `https://lookups-module.dennis-e64.workers.dev/projects_staff?project=${encodeURIComponent(project)}`;
  const res = await fetch(url, { cache: "no-cache" });
  const rows = await res.json();

  if (!Array.isArray(rows)) {
    staffGrid.innerHTML = `<p>Error loading staff.</p>`;
    return;
  }

  staffGrid.innerHTML = `
    <table class="notes-table" style="width:100%;">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Created</th>
          <th style="width:160px;">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            r => `
          <tr data-id="${r.id}">
            <td><input type="text" class="staffNameInput" value="${escapeHtml(r.staff_name || "")}" style="width:100%;"></td>
            <td><input type="text" class="staffEmailInput" value="${escapeHtml(r.staff_email || "")}" style="width:100%;"></td>
            <td><input type="text" class="staffRoleInput" value="${escapeHtml(r.role || "")}" style="width:100%;"></td>
            <td>${escapeHtml(formatDate(r.created_at))}</td>
            <td>
              <button class="saveStaffBtn btn-primary">Save</button>
              <button class="deleteStaffBtn btn-danger">Delete</button>
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;

  // Wire actions
  staffGrid.querySelectorAll(".saveStaffBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      await saveStaffRow(tr, portalState);
      await loadStaffGrid(staffGrid, portalState);
    });
  });

  staffGrid.querySelectorAll(".deleteStaffBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      await deleteStaffRow(tr.dataset.id);
      await loadStaffGrid(staffGrid, portalState);
    });
  });

  // Add new staff
  const addBtn = document.getElementById("btnAddStaff");
  addBtn.onclick = () => addNewStaffRow(staffGrid, portalState);
}

/* ---------------------------------------------
   ADD NEW STAFF ROW
--------------------------------------------- */
function addNewStaffRow(staffGrid, portalState) {
  const tbody = staffGrid.querySelector("tbody");

  const newRow = document.createElement("tr");
  newRow.innerHTML = `
    <td><input type="text" class="staffNameInput" placeholder="Name" style="width:100%;"></td>
    <td><input type="text" class="staffEmailInput" placeholder="email@example.com" style="width:100%;"></td>
    <td><input type="text" class="staffRoleInput" placeholder="Role" style="width:100%;"></td>
    <td>—</td>
    <td>
      <button class="saveNewStaffBtn btn-primary">Save</button>
      <button class="cancelNewStaffBtn btn-secondary">Cancel</button>
    </td>
  `;

  tbody.prepend(newRow);

  newRow.querySelector(".saveNewStaffBtn").addEventListener("click", async () => {
    await insertNewStaff(newRow, portalState);
    await loadStaffGrid(staffGrid, portalState);
  });

  newRow.querySelector(".cancelNewStaffBtn").addEventListener("click", () => {
    newRow.remove();
  });
}

/* ---------------------------------------------
   INSERT NEW STAFF
--------------------------------------------- */
async function insertNewStaff(tr, portalState) {
  const name = tr.querySelector(".staffNameInput").value.trim();
  const email = tr.querySelector(".staffEmailInput").value.trim().toLowerCase();
  const role = tr.querySelector(".staffRoleInput").value.trim();

  if (!email || !email.includes("@")) {
    alert("Please enter a valid email.");
    return;
  }

  const payload = {
    project: portalState.setup_project_id,
    staff_name: name,
    staff_email: email,
    role,
    created_at: new Date().toISOString()
  };

  await fetch("https://lookups-module.dennis-e64.workers.dev/projects_staff", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

/* ---------------------------------------------
   SAVE EXISTING STAFF ROW
--------------------------------------------- */
async function saveStaffRow(tr, portalState) {
  const id = tr.dataset.id;
  const name = tr.querySelector(".staffNameInput").value.trim();
  const email = tr.querySelector(".staffEmailInput").value.trim().toLowerCase();
  const role = tr.querySelector(".staffRoleInput").value.trim();

  if (!email || !email.includes("@")) {
    alert("Please enter a valid email.");
    return;
  }

  const updates = {
    staff_name: name,
    staff_email: email,
    role
  };

  await fetch(
    `https://lookups-module.dennis-e64.workers.dev/projects_staff/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates })
    }
  );
}

/* ---------------------------------------------
   DELETE STAFF ROW
--------------------------------------------- */
async function deleteStaffRow(id) {
  if (!confirm("Delete this staff member?")) return;

  await fetch(
    `https://lookups-module.dennis-e64.workers.dev/projects_staff/${id}`,
    { method: "DELETE" }
  );
}

/* ---------------------------------------------
   DATE FORMATTER
--------------------------------------------- */
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}
