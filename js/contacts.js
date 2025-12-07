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

async function openRelationshipForm(container, portalState, { mode, fixedSide, contactId, relationshipId }) {
  const projectId = portalState.project;
  if (!projectId) {
    alert("No project selected.");
    return;
  }

  // Remove any existing form
  const oldForm = container.querySelector("#relationshipForm");
  if (oldForm) oldForm.closest("section").remove();

  let existing = null;
  if (mode === "edit" && relationshipId) {
    const res = await fetch(
      `https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${projectId}`,
      { cache: "no-cache" }
    );
    existing = await res.json();
    if (Array.isArray(existing)) existing = existing[0];
  }

  const formDiv = document.createElement("div");
  formDiv.innerHTML = `
    <section class="card">
      <h3>${mode === "add" ? "Add Relationship" : "Edit Relationship"}</h3>
      <form id="relationshipForm" class="notes-form">
        <div class="notes-row">
          <label>Relationship Type</label>
          <input type="text" name="relationship_type" class="form-control"
                 value="${escapeHtml(existing?.relationship_type || "")}" />
        </div>
        <div class="notes-row">
          <label>Relationship Role</label>
          <input type="text" name="relationship_role" class="form-control"
                 value="${escapeHtml(existing?.relationship_role || "")}" />
        </div>
        <div class="notes-row">
          <label>${fixedSide === "source" ? "Related Contact ID" : "Source Contact ID"}</label>
          <input type="text" name="${fixedSide === "source" ? "related_contact_id" : "source_contact_id"}"
                 class="form-control"
                 value="${escapeHtml(existing?.related_contact_id || existing?.source_contact_id || "")}" />
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

  container.prepend(formDiv);

  const form = formDiv.querySelector("#relationshipForm");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(form);

    // Normalize checkbox
    const financialReferral = formData.get("financial_referral") === "true";

    const payload = {
      relationship_type: formData.get("relationship_type"),
      relationship_role: formData.get("relationship_role"),
      financial_referral: financialReferral
    };

    if (fixedSide === "source") {
      payload.source_contact_id = contactId;
      payload.related_contact_id = formData.get("related_contact_id");
    } else {
      payload.related_contact_id = contactId;
      payload.source_contact_id = formData.get("source_contact_id");
    }

    try {
      if (mode === "add") {
        payload.id = crypto.randomUUID();       // include id on insert
        payload.project = projectId;            // include project on insert
        payload.created_at = new Date().toISOString();
        await fetch("https://contacts-module.dennis-e64.workers.dev/contact_relationships", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        // For edit, strip id/project from body, they’re in URL filter
        const editPayload = { ...payload };
        await fetch(`https://contacts-module.dennis-e64.workers.dev/contact_relationships/${relationshipId}?project=${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editPayload)
        });
      }

      alert("Relationship saved.");

      // Refresh only the relevant grid, not the whole tab
      if (fixedSide === "source") {
        await renderContactRelationshipsSource(
          container.querySelector("#contactRelSourceGrid"),
          portalState,
          contactId
        );
      } else {
        await renderContactRelationshipsRelated(
          container.querySelector("#contactRelRelatedGrid"),
          portalState,
          contactId
        );
      }
    } catch (err) {
      alert("Error saving relationship: " + err.message);
    }
  });
}


// helper
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}
