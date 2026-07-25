// js/leads/tab-contact.js

import { escapeHtml } from "../utilities.js";

/*
  renderLeadContact(container, portalState, { tabLabel })
  tabLabel = dynamic label from project_lead_config
  Examples:
    CSI → "Client"
    GTR → "Contact"
    Future → "Applicant", "Owner", etc.
*/

function renderAgentPicker({ container, project, label, agent, onChange }) {
  const safeLabel = label.replace(/[^a-zA-Z0-9]/g, '');

  container.innerHTML = `
    <section class="card" style="margin-top:20px;">
      <h3>${label}</h3>

      <div class="row" style="gap:12px; margin-bottom:16px;">
        <input id="${safeLabel}SearchInput"
               placeholder="Search name, business, or email"
               style="flex:1;">
        <button id="${safeLabel}FindBtn" class="btn-secondary">Find</button>
      </div>

      <div id="${safeLabel}Results" class="muted" style="margin-bottom:20px;">
        Enter search text and click Find.
      </div>
    </section>
  `;

  const searchInput = container.querySelector(`#${safeLabel}SearchInput`);
  const findBtn = container.querySelector(`#${safeLabel}FindBtn`);
  const resultsDiv = container.querySelector(`#${safeLabel}Results`);

  findBtn.addEventListener("click", async () => {
    const term = searchInput.value.trim();

    if (!term) {
      resultsDiv.textContent = "Enter something to search.";
      return;
    }

    resultsDiv.textContent = "Searching…";

    const encoded = encodeURIComponent(`*${term}*`);

const url = `
  https://contacts-module.dennis-e64.workers.dev/contacts/search?
  project=${project}&
  contact_type=Agent&
  search=${encodeURIComponent(term)}
`.replace(/\s+/g, "");



    try {
      const res = await fetch(url);
      const agents = await res.json();

      if (!Array.isArray(agents) || agents.length === 0) {
        resultsDiv.innerHTML = "<div class='muted'>No agents found.</div>";
        return;
      }

      resultsDiv.innerHTML = agents
        .map(
          a => `
            <div class="contact-result"
                 data-id="${a.contact_id}"
                 data-json='${JSON.stringify(a)}'>
              <strong>${a.first_name} ${a.last_name} (${a.contact_type || "No type"})</strong><br/>
              <small>${a.email || "No email"}</small>
            </div>
          `
        )
        .join("");

      resultsDiv.querySelectorAll(".contact-result").forEach(el => {
        el.addEventListener("click", () => {
          const data = JSON.parse(el.dataset.json);

          onChange({
            id: data.contact_id,
            first_name: data.first_name,
            last_name: data.last_name
          });

          resultsDiv.innerHTML = `
            <div class="muted">
              Selected: ${data.first_name} ${data.last_name}
            </div>
          `;
        });
      });
    } catch (err) {
      resultsDiv.textContent = "❌ Error searching agents.";
      console.error(err);
    }
  });
}




