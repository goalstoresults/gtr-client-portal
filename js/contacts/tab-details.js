// js/contacts/tab-details.js
// Modularized Contact Details Tab

import { escapeHtml } from "../utilities.js";
import { renderContactList } from "./tab-list.js";

/* -------------------------------------------------------
   MAIN ENTRY: Render Contact Details
------------------------------------------------------- */
export async function renderContactDetails(container, portalState, contactId) {
  const projectId = portalState.project;
  if (!projectId || !contactId) {
    container.innerHTML = `<section class="card"><p>Missing project or contact ID.</p></section>`;
    return;
  }

  // Fetch contact details
  const res = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contacts/details/${contactId}`,
    { cache: "no-cache" }
  );
  const data = await res.json();
  const contact = Array.isArray(data) ? data[0] : data;

  if (!contact) {
    container.innerHTML = `<section class="card"><p>Contact not found.</p></section>`;
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

  const headerName = contact.search_name || contact.contact_id;

  /* -------------------------------------------------------
     HEADER WITH SAVE + DELETE
  ------------------------------------------------------- */
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <h2 style="margin:0;">Contact Details for ${escapeHtml(headerName)}</h2>

        <button id="btnSaveContact" class="btn-primary">Save</button>
        <button id="btnDeleteContact" class="btn-danger">Delete</button>
      </div>

      <form id="editContactForm" class="notes-form"></form>

      <div class="audit-info" style="margin-top:12px; font-size:0.9em; color:#666;">
        <p><strong>Created:</strong> ${escapeHtml(contact.created_at || "")}</p>
        <p><strong>Updated:</strong> ${escapeHtml(contact.updated_at || "—")}</p>
      </div>
    </section>
  `;

  const form = container.querySelector("#editContactForm");

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
              if (contact.group_id === g.group_id) opt.selected = true;
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
              if (contact[f.field_key] === v.value) opt.selected = true;
              input.appendChild(opt);
            });
          });

      // Text input
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.name = f.field_key;
        input.className = "form-control";
        input.value = contact[f.field_key] || "";
      }

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    }
  }

  /* -------------------------------------------------------
     SAVE BUTTON HANDLER
  ------------------------------------------------------- */
  document.getElementById("btnSaveContact").addEventListener("click", () => {
    form.requestSubmit();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const updates = {};

    fields.forEach(f => {
      let val = formData.get(f.field_key);

      if (val === "") {
        updates[f.field_key] = null;
      } else if (f.data_type === "integer") {
        const parsed = parseInt(val, 10);
        updates[f.field_key] = isNaN(parsed) ? null : parsed;
      } else {
        updates[f.field_key] = val;
      }
    });

    updates.updated_at = new Date().toISOString();

    try {
      const res = await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contacts/edit/${contactId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates)
        }
      );

      const result = await res.json();
      container.innerHTML = `
        <section class="card">
          <p>${escapeHtml(result.message || "Contact updated.")}</p>
        </section>
      `;
    } catch (err) {
      container.innerHTML = `
        <section class="card">
          <p>Error updating contact: ${escapeHtml(err.message)}</p>
        </section>
      `;
    }
  });

  /* -------------------------------------------------------
     DELETE CONTACT
  ------------------------------------------------------- */
  document.getElementById("btnDeleteContact").addEventListener("click", async () => {
    if (!confirm("Delete this contact?")) return;

    await fetch(
      `https://contacts-module.dennis-e64.workers.dev/contacts/delete/${contactId}?project=${portalState.project}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      }
    );

    alert("Contact deleted.");

    const listBtn = document.querySelector('#contacts-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#contactsContent");
      await renderContactList(content, portalState);
    }
  });
}
