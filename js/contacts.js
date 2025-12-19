// js/contacts.js v2.0
// 🔧 Load Contacts Tab with subtab switching

export async function loadContactsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/contacts.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  // 🔧 Inject contact context bar (above subtabs)
  let contextBar = document.getElementById("contact-context-bar");
  if (!contextBar) {
    contextBar = document.createElement("div");
    contextBar.id = "contact-context-bar";
    contextBar.className = "contact-context-bar";
    tabContent.prepend(contextBar);
  }
  contextBar.textContent = portalState.selectedContactName
    ? `Contact: ${portalState.selectedContactName}`
    : "No contact selected";

  const content = tabContent.querySelector("#contactsContent");
  const buttons = tabContent.querySelectorAll("#contacts-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
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
          if (portalState.selectedContactId) {
            await renderContactDetails(content, portalState, portalState.selectedContactId);
          } else {
            content.innerHTML = `
              <section class="card">
                <h2>Contact Details</h2>
                <p>Select a contact from the list to view details.</p>
              </section>
            `;
          }
          break;

        case "relationships":
          if (portalState.selectedContactId) {
            await renderContactRelationships(content, portalState, portalState.selectedContactId);
          } else {
            content.innerHTML = `
              <section class="card">
                <h2>Relationships</h2>
                <p>Select a contact from the list to view relationships.</p>
              </section>
            `;
          }
          break;

        case "notes":
          if (portalState.selectedContactId) {
            await renderContactNotes(content, portalState, portalState.selectedContactId);
          } else {
            content.innerHTML = `
              <section class="card">
                <h2>Contact Notes</h2>
                <p>Select a contact from the list first, then open Notes.</p>
              </section>
            `;
          }
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

  // ✅ Default to List view when tab first loads
  const defaultBtn = tabContent.querySelector('#contacts-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderContactList(content, portalState);
  }
}


