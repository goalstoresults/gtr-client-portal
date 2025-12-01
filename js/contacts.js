// js/contacts.js v1.5
export async function loadContactsTab({ portalState, tabContent }) {
  const res = await fetch("./components/contacts.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = tabContent.querySelector("#contactsContent");
  const buttons = tabContent.querySelectorAll("#contacts-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;
      switch (subtab) {
        case "add":
          await renderAddContactForm(content, portalState);
          break;

        case "list":
          await renderContactList(content, portalState);
          break;

        case "details":
          content.innerHTML = `
            <section class="card">
              <h2>Contact Details</h2>
              <p>Select a contact from the list to view details.</p>
            </section>
          `;
          break;

        case "relationships":
          content.innerHTML = `
            <section class="card">
              <h2>Relationships</h2>
              <p>(Placeholder for relationship mapping UI)</p>
            </section>
          `;
          break;

        case "notes":
          content.innerHTML = `
            <section class="card">
              <h2>Contact Notes</h2>
              <p>(Placeholder for notes integration with Contacts)</p>
            </section>
          `;
          break;

        default:
          content.innerHTML = `
            <section class="card">
              <p>Select a subtab to begin.</p>
            </section>
          `;
      }
    });
  });
}

// 🔧 Contact List with Select/Delete
async function renderContactList(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Contact List for ${escapeHtml(portalState.display_name || portalState.project)}</h2>
      <div id="contactTable">Loading...</div>
    </section>
  `;
  const tableDiv = container.querySelector("#contactTable");
  const resList = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${portalState.project}`
  );
  const contacts = await resList.json();

  tableDiv.innerHTML = `
    <table class="notes-table">
      <thead><tr><th>Name</th><th>Email</th><th>Actions</th></tr></thead>
      <tbody>
        ${contacts.map(c => `
          <tr>
            <td>${escapeHtml(c.contact_name || "")}</td>
            <td>${escapeHtml(c.email || "")}</td>
            <td>
              <button class="btn-primary btn-select" data-id="${c.contact_id}">Select</button>
              <button class="btn-danger btn-delete" data-id="${c.contact_id}">Delete</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  // Wire Select/Delete
  tableDiv.querySelectorAll(".btn-select").forEach(btn => {
    btn.addEventListener("click", async () => {
      const contactId = btn.dataset.id;

      // 🔑 Switch to Details tab
      const buttons = document.querySelectorAll("#contacts-subtabs button");
      buttons.forEach(b => b.classList.remove("active"));
      const detailsBtn = document.querySelector('#contacts-subtabs button[data-subtab="details"]');
      if (detailsBtn) detailsBtn.classList.add("active");

      const content = document.querySelector("#contactsContent");
      await renderContactDetails(content, portalState, contactId);
    });
  });

  tableDiv.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      const contactId = btn.dataset.id;
      if (!confirm("Delete this contact?")) return;
      await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, project: portalState.project })
      });
      await renderContactList(container, portalState); // refresh list
    });
  });
}

// 🔧 Dynamic Add Contact Form with collapsible sections
async function renderAddContactForm(container, portalState) {
  const projectId = portalState.project;
  if (!projectId) {
    container.innerHTML = `<section class="card"><p>No project selected.</p></section>`;
    return;
  }

  // Fetch configured fields for this project
  const res = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contact_fields?project=${projectId}`,
    { cache: "no-cache" }
  );
  const data = await res.json();
  const fields = Array.isArray(data.rows) ? data.rows : [];
  fields.sort((a, b) => a.sort_order - b.sort_order);

  // Base container
  container.innerHTML = `
    <section class="card">
      <h2>Add Contact for ${escapeHtml(portalState.display_name || projectId)}</h2>
      <form id="addContactForm" class="notes-form"></form>
    </section>
  `;

  const form = container.querySelector("#addContactForm");

  // Group fields by section
  const grouped = fields.reduce((acc, f) => {
    const section = f.section || "General";
    if (!acc[section]) acc[section] = [];
    acc[section].push(f);
    return acc;
  }, {});

  // Render each section as collapsible <details>
  for (const [section, sectionFields] of Object.entries(grouped)) {
    const details = document.createElement("details");
    details.className = "notes-section";
    details.open = true; // expand by default, remove if you want collapsed

    const summary = document.createElement("summary");
    summary.textContent = section;
    summary.className = "section-title";
    details.appendChild(summary);

    for (const f of sectionFields) {
      const wrapper = document.createElement("div");
      wrapper.className = "notes-row";

      const label = document.createElement("label");
      // no colon here — CSS ::after will add it
      label.textContent = f.label || f.field_key;
      label.className = "notes-label";

      let input;

      if (f.lookup_type) {
        // Render dropdown bound to lookup group
        input = document.createElement("select");
        input.name = f.field_key;
        input.className = "form-control";

        fetch(`https://contacts-module.dennis-e64.workers.dev/lookups?group=${f.lookup_type}`)
          .then(r => r.json())
          .then(values => {
            if (!Array.isArray(values)) {
              console.warn("Lookup fetch failed:", values);
              return;
            }
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
      } else {
        // Default text input
        input = document.createElement("input");
        input.type = "text";
        input.name = f.field_key;
        input.className = "form-control";
      }

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      details.appendChild(wrapper);
    }

    form.appendChild(details);
  }

  // Add Save button
  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "Save Contact";
  form.appendChild(saveBtn);

  // Handle form submission
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = {};

    fields.forEach(f => {
      payload[f.field_key] = formData.get(f.field_key);
    });

    payload.contact_id = crypto.randomUUID();
    payload.project = projectId;
    payload.created_at = new Date().toISOString();

    const first = formData.get("first_name") || "";
    const last = formData.get("last_name") || "";
    payload.contact_name = `${first} ${last}`.trim();

    try {
      const res = await fetch("https://contacts-module.dennis-e64.workers.dev/contacts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      container.innerHTML = `<section class="card"><p>${escapeHtml(result.message || "Contact saved.")}</p></section>`;
    } catch (err) {
      container.innerHTML = `<section class="card"><p>Error saving contact: ${escapeHtml(err.message)}</p></section>`;
    }
  });
}

