// summary/tab-notes-summary.js

import { escapeHtml, formatDateTime } from "../utilities.js";

/* -------------------------------------------------------
CONFIGURATION
------------------------------------------------------- */

const CONTACTS_API =
    "https://contacts-module.dennis-e64.workers.dev";

const SUMMARY_PAGE_SIZE = 25;
const activeSummaryViews = new WeakMap();

/* -------------------------------------------------------
MAIN ENTRY
------------------------------------------------------- */

export async function renderNotesSummary(container, portalState) {

    if (!portalState.project) {
        container.innerHTML = `
            <section class="card">
                <h2>Notes Summary</h2>
                <p>Select a project first.</p>
            </section>
        `;
        return;
    }

    const view = {};
    activeSummaryViews.set(container, view);

    const isCurrentView = () =>
        activeSummaryViews.get(container) === view
        && (!view.root || container.contains(view.root));

    // Uses the existing portal generation permission.
    // Identity fields are attribution only; no staff lookup here.
    const canGenerate =
        portalState.can_generate_notes_summary === true;

    const project = portalState.project;
    const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const identity = {
        user_id: portalState.user_id ?? "",
        user_email: portalState.userEmail || "",
        user_name: portalState.staffName
            || [portalState.firstName, portalState.lastName]
                .filter(Boolean).join(" ").trim()
    };

    let contacts = [];
    let selectedContact = null;
    let notes = [];
    let previewCriteria = null;
    let previewLoading = false;
    let generating = false;
    let savedRows = [];
    let offset = 0;
    let hasMore = false;
    let searchRequestNumber = 0;
    let notesRequestNumber = 0;
    let listRequestNumber = 0;
    let reportRequestNumber = 0;

    const selectedNoteIds = new Set();
    const knownContacts = new Map();

    container.innerHTML = `
        <section class="card">
            <h2>Notes Summary</h2>
            <p>
                Find a contact, choose the date range, and load the notes.
                Review your selections before generating the summary.
            </p>

            ${canGenerate ? `
                <section class="card" style="margin:12px 0 16px;">
                    <h3>Find Contact</h3>
                    <div class="row" style="gap:12px; margin-bottom:12px;">
                        <input
                            type="text"
                            data-summary="search"
                            placeholder="Search name, business, or email"
                            style="flex:1; min-width:180px;"
                        >
                        <button
                            type="button"
                            class="btn-primary"
                            data-summary="find"
                        >Find</button>
                    </div>
                    <div
                        data-summary="search-results"
                        class="muted"
                        role="status"
                        aria-live="polite"
                        style="overflow-x:auto;"
                    >
                        Enter criteria and click Find,
                        or leave blank and click Find to list all contacts.
                    </div>
                </section>

                <div
                    data-summary="selected-contact"
                    style="margin-bottom:12px;"
                >No contact selected.</div>

                <div style="
                    display:flex;
                    align-items:flex-end;
                    gap:20px;
                    flex-wrap:wrap;
                    margin:12px 0;
                ">
                    <label style="display:flex; flex-direction:column;">
                        <span>From</span>
                        <input
                            type="date"
                            data-summary="from"
                            style="min-width:160px;"
                            disabled
                        >
                    </label>
                    <label style="display:flex; flex-direction:column;">
                        <span>To</span>
                        <input
                            type="date"
                            data-summary="to"
                            style="min-width:160px;"
                            disabled
                        >
                    </label>
                    <button
                        type="button"
                        class="btn-secondary"
                        data-summary="load-notes"
                        disabled
                        style="background-color:#999; color:#fff; cursor:not-allowed; opacity:0.65;"
                    >Load Notes</button>
                </div>

                <p style="margin:8px 0;">
                    Date range timezone:
                    <span data-summary="timezone"></span>
                </p>

                <div
                    data-summary="notes-status"
                    role="status"
                    aria-live="polite"
                    style="margin:12px 0;"
                >Select a contact and date range, then click Load Notes.</div>

                <div data-summary="notes-preview" style="display:none;">
                    <div class="row" style="gap:12px; margin:12px 0;">
                        <button
                            type="button"
                            class="btn-secondary"
                            data-summary="select-all"
                        >Select All</button>
                        <button
                            type="button"
                            class="btn-secondary"
                            data-summary="clear-all"
                        >Clear All</button>
                        <span
                            data-summary="selection-count"
                            role="status"
                            aria-live="polite"
                        ></span>
                    </div>
                    <div style="overflow-x:auto;">
                        <table class="notes-table">
                            <thead>
                                <tr>
                                    <th>Select</th>
                                    <th>Note Date</th>
                                    <th>Subject</th>
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody data-summary="note-rows"></tbody>
                        </table>
                    </div>
                </div>

                <button
                    type="button"
                    class="btn-secondary"
                    data-summary="generate"
                    disabled
                    style="margin-top:12px; background-color:#999; color:#fff; cursor:not-allowed; opacity:0.65;"
                >Generate Summary</button>
            ` : `
                <p>
                    You can view saved summaries.
                    Generating new summaries requires generation permission.
                </p>
            `}

            <div
                data-summary="message"
                role="status"
                aria-live="polite"
                style="margin-top:12px; white-space:pre-wrap;"
            ></div>
        </section>

        <section class="card" style="margin-top:16px;">
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                flex-wrap:wrap;
            ">
                <h2>Saved Notes Summaries</h2>
                <button class="btn-secondary" data-summary="refresh">
                    Refresh List
                </button>
            </div>
            <div style="
                display:flex;
                align-items:flex-end;
                gap:12px;
                flex-wrap:wrap;
                margin:12px 0;
            ">
                <label style="display:flex; flex-direction:column; min-width:240px;">
                    <span>Filter by Contact</span>
                    <select data-summary="filter">
                        <option value="">All Contacts</option>
                    </select>
                </label>
                <button class="btn-secondary" data-summary="clear-filter">
                    Clear Filter
                </button>
            </div>
            <div
                data-summary="list-message"
                role="status"
                style="margin-bottom:8px;"
            ></div>
            <div style="overflow-x:auto;">
                <table class="notes-table">
                    <thead>
                        <tr>
                            <th>Contact</th>
                            <th>Period</th>
                            <th>Generated</th>
                            <th>Generated By</th>
                            <th>Notes Used</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody data-summary="rows">
                        <tr><td colspan="6">Loading saved summaries…</td></tr>
                    </tbody>
                </table>
            </div>
            <div style="display:flex; align-items:center; gap:12px; margin-top:12px;">
                <button class="btn-secondary" data-summary="previous" disabled>
                    Previous
                </button>
                <span data-summary="page"></span>
                <button class="btn-secondary" data-summary="next" disabled>
                    Next
                </button>
            </div>
        </section>

        <div data-summary="report" style="margin-top:16px;"></div>
    `;

    const find = name =>
        container.querySelector(`[data-summary="${name}"]`);

    const searchInput = find("search");
    const findButton = find("find");
    const searchResults = find("search-results");
    const selectedContactDisplay = find("selected-contact");
    const fromInput = find("from");
    const toInput = find("to");
    const loadNotesButton = find("load-notes");
    const notesStatus = find("notes-status");
    const preview = find("notes-preview");
    const noteRows = find("note-rows");
    const selectAllButton = find("select-all");
    const clearAllButton = find("clear-all");
    const selectionCount = find("selection-count");
    const generateButton = find("generate");
    const filterSelect = find("filter");
    const message = find("message");
    const listMessage = find("list-message");
    const rowsContainer = find("rows");
    const reportContainer = find("report");
    const previousButton = find("previous");
    const nextButton = find("next");

    view.root = message;

    if (canGenerate) {
        find("timezone").textContent = timeZone;
        findButton.addEventListener("click", findContacts);
        searchInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                findContacts();
            }
        });
        searchResults.addEventListener("click", event => {
            const button = event.target.closest("[data-select-contact]");
            if (!button || generating) return;
            const contact = contacts.find(item =>
                String(item.contact_id) === button.dataset.selectContact
            );
            if (contact) selectContact(contact);
        });

        [fromInput, toInput].forEach(input => {
            input.addEventListener("input", dateRangeChanged);
            input.addEventListener("change", dateRangeChanged);
        });

        loadNotesButton.addEventListener("click", loadNotes);
        generateButton.addEventListener("click", generateSummary);

        selectAllButton.addEventListener("click", () => {
            if (generating || previewLoading) return;
            notes.forEach(note => {
                if (noteCanBeSelected(note)) {
                    selectedNoteIds.add(String(note.id));
                }
            });
            syncNoteCheckboxes();
            updateControls();
        });

        clearAllButton.addEventListener("click", () => {
            if (generating || previewLoading) return;
            selectedNoteIds.clear();
            syncNoteCheckboxes();
            updateControls();
        });

        noteRows.addEventListener("change", event => {
            const checkbox = event.target.closest("[data-note-index]");
            if (!checkbox || generating || previewLoading) return;
            const note = notes[Number(checkbox.dataset.noteIndex)];
            if (!note || !noteCanBeSelected(note)) return;
            const id = String(note.id);
            if (checkbox.checked) selectedNoteIds.add(id);
            else selectedNoteIds.delete(id);
            updateControls();
        });

        updateControls();
    }

    find("refresh").addEventListener("click", () => loadSavedSummaries());
    filterSelect.addEventListener("change", () => {
        offset = 0;
        loadSavedSummaries();
    });
    find("clear-filter").addEventListener("click", () => {
        filterSelect.value = "";
        offset = 0;
        loadSavedSummaries();
    });
    previousButton.addEventListener("click", () => {
        offset = Math.max(0, offset - SUMMARY_PAGE_SIZE);
        loadSavedSummaries();
    });
    nextButton.addEventListener("click", () => {
        if (!hasMore) return;
        offset += SUMMARY_PAGE_SIZE;
        loadSavedSummaries();
    });
    rowsContainer.addEventListener("click", event => {
        const button = event.target.closest("[data-view-summary]");
        if (button) openSavedSummary(button.dataset.viewSummary);
    });

    /* -------------------------------------------------------
    FIND CONTACTS
    ------------------------------------------------------- */

    async function findContacts() {
        if (!canGenerate || generating) return;
        const requestNumber = ++searchRequestNumber;
        findButton.disabled = true;
        findButton.textContent = "Finding…";
        searchResults.textContent = "Searching…";

        try {
            const data = await summaryApi("/notes_summary/contacts", {
                project,
                search: searchInput.value.trim()
            });
            if (!isCurrentView() || requestNumber !== searchRequestNumber) return;
            contacts = Array.isArray(data.rows) ? data.rows : [];
            contacts.forEach(contact => {
                knownContacts.set(
                    String(contact.contact_id),
                    contact.contact_name || contact.contact_id
                );
            });
            updateContactFilter();

            if (!contacts.length) {
                searchResults.textContent = "No contacts found.";
                return;
            }

            searchResults.innerHTML = `
                <div style="margin-bottom:8px;">
                    ${h(contacts.length)} contacts found. Select a contact below.
                </div>
                <table class="notes-table">
                    <thead>
                        <tr>
                            <th>Contact</th><th>Business</th><th>Email</th>
                            <th>Type</th><th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${contacts.map(contact => `
                            <tr>
                                <td>${h(contact.contact_name)}</td>
                                <td>${h(contact.business_name || "")}</td>
                                <td>${h(contact.email || "No email")}</td>
                                <td>${h(contact.contact_type || "No type")}</td>
                                <td>
                                    <button
                                        type="button"
                                        class="btn-secondary"
                                        data-select-contact="${h(contact.contact_id)}"
                                        ${generating ? "disabled" : ""}
                                    >Select</button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        } catch (error) {
            if (!isCurrentView() || requestNumber !== searchRequestNumber) return;
            searchResults.textContent = error.message;
        } finally {
            if (isCurrentView() && requestNumber === searchRequestNumber) {
                findButton.textContent = "Find";
                findButton.disabled = generating;
            }
        }
    }

    function selectContact(contact) {
        if (generating) return;
        selectedContact = contact;
        selectedContactDisplay.textContent =
            `Selected Contact: ${contact.contact_name || contact.contact_id}`
            + (contact.email ? ` (${contact.email})` : "");
        resetPreview("Choose the date range, then click Load Notes.");
    }

    function dateRangeChanged() {
        if (generating) return;
        resetPreview("Date range changed. Click Load Notes to retrieve the matching notes.");
    }

    function resetPreview(status) {
        ++notesRequestNumber;
        notes = [];
        selectedNoteIds.clear();
        previewCriteria = null;
        previewLoading = false;
        preview.style.display = "none";
        noteRows.innerHTML = "";
        notesStatus.textContent = status;
        message.textContent = "";
        loadNotesButton.textContent = "Load Notes";
        updateControls();
    }

    function currentCriteria() {
        return {
            contact_id: String(selectedContact?.contact_id ?? ""),
            from: fromInput.value,
            to: toInput.value,
            time_zone: timeZone
        };
    }

    function previewMatchesCriteria() {
        if (!previewCriteria) return false;
        const current = currentCriteria();
        return Object.keys(current).every(key =>
            current[key] === previewCriteria[key]
        );
    }

    /* -------------------------------------------------------
    LOAD NOTES FOR THE SELECTED CONTACT AND DATE RANGE

    Backend contract:
    GET /notes_summary/notes
        ?project=&contact_id=&from=&to=&time_zone=
    Response: { status: "ok", rows: [...original notes], message? }
    Each row includes id, note_date, subject and raw_text/note_text.
    The backend returns all matching rows, not a truncated page.
    ------------------------------------------------------- */

    async function loadNotes() {
        if (!canGenerate || generating || previewLoading) return;
        const criteria = currentCriteria();
        if (!criteria.contact_id) {
            notesStatus.textContent = "Select a contact first.";
            return;
        }
        if (!criteria.from || !criteria.to) {
            notesStatus.textContent = "Select both From and To dates.";
            return;
        }
        if (criteria.from > criteria.to) {
            notesStatus.textContent = "From date must not be later than To date.";
            return;
        }

        resetPreview("Loading notes for the selected date range…");
        const requestNumber = ++notesRequestNumber;
        previewLoading = true;
        loadNotesButton.textContent = "Loading…";
        updateControls();

        try {
            const data = await summaryApi("/notes_summary/notes", {
                project,
                ...criteria
            });
            if (!isCurrentView() || requestNumber !== notesRequestNumber) return;
            if (!Array.isArray(data.rows)) {
                throw new Error("The server did not return a notes list.");
            }

            notes = data.rows;
            previewCriteria = criteria;
            selectedNoteIds.clear();
            notes.forEach(note => {
                if (noteCanBeSelected(note)) {
                    selectedNoteIds.add(String(note.id));
                }
            });

            if (!notes.length) {
                notesStatus.textContent = data.message
                    || "No notes found for this contact in the selected date range.";
                preview.style.display = "none";
                return;
            }

            renderNotesPreview();
            preview.style.display = "block";
            const usableCount = notes.filter(noteCanBeSelected).length;
            notesStatus.textContent = usableCount
                ? "Review the notes below. All usable notes are selected; uncheck any you want to exclude."
                : "Notes were found, but none have original note text available for a summary.";
        } catch (error) {
            if (!isCurrentView() || requestNumber !== notesRequestNumber) return;
            notes = [];
            selectedNoteIds.clear();
            previewCriteria = null;
            preview.style.display = "none";
            notesStatus.textContent = error.message;
        } finally {
            if (isCurrentView() && requestNumber === notesRequestNumber) {
                previewLoading = false;
                loadNotesButton.textContent = "Load Notes";
                updateControls();
            }
        }
    }

    function originalNoteText(note) {
        const raw = typeof note.raw_text === "string" ? note.raw_text.trim() : "";
        const text = typeof note.note_text === "string" ? note.note_text.trim() : "";
        return raw || text;
    }

    function noteCanBeSelected(note) {
        return note.id !== undefined && note.id !== null
            && String(note.id).trim() !== ""
            && originalNoteText(note).length > 0;
    }

    function renderNotesPreview() {
        noteRows.innerHTML = notes.map((note, index) => {
            const usable = noteCanBeSelected(note);
            const content = originalNoteText(note);
            return `
                <tr>
                    <td>
                        <input
                            type="checkbox"
                            data-note-index="${index}"
                            aria-label="Include ${h(note.subject || "Untitled note")} in summary"
                            ${usable && selectedNoteIds.has(String(note.id)) ? "checked" : ""}
                            ${!usable || generating ? "disabled" : ""}
                        >
                    </td>
                    <td>${displayDateTime(note.note_date)}</td>
                    <td>${h(note.subject || "Untitled")}</td>
                    <td>
                        ${content ? `
                            <details>
                                <summary style="cursor:pointer;">Expand Note</summary>
                                <div style="margin-top:8px;">
                                    From: ${h(note.from_name || "Not recorded")}
                                    ${note.from_email ? `(${h(note.from_email)})` : ""}
                                </div>
                                <div style="margin-top:8px; white-space:pre-wrap; overflow-wrap:anywhere;">${h(content)}</div>
                            </details>
                        ` : `<span class="muted">No original note text available.</span>`}
                        ${content && !usable ? `
                            <div class="muted">This note has no usable ID and cannot be selected.</div>
                        ` : ""}
                    </td>
                </tr>
            `;
        }).join("");
    }

    function syncNoteCheckboxes() {
        noteRows.querySelectorAll("[data-note-index]").forEach(checkbox => {
            const note = notes[Number(checkbox.dataset.noteIndex)];
            checkbox.checked = !!note && noteCanBeSelected(note)
                && selectedNoteIds.has(String(note.id));
        });
    }

    function setActionButton(button, enabled) {
        button.disabled = !enabled;
        button.className = enabled ? "btn-primary" : "btn-secondary";
        button.style.backgroundColor = enabled ? "" : "#999";
        button.style.color = enabled ? "" : "#fff";
        button.style.cursor = enabled ? "" : "not-allowed";
        button.style.opacity = enabled ? "" : "0.65";
    }

    function updateControls() {
        if (!canGenerate) return;
        const criteria = currentCriteria();
        const validRange = !!criteria.from && !!criteria.to
            && criteria.from <= criteria.to;
        const hasContact = !!criteria.contact_id;
        const selectionReady = previewMatchesCriteria()
            && selectedNoteIds.size > 0;

        setActionButton(
            generateButton,
            selectionReady && !previewLoading && !generating
        );
        setActionButton(
            loadNotesButton,
            hasContact && validRange && !previewLoading && !generating
        );

        fromInput.disabled = !hasContact || generating;
        toInput.disabled = !hasContact || generating;
        searchInput.disabled = generating;
        findButton.disabled = generating;
        selectAllButton.disabled = generating || previewLoading
            || !notes.some(noteCanBeSelected);
        clearAllButton.disabled = generating || previewLoading
            || selectedNoteIds.size === 0;

        selectionCount.textContent = `${selectedNoteIds.size} of ${notes.length} notes selected.`;

        searchResults.querySelectorAll("[data-select-contact]")
            .forEach(button => { button.disabled = generating; });
        noteRows.querySelectorAll("[data-note-index]").forEach(checkbox => {
            const note = notes[Number(checkbox.dataset.noteIndex)];
            checkbox.disabled = generating || previewLoading
                || !note || !noteCanBeSelected(note);
        });
    }

    /* -------------------------------------------------------
    SAVED SUMMARY CONTACT FILTER
    ------------------------------------------------------- */

    function updateContactFilter() {
        const selected = filterSelect.value;
        const currentOption = filterSelect.options[filterSelect.selectedIndex];
        const selectedName = currentOption?.textContent || selected;
        savedRows.forEach(row => {
            knownContacts.set(
                String(row.contact_id),
                row.contact_name || row.contact_id
            );
        });
        if (selected && !knownContacts.has(selected)) {
            knownContacts.set(selected, selectedName);
        }
        filterSelect.innerHTML = `
            <option value="">All Contacts</option>
            ${[...knownContacts.entries()]
                .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
                .map(([id, name]) => `
                    <option value="${h(id)}">${h(name)}</option>
                `).join("")}
        `;
        filterSelect.value = selected;
    }

    /* -------------------------------------------------------
    LOAD SAVED SUMMARIES
    ------------------------------------------------------- */

    async function loadSavedSummaries() {
        const requestNumber = ++listRequestNumber;
        listMessage.textContent = "Loading saved summaries…";
        previousButton.disabled = true;
        nextButton.disabled = true;
        try {
            const data = await summaryApi("/notes_summary/list", {
                project,
                contact_id: filterSelect.value,
                limit: SUMMARY_PAGE_SIZE,
                offset
            });
            if (!isCurrentView() || requestNumber !== listRequestNumber) return;
            savedRows = Array.isArray(data.rows) ? data.rows : [];
            hasMore = data.has_more === true;
            updateContactFilter();
            rowsContainer.innerHTML = savedRows.length
                ? savedRows.map(row => `
                    <tr>
                        <td>${h(row.contact_name)}</td>
                        <td>
                            ${h(row.date_from)} to ${h(row.date_to)}<br>
                            <small>${h(row.time_zone)}</small>
                        </td>
                        <td>${displayDateTime(row.generated_at)}</td>
                        <td>${h(row.generated_by_name || row.generated_by_email || "Not recorded")}</td>
                        <td>${h(row.source_notes_count)}</td>
                        <td>
                            <button class="btn-secondary" data-view-summary="${h(row.id)}">
                                View
                            </button>
                        </td>
                    </tr>
                `).join("")
                : `<tr><td colspan="6">No saved summaries found.</td></tr>`;
            listMessage.textContent = "";
            find("page").textContent = savedRows.length
                ? `Showing ${offset + 1}–${offset + savedRows.length}` : "";
            previousButton.disabled = offset === 0;
            nextButton.disabled = !hasMore;
        } catch (error) {
            if (!isCurrentView() || requestNumber !== listRequestNumber) return;
            rowsContainer.innerHTML = `
                <tr><td colspan="6">Unable to load saved summaries.</td></tr>
            `;
            find("page").textContent = "";
            listMessage.textContent = error.message;
            previousButton.disabled = offset === 0;
            nextButton.disabled = true;
        }
    }

    /* -------------------------------------------------------
    OPEN A SAVED SUMMARY — NO AI REQUEST
    ------------------------------------------------------- */

    async function openSavedSummary(id) {
        const requestNumber = ++reportRequestNumber;
        message.textContent = "Opening saved summary…";
        try {
            const data = await summaryApi(
                `/notes_summary/${encodeURIComponent(id)}`, { project }
            );
            if (!isCurrentView() || requestNumber !== reportRequestNumber) return;
            if (!data.summary) throw new Error("Saved summary was not returned.");
            renderSummaryReport(reportContainer, data.summary);
            message.textContent = "";
            reportContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (error) {
            if (!isCurrentView() || requestNumber !== reportRequestNumber) return;
            message.textContent = error.message;
        }
    }

    /* -------------------------------------------------------
    GENERATE FROM SELECTED NOTES ONLY

    Backend must require and validate selected_note_ids against
    this project, contact and date range. It must NOT ignore the
    selection and regenerate from every note in the period.
    ------------------------------------------------------- */

    async function generateSummary() {
        if (!canGenerate || generating || previewLoading) return;
        if (!previewMatchesCriteria()) {
            message.textContent = "Load notes for the current contact and date range first.";
            return;
        }
        const selectedIds = notes
            .filter(note => noteCanBeSelected(note)
                && selectedNoteIds.has(String(note.id)))
            .map(note => note.id);
        if (!selectedIds.length) {
            message.textContent = "Select at least one note to generate a summary.";
            return;
        }

        const criteria = { ...previewCriteria };
        const excludedIds = notes
            .filter(note => !selectedNoteIds.has(String(note.id)))
            .map(note => note.id)
            .filter(id => id !== null && id !== undefined);
        const requestNumber = ++reportRequestNumber;
        generating = true;
        generateButton.textContent = "Generating…";
        updateControls();
        message.textContent = "Generating and saving the summary from the selected notes. Please wait…";

        try {
            const data = await summaryApi("/notes_history/period-summary", null, {
                project,
                ...identity,
                ...criteria,
                selected_note_ids: selectedIds,
                excluded_note_ids: excludedIds
            });
            if (!isCurrentView()) return;
            if (!data.report) {
                if (requestNumber === reportRequestNumber) {
                    reportContainer.innerHTML = "";
                    message.textContent = data.message
                        || "No usable selected notes were available for this summary.";
                }
                return;
            }

            if (requestNumber === reportRequestNumber) {
                renderSummaryReport(reportContainer, {
                    metadata: data.metadata,
                    report: data.report,
                    sources: data.sources,
                    generated_by_name: identity.user_name,
                    generated_by_email: identity.user_email
                });
                message.textContent = data.saved
                    ? "Summary generated and saved."
                    : "Summary generated, but saving was not confirmed.";
                if (data.usage_warning) message.textContent += `\n${data.usage_warning}`;
            }
            offset = 0;
            await loadSavedSummaries();
        } catch (error) {
            if (!isCurrentView() || requestNumber !== reportRequestNumber) return;
            message.textContent = error.message;
        } finally {
            generating = false;
            if (isCurrentView()) {
                generateButton.textContent = "Generate Summary";
                updateControls();
            }
        }
    }

    // No automatic contact search or note loading.
    await loadSavedSummaries();
}