export async function renderLeadContact(container, portalState, { tabLabel }) {

  /* ============================================================
     BASE UI (dynamic vocabulary)
  ============================================================ */

  container.innerHTML = `
    <section class="card">
      <h2>${escapeHtml(tabLabel)}</h2>

      <div style="margin-bottom:16px;">
        <button id="btnCreateLeadTop" class="btn-primary">Create Lead</button>
      </div>

      <div class="row" style="gap:12px; margin-bottom:16px;">
        <input id="contactSearchInput" placeholder="Search name, business, or email" style="flex:1;">
        <button id="btnFindContact" class="btn-secondary">Find</button>
        <button id="btnAddContact" class="btn-primary">Add ${escapeHtml(tabLabel)}</button>
      </div>

      <div id="contactSearchResults" class="muted" style="margin-bottom:20px;">
        Enter search text and click Find.
      </div>

      <div id="contactFormArea" style="display:none;"></div>

      <div id="leadCreationArea" style="display:none; margin-top:20px;">
        <h3 id="leadAreaTitle">Create Lead</h3>
        <div id="leadFieldsForm"></div>
        <button id="btnCreateLead" class="btn-primary" style="margin-top:16px;">
          Create Lead
        </button>
      </div>

      <div id="buyersAgentArea" style="margin-top:30px;"></div>
      <div id="sellersAgentArea" style="margin-top:16px;"></div>
    </section>
  `;

  /* ============================================================
     ELEMENT REFERENCES
  ============================================================ */

  const resultsDiv = document.getElementById("contactSearchResults");
  const formArea = document.getElementById("contactFormArea");
  const leadArea = document.getElementById("leadCreationArea");
  const leadAreaTitle = document.getElementById("leadAreaTitle");
  const leadFieldsForm = document.getElementById("leadFieldsForm");
  const createLeadBtn = document.getElementById("btnCreateLead");
  const createLeadBtnTop = document.getElementById("btnCreateLeadTop");
  const buyersAgentContainer = document.getElementById("buyersAgentArea");
  const sellersAgentContainer = document.getElementById("sellersAgentArea");

  formArea.style.display = "none";
  leadArea.style.display = "none";

  let isEditingExistingLead = false;
  let lead = {};

  /* ============================================================
     UNSAVED CHANGES GUARD
  ============================================================ */

  portalState._contactTabDirty = false;

  function markDirty() {
    portalState._contactTabDirty = true;
  }

  attachUnsavedGuard(portalState);
  attachBeforeUnloadGuard(portalState);

  /* ============================================================
     LOAD FIELD CONFIG (lead_tab = "contact")
  ============================================================ */

  const configUrl = `
    https://lookups-module.dennis-e64.workers.dev/lead_fields?
    project=${encodeURIComponent(portalState.project)}
  `.replace(/\s+/g, "");

  const configRes = await fetch(configUrl, { cache: "no-cache" });
  const configData = await configRes.json();

  const configured = Array.isArray(configData.rows)
    ? configData.rows.filter(r => r.lead_tab === "contact")
    : [];

  /* ============================================================
     LOAD LOOKUPS
  ============================================================ */

  const lookupsUrl = `
    https://lookups-module.dennis-e64.workers.dev/lookups/list?
    project=${encodeURIComponent(portalState.project)}
  `.replace(/\s+/g, "");

  const lookupsRes = await fetch(lookupsUrl, { cache: "no-cache" });
  const lookupsData = await lookupsRes.json();
  const lookupGroups = Array.isArray(lookupsData.lookups) ? lookupsData.lookups : [];

  /* ============================================================
     RENDER DYNAMIC LEAD FIELDS
  ============================================================ */

  function renderLeadFields(leadValues) {
    if (!configured.length) {
      leadFieldsForm.innerHTML = `<p class="muted">No ${escapeHtml(tabLabel)}-tab fields configured in Setup → Lead Fields.</p>`;
      return;
    }

    const fields = [...configured].sort((a, b) => a.sort_order - b.sort_order);

    leadFieldsForm.innerHTML = fields
      .map(f => {
        const value = leadValues[f.field_key] || "";

        if (f.lookup_type) {
          const options = lookupGroups
            .filter(l => l.lookup_type === f.lookup_type)
            .map(l => `<option value="${l.value}" ${l.value === value ? "selected" : ""}>${escapeHtml(l.value)}</option>`)
            .join("");

          return `
            <label style="display:block; margin-bottom:10px;">
              <span>${escapeHtml(f.label)}</span>
              <select data-field="${f.field_key}" style="width:100%;">
                <option value="">-- select --</option>
                ${options}
              </select>
            </label>
          `;
        }

        return `
          <label style="display:block; margin-bottom:10px;">
            <span>${escapeHtml(f.label)}</span>
            <input type="text" data-field="${f.field_key}" value="${escapeHtml(value)}" style="width:100%;">
          </label>
        `;
      })
      .join("");
  }

  renderLeadFields({});

  leadFieldsForm.addEventListener("input", markDirty);
  leadFieldsForm.addEventListener("change", markDirty);

  /* ============================================================
     LOAD EXISTING LEAD (if editing)
  ============================================================ */

  if (portalState.activeLeadId) {
    isEditingExistingLead = true;

    try {
      const leadRes = await fetch(
        `https://leads-module.dennis-e64.workers.dev/leads/get?id=${encodeURIComponent(portalState.activeLeadId)}`,
        { cache: "no-cache" }
      );

      lead = await leadRes.json();

      leadAreaTitle.textContent = `${escapeHtml(tabLabel)} Info`;
      createLeadBtn.textContent = "Update Lead";
      createLeadBtnTop.textContent = "Update Lead";
      leadArea.style.display = "block";

      renderLeadFields(lead);

      if (lead.contact_id) {
        const contactRes = await fetch(
          `https://contacts-module.dennis-e64.workers.dev/contacts/details/${encodeURIComponent(lead.contact_id)}`
        );

        const contacts = await contactRes.json();
        const contact = Array.isArray(contacts) && contacts[0] ? contacts[0] : null;

        if (contact) {
          portalState.pendingContactId = contact.contact_id;
          portalState.pendingContactName = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

          renderContactForm(formArea, contact, portalState, tabLabel);
          formArea.style.display = "block";
        }
      }
    } catch (err) {
      console.error("[Contact Tab] Error loading existing lead/contact:", err);
    }
  }

  /* ============================================================
     BUYER / SELLER AGENT PICKERS
  ============================================================ */

if (portalState.project === "csi") {
  // Load agent values from lead (if editing)
  portalState.pendingBuyersAgent = lead.buyers_agent_id
    ? {
        id: lead.buyers_agent_id,
        first_name: lead.buyers_agent_first_name,
        last_name: lead.buyers_agent_last_name
      }
    : null;

  portalState.pendingSellersAgent = lead.sellers_agent_id
    ? {
        id: lead.sellers_agent_id,
        first_name: lead.sellers_agent_first_name,
        last_name: lead.sellers_agent_last_name
      }
    : null;

  // Render CSI agent pickers
  renderAgentPicker({
    container: buyersAgentContainer,
    project: portalState.project,
    label: "Buyer's Agent",
    agent: portalState.pendingBuyersAgent,
    onChange: a => {
      portalState.pendingBuyersAgent = a;
      markDirty();
    }
  });

  renderAgentPicker({
    container: sellersAgentContainer,
    project: portalState.project,
    label: "Seller's Agent",
    agent: portalState.pendingSellersAgent,
    onChange: a => {
      portalState.pendingSellersAgent = a;
      markDirty();
    }
  });
} else {
  // Non‑CSI projects: hide agent UI
  portalState.pendingBuyersAgent = null;
  portalState.pendingSellersAgent = null;

  buyersAgentContainer.innerHTML = "";
  sellersAgentContainer.innerHTML = "";
}


  /* ============================================================
     FIND CONTACT
  ============================================================ */

  document.getElementById("btnFindContact").addEventListener("click", async () => {
    const term = document.getElementById("contactSearchInput").value.trim();

    if (!term) {
      resultsDiv.textContent = "Enter something to search.";
      return;
    }

    resultsDiv.textContent = "Searching…";

    const encoded = encodeURIComponent(`*${term}*`);

    const url = `
      https://client-portal-api.dennis-e64.workers.dev/api/contacts?
      project=${portalState.project}&
      or=(
        first_name.ilike.${encoded},
        last_name.ilike.${encoded},
        business_name.ilike.${encoded},
        search_name.ilike.${encoded},
        email.ilike.${encoded}
      )
      &select=contact_id,first_name,last_name,email,contact_type,
      street_address,address2,city,postal_code,
      work_phone,home_phone,mobile_phone
    `.replace(/\s+/g, "");

    try {
      const res = await fetch(url);
      const contacts = await res.json();

      if (!Array.isArray(contacts) || contacts.length === 0) {
        resultsDiv.innerHTML = "<div class='muted'>No contacts found.</div>";
        return;
      }

      resultsDiv.innerHTML = contacts
        .map(
          c => `
            <div class="contact-result" data-id="${c.contact_id}" data-json='${escapeHtml(JSON.stringify(c))}'>
              <strong>${escapeHtml(c.first_name || "")} ${escapeHtml(c.last_name || "")}</strong>
              (${escapeHtml(c.contact_type || "No type")})<br/>
              <small>${escapeHtml(c.email || "No email")}</small>
            </div>
          `
        )
        .join("");

      resultsDiv.querySelectorAll(".contact-result").forEach(el => {
        el.addEventListener("click", () => {
          const data = JSON.parse(el.dataset.json);

          portalState.pendingContactId = data.contact_id;
          portalState.pendingContactName = `${data.first_name} ${data.last_name}`;
          markDirty();

          resultsDiv.innerHTML = "";

          renderContactForm(formArea, data, portalState, tabLabel);
          formArea.style.display = "block";
          leadArea.style.display = "block";
        });
      });
    } catch (err) {
      resultsDiv.textContent = "❌ Error searching contacts.";
      console.error(err);
    }
  });

  /* ============================================================
     ADD CONTACT BUTTON
  ============================================================ */

  document.getElementById("btnAddContact").addEventListener("click", () => {
    resultsDiv.innerHTML = "";
    portalState.pendingContactId = null;
    portalState.pendingContactName = null;

    renderContactForm(formArea, null, portalState, tabLabel);
    formArea.style.display = "block";
    leadArea.style.display = "block";
  });

  /* ============================================================
     CREATE / UPDATE LEAD
  ============================================================ */

  async function saveLead() {
    const updates = {};

    leadFieldsForm.querySelectorAll("[data-field]").forEach(el => {
      updates[el.dataset.field] = el.value;
    });

    if (!portalState.pendingContactId) {
      alert(`Select or create a ${tabLabel} first.`);
      return;
    }

    if (!updates.lead_name || !updates.lead_name.trim()) {
      alert("Enter a lead name.");
      return;
    }

    const agentFields = {
      buyers_agent_id: portalState.pendingBuyersAgent?.id || null,
      buyers_agent_first_name: portalState.pendingBuyersAgent?.first_name || null,
      buyers_agent_last_name: portalState.pendingBuyersAgent?.last_name || null,
      sellers_agent_id: portalState.pendingSellersAgent?.id || null,
      sellers_agent_first_name: portalState.pendingSellersAgent?.first_name || null,
      sellers_agent_last_name: portalState.pendingSellersAgent?.last_name || null
    };

    try {
      let res, data, leadId;

      if (isEditingExistingLead) {
        res = await fetch("https://leads-module.dennis-e64.workers.dev/leads/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: portalState.activeLeadId,
            updates: { ...updates, contact_id: portalState.pendingContactId, ...agentFields }
          })
        });

        data = await res.json();

        if (!res.ok) {
          alert("❌ Failed to update lead.");
          console.error(data);
          return;
        }

        leadId = portalState.activeLeadId;
      } else {
        res = await fetch("https://leads-module.dennis-e64.workers.dev/leads/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: portalState.project,
            contact_id: portalState.pendingContactId,
            pipeline_name: portalState.project,   // use global project, no hardcoding
            stage_name: "New",
            status: "Open",
            ...agentFields,
            ...updates
          })
        });

        data = await res.json();

        if (!res.ok) {
          alert("❌ Failed to create lead.");
          console.error(data);
          return;
        }

        leadId = data.lead_id;
      }

      portalState.activeLeadId = leadId;
      portalState.activeLeadName = updates.lead_name;
      portalState.activeLeadContactName = portalState.pendingContactName;

      localStorage.setItem("activeLeadId", leadId);
      localStorage.setItem("activeLeadName", updates.lead_name);
      localStorage.setItem("activeLeadContactName", portalState.pendingContactName);

      const bar = document.getElementById("lead-context-bar");
      if (bar) {
        bar.textContent = `${updates.lead_name} (${portalState.pendingContactName})`;
        bar.style.display = "block";
      }

      window.dispatchEvent(new CustomEvent("lead-created", {
        detail: {
          lead_id: leadId,
          lead_name: updates.lead_name,
          contact_name: portalState.pendingContactName
        }
      }));

      portalState._contactTabDirty = false;

      alert(isEditingExistingLead ? "✅ Lead updated." : "✅ Lead created.");

      const detailsBtn = document.querySelector('#leads-subtabs button[data-subtab="details"]');
      if (detailsBtn) detailsBtn.click();

    } catch (err) {
      alert("Error saving lead: " + err.message);
      console.error(err);
    }
  }

  createLeadBtn.addEventListener("click", saveLead);
  createLeadBtnTop.addEventListener("click", saveLead);
}

