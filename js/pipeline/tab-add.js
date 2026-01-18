// js/pipeline/tab-add.js
// Add Lead Tab — with lookup dropdowns + contact finder

import { escapeHtml } from "../utilities.js";

export async function renderPipelineAdd(container, portalState) {
  const isBroker = portalState.projects_config?.is_broker === true;

  // Reset selected contact state
  portalState.selectedLeadContactId = null;
  portalState.selectedLeadContactName = null;
  portalState.selectedLeadContactEmail = null;

  // ------------------------------------------------------------
  // FETCH LOOKUPS
  // ------------------------------------------------------------
  const lookupUrl = `https://lookups-module.dennis-e64.workers.dev/lookups/list?project=${portalState.project}`;
  const lookupRes = await fetch(lookupUrl, { cache: "no-cache" });
  const lookupData = await lookupRes.json();

  const lookups = Array.isArray(lookupData.lookups) ? lookupData.lookups : [];

  const stageOptions = lookups
    .filter(l => l.lookup_type === "lead_stage" && l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const statusOptions = lookups
    .filter(l => l.lookup_type === "lead_status" && l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const levelOptions = lookups
    .filter(l => l.lookup_type === "lead_level" && l.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const renderOptions = (rows) =>
    rows.map(r => `<option value="${escapeHtml(r.value)}">${escapeHtml(r.value)}</option>`).join("");

  // ------------------------------------------------------------
  // RENDER UI
  // ------------------------------------------------------------
  container.innerHTML = `
    <h4>Add Lead</h4>

    <!-- Lead Name -->
    <label>Lead Name:</label>
    <input id="lead_name" placeholder="Lead name" style="width:300px;margin-bottom:8px;" />

    <!-- Contact Search -->
    <div class="row" style="gap:8px; align-items:center; margin-bottom:8px;">
      <label style="min-width:120px;">Contact Name:</label>
      <input id="add-first" placeholder="First name" style="width:140px;" />
      <input id="add-last" placeholder="Last name" style="width:140px;" />
      <button id="btnAddFindContact" class="btn-primary">Find</button>
    </div>

    <div id="addContactSearchResults" class="muted" style="margin-bottom:12px;">
      Enter a first or last name and click Find.
    </div>

    <!-- Stage -->
    <label>Stage:</label>
    <select id="stage" style="width:200px;margin-bottom:8px;">
      <option value="">-- select --</option>
      ${renderOptions(stageOptions)}
    </select>

    <!-- Status -->
    <label>Status:</label>
    <select id="status" style="width:200px;margin-bottom:8px;">
      <option value="">-- select --</option>
      ${renderOptions(statusOptions)}
    </select>

    <!-- Amount -->
    <label>Amount:</label>
    <input type="number" id="amount" style="width:200px;margin-bottom:8px;" />

    <!-- Lead Level -->
    <label>Lead Level:</label>
    <select id="lead_level" style="width:200px;margin-bottom:8px;">
      <option value="">-- select --</option>
      ${renderOptions(levelOptions)}
    </select>

    <!-- Start Date -->
    <label>Start Date:</label>
    <input type="date" id="start_date" style="width:200px;margin-bottom:8px;" />

    <!-- Owner -->
    <label>Owner:</label>
    <input id="owner" placeholder="Owner" style="width:200px;margin-bottom:8px;" />

    ${isBroker ? `
      <label>Initial Size:</label>
      <input id="initial_size" placeholder="Initial size" style="width:200px;margin-bottom:8px;" />

      <label>Initial Area:</label>
      <input id="initial_area" placeholder="Initial area" style="width:200px;margin-bottom:8px;" />

      <label>No. Places Shown:</label>
      <input type="number" id="no_places_shown" style="width:200px;margin-bottom:8px;" />
    ` : ""}

    <div style="margin-top:12px;">
      <button id="btnSaveLead" class="primary">Save Lead</button>
    </div>

    <div id="leadAddResult" style="margin-top:8px;"></div>
  `;

  // ------------------------------------------------------------
  // CONTACT FINDER (same UX as Notes)
  // ------------------------------------------------------------
  document.getElementById("btnAddFindContact").addEventListener("click", async () => {
    const first = document.getElementById("add-first").value.trim();
    const last = document.getElementById("add-last").value.trim();
    const resultsDiv = document.getElementById("addContactSearchResults");

    resultsDiv.innerHTML = "Searching...";

    if (!first && !last) {
      resultsDiv.textContent = "❌ Enter at least a first or last name.";
      return;
    }

    const filters = [`project.eq.${portalState.project}`];
    if (first) filters.push(`first_name.ilike.${first}*`);
    if (last) filters.push(`last_name.ilike.${last}*`);

    const query = filters.length > 1 ? `and=(${filters.join(",")})` : filters[0];

    const url = `https://client-portal-api.dennis-e64.workers.dev/api/contacts?${query}&select=contact_id,first_name,last_name,email,contact_type`;

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
                 data-name="${escapeHtml(c.first_name || "")} ${escapeHtml(c.last_name || "")}"
                 data-email="${escapeHtml(c.email || "")}">
              <strong>${escapeHtml(c.first_name || "")} ${escapeHtml(c.last_name || "")}</strong>
              (${escapeHtml(c.contact_type || "No type")})<br/>
              <small>${escapeHtml(c.email || "No email")}</small>
            </div>
          `
        )
        .join("");

      resultsDiv.querySelectorAll(".contact-result").forEach(el => {
        el.addEventListener("click", () => {
          portalState.selectedLeadContactId = el.dataset.id;
          portalState.selectedLeadContactName = el.dataset.name;
          portalState.selectedLeadContactEmail = el.dataset.email;

          resultsDiv.innerHTML = `
            <div class="success">
              Selected: <strong>${escapeHtml(el.dataset.name)}</strong>
            </div>
          `;
        });
      });
    } catch {
      resultsDiv.textContent = "❌ Network error searching contacts.";
    }
  });

  // ------------------------------------------------------------
  // SAVE LEAD
  // ------------------------------------------------------------
  document.getElementById("btnSaveLead").addEventListener("click", async () => {
    const payload = {
      project: portalState.project,
      lead_name: document.getElementById("lead_name").value.trim(),
      contact_id: portalState.selectedLeadContactId || null,
      stage: document.getElementById("stage").value.trim(),
      status: document.getElementById("status").value.trim(),
      amount: document.getElementById("amount").value || null,
      lead_level: document.getElementById("lead_level").value.trim(),
      start_date: document.getElementById("start_date").value || null,
      owner: document.getElementById("owner").value.trim()
    };

    if (isBroker) {
      payload.initial_size = document.getElementById("initial_size").value.trim();
      payload.initial_area = document.getElementById("initial_area").value.trim();
      payload.no_places_shown = document.getElementById("no_places_shown").value || null;
    }

    try {
      const res = await fetch(
        `https://pipeline-module.dennis-e64.workers.dev/pipeline/add?project=${portalState.project}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();

      document.getElementById("leadAddResult").textContent =
        res.ok ? "Lead saved!" : `Error: ${data.error || "Unknown error"}`;
    } catch (err) {
      document.getElementById("leadAddResult").textContent = `Error: ${err.message}`;
    }
  });
}
