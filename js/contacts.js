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
async function renderContactList(container, portalState) {
  try {
    // --- Step 1: Capture previous filter values ---
    const prevFirst    = document.getElementById("filter-first")?.value.trim() || "";
    const prevLast     = document.getElementById("filter-last")?.value.trim() || "";
    const prevBusiness = document.getElementById("filter-business")?.value.trim() || "";
    const prevType     = document.getElementById("filter-contact-type")?.value || "";

    // --- Step 2: Build UI ---
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
    const resTypes = await fetch(
      `https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=contact_type&project=${portalState.project}`
    );
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

    // --- Sorting state ---
    let currentSortField = null;
    let currentSortDirection = "asc";
    let contacts = [];
    let listFields = [];

    // --- Step 4: Apply filter ---
    async function applyFilter() {
      const first    = document.getElementById("filter-first").value.trim();
      const last     = document.getElementById("filter-last").value.trim();
      const business = document.getElementById("filter-business").value.trim();
      const type     = document.getElementById("filter-contact-type").value;
    
      // ✅ Allow search if first OR last has at least 1 character
      const hasMinimumInput = first.length >= 1 || last.length >= 1 || business.length >= 1 || type;
    
      if (!hasMinimumInput) {
        tableDiv.innerHTML = `<p>(no contacts found — enter at least 1 character in First or Last)</p>`;
        return;
      }
    
      const params = new URLSearchParams({
        project: portalState.project,
        first,
        last,
        business
      });
    
      const url = `https://contacts-module.dennis-e64.workers.dev/contacts/search?${params}`;
      const resList = await fetch(url, { cache: "no-cache" });
      contacts = await resList.json();
      if (!Array.isArray(contacts)) contacts = [];
    
      if (type) contacts = contacts.filter(c => c.contact_type === type);
    
      // Fetch dynamic field config
      const fieldsRes = await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contact_fields?project=${portalState.project}`,
        { cache: "no-cache" }
      );
      const fieldsData = await fieldsRes.json();
      const fields = Array.isArray(fieldsData.rows) ? fieldsData.rows : [];
      fields.sort((a, b) => a.sort_order - b.sort_order);
    
      listFields = fields.filter(f => f.contact_tab === "list");
    
      renderSortedTable();
    }


    // --- Step 5: Render sorted table ---
function renderSortedTable() {
  const sorted = [...contacts];

  if (currentSortField) {
    sorted.sort((a, b) => {
      const valA = (a[currentSortField] || "").toLowerCase();
      const valB = (b[currentSortField] || "").toLowerCase();
      return currentSortDirection === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    });
  }

  // ✅ Always show both arrows (△▽), bold the active one (▲▼)
  const headers = listFields.map(f => {
    const isSorted = currentSortField === f.field_key;

    const upArrow   = isSorted && currentSortDirection === "asc"  ? "▲" : "△";
    const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

    return `
      <th class="sortable" data-field="${f.field_key}">
        ${escapeHtml(f.label || f.field_key)}
        <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
          <span class="sort-up">${upArrow}</span>
          <span class="sort-down">${downArrow}</span>
        </span>
      </th>
    `;
  }).join("");

  // ✅ ROW RENDERER — THIS IS WHERE updated_at GETS FORMATTED
  const rows = sorted.map(c => {
    const cells = listFields.map(f => {
      const key = f.field_key;

      // ✅ Format updated_at using your helper
      if (key === "updated_at") {
        return `<td>${formatDateTime(c.updated_at)}</td>`;
      }

      // ✅ Default: escape and print normally
      return `<td>${escapeHtml(c[key] || "")}</td>`;
    }).join("");

    return `
      <tr>
        ${cells}
        <td><button class="btn-primary btn-select" data-id="${c.contact_id}">Select</button></td>
      </tr>
    `;
  }).join("");

  tableDiv.innerHTML = `
    <h4>Showing ${sorted.length} contacts</h4>
    <table class="notes-table">
      <thead><tr>${headers}<th>Actions</th></tr></thead>
      <tbody>
        ${rows || `<tr><td colspan="${listFields.length + 1}">(no contacts found)</td></tr>`}
      </tbody>
    </table>
  `;

  // ✅ Wire select buttons
  tableDiv.querySelectorAll(".btn-select").forEach(btn => {
    btn.addEventListener("click", async () => {
      const contactId = btn.dataset.id;
      portalState.selectedContactId = contactId;

      const res = await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contacts/details/${contactId}`,
        { cache: "no-cache" }
      );
      const data = await res.json();
      const contact = Array.isArray(data) ? data[0] : data;

      portalState.selectedContactName =
        contact.search_name ||
        `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

      const contextBar = document.getElementById("contact-context-bar");
      if (contextBar) contextBar.textContent = `Contact: ${portalState.selectedContactName}`;

      document.querySelectorAll("#contacts-subtabs button").forEach(b => b.classList.remove("active"));
      const detailsBtn = document.querySelector('#contacts-subtabs button[data-subtab="details"]');
      if (detailsBtn) detailsBtn.classList.add("active");

      const content = document.querySelector("#contactsContent");
      await renderContactDetails(content, portalState, contactId);
    });
  });

  // ✅ Wire sortable headers
  tableDiv.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.field;

      if (currentSortField === field) {
        currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
      } else {
        currentSortField = field;
        currentSortDirection = "asc";
      }

      renderSortedTable();
    });
  });
}


    // --- Step 6: Wire filter buttons ---
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
          <div class="form-header" style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
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
      <h3>Relationships pointing to this contact</h3>
      <p style="font-size:0.9em; color:#666; margin-bottom:8px;">
        These relationships originate from other contacts. To modify them, visit the source contact.
      </p>
      <div id="contactRelRelatedGrid"></div>
    </section>

    <section class="card" style="margin-top:16px;">
      <div id="contactRelReferralGrid"></div>
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

  await renderContactRelationshipsReferralSummary(
    container.querySelector("#contactRelReferralGrid"),
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
}



// ✅ SOURCE GRID — FULLY EDITABLE
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
                <td>${formatDateTime(r.created_at)}</td>
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

  // ✅ Edit
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

  // ✅ Delete
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



// ✅ RELATED GRID — READ‑ONLY (NO ADD, NO EDIT, NO DELETE)
async function renderContactRelationshipsRelated(container, portalState, contactId) {
  const url = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${portalState.project}&related_contact_id=${contactId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let rows = await res.json();
  if (!Array.isArray(rows)) rows = [];

  // ✅ EXCLUDE REFERRALS
  rows = rows.filter(r => (r.relationship_type || "").toLowerCase() !== "referral");

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
                <td>${formatDateTime(r.created_at)}</td>
                <td style="color:#999;">—</td>
              </tr>
            `).join("")
          : `<tr><td colspan="6">(no relationships)</td></tr>`
        }
      </tbody>
    </table>
  `;
}

async function renderContactRelationshipsReferralSummary(container, portalState, contactId) {
  const base = `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${portalState.project}`;

  const [asSourceRes, asRelatedRes] = await Promise.all([
    fetch(`${base}&source_contact_id=${contactId}`, { cache: "no-cache" }),
    fetch(`${base}&related_contact_id=${contactId}`, { cache: "no-cache" })
  ]);

  let asSource = await asSourceRes.json();
  let asRelated = await asRelatedRes.json();

  if (!Array.isArray(asSource)) asSource = [];
  if (!Array.isArray(asRelated)) asRelated = [];

  // ✅ Only referrals
  let all = [...asSource, ...asRelated].filter(
    r => (r.relationship_type || "").toLowerCase() === "referral"
  );

  const combined = [];

  for (const r of all) {
    const sourceId = r.source_contact_id;
    const relatedId = r.related_contact_id;

    const sourceName = r.source_contact_name || sourceId;
    const relatedName = r.related_contact_name || relatedId;

    // ✅ Your rules:
    // Referred By = related_contact
    // Referred To = source_contact
    const referredBy = relatedName;
    const referredTo = sourceName;

    let direction;

    // ✅ Direction based ONLY on which column the current contact is in
    if (String(contactId) === String(sourceId)) {
      direction = "Inbound";   // this contact was referred TO
    } else if (String(contactId) === String(relatedId)) {
      direction = "Outbound";  // this contact referred someone else
    } else {
      continue; // shouldn't happen, but safety
    }

    combined.push({
      direction,
      referredBy,
      referredTo,
      financial: r.financial_referral,
      created: r.created_at
    });
  }

  const inboundCount = combined.filter(r => r.direction === "Inbound").length;
  const outboundCount = combined.filter(r => r.direction === "Outbound").length;

  container.innerHTML = `
    <h3 style="margin-bottom:4px;">
      Referral Summary
      <span style="font-size:0.85em; color:#666;">
        (Inbound: ${inboundCount}, Outbound: ${outboundCount})
      </span>
    </h3>

    <div style="font-size:0.85em; color:#666; margin-bottom:10px;">
      Inbound = this contact was <strong>referred to</strong> by someone.<br>
      Outbound = this contact <strong>referred someone else</strong>.
    </div>

    <table class="notes-table">
      <thead>
        <tr>
          <th>Direction</th>
          <th>Referred By</th>
          <th>Referred To</th>
          <th>Financial</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${combined.length > 0
          ? combined.map(r => `
              <tr>
                <td>${escapeHtml(r.direction)}</td>
                <td>${escapeHtml(r.referredBy)}</td>
                <td>${escapeHtml(r.referredTo)}</td>
                <td>${r.financial ? "✅" : ""}</td>
                <td>${formatDateTime(r.created)}</td>
              </tr>
            `).join("")
          : `<tr><td colspan="5">(no referrals)</td></tr>`
        }
      </tbody>
    </table>
  `;
}






// 🔧 Relationship Form (Add/Edit)
// Full, drop-in relationship form (mirrors Notes pattern)
async function openRelationshipForm(container, portalState, opts) {
  const { mode, contactId, relationshipId, fixedSide } = opts;
  const project = portalState.project;

  if (!project) {
    container.innerHTML = `<section class="card"><p>Missing project.</p></section>`;
    return;
  }

  let existing = null;

  /* =========================================================
     STEP 1 — LOAD EXISTING RELATIONSHIP (EDIT MODE)
  ========================================================= */
  if (mode === "edit" && relationshipId) {
    const res = await fetch(
      `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${project}`,
      { cache: "no-cache" }
    );
    const data = await res.json();
    existing = Array.isArray(data) ? data[0] : data;
  }

  /* =========================================================
     STEP 2 — RENDER FORM UI
  ========================================================= */
  container.innerHTML = `
    <section class="card">
      <h3>${mode === "edit" ? "Edit Relationship" : "Add Relationship"}</h3>

      <form id="relForm" class="notes-form">

        <div class="notes-row">
          <label class="notes-label">Source Contact</label>
          <input type="text" id="relSourceName" class="form-control" disabled />
        </div>

        <div class="notes-row">
          <label class="notes-label">Related Contact</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="relRelatedName" class="form-control" disabled />
            <button type="button" id="btnPickRelated" class="btn-secondary">Pick</button>
          </div>
        </div>

        <div class="notes-row">
          <label class="notes-label">Relationship Type</label>
          <select id="relType" class="form-control">
            <option value="">-- Select Type --</option>
            <option value="Referral">Referral</option>
            <option value="Family">Family</option>
            <option value="Friend">Friend</option>
            <option value="Coworker">Coworker</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div class="notes-row">
          <label class="notes-label">Relationship Role</label>
          <select id="relRole" class="form-control">
            <option value="">-- Select Role --</option>
            <option value="Referred By">Referred By</option>
            <option value="Referred To">Referred To</option>
            <option value="Parent">Parent</option>
            <option value="Child">Child</option>
            <option value="Sibling">Sibling</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div class="notes-row">
          <label class="notes-label">Financial Referral</label>
          <input type="checkbox" id="relFinancial" />
        </div>

        <div class="notes-row">
          <label class="notes-label">Notes</label>
          <textarea id="relNotes" class="form-control" rows="3"></textarea>
        </div>

        <button type="submit" class="btn-primary">${mode === "edit" ? "Save Changes" : "Add Relationship"}</button>
        <button type="button" id="btnCancelRel" class="btn-secondary">Cancel</button>

      </form>
    </section>
  `;

  /* =========================================================
     STEP 3 — WIRE FORM ELEMENTS
  ========================================================= */
  const form = document.getElementById("relForm");
  const typeSelect = document.getElementById("relType");
  const roleSelect = document.getElementById("relRole");
  const financialCheckbox = document.getElementById("relFinancial");
  const notesInput = document.getElementById("relNotes");

  const sourceInput = document.getElementById("relSourceName");
  const relatedInput = document.getElementById("relRelatedName");

  let sourceId = contactId;
  let relatedId = null;

  /* =========================================================
     STEP 4 — POPULATE EXISTING VALUES (EDIT MODE)
  ========================================================= */
  if (existing) {
    sourceId = existing.source_contact_id;
    relatedId = existing.related_contact_id;

    typeSelect.value = existing.relationship_type || "";
    roleSelect.value = existing.relationship_role || "";
    financialCheckbox.checked = !!existing.financial_referral;
    notesInput.value = existing.notes || "";
  }

  /* =========================================================
     STEP 5 — LOAD CONTACT NAMES
  ========================================================= */
  async function loadContactName(id, inputEl) {
    if (!id) return;
    const res = await fetch(
      `https://contacts-module.dennis-e64.workers.dev/contacts/details/${id}`,
      { cache: "no-cache" }
    );
    const data = await res.json();
    const c = Array.isArray(data) ? data[0] : data;
    inputEl.value = c?.search_name || "(unknown)";
  }

  await loadContactName(sourceId, sourceInput);
  if (relatedId) await loadContactName(relatedId, relatedInput);

  /* =========================================================
     STEP 6 — AUTO‑CHECK FINANCIAL REFERRAL WHEN TYPE = REFERRAL
  ========================================================= */
  typeSelect.addEventListener("change", () => {
    if (typeSelect.value === "Referral") {
      financialCheckbox.checked = true;
    }
  });

  /* =========================================================
     STEP 7 — PICK RELATED CONTACT
  ========================================================= */
  document.getElementById("btnPickRelated").addEventListener("click", () => {
    openContactPicker(container, portalState, (picked) => {
      relatedId = picked.contact_id;
      relatedInput.value = picked.search_name;
    });
  });

  /* =========================================================
     STEP 8 — CANCEL BUTTON
  ========================================================= */
  document.getElementById("btnCancelRel").addEventListener("click", () => {
    renderContactRelationships(container, portalState, contactId);
  });

  /* =========================================================
     STEP 9 — SUBMIT HANDLER (ADD OR EDIT)
  ========================================================= */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      project,
      source_contact_id: sourceId,
      related_contact_id: relatedId,
      relationship_type: typeSelect.value,
      relationship_role: roleSelect.value || null,
      financial_referral: financialCheckbox.checked,
      notes: notesInput.value || null
    };

    const url =
      mode === "edit"
        ? `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${project}`
        : `https://contacts-module.dennis-e64.workers.dev/contact_relationships`;

    const method = mode === "edit" ? "PATCH" : "POST";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    await renderContactRelationships(container, portalState, contactId);
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
      <h2>Notes</h2>
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

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

// helper
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}