/* ============================================================
   UNSAVED CHANGES GUARDS
============================================================ */

function attachUnsavedGuard(portalState) {
  const subtabsContainer = document.getElementById("leads-subtabs");
  if (!subtabsContainer || subtabsContainer._unsavedGuardAttached) return;

  subtabsContainer._unsavedGuardAttached = true;

  subtabsContainer.addEventListener(
    "click",
    e => {
      if (!portalState._contactTabDirty) return;

      const btn = e.target.closest("button[data-subtab]");
      if (!btn || btn.dataset.subtab === "contact") return;

      const proceed = confirm(
        `You have unsaved changes on the ${portalState.tabLabel || "Contact"} tab. Leave without saving?`
      );

      if (!proceed) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      } else {
        portalState._contactTabDirty = false;
      }
    },
    true
  );
}

function attachBeforeUnloadGuard(portalState) {
  if (window._contactTabUnloadGuardAttached) return;

  window._contactTabUnloadGuardAttached = true;

  window.addEventListener("beforeunload", e => {
    if (!portalState._contactTabDirty) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

/* ============================================================
   CONTACT FORM (dynamic vocabulary)
============================================================ */

function renderContactForm(container, contact, portalState, tabLabel) {
  const isNew = !contact;

  container.innerHTML = `
    <section class="card" style="margin-top:20px;">
      <h3>${isNew ? `Add New ${escapeHtml(tabLabel)}` : `Edit ${escapeHtml(tabLabel)}`}</h3>

      <div class="form-grid-2col">
        <label>First Name</label>
        <input id="cf_first" value="${escapeHtml(contact?.first_name || "")}">

        <label>Last Name</label>
        <input id="cf_last" value="${escapeHtml(contact?.last_name || "")}">

        <label>Email Address</label>
        <input id="cf_email" value="${escapeHtml(contact?.email || "")}">

        <label>Address 1</label>
        <input id="cf_addr1" value="${escapeHtml(contact?.street_address || "")}">

        <label>Address 2</label>
        <input id="cf_addr2" value="${escapeHtml(contact?.address2 || "")}">

        <label>City</label>
        <input id="cf_city" value="${escapeHtml(contact?.city || "")}">

        <label>Zip Code</label>
        <input id="cf_zip" value="${escapeHtml(contact?.postal_code || "")}">

        <label>Work Phone</label>
        <input id="cf_work" value="${escapeHtml(contact?.work_phone || "")}">

        <label>Home Phone</label>
        <input id="cf_home" value="${escapeHtml(contact?.home_phone || "")}">

        <label>Cell Phone</label>
        <input id="cf_cell" value="${escapeHtml(contact?.mobile_phone || "")}">
      </div>

      <button id="btnSaveContact" class="btn-primary" style="margin-top:20px;">
        Save ${escapeHtml(tabLabel)}
      </button>
    </section>
  `;

  document.getElementById("btnSaveContact").addEventListener("click", async () => {
    await saveContact(contact, portalState, tabLabel);
  });
}

/* ============================================================
   SAVE CONTACT (dynamic vocabulary)
============================================================ */
async function saveContact(existing, portalState, tabLabel) {
  const payload = {
    project: portalState.project,
    first_name: document.getElementById("cf_first").value.trim(),
    last_name: document.getElementById("cf_last").value.trim(),
    email: document.getElementById("cf_email").value.trim(),
    street_address: document.getElementById("cf_addr1").value.trim(),
    address2: document.getElementById("cf_addr2").value.trim(),
    city: document.getElementById("cf_city").value.trim(),
    postal_code: document.getElementById("cf_zip").value.trim(),
    work_phone: document.getElementById("cf_work").value.trim(),
    home_phone: document.getElementById("cf_home").value.trim(),
    mobile_phone: document.getElementById("cf_cell").value.trim()
  };

  try {
    let res, data;
    if (existing) {
      res = await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/edit/${existing.contact_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      data = await res.json();
    } else {
      res = await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      data = await res.json();
    }

    if (!res.ok) {
      alert(`❌ Failed to save ${tabLabel}.`);
      console.error(data);
      return;
    }

    const savedContact = existing ? { ...existing, ...payload } : (Array.isArray(data) ? data[0] : data);
    const contactId = savedContact.contact_id;

    portalState.pendingContactId = contactId;
    portalState.pendingContactName = `${payload.first_name} ${payload.last_name}`;
    portalState._contactTabDirty = true;

    alert(`✅ ${tabLabel} saved.`);

    const container = document.getElementById("contactFormArea");
    renderContactForm(container, savedContact, portalState, tabLabel);

    const resultsDiv = document.getElementById("contactSearchResults");
    if (resultsDiv) {
      resultsDiv.innerHTML = `<div class="muted">Selected: ${escapeHtml(payload.first_name)} ${escapeHtml(payload.last_name)}</div>`;
    }
  } catch (err) {
    alert(`Error saving ${tabLabel}: ` + err.message);
    console.error(err);
  }
}
