// /js/setup/tab-contact-diagnostics.js

const CD_BASE_URL = "https://contact-diagnostics.dennis-e64.workers.dev";

export async function renderContactDiagnostics(setupContent, portalState) {
  const project = portalState.project;

  // Initialize sort state if missing
  if (!portalState.contactDiagSort) {
    portalState.contactDiagSort = {
      column: "name",
      direction: "asc"
    };
  }

  setupContent.innerHTML = `
    <section class="card">
      <h2>Contact Diagnostics</h2>

      <div style="margin-bottom: 15px; display:flex; gap:10px; align-items:center;">
        <button id="cd-refresh" class="btn btn-primary">Refresh</button>
        <button id="cd-bulk-sync" class="btn btn-success">Bulk Sync</button>

        <button id="cd-export" class="btn btn-secondary">Export Selected</button>
        <button id="cd-clear-all" class="btn btn-secondary">Clear All</button>

        <span id="cd-selected-count" style="font-weight:bold; margin-left:10px;">
          Selected: 0
        </span>

        <div style="margin-left:auto; display:flex; gap:8px; align-items:center;">
          <label style="font-weight:bold;">Filter:</label>
          <select id="cd-filter" class="form-select" style="width:220px;">
            <option value="all">All Contacts</option>
            <option value="missing_crm">CRM ID Missing</option>
            <option value="has_crm">Has CRM ID</option>
          </select>
        </div>
      </div>

      <table class="notes-table" style="width:100%;">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">
              <input type="checkbox" id="cd-select-all">
            </th>

            <th class="cd-sortable" data-field="name">
              Name
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="cd-sortable" data-field="email">
              Email
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="cd-sortable" data-field="phone">
              Phone
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th class="cd-sortable" data-field="contact_type">
              Contact Type
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">△</span>
                <span class="sort-down">▽</span>
              </span>
            </th>

            <th style="width:160px;">CRM ID</th>

            <th style="width:180px; text-align:center;">Actions</th>
          </tr>
        </thead>

        <tbody id="cd-body">
          <tr><td colspan="7">Loading...</td></tr>
        </tbody>
      </table>
    </section>
  `;

  document.getElementById("cd-refresh").onclick = () => loadContacts(project, portalState);
  document.getElementById("cd-select-all").onclick = toggleSelectAll;
  document.getElementById("cd-clear-all").onclick = clearAll;
  document.getElementById("cd-export").onclick = exportSelected;
  document.getElementById("cd-bulk-sync").onclick = () => bulkSync(project);
  document.getElementById("cd-filter").onchange = () => applyFilter(portalState);

  loadContacts(project, portalState);
}

let CD_CACHE = [];

async function loadContacts(project, portalState) {
  const tbody = document.getElementById("cd-body");
  tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

  try {
    const res = await fetch(`${CD_BASE_URL}/contact_diag/list?project=${project}&limit=200`);
    const data = await res.json();

    CD_CACHE = data.contacts || [];
    applyFilter(portalState);

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">Error loading contacts.</td></tr>`;
  }
}

