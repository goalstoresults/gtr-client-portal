// js/contacts.js v1.5
// 🔧 Load Contacts Tab with subtab switching
export async function loadContactsTab({ portalState, tabContent }) {
  // Load base HTML template
  const res = await fetch("./components/contacts.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

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
          // ✅ Reset filters safely (no optional chaining on assignment)
          const fFirst = document.getElementById("filter-first");
          const fLast  = document.getElementById("filter-last");
          const fFrom  = document.getElementById("filter-from");
          const fTo    = document.getElementById("filter-to");
          if (fFirst) fFirst.value = "";
          if (fLast)  fLast.value  = "";
          if (fFrom)  fFrom.value  = "";
          if (fTo)    fTo.value    = "";

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

  // ✅ Default to List view when tab first loads
  const defaultBtn = tabContent.querySelector('#contacts-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderContactList(content, portalState);
  }
}

// 🔧 Contact List with client-side filters + sticky filter values
async function renderContactList(container, portalState) {
  try {
    // --- Step 1: Capture current filter values before rebuild ---
    const prevFirst = document.getElementById("filter-first")?.value.trim() || "";
    const prevLast  = document.getElementById("filter-last")?.value.trim() || "";
    const prevBiz   = document.getElementById("filter-business")?.value.trim() || "";
    const prevType  = document.getElementById("filter-contact-type")?.value || "";

    // --- Step 2: Build base UI with preserved values ---
    container.innerHTML = `
      <section class="card">
        <h2>Contact List for ${escapeHtml(portalState.display_name || portalState.project)}</h2>
        <div id="contactsFilters" style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <label>First: <input type="text" id="filter-first" value="${escapeHtml(prevFirst)}" /></label>
          <label>Last: <input type="text" id="filter-last" value="${escapeHtml(prevLast)}" /></label>
          <label>Business: <input type="text" id="filter-business" value="${escapeHtml(prevBiz)}" /></label>
          <label>Contact Type:
            <select id="filter-contact-type" class="form-control" style="min-width:160px;">
              <option value="">ALL</option>
            </select>
          </label>
          <button id="btnApplyContactsFilter" class="secondary">Apply Filter</button>
          <button id="btnClearContactsFilter" class="secondary">Clear Filter</button>
        </div>
        <div id="contactTable">Loading...</div>
      </section>
    `;

    const tableDiv = container.querySelector("#contactTable");
    const typeSelect = document.getElementById("filter-contact-type");

    // --- Step 3: Populate Contact Type dropdown, preserve selection ---
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

    // --- Step 4: Fetch contacts (always limit 500) ---
    const params = new URLSearchParams({
      project: portalState.project,
      order: portalState.contactsSort?.order || "created_at.desc",
      limit: "500"
    });
    const url = `https://contacts-module.dennis-e64.workers.dev/contacts/list?${params}`;
    console.log("[Contacts] Fetching:", url);

    const resList = await fetch(url, { cache: "no-cache" });
    let contacts = await resList.json();
    if (!Array.isArray(contacts)) contacts = [];

    // --- Step 5: Apply client-side filters ---
    const first = prevFirst;
    const last  = prevLast;
    const biz   = prevBiz;
    const type  = prevType;

    if (first && first.length >= 3) {
      const term = first.toLowerCase();
      contacts = contacts.filter(c => (c.first_name || "").toLowerCase().includes(term));
    }
    if (last && last.length >= 3) {
      const term = last.toLowerCase();
      contacts = contacts.filter(c => (c.last_name || "").toLowerCase().includes(term));
    }
    if (biz && biz.length >= 3) {
      const term = biz.toLowerCase();
      contacts = contacts.filter(c => (c.business_name || "").toLowerCase().includes(term));
    }
    if (type) {
      contacts = contacts.filter(c => c.contact_type === type);
    }

    // --- Step 6: Sort client-side ---
    if (!portalState.contactsSort) {
      portalState.contactsSort = { column: "created_at", direction: "desc" };
    }
    function sortContacts(list, column, direction) {
      return [...list].sort((a, b) => {
        let va = a[column] || "";
        let vb = b[column] || "";
        if (column === "created_at") {
          va = new Date(va);
          vb = new Date(vb);
        } else {
          va = va.toString().toLowerCase();
          vb = vb.toString().toLowerCase();
        }
        if (va < vb) return direction === "asc" ? -1 : 1;
        if (va > vb) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    const sortedContacts = sortContacts(contacts, portalState.contactsSort.column, portalState.contactsSort.direction);

    // --- Step 7: Build table UI ---
    tableDiv.innerHTML = `
      <h4>Showing ${sortedContacts.length} ${first||last||biz||type ? "filtered" : "recent"} contacts</h4>
      <table class="notes-table">
        <thead>
          <tr>
            <th>
              Name
              <button class="sort-btn" data-col="contact_name" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="contact_name" data-dir="desc">▼</button>
            </th>
            <th>
              Email
              <button class="sort-btn" data-col="email" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="email" data-dir="desc">▼</button>
            </th>
            <th>
              Business Name
              <button class="sort-btn" data-col="business_name" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="business_name" data-dir="desc">▼</button>
            </th>
            <th>
              Contact Type
              <button class="sort-btn" data-col="contact_type" data-dir="asc">▲</button>
              <button class="sort-btn" data-col="contact_type" data-dir="desc">▼</button>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${sortedContacts.length > 0
            ? sortedContacts.map(c => `
                <tr>
                  <td>${escapeHtml(c.contact_name || "")}</td>
                  <td>${escapeHtml(c.email || "")}</td>
                  <td>${escapeHtml(c.business_name || "")}</td>
                  <td>${escapeHtml(c.contact_type || "")}</td>
                  <td>
                    <button class="btn-primary btn-select" data-id="${c.contact_id}">Select</button>
                  </td>
                </tr>
              `).join("")
            : `<tr><td colspan="5">(no contacts found)</td></tr>`
          }
        </tbody>
      </table>
    `;

    // --- Step 8: Wire actions ---
    tableDiv.querySelectorAll(".btn-select").forEach(btn => {
      btn.addEventListener("click", async () => {
        const contactId = btn.dataset.id;
        portalState.selectedContactId = contactId;   // ✅ store active contact
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
        await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/delete/${contactId}?project=${portalState.project}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" }
        });
        await renderContactList(container, portalState);
      });
    });

    // Filter buttons
    document.getElementById("btnApplyContactsFilter").addEventListener("click", () => {
      // Re‑render with current values preserved
      renderContactList(container, portalState);
    });

    document.getElementById("btnClearContactsFilter").addEventListener("click", () => {
      document.getElementById("filter-first").value = "";
      document.getElementById("filter-last").value = "";
      document.getElementById("filter-business").value = "";
      document.getElementById("filter-contact-type").value = "";
      renderContactList(container, portalState);
    });

    // Sort buttons
    tableDiv.querySelectorAll(".sort-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const col = btn.dataset.col;
        const dir = btn.dataset.dir;
        portalState.contactsSort = { column: col, direction: dir };
        renderContactList(container, portalState);
      });
    });

  } catch (err) {
    container.innerHTML = `<h4>Contacts</h4><p>Error loading contacts: ${escapeHtml(err.message)}</p>`;
    console.error(err);
  }
}


      


