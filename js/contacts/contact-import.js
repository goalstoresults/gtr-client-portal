// js/contacts/contact-import.js
// Create-only CSV contact import.
//
// Usage:
// import { renderContactImport } from "./contact-import.js";
// renderContactImport(importContainer, portalState);

const CONTACTS_API =
  "https://contacts-module.dennis-e64.workers.dev";

const MAX_ROWS = 100;
const MAX_FILE_BYTES = 1024 * 1024;

const IMPORT_FIELDS = [
  ["first_name", "First Name"],
  ["last_name", "Last Name"],
  ["business_name", "Business Name"],
  ["title", "Job Title"],
  ["email", "Email"],
  ["additional_emails", "Additional Emails"],
  ["phone", "Phone"],
  ["additional_phones", "Additional Phones"],
  ["mobile_phone", "Mobile Phone"],
  ["work_phone", "Work Phone"],
  ["home_phone", "Home Phone"],
  ["website", "Website"],
  ["street_address", "Street Address"],
  ["address2", "Address Line 2"],
  ["city", "City"],
  ["state", "State"],
  ["postal_code", "Postal Code"],
  ["contact_type", "Contact Type"],
  ["source", "Source"],
  ["tags", "Tags"]
];

const FIELD_LABELS = new Map(IMPORT_FIELDS);

const HEADER_ALIASES = {
  first_name: ["first name", "firstname", "given name", "givenname"],
  last_name: ["last name", "lastname", "surname", "family name"],
  business_name: [
    "business name",
    "business",
    "company",
    "company name",
    "organization",
    "organisation"
  ],
  title: ["title", "job title", "position"],
  email: ["email", "email address", "primary email"],
  additional_emails: [
    "additional emails",
    "other emails",
    "secondary email",
    "secondary emails"
  ],
  phone: ["phone", "phone number", "primary phone"],
  additional_phones: [
    "additional phones",
    "other phones",
    "secondary phone",
    "secondary phones"
  ],
  mobile_phone: ["mobile", "mobile phone", "cell", "cell phone"],
  work_phone: ["work phone", "office phone", "business phone"],
  home_phone: ["home phone"],
  website: ["website", "web site", "website url"],
  street_address: ["street address", "address", "address line 1"],
  address2: ["address2", "address 2", "address line 2", "suite"],
  city: ["city", "town"],
  state: ["state", "province", "state province"],
  postal_code: ["postal code", "postcode", "zip", "zip code"],
  contact_type: ["contact type", "type"],
  source: ["source", "lead source"],
  tags: ["tags", "tag"]
};

function normalizeHeader(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function suggestMappings(headers) {
  const used = new Set();

  return headers.map((header) => {
    const normalized = normalizeHeader(header);

    const match = IMPORT_FIELDS.find(([field]) => {
      if (used.has(field)) return false;

      return [
        field,
        FIELD_LABELS.get(field),
        ...(HEADER_ALIASES[field] || [])
      ].some((alias) => normalizeHeader(alias) === normalized);
    });

    if (!match) return "";

    used.add(match[0]);
    return match[0];
  });
}

// Parses comma-delimited CSV, including quoted commas,
// escaped quotes, CRLF, and line breaks inside quoted cells.
function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");

  const records = [];
  let cells = [];
  let cell = "";
  let inQuotes = false;
  let afterQuote = false;
  let line = 1;
  let recordLine = 1;

  function finishCell() {
    cells.push(cell);
    cell = "";
    afterQuote = false;
  }

  function finishRecord() {
    finishCell();

    if (cells.some((value) => value.trim() !== "")) {
      records.push({
        cells,
        sourceLine: recordLine
      });
    }

    cells = [];
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (char === "\r" || char === "\n") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        cell += "\n";
        line++;
      } else {
        cell += char;
      }

      continue;
    }

    if (char === ",") {
      finishCell();
      continue;
    }

    if (char === "\r" || char === "\n") {
      finishRecord();

      if (char === "\r" && text[i + 1] === "\n") i++;

      line++;
      recordLine = line;
      continue;
    }

    if (afterQuote) {
      if (char === " " || char === "\t") continue;

      throw new Error(
        `Unexpected content after a closing quote near line ${line}.`
      );
    }

    if (char === '"') {
      if (cell.length) {
        throw new Error(
          `Unexpected quote near line ${line}.`
        );
      }

      inQuotes = true;
      continue;
    }

    cell += char;
  }

  if (inQuotes) {
    throw new Error("The CSV contains an unclosed quoted value.");
  }

  if (cell.length || cells.length || afterQuote) {
    finishRecord();
  }

  if (records.length < 2) {
    throw new Error(
      "Include a header row and at least one contact row."
    );
  }

  const headers = records[0].cells.map((header) => header.trim());
  const rows = records.slice(1);

  if (headers.some((header) => !header)) {
    throw new Error(
      "Every CSV column must have a header. Remove empty columns first."
    );
  }

  if (rows.length > MAX_ROWS) {
    throw new Error(
      `This first version accepts up to ${MAX_ROWS} contacts per file. ` +
      `Your file contains ${rows.length}. Split it into smaller files.`
    );
  }

  for (const row of rows) {
    if (row.cells.length !== headers.length) {
      throw new Error(
        `CSV line ${row.sourceLine} has ${row.cells.length} columns; ` +
        `the header has ${headers.length}. Check its commas and quotes.`
      );
    }
  }

  return { headers, rows };
}

