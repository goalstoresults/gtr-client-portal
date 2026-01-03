// js/contacts/tab-add.js
// Modularized Add Contact Tab

import { escapeHtml } from "../utilities.js";
import { renderContactList } from "./tab-list.js";

/* -------------------------------------------------------
   MAIN ENTRY: Render Add Contact Form
------------------------------------------------------- */
export async function renderAddContactForm(container, portalState) {
  const projectId = portalState.project;
  if (!projectId) {
    container.innerHTML = `<section class="card"><p>No project selected.</p></section>`;
    return;
  }

  // Fetch configured fields
  const fieldsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contact_fields?project=${projectId}`,
    { cache: "no-cache" }
  );
  const fieldsData = await fieldsRes.json();
  let fields = Array.isArray(fieldsData.rows) ? fieldsData.rows : [];
  fields.sort((a, b) => a.sort_order - b.sort_order);

  // Use Add tab fields for consistency
  fields = fields.filter(f => f.contact_tab === "add");

  /* -------------------------------------------------------
     RENDER FORM SHELL
  ------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">
      <form id="addContactForm" class="notes-form">
        <div class="form-header" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <h2 style="margin:0;">Add Contact for ${escapeHtml(portalState.display_name || projectId)}</h2>
          <button type="submit" class="btn-primary">Save Contact</button>
        </div>
      </form>
    </section>
  `;

  const form = container.querySelector("#addContactForm");

  /* -------------------------------------------------------
     GROUP FIELDS BY SECTION
  ------------------------------------------------------- */
  const grouped = fields.reduce((acc, f) => {
    const section = f.section || "General";
    if (!acc[section]) acc[section] = [];
    acc[section].push(f);
    return acc;
  }, {});

  /* -------------------------------------------------------
     RENDER SECTIONS + FIELDS
  ------------------------------------------------------- */
  for (const [section, sectionFields] of Object.entries(grouped)) {
    const sectionHeader = document.createElement("h3");
    sectionHeader.textContent = section;
    sectionHeader.className = "section-title";
    form.appendChild(sectionHeader);

    for (const f of sectionFields) {
      const wrapper = document.createElement("div");
      wrapper.className = "notes-row";

      const label = document.createElement("label");
      label.textContent = f.label || f.field_key;
      label.className = "notes-label";

      let input;

      // Group dropdown
      if (f.field_key === "group_id") {
        input = document.createElement("select");
        input.name = "group_id";
        input.className = "form-control";

        fetch(`https://groups-module.dennis-e64.workers.dev/groups/list?project=${projectId}`)
          .then(r => r.json())
          .then(data => {
            const rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : [];
            rows.sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "-- Select Group --";
            input.appendChild(placeholder);

            rows.forEach(g => {
              const opt = document.createElement("option");
              opt.value = g.group_id;
              opt.textContent = g.group_name;
              input.appendChild(opt);
            });
          });

      // Lookup dropdown
      } else if (f.lookup_type) {
        input = document.createElement("select");
        input.name = f.field_key;
        input.className = "form-control";

        fetch(`https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=${f.lookup_type}&project=${projectId}`)
          .then(r => r.json())
          .then(values => {
            if (!Array.isArray(values)) return;
            values.sort((a, b) => (a.label || a.value || "").localeCompare(b.label || b.value || ""));

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "-- Select --";
            input.appendChild(placeholder);

            values.forEach(v => {
              const opt = document.createElement("option");
              opt.value = v.value;
              opt.textContent = v.label || v.value;
              input.appendChild(opt);
            });
          });

      // Text input
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.name = f.field_key;
        input.className = "form-control";
      }

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    }
  }

  /* -------------------------------------------------------
     SUBMIT HANDLER
  ------------------------------------------------------- */
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = {};

    fields.forEach(f => {
      let val = formData.get(f.field_key);

      if (val === "") {
        payload[f.field_key] = null;
      } else if (f.data_type === "integer") {
        const parsed = parseInt(val, 10);
        payload[f.field_key] = isNaN(parsed) ? null : parsed;
      } else {
        payload[f.field_key] = val;
      }
    });

    payload.contact_id = crypto.randomUUID();
    payload.project = projectId;
    payload.created_at = new Date().toISOString();

    // Build contact_name consistently
    const first = formData.get("first_name") || "";
    const last = formData.get("last_name") || "";
    payload.contact_name = `${first} ${last}`.trim();

    try {
      const res = await fetch("https://contacts-module.dennis-e64.workers.dev/contacts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      await res.json();

      // Return to List tab after save
      const listBtn = document.querySelector('#contacts-subtabs button[data-subtab="list"]');
      if (listBtn) {
        document.querySelectorAll("#contacts-subtabs button").forEach(b => b.classList.remove("active"));
        listBtn.classList.add("active");

        const content = document.querySelector("#contactsContent");
        await renderContactList(content, portalState);
      }

    } catch (err) {
      container.innerHTML = `
        <section class="card">
          <p>Error saving contact: ${escapeHtml(err.message)}</p>
        </section>
      `;
    }
  });
}
