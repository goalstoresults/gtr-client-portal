// js/utilities.js

// Escape HTML for safe rendering
export function escapeHtml(str) {
  const s = String(str ?? "");
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Format currency consistently across the portal
export function formatCurrency(value) {
  const num = Number(value) || 0;
  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDateOnly(value) {
  if (!value) return "";
  const str = String(value);

  // If it's already YYYY-MM-DD, reformat it
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-");
    return `${m}/${d}/${y}`;
  }

  // Fallback for full timestamps
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "America/New_York"
  });
}


// Format date/time consistently across the portal in Eastern Time
export function formatDateTime(value) {
  if (!value) return "";

  const d = new Date(value);

  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}


// Shared Contact Picker
export async function renderContactPicker(container, portalState, onContactSelected) {
  container.innerHTML = `
    <div id="contactsFilters" style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <label>First: <input type="text" id="filter-first" /></label>
      <label>Last: <input type="text" id="filter-last" /></label>
      <label>Business: <input type="text" id="filter-business" /></label>
      <label>Contact Type:
        <select id="filter-contact-type" class="form-control" style="min-width:160px;">
          <option value="">ALL</option>
        </select>
      </label>
      <button id="btnApplyContactsFilter" class="secondary">Apply Filter</button>
      <button id="btnClearContactsFilter" class="secondary">Clear Filter</button>
    </div>
    <div id="contactPickerGrid">(no contacts found)</div>
  `;

  const grid = container.querySelector("#contactPickerGrid");

  // Populate contact type dropdown
  const resTypes = await fetch(
    `https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=contact_type&project=${portalState.project}`
  );
  const values = await resTypes.json();
  const typeSelect = document.getElementById("filter-contact-type");

  if (Array.isArray(values)) {
    values.sort((a, b) =>
      (a.label || a.value || "").localeCompare(b.label || b.value || "")
    );
    values.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v.value;
      opt.textContent = v.label || v.value;
      typeSelect.appendChild(opt);
    });
  }

  async function applyFilter() {
    const first    = document.getElementById("filter-first").value.trim();
    const last     = document.getElementById("filter-last").value.trim();
    const business = document.getElementById("filter-business").value.trim();
    const type     = document.getElementById("filter-contact-type").value;

    const params = new URLSearchParams({
      project: portalState.project,
      first,
      last,
      business
    });

    const url = `https://contacts-module.dennis-e64.workers.dev/contacts/search?${params}`;
    const res = await fetch(url, { cache: "no-cache" });
    let contacts = await res.json();
    if (!Array.isArray(contacts)) contacts = [];

    if (type) contacts = contacts.filter(c => c.contact_type === type);

    grid.innerHTML = `
      <table class="notes-table">
        <thead>
          <tr>
            <th>Name</th><th>Business</th><th>Type</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${contacts.map(c => `
            <tr>
              <td>${escapeHtml(c.search_name || `${c.first_name} ${c.last_name}`)}</td>
              <td>${escapeHtml(c.business_name || "")}</td>
              <td>${escapeHtml(c.contact_type || "")}</td>
              <td><button class="btn-primary btn-add" data-id="${c.contact_id}">Add Payment</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    grid.querySelectorAll(".btn-add").forEach(btn => {
      btn.addEventListener("click", () => {
        const contactId = btn.dataset.id;
        const contact = contacts.find(c => c.contact_id === contactId);
        if (contact && typeof onContactSelected === "function") {
          onContactSelected(contact);
        }
      });
    });
  }

  document.getElementById("btnApplyContactsFilter").addEventListener("click", applyFilter);

  document.getElementById("btnClearContactsFilter").addEventListener("click", () => {
    document.getElementById("filter-first").value = "";
    document.getElementById("filter-last").value = "";
    document.getElementById("filter-business").value = "";
    document.getElementById("filter-contact-type").value = "";
    grid.innerHTML = `(no contacts found)`;
  });
}
