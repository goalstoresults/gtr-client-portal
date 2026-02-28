// /js/setup/tab-contact-diagnostics.js

const CD_BASE_URL = "https://contact-diagnostics.dennis-e64.workers.dev";

export async function renderContactDiagnostics(setupContent, portalState) {
  const project = portalState.project;

  setupContent.innerHTML = `
    <section class="card">
      <h2>Contact Diagnostics</h2>

      <div style="margin-bottom: 15px; display:flex; gap:10px;">
        <button id="cd-refresh" class="btn btn-primary">Refresh</button>
        <button id="cd-bulk-sync" class="btn btn-success">Bulk Sync</button>
      </div>

      <table class="notes-table" style="width:100%;">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">
              <input type="checkbox" id="cd-select-all">
            </th>
            <th style="width:220px;">Name</th>
            <th style="width:240px;">Email</th>
            <th style="width:160px;">Phone</th>
            <th style="width:160px;">CRM ID</th>
            <th style="width:180px; text-align:center;">Actions</th>
          </tr>
        </thead>
        <tbody id="cd-body">
          <tr><td colspan="6">Loading...</td></tr>
        </tbody>
      </table>
    </section>
  `;

  loadContacts(project);

  document.getElementById("cd-refresh").onclick = () => loadContacts(project);
  document.getElementById("cd-select-all").onclick = toggleSelectAll;
  document.getElementById("cd-bulk-sync").onclick = () => bulkSync(project);
}

async function loadContacts(project) {
  const tbody = document.getElementById("cd-body");
  tbody.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;

  try {
    const res = await fetch(`${CD_BASE_URL}/contact_diag/list?project=${project}&limit=200`);
    const data = await res.json();

    if (!data.contacts || data.contacts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">No contacts found.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.contacts
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
          <td>${crmDisplay}</td>

          <td style="text-align:center;">
            <button class="btn btn-secondary" onclick="cdPreview('${c.contact_id}', '${project}')">Preview</button>
            <button class="btn btn-success" onclick="cdSync('${c.contact_id}', '${project}')">Sync</button>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Error loading contacts.</td></tr>`;
  }
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
  document.querySelectorAll(".cd-row").forEach((cb) => (cb.checked = checked));
}

async function bulkSync(project) {
  const ids = [...document.querySelectorAll(".cd-row")]
    .filter((cb) => cb.checked)
    .map((cb) => cb.closest("tr").dataset.id);

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

