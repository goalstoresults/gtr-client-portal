// /js/setup/tab-contact-diagnostics.js

// IMPORTANT: Named export — this is what setup.js expects
export async function renderContactDiagnostics(setupContent, portalState) {
  const project = portalState.project;

  setupContent.innerHTML = `
    <section class="card">
      <h2>Contact Diagnostics</h2>

      <div style="margin-bottom: 15px;">
        <button id="cd-refresh" class="btn btn-primary">Refresh</button>
        <button id="cd-bulk-sync" class="btn btn-success">Bulk Sync</button>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th><input type="checkbox" id="cd-select-all"></th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>CRM ID</th>
            <th>Actions</th>
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
    const res = await fetch(`/contact_diag/list?project=${project}&limit=200`);
    const data = await res.json();

    if (!data.contacts || data.contacts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">No contacts found.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.contacts
      .map(
        (c) => `
        <tr data-id="${c.id}">
          <td><input type="checkbox" class="cd-row"></td>
          <td>${c.first_name || ""} ${c.last_name || ""}</td>
          <td>${c.email || ""}</td>
          <td>${c.phone || ""}</td>
          <td>${c.crm_id || "<span style='color:red;font-weight:bold;'>None</span>"}</td>
          <td>
            <button class="btn btn-secondary" onclick="cdPreview('${c.id}', '${project}')">Preview</button>
            <button class="btn btn-success" onclick="cdSync('${c.id}', '${project}')">Sync</button>
          </td>
        </tr>
      `
      )
      .join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6">Error loading contacts.</td></tr>`;
  }
}

window.cdPreview = async function (contactId, project) {
  const res = await fetch(`/contact_diag/preview`, {
    method: "POST",
    body: JSON.stringify({ project, contact_id: contactId }),
  });
  const data = await res.json();

  alert(JSON.stringify(data.payload, null, 2));
};

window.cdSync = async function (contactId, project) {
  const res = await fetch(`/contact_diag/sync`, {
    method: "POST",
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

  const res = await fetch(`/contact_diag/bulk_sync`, {
    method: "POST",
    body: JSON.stringify({ project, contact_ids: ids }),
  });

  const data = await res.json();
  alert("Bulk sync complete:\n" + JSON.stringify(data, null, 2));

  loadContacts(project);
}
