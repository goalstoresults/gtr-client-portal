// js/contacts/tab-onboarding.js
// Contact Onboarding Tab (NYFO only) — NYFO email + three employee leads

import { escapeHtml } from "../utilities.js";

const API_BASE = "https://client-portal-api.dennis-e64.workers.dev";

const LEAD_FIELDS = [
  { key: "nyfo_client_lead", label: "Client Lead" },
  { key: "nyfo_home_visit_lead", label: "Home Visit Lead" },
  { key: "nyfo_back_end_lead", label: "Back End Lead" }
];

export async function renderContactOnboarding(container, portalState) {
  const contactId = portalState.selectedContactId;
  const project = portalState.project;

  if (!contactId) {
    container.innerHTML = `
      <section class="card">
        <h2>Onboarding</h2>
        <p>Select a contact from the List tab first.</p>
      </section>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Onboarding for ${escapeHtml(portalState.selectedContactName || "")}</h2>
      <div id="onboardingBody">(loading…)</div>
    </section>`;

  const body = container.querySelector("#onboardingBody");
  const stillHere = () =>
    portalState.selectedContactId === contactId &&
    portalState.project === project &&
    container.contains(body);

  try {
    const p = new URLSearchParams({ project, contact_id: contactId });
    const [empRes, curRes] = await Promise.all([
      fetch(`${API_BASE}/api/contact_onboarding/employees?${new URLSearchParams({ project })}`, { cache: "no-cache" }),
      fetch(`${API_BASE}/api/contact_onboarding?${p}`, { cache: "no-cache" })
    ]);

    const employees = await empRes.json();
    const current = await curRes.json();

    if (!empRes.ok) throw new Error(employees?.error || `Employees: HTTP ${empRes.status}`);
    if (!curRes.ok) throw new Error(current?.error || `Contact: HTTP ${curRes.status}`);
    if (!stillHere()) return;

    const empList = Array.isArray(employees) ? employees : [];

    const optionsFor = saved => {
      const known = empList.some(e => e.contact_id === saved);
      const opts = [`<option value="">— Unassigned —</option>`];
      // Keep a saved value visible even if that person is no longer an Employee
      if (saved && !known) {
        opts.push(`<option value="${escapeHtml(saved)}" selected>(Former/unknown: ${escapeHtml(saved)})</option>`);
      }
      for (const e of empList) {
        opts.push(
          `<option value="${escapeHtml(e.contact_id)}"${e.contact_id === saved ? " selected" : ""}>${escapeHtml(e.name)}</option>`
        );
      }
      return opts.join("");
    };

    body.innerHTML = `
      <form id="onboardingForm" style="max-width:520px;">
        <label for="onbEmailNyfo">NYFO Email</label>
        <input type="email" id="onbEmailNyfo" name="email_nyfo"
               value="${escapeHtml(current.email_nyfo || "")}"
               style="display:block; width:100%; margin:4px 0 14px;">

        ${LEAD_FIELDS.map(f => `
          <label for="onb_${f.key}">${f.label}</label>
          <select id="onb_${f.key}" name="${f.key}"
                  style="display:block; width:100%; margin:4px 0 14px;">
            ${optionsFor(current[f.key] || "")}
          </select>
        `).join("")}

        <button type="submit" class="btn-primary" id="onbSave">Save</button>
        <span id="onbMessage" role="status" style="margin-left:10px;"></span>
      </form>`;

    const form = body.querySelector("#onboardingForm");
    const saveBtn = body.querySelector("#onbSave");
    const msg = body.querySelector("#onbMessage");

    form.addEventListener("submit", async event => {
      event.preventDefault();
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      msg.textContent = "";

      const payload = { project, contact_id: contactId, email_nyfo: form.email_nyfo.value };
      LEAD_FIELDS.forEach(f => { payload[f.key] = form[f.key].value; });

      try {
        const res = await fetch(`${API_BASE}/api/contact_onboarding`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.success) throw new Error(result?.error || `HTTP ${res.status}`);

        msg.textContent = "Saved.";
        msg.style.color = "#198754";
      } catch (err) {
        console.error("[Onboarding] Save failed:", err);
        msg.textContent = `Save failed: ${err.message || "Unknown error"}`;
        msg.style.color = "#dc3545";
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save";
      }
    });
  } catch (err) {
    console.error("[Onboarding] Load failed:", err);
    body.innerHTML = `<p>Error loading onboarding: ${escapeHtml(err.message || "Unknown error")}</p>`;
  }
}