function applyFilter(portalState) {
  const filter = document.getElementById("cd-filter").value;
  const tbody = document.getElementById("cd-body");

  let rows = CD_CACHE;

  if (filter === "missing_crm") rows = rows.filter(c => !c.crm_id);
  if (filter === "has_crm") rows = rows.filter(c => c.crm_id);

  // Apply sorting
  rows = sortRows(rows, portalState);

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">No matching contacts.</td></tr>`;
    updateSelectedCount();
    return;
  }

  tbody.innerHTML = rows
    .map((c) => {
      const name =
        c.search_name ||
        `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
        "(no name)";

      const crmDisplay = c.crm_id
        ? c.crm_id
        : `<span style="color:red; font-weight:bold;">None</span>`;

      return `
        <tr data-id="${c.contact_id}">
          <td style="text-align:center;">
            <input type="checkbox" class="cd-row">
          </td>

          <td>${name}</td>
          <td>${c.email || ""}</td>
          <td>${c.phone || ""}</td>
          <td>${c.contact_type || ""}</td>
          <td>${crmDisplay}</td>

          <td style="text-align:center;">
            <button class="btn btn-secondary" onclick="cdPreview('${c.contact_id}', '${c.project}')">Preview</button>
            <button class="btn btn-success" onclick="cdSync('${c.contact_id}', '${c.project}')">Sync</button>
          </td>
        </tr>
      `;
    })
    .join("");

  // Attach checkbox listeners
  document.querySelectorAll(".cd-row").forEach(cb => {
    cb.addEventListener("change", updateSelectedCount);
  });

  // Attach sorting listeners
  document.querySelectorAll(".cd-sortable").forEach(th => {
    th.onclick = () => handleSortClick(th, portalState);
  });

  updateSortArrows(portalState);
  updateSelectedCount();
}

function sortRows(rows, portalState) {
  const { column, direction } = portalState.contactDiagSort;

  return rows.sort((a, b) => {
    let A, B;

    if (column === "name") {
      A = a.search_name || `${a.first_name || ""} ${a.last_name || ""}`.trim();
      B = b.search_name || `${b.first_name || ""} ${b.last_name || ""}`.trim();
    } else {
      A = (a[column] || "").toString().toLowerCase();
      B = (b[column] || "").toString().toLowerCase();
    }

    if (A < B) return direction === "asc" ? -1 : 1;
    if (A > B) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

function handleSortClick(th, portalState) {
  const field = th.dataset.field;

  if (portalState.contactDiagSort.column === field) {
    portalState.contactDiagSort.direction =
      portalState.contactDiagSort.direction === "asc" ? "desc" : "asc";
  } else {
    portalState.contactDiagSort.column = field;
    portalState.contactDiagSort.direction = "asc";
  }

  applyFilter(portalState);
}

function updateSortArrows(portalState) {
  const { column, direction } = portalState.contactDiagSort;

  document.querySelectorAll(".cd-sortable").forEach(th => {
    const field = th.dataset.field;
    const up = th.querySelector(".sort-up");
    const down = th.querySelector(".sort-down");

    if (field === column) {
      up.textContent = direction === "asc" ? "▲" : "△";
      down.textContent = direction === "desc" ? "▼" : "▽";
    } else {
      up.textContent = "△";
      down.textContent = "▽";
    }
  });
}

window.cdPreview = async function (contactId, project) {
  const res = await fetch(`${CD_BASE_URL}/contact_diag/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, contact_id: contactId }),
  });

  const data = await res.json();
  alert(JSON.stringify(data.payload, null, 2));
};

window.cdSync = async function (contactId, project) {
  const res = await fetch(`${CD_BASE_URL}/contact_diag/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, contact_id: contactId }),
  });

  const data = await res.json();
  alert("Sync complete:\n" + JSON.stringify(data, null, 2));

  loadContacts(project);
};

function toggleSelectAll() {
  const checked = document.getElementById("cd-select-all").checked;
  document.querySelectorAll(".cd-row").forEach(cb => (cb.checked = checked));
  updateSelectedCount();
}

function clearAll() {
  document.querySelectorAll(".cd-row").forEach(cb => (cb.checked = false));
  document.getElementById("cd-select-all").checked = false;
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = document.querySelectorAll(".cd-row:checked").length;
  document.getElementById("cd-selected-count").innerText = `Selected: ${count}`;
}

function exportSelected() {
  const selected = [...document.querySelectorAll(".cd-row:checked")].map(cb => {
    const tr = cb.closest("tr");
    const id = tr.dataset.id;

    const contact = CD_CACHE.find(c => c.contact_id === id);

    return {
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      business_name: contact.business_name || "",
      contact_type: contact.contact_type || "",
      email: contact.email || "",
      phone: contact.phone || "",
      crm_id: contact.crm_id || "",
      selected_for_export: "true"
    };
  });

  if (selected.length === 0) {
    alert("No rows selected.");
    return;
  }

  const headers = [
    "first_name",
    "last_name",
    "business_name",
    "contact_type",
    "email",
    "phone",
    "crm_id",
    "selected_for_export"
  ];

  let csv = headers.join(",") + "\n";

  selected.forEach(row => {
    csv += headers.map(h => (row[h] || "").toString().replace(/,/g, "")).join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "selected_contacts.csv";
  a.click();

  URL.revokeObjectURL(url);
}

async function bulkSync(project) {
  const ids = [...document.querySelectorAll(".cd-row:checked")].map(cb =>
    cb.closest("tr").dataset.id
  );

  if (ids.length === 0) {
    alert("No contacts selected.");
    return;
  }

  const res = await fetch(`${CD_BASE_URL}/contact_diag/bulk_sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, contact_ids: ids }),
  });

  const data = await res.json();
  alert("Bulk sync complete:\n" + JSON.stringify(data, null, 2));

  loadContacts(project);
}
