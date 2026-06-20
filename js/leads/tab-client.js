// js/leads/tab-client.js

import { escapeHtml } from "../utilities.js";

export async function renderLeadClient(container, portalState) {

container.innerHTML = `
<section class="card">
<h2>Client</h2>
<div class="row" style="gap:12px; margin-bottom:16px;">
<input id="clientSearchInput" placeholder="Search name, business, or email" style="flex:1;">
<button id="btnFindClient" class="btn-secondary">Find</button>
<button id="btnAddClient" class="btn-primary">Add Client</button>
</div>
<div id="clientSearchResults" class="muted" style="margin-bottom:20px;">
Enter search text and click Find.
</div>
<div id="clientFormArea" style="display:none;"></div>
<div id="leadCreationArea" style="display:none; margin-top:20px;">
<h3 id="leadAreaTitle">Create Lead</h3>
<div id="leadFieldsForm"></div>
<button id="btnCreateLead" class="btn-primary" style="margin-top:16px;">
Create Lead
</button>
</div>
</section>
`;

const resultsDiv = document.getElementById("clientSearchResults");
const formArea = document.getElementById("clientFormArea");
const leadArea = document.getElementById("leadCreationArea");
const leadAreaTitle = document.getElementById("leadAreaTitle");
const leadFieldsForm = document.getElementById("leadFieldsForm");
const createLeadBtn = document.getElementById("btnCreateLead");

formArea.style.display = "none";
leadArea.style.display = "none";

let isEditingExistingLead = false;
let lead = {};

/* ============================================================
   ⭐ NEW — LOAD "client" TAB FIELD CONFIG (same source as Details)
============================================================ */
const configUrl = `
  https://lookups-module.dennis-e64.workers.dev/lead_fields?
  project=${encodeURIComponent(portalState.project)}
`.replace(/\s+/g, "");
const configRes = await fetch(configUrl, { cache: "no-cache" });
const configData = await configRes.json();
const configured = Array.isArray(configData.rows)
  ? configData.rows.filter(r => r.lead_tab === "client")
  : [];

const lookupsUrl = `
  https://lookups-module.dennis-e64.workers.dev/lookups/list?
  project=${encodeURIComponent(portalState.project)}
`.replace(/\s+/g, "");
const lookupsRes = await fetch(lookupsUrl, { cache: "no-cache" });
const lookupsData = await lookupsRes.json();
const lookupGroups = Array.isArray(lookupsData.lookups) ? lookupsData.lookups : [];

function renderLeadFields(leadValues) {
  if (!configured.length) {
    leadFieldsForm.innerHTML = `<p class="muted">No client-tab fields configured in Setup → Lead Fields.</p>`;
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

renderLeadFields({}); // default blank state, covers the "new lead" case

/* ============================================================
   IF AN EXISTING LEAD IS ACTIVE, LOAD ITS CLIENT + FIELD VALUES
============================================================ */
if (portalState.activeLeadId) {
  isEditingExistingLead = true;

  try {
    const leadRes = await fetch(
      `https://leads-module.dennis-e64.workers.dev/leads/get?id=${encodeURIComponent(portalState.activeLeadId)}`,
      { cache: "no-cache" }
    );
    lead = await leadRes.json();

    leadAreaTitle.textContent = "Lead Info";
    createLeadBtn.textContent = "Update Lead";
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
        renderClientForm(formArea, contact, portalState);
        formArea.style.display = "block";
      }
    }
  } catch (err) {
    console.error("[Client Tab] Error loading existing lead/client:", err);
  }
}

/* ============================================================
   FIND CLIENT
============================================================ */
document.getElementById("btnFindClient").addEventListener("click", async () => {
  const term = document.getElementById("clientSearchInput").value.trim();
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
        resultsDiv.innerHTML = "";
        renderClientForm(formArea, data, portalState);
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
   ADD CLIENT BUTTON
============================================================ */
document.getElementById("btnAddClient").addEventListener("click", () => {
  resultsDiv.innerHTML = "";
  portalState.pendingContactId = null;
  portalState.pendingContactName = null;
  renderClientForm(formArea, null, portalState);
  formArea.style.display = "block";
  leadArea.style.display = "block";
});

/* ============================================================
   CREATE / UPDATE LEAD  (now collects dynamic fields)
============================================================ */
createLeadBtn.addEventListener("click", async () => {
  const updates = {};
  leadFieldsForm.querySelectorAll("[data-field]").forEach(el => {
    updates[el.dataset.field] = el.value;
  });

  if (!portalState.pendingContactId) {
    alert("Select or create a client first.");
    return;
  }
  if (!updates.lead_name || !updates.lead_name.trim()) {
    alert("Enter a lead name.");
    return;
  }

  try {
    let res, data, leadId;

    if (isEditingExistingLead) {
      res = await fetch("https://leads-module.dennis-e64.workers.dev/leads/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: portalState.activeLeadId,
          updates: { ...updates, contact_id: portalState.pendingContactId }
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
          stage_name: "New",
          status: "Open",
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
      detail: { lead_id: leadId, lead_name: updates.lead_name, contact_name: portalState.pendingContactName }
    }));

    alert(isEditingExistingLead ? "✅ Lead updated." : "✅ Lead created.");

    const detailsBtn = document.querySelector('#leads-subtabs button[data-subtab="details"]');
    if (detailsBtn) detailsBtn.click();
  } catch (err) {
    alert("Error saving lead: " + err.message);
    console.error(err);
  }
});

}

/* ============================================================
   RENDER CLIENT FORM  (unchanged)
============================================================ */
function renderClientForm(container, contact, portalState) {
  const isNew = !contact;
  container.innerHTML = `
    <section class="card" style="margin-top:20px;">
      <h3>${isNew ? "Add New Client" : "Edit Client"}</h3>
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
      <button id="btnSaveClient" class="btn-primary" style="margin-top:20px;">
        Save Client
      </button>
    </section>
  `;

  document.getElementById("btnSaveClient").addEventListener("click", async () => {
    await saveClient(contact, portalState);
  });
}

/* ============================================================
   SAVE CLIENT  (unchanged)
============================================================ */
async function saveClient(existing, portalState) {
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
      res = await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contacts/edit/${existing.contact_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
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
      alert("❌ Failed to save client.");
      console.error(data);
      return;
    }

    const contactId = existing ? existing.contact_id : data.contact_id;
    portalState.pendingContactId = contactId;
    portalState.pendingContactName = `${payload.first_name} ${payload.last_name}`;
    alert("✅ Client saved.");
  } catch (err) {
    alert("Error saving client: " + err.message);
    console.error(err);
  }
}