// 🔧 Contact List with dynamic grid based on project_contact_fields
// 🔧 Contact List with dynamic grid + context bar update
async function renderContactList(container, portalState) {
  try {
    // --- Step 1: Capture current filter values ---
    const prevFirst    = document.getElementById("filter-first")?.value.trim() || "";
    const prevLast     = document.getElementById("filter-last")?.value.trim() || "";
    const prevBusiness = document.getElementById("filter-business")?.value.trim() || "";
    const prevType     = document.getElementById("filter-contact-type")?.value || "";

    // --- Step 2: Build base UI ---
    container.innerHTML = `
      <section class="card">
        <h2>Contact List for ${escapeHtml(portalState.display_name || portalState.project)}</h2>
        <div id="contactsFilters" style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <label>First: <input type="text" id="filter-first" value="${escapeHtml(prevFirst)}" /></label>
          <label>Last: <input type="text" id="filter-last" value="${escapeHtml(prevLast)}" /></label>
          <label>Business: <input type="text" id="filter-business" value="${escapeHtml(prevBusiness)}" /></label>
          <label>Contact Type:
            <select id="filter-contact-type" class="form-control" style="min-width:160px;">
              <option value="">ALL</option>
            </select>
          </label>
          <button id="btnApplyContactsFilter" class="secondary">Apply Filter</button>
          <button id="btnClearContactsFilter" class="secondary">Clear Filter</button>
        </div>
        <div id="contactTable">(no contacts found)</div>
      </section>
    `;

    const tableDiv   = container.querySelector("#contactTable");
    const typeSelect = document.getElementById("filter-contact-type");

    // --- Step 3: Populate Contact Type dropdown ---
    const resTypes = await fetch(`https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=contact_type&project=${portalState.project}`);
    const values = await resTypes.json();
    if (Array.isArray(values)) {
      values.sort((a, b) => (a.label || a.value || "").localeCompare(b.label || b.value || ""));
      values.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.value;
        opt.textContent = v.label || v.value;
        if (v.value === prevType) opt.selected = true;
        typeSelect.appendChild(opt);
      });
    }

    // --- Step 4: Apply filter (server-side search) ---
    async function applyFilter() {
      const first    = document.getElementById("filter-first").value.trim();
      const last     = document.getElementById("filter-last").value.trim();
      const business = document.getElementById("filter-business").value.trim();
      const type     = document.getElementById("filter-contact-type").value;

      if (first.length < 1 && last.length < 1 && business.length < 1 && !type) {
        tableDiv.innerHTML = `<p>(no contacts found — enter at least 1 character)</p>`;
        return;
      }

      const params = new URLSearchParams({
        project: portalState.project,
        first: first,
        last: last,
        business: business
      });
      const url = `https://contacts-module.dennis-e64.workers.dev/contacts/search?${params}`;
      console.log("[Contacts] Searching:", url);

      const resList = await fetch(url, { cache: "no-cache" });
      let contacts = await resList.json();
      if (!Array.isArray(contacts)) contacts = [];

      if (type) {
        contacts = contacts.filter(c => c.contact_type === type);
      }

      // --- Step 5: Fetch field config for dynamic grid ---
      const fieldsRes = await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contact_fields?project=${portalState.project}`,
        { cache: "no-cache" }
      );
      const fieldsData = await fieldsRes.json();
      const fields = Array.isArray(fieldsData.rows) ? fieldsData.rows : [];
      fields.sort((a, b) => a.sort_order - b.sort_order);

      const listFields = fields.filter(f => f.contact_tab === "list");

      // --- Step 6: Build table UI dynamically ---
      const headers = listFields.map(f => `<th>${escapeHtml(f.label || f.field_key)}</th>`).join("");
      const headerRow = `<tr>${headers}<th>Actions</th></tr>`;

      const rows = contacts.map(c => {
        const cells = listFields.map(f => `<td>${escapeHtml(c[f.field_key] || "")}</td>`).join("");
        return `
          <tr>
            ${cells}
            <td><button class="btn-primary btn-select" data-id="${c.contact_id}">Select</button></td>
          </tr>
        `;
      }).join("");

      tableDiv.innerHTML = `
        <h4>Showing ${contacts.length} contacts</h4>
        <table class="notes-table">
          <thead>${headerRow}</thead>
          <tbody>
            ${rows || `<tr><td colspan="${listFields.length + 1}">(no contacts found)</td></tr>`}
          </tbody>
        </table>
      `;

      // --- Step 7: Wire select buttons ---
      tableDiv.querySelectorAll(".btn-select").forEach(btn => {
        btn.addEventListener("click", async () => {
          const contactId = btn.dataset.id;
          portalState.selectedContactId = contactId;

          // Fetch contact details to get name
          const res = await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/details/${contactId}`, {
            cache: "no-cache"
          });
          const data = await res.json();
          const contact = Array.isArray(data) ? data[0] : data;

          portalState.selectedContactName =
            contact.search_name || `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

          // Update context bar
          const contextBar = document.getElementById("contact-context-bar");
          if (contextBar) {
            contextBar.textContent = `Contact: ${portalState.selectedContactName}`;
          }

          // Switch to Details tab
          const buttons = document.querySelectorAll("#contacts-subtabs button");
          buttons.forEach(b => b.classList.remove("active"));
          const detailsBtn = document.querySelector('#contacts-subtabs button[data-subtab="details"]');
          if (detailsBtn) detailsBtn.classList.add("active");
          const content = document.querySelector("#contactsContent");
          await renderContactDetails(content, portalState, contactId);
        });
      });
    }

    // --- Step 8: Wire filter buttons ---
    document.getElementById("btnApplyContactsFilter").addEventListener("click", applyFilter);
    document.getElementById("btnClearContactsFilter").addEventListener("click", () => {
      document.getElementById("filter-first").value = "";
      document.getElementById("filter-last").value = "";
      document.getElementById("filter-business").value = "";
      document.getElementById("filter-contact-type").value = "";
      tableDiv.innerHTML = `(no contacts found)`;
    });

  } catch (err) {
    container.innerHTML = `
      <h4>Contacts</h4>
      <p>Error loading contacts: ${escapeHtml(err.message || "Unknown error")}</p>
    `;
    console.error("[Contacts] Error in renderContactList:", err);
  }
}

// 🔧 Add Contact Form (same structure as Details, but POST + new contact_id)
async function renderAddContactForm(container, portalState) {
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

  // Header and Save button moved inside the form, top-aligned
  container.innerHTML = `
    <section class="card">
      <form id="addContactForm" class="notes-form">
        <div class="form-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2 style="margin:0;">Add Contact for ${escapeHtml(portalState.display_name || projectId)}</h2>
          <button type="submit" class="btn-primary">Save Contact</button>
        </div>
        <!-- fields will be appended here -->
      </form>
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
      label.textContent = f.label || f.field_key;
      label.className = "notes-label";

      let input;

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
              opt.value = g.group_id; // full UUID
              opt.textContent = g.group_name;
              input.appendChild(opt);
            });
          });
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

  // Handle form submission with normalization
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
        payload[f.field_key] = val; // preserve UUIDs and strings
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

      const result = await res.json();
      container.innerHTML = `<section class="card"><p>${escapeHtml(result.message || "Contact saved.")}</p></section>`;
    } catch (err) {
      container.innerHTML = `<section class="card"><p>Error saving contact: ${escapeHtml(err.message)}</p></section>`;
    }
  });
}