function element(tag, text, className) {
  const node = document.createElement(tag);

  if (text !== undefined && text !== null) {
    node.textContent = text;
  }

  if (className) node.className = className;

  return node;
}

function button(text, handler, primary = false) {
  const node = element(
    "button",
    text,
    primary ? "btn-primary" : "btn-secondary"
  );

  node.type = "button";
  node.addEventListener("click", handler);

  return node;
}

function actions(...buttons) {
  const row = element("div");
  row.style.cssText =
    "display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;";

  row.append(...buttons);
  return row;
}

function table(headers) {
  const wrapper = element("div");
  wrapper.style.cssText = "overflow-x:auto;margin:12px 0;";

  const node = element("table");
  node.style.cssText =
    "width:100%;border-collapse:collapse;text-align:left;";

  const head = element("thead");
  const headingRow = element("tr");

  for (const heading of headers) {
    const cell = element("th", heading);
    cell.style.cssText =
      "padding:10px;border-bottom:2px solid #ddd;vertical-align:top;";
    headingRow.append(cell);
  }

  head.append(headingRow);

  const body = element("tbody");

  node.append(head, body);
  wrapper.append(node);

  return { wrapper, body };
}

function appendCells(row, values) {
  for (const value of values) {
    const cell = element("td");
    cell.style.cssText =
      "padding:10px;border-bottom:1px solid #ddd;" +
      "vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere;";

    if (value instanceof Node) {
      cell.append(value);
    } else {
      cell.textContent = String(value ?? "");
    }

    row.append(cell);
  }
}

