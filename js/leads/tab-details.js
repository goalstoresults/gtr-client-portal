// js/leads/tab-details.js
// Dynamic Lead Details — wired to /leads/get and /leads/update.
// Dropdowns load active values directly by their configured lookup_type.

import { escapeHtml } from "../utilities.js";

const LOOKUPS_BASE = "https://lookups-module.dennis-e64.workers.dev";
const LEADS_BASE = "https://leads-module.dennis-e64.workers.dev";

async function fetchJson(url, description) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(`${description} returned an invalid response.`);
  }

  if (
    !response.ok ||
    data?.status === "error" ||
    data?.success === false
  ) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : `Unable to load ${description}.`;

    throw new Error(message);
  }

  return data;
}

export async function renderLeadDetails(container, portalState) {
  const leadId = portalState.activeLeadId;
  const project = portalState.project;

  if (!leadId) {
    container.innerHTML = `
      <section class="card">
        <h2>Lead Details</h2>
        <p>No lead selected.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Lead Details</h2>
      <p>Loading lead details…</p>
    </section>
  `;

  const loadingCard = container.querySelector(".card");

  const stillLoadingCurrentLead = () =>
    loadingCard.isConnected &&
    portalState.project === project &&
    portalState.activeLeadId === leadId;

  let configured;
  let lead;
  const lookupsByType = new Map();

  try {
    /* -------------------------------------------------------
       FETCH CONFIGURED LEAD FIELDS
    ------------------------------------------------------- */

    const configUrl = new URL(`${LOOKUPS_BASE}/lead_fields`);
    configUrl.searchParams.set("project", project);
    configUrl.searchParams.set("_", String(Date.now()));

    const configData = await fetchJson(
      configUrl.toString(),
      "lead field configuration"
    );

    if (!Array.isArray(configData.rows)) {
      throw new Error("Lead field configuration is not a valid list.");
    }

    configured = configData.rows
      .filter(row => row.lead_tab === "details")
      .map(row => ({
        ...row,
        lookup_type:
          typeof row.lookup_type === "string"
            ? row.lookup_type.trim()
            : ""
      }));

    if (!stillLoadingCurrentLead()) return;

    if (!configured.length) {
      container.innerHTML = `
        <section class="card">
          <h2>Lead Details</h2>
          <p>No fields configured in Setup → Lead Fields.</p>
        </section>
      `;
      return;
    }

    /* -------------------------------------------------------
       FETCH LOOKUPS DIRECTLY BY CONFIGURED TYPE
    ------------------------------------------------------- */

    const lookupTypes = [
      ...new Set(
        configured
          .map(field => field.lookup_type)
          .filter(Boolean)
      )
    ];

    const lookupRequests = lookupTypes.map(async lookupType => {
      const lookupUrl = new URL(`${LOOKUPS_BASE}/lookups`);

      lookupUrl.searchParams.set("project", project);
      lookupUrl.searchParams.set("lookup_type", lookupType);
      lookupUrl.searchParams.set("_", String(Date.now()));

      const rows = await fetchJson(
        lookupUrl.toString(),
        `lookup "${lookupType}"`
      );

      if (!Array.isArray(rows)) {
        throw new Error(
          `Lookup "${lookupType}" did not return a valid list.`
        );
      }

      const matchingRows = rows
        .filter(row => {
          const rowType = String(row.lookup_type ?? "").trim();

          return (
            rowType === lookupType &&
            row.project === project &&
            row.is_active === true
          );
        })
        .sort((a, b) => {
          const aSort = Number(a.sort_order);
          const bSort = Number(b.sort_order);

          const aOrder = Number.isFinite(aSort) ? aSort : 999;
          const bOrder = Number.isFinite(bSort) ? bSort : 999;

          return aOrder - bOrder;
        });

      const seenValues = new Set();

      const options = matchingRows.filter(row => {
        if (row.value === null || row.value === undefined) {
          return false;
        }

        const value = String(row.value);

        if (seenValues.has(value)) return false;

        seenValues.add(value);
        return true;
      });

      lookupsByType.set(lookupType, options);
    });

    /* -------------------------------------------------------
       FETCH LEAD RECORD
    ------------------------------------------------------- */

    const leadUrl = new URL(`${LEADS_BASE}/leads/get`);
    leadUrl.searchParams.set("id", leadId);

    const [leadData] = await Promise.all([
      fetchJson(leadUrl.toString(), "lead"),
      Promise.all(lookupRequests)
    ]);

    lead = Array.isArray(leadData) ? leadData[0] : leadData;

    if (!stillLoadingCurrentLead()) return;

    if (
      !lead ||
      String(lead.lead_id) !== String(leadId) ||
      lead.project !== project
    ) {
      throw new Error("Unable to load the matching lead.");
    }
  } catch (error) {
    if (!stillLoadingCurrentLead()) return;

    container.innerHTML = `
      <section class="card">
        <h2>Lead Details</h2>
        <p>${escapeHtml(error.message || "Unable to load Lead Details.")}</p>
      </section>
    `;

    console.error("[Lead Details] Load failed:", error);
    return;
  }

  /* -------------------------------------------------------
     GROUP FIELDS BY SECTION
  ------------------------------------------------------- */

  const sections = new Map();

  configured.forEach(field => {
    const section = field.section || "General";

    if (!sections.has(section)) {
      sections.set(section, []);
    }

    sections.get(section).push(field);
  });

  /* -------------------------------------------------------
     RENDER UI
  ------------------------------------------------------- */

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h2 style="margin:0;">Lead Details</h2>

        <button id="btnSaveLeadDetails" class="btn-primary">
          Save Lead Details
        </button>
      </div>

      <div id="leadDetailsForm"></div>
    </section>
  `;

  const formDiv = container.querySelector("#leadDetailsForm");

  /* -------------------------------------------------------
     LOCAL STYLES
  ------------------------------------------------------- */

  const sectionHeaderStyle = `
    background:#eef2f6;
    color:#3d4a5c;
    font-size:12px;
    font-weight:700;
    letter-spacing:0.07em;
    text-transform:uppercase;
    padding:10px 16px;
    margin:0 0 18px;
    border-radius:6px;
    border-left:3px solid #7ea3c9;
  `.replace(/\s+/g, " ");

  const fieldLabelStyle = `
    display:block;
    margin-bottom:16px;
  `.replace(/\s+/g, " ");

  const fieldLabelTextStyle = `
    display:block;
    font-size:13px;
    color:#5b6673;
    margin-bottom:4px;
  `.replace(/\s+/g, " ");

  const fieldInputStyle = `
    width:100%;
    padding:8px 10px;
    border:1px solid #d5dbe2;
    border-radius:4px;
    font-size:14px;
    box-sizing:border-box;
  `.replace(/\s+/g, " ");

  const lookupWarningStyle = `
    display:block;
    margin-top:5px;
    color:#9a6700;
    font-size:12px;
  `.replace(/\s+/g, " ");

  /* -------------------------------------------------------
     BUILD FORM
  ------------------------------------------------------- */

  formDiv.innerHTML = Array.from(sections.entries())
    .map(([sectionName, sectionFields]) => {
      const fields = [...sectionFields].sort(
        (a, b) =>
          (Number(a.sort_order) || 0) -
          (Number(b.sort_order) || 0)
      );

      const rows = fields
        .map(field => {
          const value = String(lead[field.field_key] ?? "");

          if (field.lookup_type) {
            const lookupRows =
              lookupsByType.get(field.lookup_type) || [];

            const hasCurrentValue = lookupRows.some(
              row => String(row.value) === value
            );

            const currentValueMissing =
              value !== "" && !hasCurrentValue;

            const options = lookupRows
              .map(row => {
                const optionValue = String(row.value);

                return `
                  <option
                    value="${escapeHtml(optionValue)}"
                    ${optionValue === value ? "selected" : ""}
                  >${escapeHtml(optionValue)}</option>
                `;
              })
              .join("");

            // Preserve a saved value that is no longer available.
            // It is not added as an editable lookup choice.
            const savedValueOption = currentValueMissing
              ? `
                <option
                  value="${escapeHtml(value)}"
                  selected
                  disabled
                >${escapeHtml(value)} — saved value unavailable in lookup</option>
              `
              : "";

            let warning = "";

            if (currentValueMissing) {
              warning = `
                <span style="${lookupWarningStyle}">
                  The saved value is not in the active
                  "${escapeHtml(field.lookup_type)}" lookup.
                  It will remain unchanged unless you select another value.
                </span>
              `;
            } else if (!lookupRows.length) {
              warning = `
                <span style="${lookupWarningStyle}">
                  No active values were returned for
                  "${escapeHtml(field.lookup_type)}".
                </span>
              `;
            }

            return `
              <label style="${fieldLabelStyle}">
                <span style="${fieldLabelTextStyle}">
                  ${escapeHtml(String(field.label || field.field_key))}
                </span>

                <select
                  data-field="${escapeHtml(String(field.field_key))}"
                  style="${fieldInputStyle}"
                >
                  <option value="" ${value === "" ? "selected" : ""}>
                    -- select --
                  </option>

                  ${savedValueOption}
                  ${options}
                </select>

                ${warning}
              </label>
            `;
          }

          return `
            <label style="${fieldLabelStyle}">
              <span style="${fieldLabelTextStyle}">
                ${escapeHtml(String(field.label || field.field_key))}
              </span>

              <input
                type="text"
                data-field="${escapeHtml(String(field.field_key))}"
                value="${escapeHtml(value)}"
                style="${fieldInputStyle}"
              >
            </label>
          `;
        })
        .join("");

      return `
        <div style="margin-bottom:32px;">
          <h3 style="${sectionHeaderStyle}">
            ${escapeHtml(String(sectionName))}
          </h3>

          ${rows}
        </div>
      `;
    })
    .join("");

  /* -------------------------------------------------------
     SAVE LOGIC
  ------------------------------------------------------- */

  const saveButton = container.querySelector("#btnSaveLeadDetails");
  const card = container.querySelector(".card");

  const canEdit = () =>
    portalState.canEdit === true &&
    portalState.isDemoAccount !== true;

  const isCurrent = () =>
    card.isConnected &&
    portalState.project === project &&
    portalState.activeLeadId === leadId;

  const baseline = new Map();

  formDiv.querySelectorAll("[data-field]").forEach(element => {
    baseline.set(element.dataset.field, element.value);
    element.disabled = !canEdit();
  });

  saveButton.disabled = !canEdit();

  let saving = false;
  let reloadRequired = false;

  saveButton.addEventListener("click", async () => {
    if (
      saving ||
      reloadRequired ||
      !canEdit() ||
      !isCurrent()
    ) {
      return;
    }

    const updates = {};

    // Submit only changed controls.
    formDiv.querySelectorAll("[data-field]").forEach(element => {
      if (
        element.value !== baseline.get(element.dataset.field)
      ) {
        updates[element.dataset.field] =
          element.value === "" ? null : element.value;
      }
    });

    if (!Object.keys(updates).length) {
      alert("No changes to save.");
      return;
    }

    if (portalState.user_id) {
      updates.updated_user_id = String(portalState.user_id);
    }

    const payload = {
      id: leadId,
      updates,
      change_source: "lead_details"
    };

    if (
      Object.prototype.hasOwnProperty.call(lead, "updated_at")
    ) {
      payload.expected_updated_at = lead.updated_at;
    }

    saving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";

    formDiv.querySelectorAll("[data-field]").forEach(element => {
      element.disabled = true;
    });

    try {
      const response = await fetch(
        `${LEADS_BASE}/leads/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await response.json().catch(() => null);

      if (!isCurrent()) return;

      if (!response.ok) {
        reloadRequired =
          response.status === 409 ||
          data?.lead_saved === true;

        const message =
          typeof data?.error === "string"
            ? data.error
            : "Failed to save lead details. Reload before retrying.";

        if (!reloadRequired && response.status >= 500) {
          reloadRequired = true;
        }

        alert(message);

        console.error("[Lead Details] Save failed", {
          status: response.status
        });

        return;
      }

      const savedLead = Array.isArray(data) ? data[0] : null;

      if (
        !savedLead ||
        String(savedLead.lead_id) !== String(leadId) ||
        savedLead.project !== project
      ) {
        reloadRequired = true;

        throw new Error(
          "The save response could not be verified. Reload Lead Details before retrying."
        );
      }

      Object.assign(lead, savedLead);

      formDiv.querySelectorAll("[data-field]").forEach(element => {
        const key = element.dataset.field;

        if (
          Object.prototype.hasOwnProperty.call(savedLead, key)
        ) {
          const savedValue = String(savedLead[key] ?? "");

          if (element.tagName === "SELECT" && savedValue !== "") {
            const hasOption = Array.from(element.options).some(
              option => option.value === savedValue
            );

            if (!hasOption) {
              const option = document.createElement("option");

              option.value = savedValue;
              option.textContent =
                `${savedValue} — saved value unavailable in lookup`;
              option.disabled = true;

              element.appendChild(option);
            }
          }

          element.value = savedValue;
        }

        baseline.set(key, element.value);
      });

      if (
        Object.prototype.hasOwnProperty.call(updates, "lead_name")
      ) {
        portalState.activeLeadName = savedLead.lead_name || "";

        localStorage.setItem(
          "activeLeadName",
          portalState.activeLeadName
        );

        const bar = document.getElementById("lead-context-bar");

        if (bar) {
          bar.textContent =
            `Lead: ${portalState.activeLeadName} ` +
            `(${portalState.activeLeadContactName || ""})`;
        }
      }

      alert("✅ Lead details saved.");
    } catch (error) {
      reloadRequired = true;

      if (isCurrent()) {
        alert(
          "Error confirming the save: " +
          error.message +
          " Reload Lead Details before retrying."
        );
      }

      console.error(
        "[Lead Details] Save request failed:",
        error
      );
    } finally {
      saving = false;

      if (isCurrent()) {
        saveButton.disabled = !canEdit() || reloadRequired;

        saveButton.textContent = reloadRequired
          ? "Reload Lead Details to Continue"
          : "Save Lead Details";

        formDiv.querySelectorAll("[data-field]").forEach(element => {
          element.disabled = !canEdit() || reloadRequired;
        });
      }
    }
  });
}
