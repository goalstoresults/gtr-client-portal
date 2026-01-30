// js/setup/tab-contact-add.js
// v3.0 — Contact Add Setup Subtab (extracted from legacy setup.js)

import { escapeHtml } from "../utilities.js";

const CONTACT_FIELD_OPTIONS = [
  "first_name",
  "last_name",
  "contact_name",
  "business_name",
  "email",
  "phone",
  "website",
  "title",
  "source",
  "contact_type",
  "search_name",
  "updated_at",
  "group_id"
];

// Save helper (unchanged logic)
async function saveContactSetup(portalState, tab, gridBody) {
  const rows = [];

  gridBody.querySelectorAll("tr").forEach(tr => {
    const enabled = tr.querySelector(".enableCheckbox")?.checked;
    if (!enabled) return;

    const field_key = tr.querySelector(".systemFieldSelect")?.value || "";
    if (!field_key) return;

    const label = tr.querySelector(".labelInput")?.value.trim() || field_key;
    const sort_order = parseInt(tr.querySelector(".orderInput")?.value, 10) || 99;
    const lookup_type = tr.querySelector(".lookupTypeSelect")?.value || null;
    const section = tr.querySelector(".sectionSelect")?.value || null;

    rows.push({
      field_key,
      label,
      sort_order,
      lookup_type,
      section,
      contact_tab: tab
    });
  });

  const payload = {
    project: portalState.setup_project_id,
    fields: rows,
    tab
  };

  await fetch(
    "https://lookups-module.dennis-e64.workers.dev/contact_fields/save",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  alert("Contact Add configuration saved.");
}

export async function renderContactAddSetup(container, portalState) {
  if (!portalState.setup_project_id) {
    container.innerHTML = `
      <section class="card">
        <p>Please select a project in the Client tab before configuring Contact Add fields.</p>
      </section>
    `;
    return;
  }

  // Load lookup groups + sections
  const resLookups = await fetch(
    `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.setup_project_id}`,
    { cache: "no-cache" }
  );
  const lookupsData = await resLookups.json();

  const lookupGroups = Array.isArray(lookupsData.lookups)
    ? [...new Set(lookupsData.lookups.map(l => l.lookup_type))].sort()
    : [];

  const sectionValues = Array.isArray(lookupsData.lookups)
    ? lookupsData.lookups
        .filter(l => l.lookup_type === "section")
        .map(l => l.value)
    : [];

  // Render shell
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <h2>Contact Add Setup for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>
        <div>
          <button id="btnAddAddField" class="btn-secondary" style="margin-right:8px;">+ Add Field</button>
          <button id="btnDefaultAddMode" class="btn-secondary" style="margin-right:8px;">Default Mode</button>
          <button id="btnSaveAddConfig" class="btn-primary">Save Config</button>
        </div>
      </div>

      <p>Enable fields for the Add form, customize labels, set order, bind lookup groups, and assign sections.</p>

      <table id="contactAddFieldsGrid" class="notes-table" style="width:100%; margin-top:12px;">
        <thead>
          <tr>
            <th style="width:60px;">Enabled</th>
            <th style="width:200px;">System Field</th>
            <th style="width:200px;">Label</th>
            <th style="width:100px;">Order</th>
            <th style="width:180px;">Lookup Type</th>
            <th style="width:160px;">Section</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>
  `;

  const gridBody = container.querySelector("#contactAddFieldsGrid tbody");

  // Load existing config
  const url = `https://lookups-module.dennis-e64.workers.dev/contact_fields?project=${portalState.setup_project_id}`;
  const res = await fetch(url, { cache: "no-cache" });
  const data = await res.json();

  const configured = Array.isArray(data.rows)
    ? data.rows.filter(r => r.contact_tab === "add")
    : [];

  const defaultBtn = container.querySelector("#btnDefaultAddMode");

  // Default Mode only appears when there are NO rows
  if (configured.length > 0) {
    defaultBtn.style.display = "none";
  } else {
    defaultBtn.style.display = "inline-block";

    defaultBtn.addEventListener("click", () => {
      const defaults = [
        { field_key: "first_name", label: "First Name", sort_order: 10, section: "General" },
        { field_key: "last_name", label: "Last Name", sort_order: 20, section: "General" },
        { field_key: "business_name", label: "Business Name", sort_order: 30, section: "General" },
        { field_key: "email", label: "Email", sort_order: 40, section: "General" },
        { field_key: "phone", label: "Phone", sort_order: 50, section: "General" },
        { field_key: "contact_type", label: "Contact Type", sort_order: 60, section: "General" }
      ];

      gridBody.innerHTML = defaults
        .map(row => {
          const lookupOptions = [`<option value="">-- none --</option>`]
            .concat(lookupGroups.map(g => `<option value="${g}">${g}</option>`))
            .join("");

          const sectionOptions = [`<option value="">-- none --</option>`]
            .concat(sectionValues.map(s => `<option value="${s}" ${s === row.section ? "selected" : ""}>${s}</option>`))
            .join("");

          const systemFieldOptions = [`<option value="">-- select field --</option>`]
            .concat(CONTACT_FIELD_OPTIONS.map(
              f => `<option value="${f}" ${f === row.field_key ? "selected" : ""}>${f}</option>`
            ))
            .join("");

          return `
            <tr data-field="${row.field_key}">
              <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
              <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
              <td><input type="text" class="labelInput" value="${escapeHtml(row.label)}" style="width:100%;"></td>
              <td><input type="number" class="orderInput" value="${row.sort_order}" style="width:70px;"></td>
              <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
              <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
            </tr>
          `;
        })
        .join("");
    });
  }

  // Render existing rows
  const sortedRows = configured.sort((a, b) => a.sort_order - b.sort_order);

  function toTitleCase(field) {
    return field
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  gridBody.innerHTML = sortedRows
    .map(row => {
      const placeholder = toTitleCase(row.field_key);

      const lookupOptions = [`<option value="">-- none --</option>`]
        .concat(
          lookupGroups.map(
            g => `<option value="${g}" ${row.lookup_type === g ? "selected" : ""}>${g}</option>`
          )
        )
        .join("");

      const sectionOptions = [`<option value="">-- none --</option>`]
        .concat(
          sectionValues.map(
            s => `<option value="${s}" ${row.section === s ? "selected" : ""}>${s}</option>`
          )
        )
        .join("");

      const systemFieldOptions = [`<option value="">-- select field --</option>`]
        .concat(
          CONTACT_FIELD_OPTIONS.map(
            f => `<option value="${f}" ${f === row.field_key ? "selected" : ""}>${f}</option>`
          )
        )
        .join("");

      return `
        <tr data-field="${row.field_key}">
          <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
          <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
          <td><input type="text" class="labelInput" value="${escapeHtml(row.label)}" placeholder="${escapeHtml(placeholder)}" style="width:100%;"></td>
          <td><input type="number" class="orderInput" value="${row.sort_order}" style="width:70px;"></td>
          <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
          <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
        </tr>
      `;
    })
    .join("");

  // Add Field
  container.querySelector("#btnAddAddField").addEventListener("click", () => {
    const used = new Set(
      [...gridBody.querySelectorAll("tr")].map(tr => {
        const explicit = tr.dataset.field;
        const selectVal = tr.querySelector(".systemFieldSelect")?.value;
        return selectVal || explicit || "";
      }).filter(Boolean)
    );

    const available = CONTACT_FIELD_OPTIONS.filter(f => !used.has(f));

    if (!available.length) {
      alert("All contact fields are already configured.");
      return;
    }

    const lookupOptions = [`<option value="">-- none --</option>`]
      .concat(lookupGroups.map(g => `<option value="${g}">${g}</option>`))
      .join("");

    const sectionOptions = [`<option value="">-- none --</option>`]
      .concat(sectionValues.map(s => `<option value="${s}">${s}</option>`))
      .join("");

    const systemFieldOptions = [`<option value="">-- select field --</option>`]
      .concat(available.map(f => `<option value="${f}">${f}</option>`))
      .join("");

    const newRow = document.createElement("tr");
    newRow.dataset.field = "";

    newRow.innerHTML = `
      <td style="text-align:center;"><input type="checkbox" class="enableCheckbox" checked></td>
      <td><select class="systemFieldSelect" style="width:100%;">${systemFieldOptions}</select></td>
      <td><input type="text" class="labelInput" placeholder="Label" style="width:100%;"></td>
      <td><input type="number" class="orderInput" value="99" style="width:70px;"></td>
      <td><select class="lookupTypeSelect" style="width:100%;">${lookupOptions}</select></td>
      <td><select class="sectionSelect" style="width:100%;">${sectionOptions}</select></td>
    `;

    gridBody.appendChild(newRow);
  });

  // Save
  container.querySelector("#btnSaveAddConfig").addEventListener("click", async () => {
    await saveContactSetup(portalState, "add", gridBody);
  });
}