async function importRequest(action, payload) {
  let response;

  try {
    response = await fetch(
      `${CONTACTS_API}/contacts/import/${action}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );
  } catch {
    const error = new Error(
      action === "create"
        ? "The create request could not be confirmed. " +
          "Some contacts may have been created. Do not retry automatically."
        : "Unable to reach the import service. No create request was made."
    );

    error.uncertain = action === "create";
    throw error;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.status !== "ok") {
    const error = new Error(
      typeof data?.error === "string"
        ? data.error
        : "The import service returned an unexpected response."
    );

    error.data = data;
    error.uncertain =
      action === "create" &&
      (!data || data.creation_may_have_occurred === true);

    throw error;
  }

  if (!Array.isArray(data.rows) || !data.summary) {
    const error = new Error(
      action === "create"
        ? "The create response could not be verified. Check before retrying."
        : "The preview response could not be verified."
    );

    error.uncertain = action === "create";
    throw error;
  }

  return data;
}

function downloadReport(records, filename) {
  const headers = [
    "csv_line",
    "status",
    "reason",
    "contact_id",
    "first_name",
    "last_name",
    "business_name",
    "email"
  ];

  function csvCell(value) {
    let text = String(value ?? "");

    // Protect spreadsheet report cells from formula interpretation.
    if (/^[\s]*[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  const lines = [
    headers.map(csvCell).join(","),
    ...records.map((row) => {
      const contact = row.contact || {};

      return [
        row.csv_line,
        row.status,
        (row.reasons || []).join("; "),
        row.contact_id || "",
        contact.first_name || "",
        contact.last_name || "",
        contact.business_name || "",
        contact.email || ""
      ].map(csvCell).join(",");
    })
  ];

  const blob = new Blob(
    ["\uFEFF", lines.join("\r\n")],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderContactImport(container, portalState) {
  const project = String(portalState.project || "").trim();

  container.replaceChildren();

  if (
    !project ||
    project.toLowerCase() === "csi" ||
    !portalState.canEdit
  ) {
    return;
  }

  const state = {
    fileName: "",
    headers: [],
    sourceRows: [],
    mappings: [],
    mappedRows: [],
    preview: null,
    busy: false
  };

  const details = element("details");
  details.className = "card";
  details.style.marginBottom = "18px";

  const summary = element(
    "summary",
    "Import Contacts from CSV"
  );

  summary.style.cssText =
    "cursor:pointer;font-weight:600;padding:8px 0;";

  const description = element(
    "p",
    "Create new contacts in bulk. Existing contacts will not be updated."
  );

  const stage = element("div");
  const message = element("p");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");

  details.append(summary, description, stage, message);
  container.append(details);

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#a12622" : "";
  }

  function setBusy(busy, text = "") {
    state.busy = busy;
    stage.setAttribute("aria-busy", String(busy));

    stage.querySelectorAll("button, input, select").forEach((node) => {
      node.disabled = busy;
    });

    if (text) showMessage(text);
  }

  function withSourceLines(rows, submittedIndices = null) {
    return rows.map((row) => {
      const position = row.row_number - 1;
      const sourceIndex = submittedIndices
        ? submittedIndices[position]
        : position;

      return {
        ...row,
        csv_line: state.sourceRows[sourceIndex]?.sourceLine ?? ""
      };
    });
  }

  function renderRows(rows, includeId = false) {
    const headings = [
      "CSV line",
      "Status",
      "Name / Business",
      "Email",
      "Details"
    ];

    if (includeId) headings.push("Contact ID");

    const display = table(headings);

    for (const result of rows) {
      const contact = result.contact || {};
      const fullName = [
        contact.first_name,
        contact.last_name
      ].filter(Boolean).join(" ");

      const name = [
        fullName,
        contact.business_name
      ].filter(Boolean).join(" / ");

      const values = [
        result.csv_line,
        result.status,
        name,
        contact.email || "",
        (result.reasons || []).join(" ")
      ];

      if (includeId) values.push(result.contact_id || "");

      const row = element("tr");
      appendCells(row, values);
      display.body.append(row);
    }

    return display.wrapper;
  }

  function reset() {
    state.fileName = "";
    state.headers = [];
    state.sourceRows = [];
    state.mappings = [];
    state.mappedRows = [];
    state.preview = null;

    showMessage("");
    renderUpload();
  }

  function renderUpload() {
    stage.replaceChildren();
    stage.append(element("h3", "1. Upload CSV"));

    stage.append(
      element(
        "p",
        `Choose a comma-separated CSV with a header row. ` +
        `Maximum ${MAX_ROWS} contacts and 1 MB per file.`
      )
    );

    const fileInput = element("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,text/csv";
    fileInput.setAttribute("aria-label", "Choose contacts CSV");

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      showMessage("");

      if (file.size > MAX_FILE_BYTES) {
        showMessage("The CSV file must be 1 MB or smaller.", true);
        fileInput.value = "";
        return;
      }

      setBusy(true, "Reading CSV…");

      try {
        const parsed = parseCsv(await file.text());

        state.fileName = file.name;
        state.headers = parsed.headers;
        state.sourceRows = parsed.rows;
        state.mappings = suggestMappings(parsed.headers);
        state.preview = null;

        renderMapping();
        showMessage("");
      } catch (error) {
        showMessage(error.message, true);
        fileInput.value = "";
      } finally {
        setBusy(false);
      }
    });

    stage.append(fileInput);
  }

  function buildMappedRows() {
    const selected = state.mappings.filter(Boolean);

    if (!selected.length) {
      throw new Error("Map at least one CSV column.");
    }

    if (new Set(selected).size !== selected.length) {
      throw new Error(
        "Each portal field can be mapped only once."
      );
    }

    return state.sourceRows.map((record) => {
      const contact = {};

      state.mappings.forEach((field, columnIndex) => {
        if (field) contact[field] = record.cells[columnIndex].trim();
      });

      return contact;
    });
  }

  function renderMapping() {
    stage.replaceChildren();

    stage.append(
      element("h3", "2. Map CSV Columns"),
      element(
        "p",
        `${state.fileName}: ${state.sourceRows.length} contact rows. ` +
        "Review the suggested mappings before continuing."
      )
    );

    stage.append(
      element(
        "p",
        "Additional Emails, Additional Phones, and Tags are imported " +
        "as text exactly as supplied, apart from surrounding spaces. " +
        "Blank Contact Type defaults to Lead."
      )
    );

    const display = table([
      "CSV column",
      "Sample values",
      "Import into"
    ]);

    state.headers.forEach((header, index) => {
      const select = element("select");
      select.className = "form-control";
      select.style.minWidth = "190px";
      select.setAttribute("aria-label", `Map ${header}`);

      const skip = element("option", "Do not import");
      skip.value = "";
      select.append(skip);

      for (const [field, label] of IMPORT_FIELDS) {
        const option = element("option", label);
        option.value = field;
        select.append(option);
      }

      select.value = state.mappings[index] || "";

      select.addEventListener("change", () => {
        state.mappings[index] = select.value;
        state.preview = null;
        showMessage("");
      });

      const samples = state.sourceRows
        .map((record) => record.cells[index])
        .filter((value) => value.trim())
        .slice(0, 3)
        .map((value) =>
          value.length > 180 ? `${value.slice(0, 180)}…` : value
        )
        .join("\n");

      const row = element("tr");
      appendCells(row, [header, samples || "—", select]);
      display.body.append(row);
    });

    stage.append(
      display.wrapper,
      actions(
        button("Choose Another File", reset),
        button("Preview Import", previewImport, true)
      )
    );
  }

  async function previewImport() {
    if (state.busy) return;

    try {
      state.mappedRows = buildMappedRows();
    } catch (error) {
      showMessage(error.message, true);
      return;
    }

    setBusy(true, "Checking rows and existing contacts…");

    try {
      state.preview = await importRequest("preview", {
        project,
        rows: state.mappedRows
      });

      renderPreview();
      showMessage("");
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  function renderPreview() {
    stage.replaceChildren();

    const data = state.preview;
    const rows = withSourceLines(data.rows);
    const ready = data.rows.filter((row) => row.status === "ready");
    const invalid = data.rows.filter((row) => row.status === "invalid");

    stage.append(
      element("h3", "3. Review Import"),
      element(
        "p",
        `Ready: ${data.summary.ready} | ` +
        `Duplicates to skip: ${data.summary.duplicate} | ` +
        `Invalid: ${data.summary.invalid}`
      ),
      element(
        "p",
        "Duplicates require matching first name, last name, and email " +
        "within this project. No existing contact will be updated."
      )
    );

    // Show the actual mapped field values, not only names and email.
    const mappedFields = state.mappings.filter(Boolean);
    const mappedTable = table([
      "CSV line",
      ...mappedFields.map((field) => FIELD_LABELS.get(field))
    ]);

    state.mappedRows.forEach((contact, index) => {
      const row = element("tr");

      appendCells(row, [
        state.sourceRows[index].sourceLine,
        ...mappedFields.map((field) => contact[field] || "")
      ]);

      mappedTable.body.append(row);
    });

    stage.append(
      element("h4", "Mapped data"),
      mappedTable.wrapper,
      element("h4", "Validation results"),
      renderRows(rows)
    );

    if (invalid.length) {
      stage.append(
        element(
          "p",
          "Correct the CSV or change the mappings, then preview again. " +
          "Creation is blocked while invalid rows remain."
        )
      );
    }

    const createButton = button(
      `Create ${ready.length} Contacts`,
      createContacts,
      true
    );

    const controls = actions(
      button("Back to Mapping", () => {
        showMessage("");
        renderMapping();
      }),
      button("Download Review", () => {
        downloadReport(rows, "contact-import-review.csv");
      })
    );

    if (ready.length && !invalid.length) {
      controls.append(createButton);
    }

    controls.append(button("Cancel Import", reset));

    stage.append(controls);
  }

  async function createContacts() {
    if (state.busy || !state.preview) return;

    const ready = state.preview.rows.filter(
      (row) => row.status === "ready"
    );

    if (!ready.length) return;

    if (state.preview.rows.some((row) => row.status === "invalid")) {
      showMessage("Resolve invalid rows before creating contacts.", true);
      return;
    }

    const confirmed = window.confirm(
      `Create up to ${ready.length} new contacts? ` +
      "Duplicates will be checked again and skipped. " +
      "Existing contacts will not be updated."
    );

    if (!confirmed) return;

    const submittedIndices = ready.map(
      (row) => row.row_number - 1
    );

    const payloadRows = submittedIndices.map(
      (index) => state.mappedRows[index]
    );

    setBusy(true, "Creating contacts. Do not resubmit or leave this tab…");

    try {
      const result = await importRequest("create", {
        project,
        confirm_create: true,
        rows: payloadRows
      });

      const earlierDuplicates = withSourceLines(
        state.preview.rows.filter(
          (row) => row.status === "duplicate"
        )
      );

      const finalRows = [
        ...earlierDuplicates,
        ...withSourceLines(result.rows, submittedIndices)
      ].sort((a, b) => a.csv_line - b.csv_line);

      renderResults(result, finalRows);

      // The parent can listen to this when we wire up tab-add.js.
      if (result.summary.created > 0) {
        container.dispatchEvent(
          new CustomEvent("contacts-imported", {
            bubbles: true,
            detail: {
              project,
              created: result.summary.created
            }
          })
        );
      }

      showMessage("");
    } catch (error) {
      renderCreateFailure(error);
    } finally {
      setBusy(false);
    }
  }

  function renderResults(result, rows) {
    stage.replaceChildren();

    const created = rows.filter(
      (row) => row.status === "created"
    ).length;

    const duplicates = rows.filter(
      (row) => row.status === "duplicate"
    ).length;

    const invalid = rows.filter(
      (row) => row.status === "invalid"
    ).length;

    stage.append(
      element("h3", "4. Import Results"),
      element(
        "p",
        `Created: ${created} | Duplicates skipped: ${duplicates}` +
        (invalid ? ` | Invalid: ${invalid}` : "")
      ),
      element("p", `Request ID: ${result.request_id}`),
      renderRows(rows, true),
      actions(
        button("Download Results", () => {
          downloadReport(rows, "contact-import-results.csv");
        }),
        button("Import Another File", reset),
        button("Close Import", () => {
          details.open = false;
        })
      )
    );
  }

  function renderCreateFailure(error) {
    stage.replaceChildren();

    const data = error.data;

    stage.append(
      element("h3", "Import Could Not Be Confirmed"),
      element("p", error.message)
    );

    if (data?.request_id) {
      stage.append(
        element("p", `Request ID: ${data.request_id}`)
      );
    }

    stage.append(
      element(
        "p",
        "No automatic retry was made. Check the contact list before " +
        "starting another import, especially for business-only rows " +
        "that have no first name, last name, or email."
      )
    );

    // Deliberately omit a retry-create button after any create failure.
    stage.append(
      actions(
        button("Close Import", () => {
          details.open = false;
        })
      )
    );

    showMessage(
      error.uncertain
        ? "Some contacts may already exist. Verify before retrying."
        : "Review the error before starting another import.",
      true
    );
  }

  renderUpload();
}