async function renderContactDetails(container, portalState, contactId) {
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

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <h2 style="margin:0;">Contact Details for ${escapeHtml(headerName)}</h2>
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
      label.textContent = f.label || f.field_key;
      label.className = "notes-label";

      let input;

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

  // Handle form submission with normalization
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
        updates[f.field_key] = val; // preserve UUIDs and strings
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
      container.innerHTML = `<section class="card"><p>${escapeHtml(result.message || "Contact updated.")}</p></section>`;
    } catch (err) {
      container.innerHTML = `<section class="card"><p>Error updating contact: ${escapeHtml(err.message)}</p></section>`;
    }
  });

  // Handle Delete button
  document.getElementById("btnDeleteContact").addEventListener("click", async () => {
    if (!confirm("Delete this contact?")) return;
    await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/delete/${contactId}?project=${portalState.project}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });
    alert("Contact deleted.");
    const listBtn = document.querySelector('#contacts-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#contactsContent");
      await renderContactList(content, portalState);
    }
  });
}


// Render relationships grid for a contact
async function renderContactRelationships(container, portalState, contactId) {
  if (!portalState.project || !contactId) {
    container.innerHTML = `
      <section class="card">
        <p>Select a contact from the list to view relationships.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Relationships originating from this contact</h3>
        <button id="btnAddSourceRel" class="btn-primary">Add Relationship</button>
      </div>
      <div id="contactRelSourceGrid"></div>
    </section>

    <section class="card" style="margin-top:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Relationships pointing to this contact</h3>
        <button id="btnAddRelatedRel" class="btn-primary">Add Relationship</button>
      </div>
      <div id="contactRelRelatedGrid"></div>
    </section>
  `;

  await renderContactRelationshipsSource(
    container.querySelector("#contactRelSourceGrid"),
    portalState,
    contactId
  );
  await renderContactRelationshipsRelated(
    container.querySelector("#contactRelRelatedGrid"),
    portalState,
    contactId
  );

  container.querySelector("#btnAddSourceRel").addEventListener("click", () =>
    openRelationshipForm(container, portalState, {
      mode: "add",
      fixedSide: "source",
      contactId
    })
  );

  container.querySelector("#btnAddRelatedRel").addEventListener("click", () =>
    openRelationshipForm(container, portalState, {
      mode: "add",
      fixedSide: "related",
      contactId
    })
  );
}

async function renderContactRelationshipsSource(container, portalState, contactId) {
  const url = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${portalState.project}&source_contact_id=${contactId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let rows = await res.json();
  if (!Array.isArray(rows)) rows = [];

  container.innerHTML = `
    <table class="notes-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Role</th>
          <th>Related Contact</th>
          <th>Financial Referral</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length > 0
          ? rows.map(r => `
              <tr>
                <td>${escapeHtml(r.relationship_type || "")}</td>
                <td>${escapeHtml(r.relationship_role || "")}</td>
                <td>${escapeHtml(r.related_contact_name || r.related_contact_id || "")}</td>
                <td>${r.financial_referral ? "✅" : ""}</td>
                <td>${escapeHtml(r.created_at || "")}</td>
                <td>
                  <button class="btn-secondary btn-edit" data-id="${r.id}">Edit</button>
                  <button class="btn-danger btn-delete" data-id="${r.id}">Delete</button>
                </td>
              </tr>
            `).join("")
          : `<tr><td colspan="6">(no relationships)</td></tr>`
        }
      </tbody>
    </table>
  `;

  // ✅ Use tab-level container for form
  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const content = document.querySelector("#contactsContent");
      openRelationshipForm(content, portalState, {
        mode: "edit",
        relationshipId: btn.dataset.id,
        contactId
      });
    });
  });

  container.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this relationship?")) return;
      await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${btn.dataset.id}?project=${portalState.project}`,
        { method: "DELETE" }
      );
      await renderContactRelationshipsSource(container, portalState, contactId);
    });
  });
}

async function renderContactRelationshipsRelated(container, portalState, contactId) {
  const url = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${portalState.project}&related_contact_id=${contactId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let rows = await res.json();
  if (!Array.isArray(rows)) rows = [];

  container.innerHTML = `
    <table class="notes-table">
      <thead>
        <tr>
          <th>Type</th>
          <th>Role</th>
          <th>Source Contact</th>
          <th>Financial Referral</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length > 0
          ? rows.map(r => `
              <tr>
                <td>${escapeHtml(r.relationship_type || "")}</td>
                <td>${escapeHtml(r.relationship_role || "")}</td>
                <td>${escapeHtml(r.source_contact_name || r.source_contact_id || "")}</td>
                <td>${r.financial_referral ? "✅" : ""}</td>
                <td>${escapeHtml(r.created_at || "")}</td>
                <td>
                  <button class="btn-secondary btn-edit" data-id="${r.id}">Edit</button>
                  <button class="btn-danger btn-delete" data-id="${r.id}">Delete</button>
                </td>
              </tr>
            `).join("")
          : `<tr><td colspan="6">(no relationships)</td></tr>`
        }
      </tbody>
    </table>
  `;

  // ✅ Use tab-level container for form
  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const content = document.querySelector("#contactsContent");
      openRelationshipForm(content, portalState, {
        mode: "edit",
        relationshipId: btn.dataset.id,
        contactId
      });
    });
  });

  container.querySelectorAll(".btn-delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this relationship?")) return;
      await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${btn.dataset.id}?project=${portalState.project}`,
        { method: "DELETE" }
      );
      await renderContactRelationshipsRelated(container, portalState, contactId);
    });
  });
}