/* -------------------------------------------------------
API REQUESTS
------------------------------------------------------- */

async function summaryApi(path, query = null, body = null) {
    const url = new URL(`${CONTACTS_API}${path}`);
    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        });
    }
    const response = await fetch(url.toString(), {
        method: body ? "POST" : "GET",
        cache: "no-cache",
        ...(body ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        } : {})
    });
    let data;
    try { data = await response.json(); }
    catch {
        throw new Error(`The server returned an invalid response (${response.status}).`);
    }
    if (!response.ok || data?.status === "error") {
        throw new Error(typeof data?.error === "string"
            ? data.error : `Request failed (${response.status}).`);
    }
    return data;
}

/* -------------------------------------------------------
REPORT DISPLAY
------------------------------------------------------- */

function renderSummaryReport(container, saved) {
    const metadata = saved.metadata || {};
    const report = saved.report || {};

    const sources = Array.isArray(saved.sources)
        ? saved.sources
        : [];

    const sourceMap = new Map(
        sources.map(source => [source.source_id, source])
    );

    const commitments = Array.isArray(report.commitments)
        ? report.commitments
        : [];

    const skippedNotes = Array.isArray(metadata.skipped_notes)
        ? metadata.skipped_notes
        : [];

    function evidenceHtml(evidence) {
        if (!Array.isArray(evidence) || !evidence.length) {
            return "";
        }

        return `
            <details style="margin-top:8px;">
                <summary style="cursor:pointer;">
                    Supporting evidence
                </summary>

                ${evidence.map(item => {
                    const source = sourceMap.get(item.source_id);

                    return `
                        <div style="
                            margin-top:8px;
                            padding:8px 12px;
                            background:#f9f9f9;
                        ">
                            <div>
                                <strong>${h(item.source_id)}</strong>
                                ${
                                    source?.note_date
                                    ? ` — ${displayDateTime(source.note_date)}`
                                    : ""
                                }
                            </div>

                            ${
                                source?.subject
                                ? `<div>${h(source.subject)}</div>`
                                : ""
                            }

                            <blockquote style="
                                margin:8px 0;
                                white-space:pre-wrap;
                            ">${h(item.quote)}</blockquote>
                        </div>
                    `;
                }).join("")}
            </details>
        `;
    }

    function pointsHtml(title, points) {
        const items = Array.isArray(points) ? points : [];

        return `
            <div style="margin-top:20px;">
                <h3>${h(title)}</h3>

                ${
                    items.length
                    ? items.map(item => `
                        <div style="margin-bottom:14px;">
                            <div style="white-space:pre-wrap;">
                                ${h(item.text)}
                            </div>
                            ${evidenceHtml(item.evidence)}
                        </div>
                    `).join("")
                    : `<p>Not documented in the selected notes.</p>`
                }
            </div>
        `;
    }

    function commitmentsHtml(title, state) {
        const tasks = commitments.filter(task => task.state === state);

        return `
            <div style="margin-top:20px;">
                <h3>${h(title)}</h3>

                ${
                    tasks.length
                    ? tasks.map(task => `
                        <div style="
                            margin-bottom:16px;
                            padding:12px;
                            background:#f9f9f9;
                        ">
                            <div>
                                <strong>${h(task.task)}</strong>
                            </div>

                            <div style="margin-top:6px;">
                                Owner: ${h(task.owner)}
                            </div>

                            <div>
                                Deadline: ${h(task.deadline)}
                            </div>

                            ${
                                task.first_documented_note_date
                                ? `
                                    <div>
                                        First documented:
                                        ${displayDateTime(
                                            task.first_documented_note_date
                                        )}
                                    </div>
                                `
                                : ""
                            }

                            <div style="
                                margin-top:8px;
                                white-space:pre-wrap;
                            ">${h(task.latest_update)}</div>

                            ${
                                task.documentation_status
                                ? `
                                    <div style="margin-top:8px;">
                                        ${h(task.documentation_status)}
                                    </div>
                                `
                                : ""
                            }

                            ${
                                task.assignment
                                ? `
                                    <div style="margin-top:8px;">
                                        Assignment / first task mention:
                                        ${evidenceHtml([task.assignment])}
                                    </div>
                                `
                                : ""
                            }

                            ${evidenceHtml(task.evidence)}

                            ${
                                Array.isArray(task.resolution_evidence)
                                && task.resolution_evidence.length
                                ? `
                                    <div style="margin-top:8px;">
                                        Resolution:
                                        ${evidenceHtml(
                                            task.resolution_evidence
                                        )}
                                    </div>
                                `
                                : ""
                            }
                        </div>
                    `).join("")
                    : `<p>None documented in the selected notes.</p>`
                }
            </div>
        `;
    }

    container.innerHTML = `
        <section class="card">
            <h2>
                Notes Summary:
                ${h(
                    metadata.contact_name
                    || saved.contact_name
                    || "Contact"
                )}
            </h2>

            <div>
                Period:
                ${h(metadata.from || saved.date_from)}
                to
                ${h(metadata.to || saved.date_to)}
            </div>

            <div>
                Timezone:
                ${h(metadata.time_zone || saved.time_zone || "UTC")}
            </div>

            <div>
                Generated:
                ${displayDateTime(
                    metadata.generated_at || saved.generated_at
                )}
            </div>

            ${
                saved.generated_by_name || saved.generated_by_email
                ? `
                    <div>
                        Generated by:
                        ${h(
                            saved.generated_by_name
                            || saved.generated_by_email
                        )}
                    </div>
                `
                : ""
            }

            <div style="margin-top:8px;">
                Matching notes: ${h(metadata.matched_notes)}
                |
                Notes used: ${h(metadata.source_notes_count)}
                |
                Skipped: ${h(skippedNotes.length)}
            </div>

            ${
                metadata.scope
                ? `
                    <p style="margin-top:12px;">
                        ${h(metadata.scope)}
                    </p>
                `
                : ""
            }

            ${pointsHtml("Period Overview", report.period_overview)}

            ${pointsHtml("Progress and Wins", report.progress_and_wins)}

            ${pointsHtml("Key Decisions", report.key_decisions)}

            ${
                pointsHtml(
                    "Challenges and Blockers",
                    report.challenges_and_blockers
                )
            }

            ${
                commitmentsHtml(
                    "Outstanding Commitments — Completion Not Confirmed",
                    "open"
                )
            }

            ${commitmentsHtml("Completed Commitments", "completed")}

            ${commitmentsHtml("Cancelled Commitments", "cancelled")}

            ${
                pointsHtml(
                    "Agreed Next-Period Priorities",
                    report.next_period_priorities?.agreed
                )
            }

            ${
                skippedNotes.length
                ? `
                    <details style="margin-top:20px;">
                        <summary style="cursor:pointer;">
                            Skipped Notes (${h(skippedNotes.length)})
                        </summary>

                        <ul>
                            ${skippedNotes.map(note => `
                                <li style="margin-top:8px;">
                                    ${displayDateTime(note.note_date)}
                                    — ${h(note.subject || "Untitled")}
                                    — ${h(note.reason)}
                                </li>
                            `).join("")}
                        </ul>
                    </details>
                `
                : ""
            }

            <details style="margin-top:20px;">
                <summary style="cursor:pointer;">
                    Source Notes (${h(sources.length)})
                </summary>

                ${sources.map(source => `
                    <details style="
                        margin-top:12px;
                        padding:10px;
                        background:#f9f9f9;
                    ">
                        <summary style="cursor:pointer;">
                            ${h(source.source_id)}
                            — ${displayDateTime(source.note_date)}
                            — ${h(source.subject || "Untitled")}
                        </summary>

                        <div style="margin-top:8px;">
                            From:
                            ${h(source.from_name || "Not recorded")}
                            ${
                                source.from_email
                                ? `(${h(source.from_email)})`
                                : ""
                            }
                        </div>

                        <div style="
                            margin-top:8px;
                            white-space:pre-wrap;
                            overflow-wrap:anywhere;
                        ">${h(source.content)}</div>
                    </details>
                `).join("")}
            </details>
        </section>
    `;
}

/* -------------------------------------------------------
DISPLAY HELPERS
------------------------------------------------------- */

function h(value) {
    return escapeHtml(String(value ?? ""));
}

function displayDateTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return h(value);
    }

    return h(formatDateTime(value));
}