// 🔧 Dynamic Add Contact Form with collapsible sections + defaults
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
    details.open = true;

    const summary = document.createElement("summary");
    summary.textContent = section;
    summary.className = "section-title";
    details.appendChild(summary);

    for (const f of sectionFields) {
      const wrapper = document.createElement("div");
      wrapper.className = "notes-row";

      const label = document.createElement("label");
      label.textContent = f.label || f.field_key;
      label.className = "notes-label";

      let input;

      if (f.field_key === "group_id") {
        // Special case: dropdown bound to groups table
        input = document.createElement("select");
        input.name = "group_id";
        input.className = "form-control";

        fetch(`https://groups-module.dennis-e64.workers.dev/groups/list?project=${projectId}`)
          .then(r => r.json())
          .then(data => {
            console.log("✅ Groups response:", data);

            const rows = Array.isArray(data.rows)
              ? data.rows
              : Array.isArray(data)
              ? data
              : [];

            if (rows.length === 0) {
              console.warn("Groups fetch returned no rows:", data);
              return;
            }

            // Sort alphabetically by group_name
            rows.sort((a, b) => (a.group_name || "").localeCompare(b.group_name || ""));

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "-- Select Group --";
            input.appendChild(placeholder);

            rows.forEach(g => {
              const opt = document.createElement("option");
              opt.value = g.group_id;        // foreign key stored
              opt.textContent = g.group_name; // human-readable name shown
              input.appendChild(opt);
            });
          });
      } else if (f.lookup_type) {
        // Dropdown bound to lookup group
        input = document.createElement("select");
        input.name = f.field_key;
        input.className = "form-control";

        fetch(`https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=${f.lookup_type}&project=${projectId}`)
          .then(r => r.json())
          .then(values => {
            if (!Array.isArray(values)) {
              console.warn("Lookup fetch failed:", values);
              return;
            }

            // Sort alphabetically by label/value
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

// 🔧 Render Contact Details with search_name header + Delete button near header
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
  const fields = Array.isArray(fieldsData.rows) ? fieldsData.rows : [];
  fields.sort((a, b) => a.sort_order - b.sort_order);

  // Header value: prefer search_name, fallback to contact_id
  const headerName = contact.search_name || contact.contact_id;

  // Base container
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

  // Handle Delete button
  document.getElementById("btnDeleteContact").addEventListener("click", async () => {
    if (!confirm("Delete this contact?")) return;
    await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/delete/${contactId}?project=${portalState.project}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });
    alert("Contact deleted.");
    // Return to list view
    const listBtn = document.querySelector('#contacts-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#contactsContent");
      await renderContactList(content, portalState);
    }
  });
}

// Render relationships grid (source or related)
async function renderContactRelationships(container, portalState, contactId) {
  const projectId = portalState.project;
  if (!projectId) {
    container.innerHTML = `<section class="card"><p>No project selected.</p></section>`;
    return;
  }

  // Fetch relationships for this contact (both source and related)
  const res = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contact_relationships?project=${projectId}&source_contact_id=${contactId}&related_contact_id=${contactId}`,
    { cache: "no-cache" }
  );
  let rows = await res.json();
  if (!Array.isArray(rows)) rows = [];

  // Build table
  let html = `
    <section class="card">
      <h3>Relationships</h3>
      <table class="grid">
        <thead>
          <tr>
            <th>Source Contact</th>
            <th>Related Contact</th>
            <th>Type</th>
            <th>Role</th>
            <th>Financial Referral</th>
            <th>Notes</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
  `;

  rows.forEach(row => {
    const sourceName  = row.source_contact?.contact_name || row.source_contact_id;
    const relatedName = row.related_contact?.contact_name || row.related_contact_id;

    html += `
      <tr>
        <td>${escapeHtml(sourceName)}</td>
        <td>${escapeHtml(relatedName)}</td>
        <td>${escapeHtml(row.relationship_type || "")}</td>
        <td>${escapeHtml(row.relationship_role || "")}</td>
        <td>${row.financial_referral ? "Yes" : "No"}</td>
        <td>${escapeHtml(row.notes || "")}</td>
        <td>${escapeHtml(row.created_at || "")}</td>
        <td>
          <button class="btn-small" onclick="openRelationshipForm(container, portalState, { mode: 'edit', contactId: '${contactId}', relationshipId: '${row.id}', fixedSide: 'source' })">Edit</button>
          <button class="btn-small btn-danger" onclick="deleteRelationship('${row.id}', '${projectId}', container, portalState, '${contactId}')">Delete</button>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <button class="btn-primary" onclick="openRelationshipForm(container, portalState, { mode: 'add', contactId: '${contactId}', fixedSide: 'source' })">Add Relationship</button>
    </section>
  `;

  container.innerHTML = html;
}

// Helper: delete relationship
async function deleteRelationship(relId, projectId, container, portalState, contactId) {
  if (!confirm("Delete this relationship?")) return;
  const res = await fetch(`https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relId}?project=${projectId}`, {
    method: "DELETE"
  });
  if (res.ok) {
    alert("Relationship deleted.");
    await renderContactRelationships(container, portalState, contactId);
  } else {
    const text = await res.text();
    alert("Delete failed: " + text);
  }
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

  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      openRelationshipForm(container, portalState, {
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

  container.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      openRelationshipForm(container, portalState, {
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
async function openRelationshipForm(container, portalState, { mode, fixedSide, contactId, relationshipId }) {
  const projectId = portalState.project;
  if (!projectId) {
    container.innerHTML = `<section class="card"><p>No project selected.</p></section>`;
    return;
  }

  // Fetch existing row if editing
  let existing = null;
  if (mode === "edit" && relationshipId) {
    const res = await fetch(
      `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${projectId}`,
      { cache: "no-cache" }
    );
    const data = await res.json();
    existing = Array.isArray(data) ? data[0] : data;
  }

  // Build form UI
  container.innerHTML = `
    <section class="card">
      <h3>${mode === "add" ? "Add Relationship" : "Edit Relationship"}</h3>
      <form id="relationshipForm" class="notes-form">
        <div class="notes-row">
          <label>Relationship Type</label>
          <select name="relationship_type" id="relType" class="form-control"></select>
        </div>
        <div class="notes-row">
          <label>Relationship Role</label>
          <select name="relationship_role" id="relRole" class="form-control"></select>
        </div>
        <div class="notes-row">
          <label>${fixedSide === "source" ? "Related Contact" : "Source Contact"}</label>
          <input type="text" id="searchName" placeholder="Enter first/last name (min 3 chars)" class="form-control" />
          <button type="button" id="btnFindContact" class="secondary">Find</button>
          <select id="contactSelect" class="form-control" style="margin-top:8px;">
            <option value="">-- Select Contact --</option>
          </select>
        </div>
        <div class="notes-row">
          <label>Notes</label>
          <input type="text" name="notes" class="form-control"
                 value="${escapeHtml(existing?.notes || "")}" />
        </div>
        <div class="notes-row">
          <label>
            <input type="checkbox" name="financial_referral" value="true" ${existing?.financial_referral ? "checked" : ""}/>
            Financial Referral
          </label>
        </div>
        <button type="submit" class="btn-primary">
          ${mode === "add" ? "Save Relationship" : "Update Relationship"}
        </button>
      </form>
    </section>
  `;

  // Populate dropdowns from lookups
  async function populateLookup(selectEl, lookupType, currentValue) {
    const res = await fetch(
      `https://lookups-module.dennis-e64.workers.dev/lookups?project=${projectId}&lookup_type=${lookupType}`
    );
    const values = await res.json();
    if (Array.isArray(values)) {
      values.sort((a, b) => (a.label || a.value || "").localeCompare(b.label || b.value || ""));
      selectEl.innerHTML = `<option value="">-- Select --</option>`;
      values.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.value;
        opt.textContent = v.label || v.value;
        if (currentValue === v.value) opt.selected = true;
        selectEl.appendChild(opt);
      });
    }
  }

  await populateLookup(document.getElementById("relType"), "relationship_type", existing?.relationship_type);
  await populateLookup(document.getElementById("relRole"), "relationship_role", existing?.relationship_role);

  // Wire up contact search
  const btnFind = document.getElementById("btnFindContact");
  const contactSelect = document.getElementById("contactSelect");
  btnFind.addEventListener("click", async () => {
    const term = document.getElementById("searchName").value.trim().toLowerCase();
    if (term.length < 3) {
      alert("Enter at least 3 characters to search.");
      return;
    }

    const res = await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${projectId}&limit=500`);
    let contacts = await res.json();
    if (!Array.isArray(contacts)) contacts = [];

    const matches = contacts.filter(c =>
      (c.first_name || "").toLowerCase().includes(term) ||
      (c.last_name || "").toLowerCase().includes(term)
    );

    contactSelect.innerHTML = `<option value="">-- Select Contact --</option>`;
    matches.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.contact_id;
      opt.textContent = `${c.first_name || ""} ${c.last_name || ""} (${c.email || ""})`;
      contactSelect.appendChild(opt);
    });

    if (matches.length === 1) {
      contactSelect.value = matches[0].contact_id;
    }
  });

  // Handle submit
  const form = container.querySelector("#relationshipForm");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(form);

    const payload = {
      project: projectId,
      relationship_type: fd.get("relationship_type") || null,
      relationship_role: fd.get("relationship_role") || null,
      notes: fd.get("notes") || "",
      financial_referral: fd.get("financial_referral") ? true : false
    };

    if (fixedSide === "source") {
      payload.source_contact_id = contactId;
      payload.related_contact_id = contactSelect.value;
    } else {
      payload.related_contact_id = contactId;
      payload.source_contact_id = contactSelect.value;
    }

    try {
      if (mode === "add") {
        payload.id = crypto.randomUUID();
        payload.created_at = new Date().toISOString();

        const res = await fetch("https://contacts-module.dennis-e64.workers.dev/contact_relationships", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const resultText = await res.text();
        alert(res.ok ? "Relationship added." : `Add failed: ${resultText}`);
      } else {
        const updates = { ...payload };
        const res = await fetch("https://contacts-module.dennis-e64.workers.dev/contact_relationships", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: relationshipId, project: projectId, updates })
        });
        const resultText = await res.text();
        alert(res.ok ? "Relationship updated." : `Update failed: ${resultText}`);
      }

      await renderContactRelationships(container, portalState, contactId);
    } catch (err) {
      alert("Error saving relationship: " + err.message);
      console.error("Relationship save error", err);
    }
  });
}


// helper
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}
