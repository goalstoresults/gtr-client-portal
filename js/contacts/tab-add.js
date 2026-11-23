// js/contacts/tab-add.js

import { escapeHtml } from "../utilities.js";
import { renderContactList } from "./tab-list.js";

/* -------------------------------------------------------
MAIN ENTRY: Render Add Contact Form
------------------------------------------------------- */

export async function renderAddContactForm(container, portalState) {
  const projectId = portalState.project;

  if (!projectId) {
    container.innerHTML = `
<section class="card">
  <p>No project selected.</p>
</section>
`;
    return;
  }

  // Fetch configured fields.
  const fieldsRes = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contact_fields?project=${encodeURIComponent(projectId)}`,
    { cache: "no-cache" }
  );

  const fieldsData = await fieldsRes.json();
  let fields = Array.isArray(fieldsData.rows) ? fieldsData.rows : [];

  fields.sort((a, b) => a.sort_order - b.sort_order);

  // Use Add tab fields for consistency.
  fields = fields.filter((f) => f.contact_tab === "add");

  /* -------------------------------------------------------
  RENDER FORM SHELL
  ------------------------------------------------------- */

  container.innerHTML = `
<div id="contactImportContainer" hidden></div>

<section class="card">
  <form id="addContactForm" class="notes-form">
    <div
      class="form-header"
      style="display:flex;align-items:center;gap:12px;margin-bottom:12px;"
    >
      <h2 style="margin:0;">Add Contact for ${escapeHtml(
        portalState.display_name || projectId
      )}</h2>

      ${
        portalState.canEdit
          ? `<button type="submit" class="btn-primary">Save Contact</button>`
          : ""
      }
    </div>
  </form>
</section>
`;

  const form = container.querySelector("#addContactForm");
  const importContainer = container.querySelector(
    "#contactImportContainer"
  );

  /* -------------------------------------------------------
  GROUP FIELDS BY SECTION
  ------------------------------------------------------- */

  const grouped = fields.reduce((acc, f) => {
    const section = f.section || "General";

    if (!acc[section]) {
      acc[section] = [];
    }

    acc[section].push(f);

    return acc;
  }, {});

  /* -------------------------------------------------------
  RENDER SECTIONS + FIELDS
  ------------------------------------------------------- */

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

      // Group dropdown.
      if (f.field_key === "group_id") {
        input = document.createElement("select");
        input.name = "group_id";
        input.className = "form-control";

        fetch(
          `https://groups-module.dennis-e64.workers.dev/groups/list?project=${encodeURIComponent(projectId)}`
        )
          .then((r) => r.json())
          .then((data) => {
            const rows = Array.isArray(data.rows)
              ? data.rows
              : Array.isArray(data)
              ? data
              : [];

            rows.sort((a, b) =>
              (a.group_name || "").localeCompare(b.group_name || "")
            );

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "-- Select Group --";
            input.appendChild(placeholder);

            rows.forEach((g) => {
              const opt = document.createElement("option");
              opt.value = g.group_id;
              opt.textContent = g.group_name;
              input.appendChild(opt);
            });
          });

      // Lookup dropdown.
      } else if (f.lookup_type) {
        input = document.createElement("select");
        input.name = f.field_key;
        input.className = "form-control";

        fetch(
          `https://lookups-module.dennis-e64.workers.dev/lookups?lookup_type=${encodeURIComponent(f.lookup_type)}&project=${encodeURIComponent(projectId)}`
        )
          .then((r) => r.json())
          .then((values) => {
            if (!Array.isArray(values)) {
              return;
            }

            values.sort((a, b) =>
              (a.label || a.value || "").localeCompare(
                b.label || b.value || ""
              )
            );

            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "-- Select --";
            input.appendChild(placeholder);

            values.forEach((v) => {
              const opt = document.createElement("option");
              opt.value = v.value;
              opt.textContent = v.label || v.value;
              input.appendChild(opt);
            });
          });

      // Text input.
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

  /* -------------------------------------------------------
  SEARCH NAME MODE — PER-CONTACT OVERRIDE
  ------------------------------------------------------- */

  const searchSectionHeader = document.createElement("h3");
  searchSectionHeader.textContent = "Search Settings";
  searchSectionHeader.className = "section-title";
  form.appendChild(searchSectionHeader);

  const searchRow = document.createElement("div");
  searchRow.className = "notes-row";

  const searchLabel = document.createElement("label");
  searchLabel.textContent = "Search Name Mode";
  searchLabel.className = "notes-label";

  const searchSelect = document.createElement("select");
  searchSelect.name = "search_name_source";
  searchSelect.className = "form-control";

  // Let the backend use the project default when left blank.
  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.textContent = "Use project default";
  searchSelect.appendChild(optDefault);

  const optContact = document.createElement("option");
  optContact.value = "contact";
  optContact.textContent = "Contact (first/last)";
  searchSelect.appendChild(optContact);

  const optBusiness = document.createElement("option");
  optBusiness.value = "business";
  optBusiness.textContent = "Business";
  searchSelect.appendChild(optBusiness);

  searchRow.appendChild(searchLabel);
  searchRow.appendChild(searchSelect);
  form.appendChild(searchRow);

  /* -------------------------------------------------------
  SUBMIT HANDLER
  ------------------------------------------------------- */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (
      !portalState.canEdit ||
      String(portalState.project) !== String(projectId)
    ) {
      return;
    }

    const formData = new FormData(form);
    const payload = {};

    // Populate from dynamic fields.
    fields.forEach((f) => {
      const val = formData.get(f.field_key);

      if (val === "" || val === null) {
        payload[f.field_key] = null;
      } else if (f.data_type === "integer") {
        const parsed = parseInt(val, 10);
        payload[f.field_key] = isNaN(parsed) ? null : parsed;
      } else {
        payload[f.field_key] = val;
      }
    });

    // Optional per-contact search-name override.
    const searchMode = formData.get("search_name_source");

    if (searchMode === "contact" || searchMode === "business") {
      payload.search_name_source = searchMode;
    }

    payload.contact_id = crypto.randomUUID();
    payload.project = projectId;
    payload.created_at = new Date().toISOString();

    // Build contact_name with fallback to business_name.
    const first = formData.get("first_name") || "";
    const last = formData.get("last_name") || "";
    const business = formData.get("business_name") || "";
    const contactName = `${first} ${last}`.trim();

    payload.contact_name = contactName || business || null;

    try {
      const res = await fetch(
        "https://contacts-module.dennis-e64.workers.dev/contacts/add",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const result = await res.json();

      if (
        !res.ok ||
        result?.success === false ||
        result?.status === "error"
      ) {
        throw new Error(
          result?.error ||
          result?.message ||
          "Unable to save contact."
        );
      }

      // Return to List tab after save.
      const listBtn = document.querySelector(
        '#contacts-subtabs button[data-subtab="list"]'
      );

      if (listBtn) {
        document
          .querySelectorAll("#contacts-subtabs button")
          .forEach((b) => b.classList.remove("active"));

        listBtn.classList.add("active");

        const content = document.querySelector("#contactsContent");

        if (content) {
          await renderContactList(content, portalState);
        }
      }
    } catch (err) {
      container.innerHTML = `
<section class="card">
  <p>Error saving contact: ${escapeHtml(err.message)}</p>
</section>
`;
    }
  });

  /* -------------------------------------------------------
  CONDITIONAL CONTACT IMPORT

  Uses project configuration already loaded by index.html.

  No static import of contact-import.js.
  No separate import configuration request.
  ------------------------------------------------------- */

  function importIsAllowed() {
    return (
      Boolean(portalState.canEdit) &&
      portalState.allow_import === true &&
      String(projectId).trim().toLowerCase() !== "csi"
    );
  }

  function isCurrentView() {
    return (
      container.isConnected &&
      container.contains(form) &&
      container.contains(importContainer) &&
      String(portalState.project) === String(projectId)
    );
  }

  async function initializeContactImport() {
    if (!importIsAllowed() || !isCurrentView()) {
      return;
    }

    try {
      // Load only after the project and edit checks pass.
      const { renderContactImport } = await import(
        "./contact-import.js"
      );

      // Recheck after the asynchronous module load.
      if (!importIsAllowed() || !isCurrentView()) {
        return;
      }

      if (typeof renderContactImport !== "function") {
        throw new Error(
          "The contact import module could not be initialized."
        );
      }

      await renderContactImport(importContainer, portalState);

      // Do not reveal a delayed render after navigation.
      if (!importIsAllowed() || !isCurrentView()) {
        importContainer.hidden = true;
        importContainer.replaceChildren();
        return;
      }

      importContainer.hidden = false;
    } catch (err) {
      console.error("[Contact import]", err);

      if (!importIsAllowed() || !isCurrentView()) {
        return;
      }

      // Import failures do not prevent manual contact entry.
      importContainer.replaceChildren();

      const notice = document.createElement("p");
      notice.textContent =
        "Contact import is currently unavailable. " +
        "You can still add a contact using the form below.";

      importContainer.appendChild(notice);
      importContainer.hidden = false;
    }
  }

  // Do not block manual entry while the import module loads.
  void initializeContactImport();
}