// 🔧 Render Contact Details
async function renderContactDetails(container, portalState, contactId) {
  const projectId = portalState.project;
  if (!projectId || !contactId) {
    container.innerHTML = `<section class="card"><p>Missing project or contact ID.</p></section>`;
    return;
  }

  // Fetch contact details (Worker expects /contacts/details/:id)
  const res = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contacts/details/${contactId}`,
    { cache: "no-cache" }
  );
  const data = await res.json();

  // Supabase proxy returns an array
  const contact = Array.isArray(data) ? data[0] : data;
  if (!contact) {
    container.innerHTML = `<section class="card"><p>Contact not found.</p></section>`;
    return;
  }

  // Fetch configured fields for this project
  const fieldsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contact_fields?project=${projectId}`,
    { cache: "no-cache" }
  );
  const fieldsData = await fieldsRes.json();
  const fields = Array.isArray(fieldsData.rows) ? fieldsData.rows : [];
  fields.sort((a, b) => a.sort_order - b.sort_order);

  // Base container
  container.innerHTML = `
    <section class="card">
      <h2>Contact Details for ${escapeHtml(contact.contact_name || contactId)}</h2>
      <form id="editContactForm" class="notes-form"></form>
    </section>
  `;

  const form = container.querySelector("#editContactForm");

  // Group fields by section
  const grouped = fields.reduce((acc, f) => {
    const section = f.section || "General";
    if (!acc[section]) acc[section] = [];
    acc[section].push(f);
    return acc;
  }, {});

  // Render each section
  for (const [section, sectionFields] of Object.entries(grouped)) {
    const sectionHeader = document.createElement("h3");
    sectionHeader.textContent = section;
    sectionHeader.className = "section-title";
    form.appendChild(sectionHeader);

    for (const f of sectionFields) {
      const wrapper = document.createElement("div");
      wrapper.className = "notes-row";

      const label = document.createElement("label");
      label.textContent = f.label || f.field_key; // colon handled by CSS
      label.className = "notes-label";

      let input;

      if (f.lookup_type) {
        input = document.createElement("select");
        input.name = f.field_key;
        input.className = "form-control";

        fetch(`https://contacts-module.dennis-e64.workers.dev/lookups?group=${f.lookup_type}`)
          .then(r => r.json())
          .then(values => {
            if (!Array.isArray(values)) {
              console.warn("Lookup fetch failed:", values);
              return;
            }
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "-- Select --";
            input.appendChild(placeholder);

            values.forEach(v => {
              const opt = document.createElement("option");
              opt.value = v.value;
              opt.textContent = v.label || v.value;
              if (contact[f.field_key] === v.value) {
                opt.selected = true;
              }
              input.appendChild(opt);
            });
          });
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

  // Save button
  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "btn-primary";
  saveBtn.textContent = "Save Changes";
  form.appendChild(saveBtn);

  // Handle form submission
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const updates = {};

    fields.forEach(f => {
      updates[f.field_key] = formData.get(f.field_key);
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
      container.innerHTML = `<section class="card"><p>${escapeHtml(result.message || "Contact updated.")}</p></section>`;
    } catch (err) {
      container.innerHTML = `<section class="card"><p>Error updating contact: ${escapeHtml(err.message)}</p></section>`;
    }
  });
}







// helper
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}
