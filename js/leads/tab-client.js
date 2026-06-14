// js/leads/tab-client.js
import { escapeHtml } from "../utilities.js";

export async function renderLeadClient(container, portalState) {

  /* ============================================================
     BASE UI — SEARCH + BUTTONS + EMPTY FORM AREA
  ============================================================ */

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
        <h3>Create Lead</h3>

        <div class="form-grid-2col">
          <label>Lead Name</label>
          <input id="leadNameInput" placeholder="Enter lead name">
        </div>

        <button id="btnCreateLead" class="btn-primary" style="margin-top:16px;">
          Create Lead
        </button>
      </div>
    </section>
  `;

  const resultsDiv = document.getElementById("clientSearchResults");
  const formArea = document.getElementById("clientFormArea");
  const leadArea = document.getElementById("leadCreationArea");

  formArea.style.display = "none";
  leadArea.style.display = "none";

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
          <div class="contact-result" 
               data-id="${c.contact_id}"
               data-json='${escapeHtml(JSON.stringify(c))}'>
            <strong>${escapeHtml(c.first_name || "")} ${escapeHtml(c.last_name || "")}</strong>
            (${escapeHtml(c.contact_type || "No type")})<br/>
            <small>${escapeHtml(c.email || "No email")}</small>
          </div>
        `
        )
        .join("");

      // CLICK HANDLER FOR RESULTS
      resultsDiv.querySelectorAll(".contact-result").forEach(el => {
        el.addEventListener("click", () => {
          const data = JSON.parse(el.dataset.json);

          // Store pending client
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
     CREATE LEAD (ONLY WHEN CLIENT + LEAD NAME EXIST)
  ============================================================ */

  document.getElementById("btnCreateLead").addEventListener("click", async () => {
    const leadName = document.getElementById("leadNameInput").value.trim();

    if (!portalState.pendingContactId) {
      alert("Select or create a client first.");
      return;
    }

    if (!leadName) {
      alert("Enter a lead name.");
      return;
    }

    try {
      const res = await fetch(
        "https://leads-module.dennis-e64.workers.dev/leads/add",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: portalState.project,
            lead_name: leadName,
            contact_id: portalState.pendingContactId,
            stage: "New",
            status: "Open"
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert("❌ Failed to create lead.");
        console.error(data);
        return;
      }

      // Store new lead
      portalState.activeLeadId = data.lead_id;
      portalState.activeLeadName = leadName;
      portalState.activeLeadContactName = portalState.pendingContactName;

      // Update blue bar
      const bar = document.getElementById("lead-context-bar");
      bar.textContent = `${leadName} (${portalState.pendingContactName})`;
      bar.style.display = "block";

      alert("✅ Lead created.");

      // Switch to Details tab
      const detailsBtn = document.querySelector('#leads-subtabs button[data-subtab="details"]');
      if (detailsBtn) detailsBtn.click();

    } catch (err) {
      alert("Error creating lead: " + err.message);
      console.error(err);
    }
  });
}

/* ============================================================
   RENDER CLIENT FORM (NEW OR EXISTING)
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
   SAVE CLIENT (NEW OR EXISTING)
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
      // UPDATE
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
      // CREATE
      res = await fetch(
        `https://contacts-module.dennis-e64.workers.dev/contacts/add`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      data = await res.json();
    }

    if (!res.ok) {
      alert("❌ Failed to save client.");
      console.error(data);
      return;
    }

    const contactId = existing ? existing.contact_id : data.contact_id;

    // Store pending client
    portalState.pendingContactId = contactId;
    portalState.pendingContactName = `${payload.first_name} ${payload.last_name}`;

    alert("✅ Client saved.");

  } catch (err) {
    alert("Error saving client: " + err.message);
    console.error(err);
  }
}
