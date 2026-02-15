// js/setup/tab-staff.js
// v2.2 — Staff Setup Subtab (Simple JSON + First/Last Name)

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
          <th>Full Name</th>
          <th>First</th>
          <th>Last</th>
          <th>Email</th>
          <th>Allowed Tabs (JSON)</th>
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

            <td><input type="text" class="staffFirstInput" value="${escapeHtml(r.first_name || "")}" style="width:100%;"></td>

            <td><input type="text" class="staffLastInput" value="${escapeHtml(r.last_name || "")}" style="width:100%;"></td>

            <td><input type="text" class="staffEmailInput" value="${escapeHtml(r.staff_email || "")}" style="width:100%;"></td>

            <td>
              <input type="text"
                     class="allowedTabsInput"
                     value='${escapeHtml(JSON.stringify(r.allowed_tabs || []))}'
                     style="width:100%;">
            </td>

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
    <td><input type="text" class="staffNameInput" placeholder="Full Name" style="width:100%;"></td>
    <td><input type="text" class="staffFirstInput" placeholder="First" style="width:100%;"></td>
    <td><input type="text" class="staffLastInput" placeholder="Last" style="width:100%;"></td>
    <td><input type="text" class="staffEmailInput" placeholder="email@example.com" style="width:100%;"></td>

    <td>
      <input type="text"
             class="allowedTabsInput"
             placeholder='["1","2","3"]'
             style="width:100%;">
    </td>

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
  const first = tr.querySelector(".staffFirstInput").value.trim();
  const last = tr.querySelector(".staffLastInput").value.trim();
  const email = tr.querySelector(".staffEmailInput").value.trim().toLowerCase();
  const allowedTabsRaw = tr.querySelector(".allowedTabsInput").value.trim();

  if (!email || !email.includes("@")) {
    alert("Please enter a valid email.");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(allowedTabsRaw || "[]");
  } catch {
    alert('Allowed Tabs must be a JSON array like ["1","2","3"]');
    return;
  }

  const payload = {
    project: portalState.setup_project_id,
    staff_name: name,
    first_name: first,
    last_name: last,
    staff_email: email,
    allowed_tabs: parsed,
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
  const first = tr.querySelector(".staffFirstInput").value.trim();
  const last = tr.querySelector(".staffLastInput").value.trim();
  const email = tr.querySelector(".staffEmailInput").value.trim().toLowerCase();
  const allowedTabsRaw = tr.querySelector(".allowedTabsInput").value.trim();

  if (!email || !email.includes("@")) {
    alert("Please enter a valid email.");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(allowedTabsRaw || "[]");
  } catch {
    alert('Allowed Tabs must be a JSON array like ["1","2","3"]');
    return;
  }

  const updates = {
    staff_name: name,
    first_name: first,
    last_name: last,
    staff_email: email,
    allowed_tabs: parsed
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