// 🔧 Relationship Form (Add/Edit)
// Full, drop-in relationship form (mirrors Notes pattern)
async function openRelationshipForm(container, portalState, { mode, contactId, relationshipId, fixedSide }) {
  const projectId = portalState.project;
  if (!projectId) {
    container.innerHTML = `<section class="card"><p>Missing project.</p></section>`;
    return;
  }

  // Ensure escapeHtml exists locally
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Step 1: fetch relationship row if editing
  let relationship = null;
  if (mode === "edit" && relationshipId) {
    const res = await fetch(
      `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${encodeURIComponent(projectId)}`,
      { cache: "no-cache" }
    );
    const rows = await res.json().catch(() => []);
    relationship = Array.isArray(rows) ? rows[0] : rows; // handle array or single object
  }

  // Step 2: fetch contacts for name resolution (same approach as Notes)
  const contactsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${encodeURIComponent(projectId)}&limit=500`,
    { cache: "no-cache" }
  );
  const contacts = await contactsRes.json().catch(() => []);
  const contactMap = {};
  (Array.isArray(contacts) ? contacts : []).forEach(c => {
    const name = c.contact_name || `${c.first_name || ""} ${c.last_name || ""}`.trim();
    if (c.contact_id) contactMap[c.contact_id] = name || c.contact_id;
  });

  // Step 3: resolve IDs and names
  const sourceId  = relationship?.source_contact_id  || contactId || "";
  const relatedId = relationship?.related_contact_id || "";
  const sourceName  = contactMap[sourceId]  || sourceId || "(unknown)";
  const relatedName = contactMap[relatedId] || relatedId || "(unknown)";

  // Step 4: build form HTML
  container.innerHTML = `
    <section class="card">
      <h3>${mode === "edit" ? "Edit Relationship" : "Add Relationship"}</h3>
      <form id="relationshipForm">
        <div class="row" style="gap:12px; align-items:center;">
          <label style="min-width:160px;">Source contact</label>
          <input type="hidden" name="source_contact_id" value="${escapeHtml(sourceId)}">
          <span class="muted">${escapeHtml(sourceName)}</span>
        </div>

        <div class="row" style="gap:12px; align-items:center;">
          <label style="min-width:160px;">Related contact</label>
          <input type="hidden" name="related_contact_id" value="${escapeHtml(relatedId)}">
          <span class="muted">${escapeHtml(relatedName)}</span>
          <button type="button" class="secondary" id="btnPickRelated">Pick</button>
        </div>

        <div class="row" style="gap:12px;">
          <label style="min-width:160px;">Relationship type</label>
          <input type="text" name="relationship_type" value="${escapeHtml(relationship?.relationship_type || "")}" placeholder="e.g., referral, partner">
        </div>

        <div class="row" style="gap:12px;">
          <label style="min-width:160px;">Relationship role</label>
          <input type="text" name="relationship_role" value="${escapeHtml(relationship?.relationship_role || "")}" placeholder="e.g., source, target">
        </div>

        <div class="row" style="gap:12px; align-items:center;">
          <label style="min-width:160px;">Financial referral</label>
          <input type="checkbox" name="financial_referral" ${relationship?.financial_referral ? "checked" : ""}>
        </div>

        <div class="row" style="gap:12px;">
          <label style="min-width:160px;">Notes</label>
          <textarea name="notes" rows="3" style="width:100%;">${escapeHtml(relationship?.notes || "")}</textarea>
        </div>

        <div style="margin-top:16px; display:flex; gap:12px;">
          <button type="submit" class="btn-primary">${mode === "edit" ? "Save changes" : "Add relationship"}</button>
          <button type="button" class="btn-secondary" id="btnCancel">Cancel</button>
        </div>
      </form>

      <section id="relatedPicker" class="card" style="display:none; margin-top:16px;">
        <h4>Find related contact</h4>
        <div class="row" style="gap:8px; margin-bottom:8px;">
          <input id="rel-first" placeholder="First name">
          <input id="rel-last" placeholder="Last name">
          <button id="btnFindRel" class="primary">Find</button>
        </div>
        <div id="relResults" class="muted">(enter a name and click Find)</div>
      </section>
    </section>
  `;

  // Step 5: wire cancel
  document.getElementById("btnCancel")?.addEventListener("click", () => {
    renderContactRelationships(container, portalState, contactId);
  });

  // Step 6: wire pick related (inline search like Notes)
  document.getElementById("btnPickRelated")?.addEventListener("click", () => {
    const picker = document.getElementById("relatedPicker");
    picker.style.display = picker.style.display === "none" ? "block" : "none";
  });

  document.getElementById("btnFindRel")?.addEventListener("click", async () => {
    const first = document.getElementById("rel-first").value.trim();
    const last  = document.getElementById("rel-last").value.trim();

    if (!first && !last) { alert("Enter at least a first or last name."); return; }
    if ((first && first.length < 3) || (last && last.length < 3)) {
      alert("Names must be at least 3 characters.");
      return;
    }

    const filters = [`project.eq.${projectId}`];
    if (first) filters.push(`first_name.ilike.*${first}*`);
    if (last)  filters.push(`last_name.ilike.*${last}*`);

    const query = filters.length > 1 ? `and=(${filters.join(",")})` : filters[0];
    const url = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${query}&select=contact_id,first_name,last_name,email,contact_type`;

    try {
      const resp = await fetch(url);
      const rows = await resp.json();
      const relResults = document.getElementById("relResults");

      relResults.innerHTML = Array.isArray(rows) && rows.length > 0
        ? rows.map(r => {
            const fullName = `${r.first_name || ""} ${r.last_name || ""}`.trim();
            return `
              <div class="contact-result" data-id="${escapeHtml(r.contact_id)}" data-name="${escapeHtml(fullName)}" data-email="${escapeHtml(r.email || "")}">
                <strong>${escapeHtml(fullName)}</strong><br/>
                <small>${escapeHtml(r.email || "")}</small>
              </div>
            `;
          }).join("")
        : "<div class='muted'>No contacts found.</div>";

      // attach pick handlers
      relResults.querySelectorAll(".contact-result").forEach(el => {
        el.addEventListener("click", () => {
          const id = el.dataset.id;
          const name = el.dataset.name;

          const hidden = document.querySelector('input[name="related_contact_id"]');
          const label  = document.querySelector('input[name="related_contact_id"] + span');
          if (hidden) hidden.value = id || "";
          if (label)  label.textContent = name || "(unknown)";

          alert("✅ Related contact selected.");
        });
      });
    } catch (err) {
      alert("Network error searching contacts.");
      console.error(err);
    }
  });

  // Step 7: submit handler (POST for add, PATCH for edit)
  document.getElementById("relationshipForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const payload = {
      project: projectId,
      source_contact_id: fd.get("source_contact_id") || "",
      related_contact_id: fd.get("related_contact_id") || "",
      relationship_type: (fd.get("relationship_type") || "").trim(),
      relationship_role: (fd.get("relationship_role") || "").trim(),
      financial_referral: fd.get("financial_referral") === "on",
      notes: (fd.get("notes") || "").trim(),
      ...(mode === "add" ? { created_at: new Date().toISOString() } : {})
    };

    if (!payload.source_contact_id) { alert("Missing source contact."); return; }
    if (!payload.related_contact_id) { alert("Missing related contact."); return; }

    try {
      const url = mode === "edit"
        ? `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${encodeURIComponent(projectId)}`
        : `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${encodeURIComponent(projectId)}`;

      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      if (!res.ok) {
        alert(`❌ Save failed: ${text}`);
        return;
      }

        alert("✅ Relationship saved.");
        container.innerHTML = ""; // clear form layout
        await renderContactRelationships(container, portalState, contactId);
        container.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      alert("Error saving relationship: " + err.message);
      console.error(err);
    }
  });
}

async function renderContactNotes(container, portalState, contactId) {
  if (!portalState.project || !contactId) {
    container.innerHTML = `
      <section class="card">
        <h2>Contact Notes</h2>
        <p>Select a contact from the list first, then open Notes.</p>
      </section>
    `;
    return;
  }

  const url = `https://contacts-module.dennis-e64.workers.dev/notes_history?project=${portalState.project}&contact_id=${contactId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let notes = await res.json();
  if (!Array.isArray(notes)) notes = [];

  container.innerHTML = `
    <section class="card">
      <h2>Notes for Contact ${escapeHtml(contactId)}</h2>
      <table class="notes-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Subject</th>
            <th>Summary</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="notesRows">
          ${
            notes.length > 0
              ? notes.map((n, idx) => `
                  <tr>
                    <td>${escapeHtml(n.note_date || "")}</td>
                    <td>${escapeHtml(n.subject || "")}</td>
                    <td>${escapeHtml(n.summary || "")}</td>
                    <td>
                      <button class="btn-secondary btn-expand" data-idx="${idx}" style="display:flex; align-items:center; gap:4px;">
                        ▶ Expand
                      </button>
                    </td>
                  </tr>
                  <tr class="note-details" data-idx="${idx}" style="display:none;">
                    <td colspan="4" style="background:#f9f9f9; padding:12px;">
                      <div><strong>From:</strong> ${escapeHtml(n.from_name || "")} (${escapeHtml(n.from_email || "")})</div>
                      <div><strong>Status:</strong> ${escapeHtml(n.review_status || "")}</div>
                      <div><strong>Needs Review:</strong> ${n.needs_review ? "Yes" : "No"}</div>
                      <div style="margin-top:8px;"><strong>Raw Text:</strong></div>
                      <pre style="white-space:pre-wrap; background:#fff; padding:8px; border:1px solid #ccc;">${escapeHtml(n.raw_text || "")}</pre>
                      <button class="btn-danger btn-delete-note" data-id="${n.id}" style="margin-top:8px;">Delete Note</button>
                    </td>
                  </tr>
                `).join("")
              : `<tr><td colspan="4">(no notes yet)</td></tr>`
          }
        </tbody>
      </table>
    </section>
  `;

  // Wire expand/collapse buttons
  container.querySelectorAll(".btn-expand").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.idx;
      const row = container.querySelector(`.note-details[data-idx="${idx}"]`);
      const isVisible = row.style.display !== "none";
      row.style.display = isVisible ? "none" : "table-row";
      btn.innerHTML = isVisible ? "▶ Expand" : "▼ Collapse";
    });
  });

  // Wire delete buttons
  container.querySelectorAll(".btn-delete-note").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this note?")) return;
      const noteId = btn.dataset.id;
      await fetch(`https://contacts-module.dennis-e64.workers.dev/notes_history/${noteId}?project=${portalState.project}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });
      await renderContactNotes(container, portalState, contactId); // reload
    });
  });
}


// helper
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}
