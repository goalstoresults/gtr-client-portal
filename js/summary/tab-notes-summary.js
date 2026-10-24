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

    // Generation controls follow the existing portal permission.
    // Staff details sent during generation are attribution only.
    const canGenerate =
        portalState.can_generate_notes_summary === true;

    const project = portalState.project;

    const identity = {
        user_id: portalState.user_id ?? "",
        user_email: portalState.userEmail || "",
        user_name: portalState.staffName
            || [portalState.firstName, portalState.lastName]
                .filter(Boolean).join(" ").trim()
    };

    let contacts = [];
    let savedRows = [];
    let selectedContact = null;
    let selectedContactHasNotes = false;
    let checkingNotes = false;
    let offset = 0;
    let hasMore = false;
    let listRequestNumber = 0;
    let reportRequestNumber = 0;
    let searchRequestNumber = 0;
    let notesRequestNumber = 0;
    let generating = false;

    const knownContacts = new Map();

    container.innerHTML = `
        <section class="card">
            <h2>Notes Summary</h2>

            <p>
                Generate a contact summary for a selected period,
                or open an existing saved summary below.
            </p>

            ${
                canGenerate
                ? `
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
                            >
                                Find
                            </button>
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
                    >
                        No contact selected.
                    </div>

                    <div
                        data-summary="notes-status"
                        role="status"
                        aria-live="polite"
                        style="margin-bottom:12px;"
                    ></div>

                    <div style="
                        display:flex;
                        align-items:flex-start;
                        gap:20px;
                        flex-wrap:wrap;
                        margin:12px 0;
                    ">
                        <label style="
                            display:flex;
                            flex-direction:column;
                        ">
                            <span>From</span>
                            <input
                                type="date"
                                data-summary="from"
                                style="min-width:160px;"
                                disabled
                            >
                        </label>

                        <label style="
                            display:flex;
                            flex-direction:column;
                        ">
                            <span>To</span>
                            <input
                                type="date"
                                data-summary="to"
                                style="min-width:160px;"
                                disabled
                            >
                        </label>
                    </div>

                    <p style="margin:8px 0;">
                        Date range timezone:
                        <span data-summary="timezone"></span>
                    </p>

                    <button
                        type="button"
                        class="btn-primary"
                        data-summary="generate"
                        disabled
                    >
                        Generate Summary
                    </button>
                `
                : `
                    <p>
                        You can view saved summaries.
                        Generating new summaries requires
                        generation permission.
                    </p>
                `
            }

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

                <button
                    class="btn-secondary"
                    data-summary="refresh"
                >
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
                <label style="
                    display:flex;
                    flex-direction:column;
                    min-width:240px;
                ">
                    <span>Filter by Contact</span>
                    <select data-summary="filter">
                        <option value="">All Contacts</option>
                    </select>
                </label>

                <button
                    class="btn-secondary"
                    data-summary="clear-filter"
                >
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
                        <tr>
                            <td colspan="6">
                                Loading saved summaries…
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div style="
                display:flex;
                align-items:center;
                gap:12px;
                margin-top:12px;
            ">
                <button
                    class="btn-secondary"
                    data-summary="previous"
                    disabled
                >
                    Previous
                </button>

                <span data-summary="page"></span>

                <button
                    class="btn-secondary"
                    data-summary="next"
                    disabled
                >
                    Next
                </button>
            </div>
        </section>

        <div
            data-summary="report"
            style="margin-top:16px;"
        ></div>
    `;

    const find = name =>
        container.querySelector(`[data-summary="${name}"]`);

    const searchInput = find("search");
    const findButton = find("find");
    const searchResults = find("search-results");
    const selectedContactDisplay = find("selected-contact");
    const notesStatus = find("notes-status");
    const fromInput = find("from");
    const toInput = find("to");
    const generateButton = find("generate");
    const filterSelect = find("filter");
    const message = find("message");
    const listMessage = find("list-message");
    const rowsContainer = find("rows");
    const reportContainer = find("report");
    const previousButton = find("previous");
    const nextButton = find("next");

    view.root = message;

    const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    if (canGenerate) {
        find("timezone").textContent = timeZone;
        generateButton.addEventListener("click", generateSummary);
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
    }

    find("refresh").addEventListener("click", () => {
        loadSavedSummaries();
    });

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
        if (!button) return;

        const id = button.dataset.viewSummary;
        openSavedSummary(id);
    });

    /* -------------------------------------------------------
    FIND CONTACTS — BLANK CRITERIA RETURNS ALL PROJECT CONTACTS
    ------------------------------------------------------- */

    async function findContacts() {
        if (!canGenerate || generating) return;

        const requestNumber = ++searchRequestNumber;
        const term = searchInput.value.trim();

        findButton.disabled = true;
        findButton.textContent = "Finding…";
        searchResults.textContent = "Searching…";

        try {
            const data = await summaryApi(
                "/notes_summary/contacts",
                {
                    project,
                    search: term
                }
            );

            if (
                !isCurrentView()
                || requestNumber !== searchRequestNumber
            ) {
                return;
            }

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
                    ${h(contacts.length)} contacts found.
                    Select a contact below.
                </div>

                <table class="notes-table">
                    <thead>
                        <tr>
                            <th>Contact</th>
                            <th>Business</th>
                            <th>Email</th>
                            <th>Type</th>
                            <th>Action</th>
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
                                    >
                                        Select
                                    </button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        } catch (error) {
            if (
                !isCurrentView()
                || requestNumber !== searchRequestNumber
            ) {
                return;
            }

            searchResults.textContent = error.message;
        } finally {
            if (
                isCurrentView()
                && requestNumber === searchRequestNumber
            ) {
                findButton.disabled = generating;
                findButton.textContent = "Find";
            }
        }
    }

    /* -------------------------------------------------------
    SELECT CONTACT AND CHECK FOR ATTACHED NOTES
    ------------------------------------------------------- */

    async function selectContact(contact) {
        if (generating) return;

        const requestNumber = ++notesRequestNumber;

        selectedContact = contact;
        selectedContactHasNotes = false;
        checkingNotes = true;

        selectedContactDisplay.textContent =
            `Selected Contact: ${contact.contact_name || contact.contact_id}`
            + (contact.email ? ` (${contact.email})` : "");

        notesStatus.textContent = "Checking notes for this contact…";
        message.textContent = "";
        updateGenerationControls();

        try {
            const data = await summaryApi(
                "/notes_summary/contact-notes",
                {
                    project,
                    contact_id: contact.contact_id
                }
            );

            if (
                !isCurrentView()
                || requestNumber !== notesRequestNumber
            ) {
                return;
            }

            selectedContactHasNotes = data.has_notes === true;
            notesStatus.textContent = selectedContactHasNotes
                ? "Notes found for this contact. Select the date range below."
                : "No notes found for this contact.";
        } catch (error) {
            if (
                !isCurrentView()
                || requestNumber !== notesRequestNumber
            ) {
                return;
            }

            selectedContactHasNotes = false;
            notesStatus.textContent = error.message;
        } finally {
            if (
                isCurrentView()
                && requestNumber === notesRequestNumber
            ) {
                checkingNotes = false;
                updateGenerationControls();
            }
        }
    }

    function updateGenerationControls() {
        if (!canGenerate) return;

        const ready = selectedContact
            && selectedContactHasNotes
            && !checkingNotes
            && !generating;

        generateButton.disabled = !ready;
        fromInput.disabled = !ready;
        toInput.disabled = !ready;
        searchInput.disabled = generating;
        findButton.disabled = generating;

        searchResults.querySelectorAll("[data-select-contact]")
            .forEach(button => {
                button.disabled = generating;
            });
    }

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
            ${
                [...knownContacts.entries()]
                    .sort((a, b) =>
                        String(a[1]).localeCompare(String(b[1]))
                    )
                    .map(([id, name]) => `
                        <option value="${h(id)}">
                            ${h(name)}
                        </option>
                    `)
                    .join("")
            }
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
            const data = await summaryApi(
                "/notes_summary/list",
                {
                    project,
                    contact_id: filterSelect.value,
                    limit: SUMMARY_PAGE_SIZE,
                    offset
                }
            );

            if (
                !isCurrentView()
                || requestNumber !== listRequestNumber
            ) {
                return;
            }

            savedRows = Array.isArray(data.rows) ? data.rows : [];
            hasMore = data.has_more === true;

            updateContactFilter();

            rowsContainer.innerHTML = savedRows.length
                ? savedRows.map(row => `
                    <tr>
                        <td>${h(row.contact_name)}</td>

                        <td>
                            ${h(row.date_from)}
                            to
                            ${h(row.date_to)}
                            <br>
                            <small>${h(row.time_zone)}</small>
                        </td>

                        <td>${displayDateTime(row.generated_at)}</td>

                        <td>
                            ${h(
                                row.generated_by_name
                                || row.generated_by_email
                                || "Not recorded"
                            )}
                        </td>

                        <td>${h(row.source_notes_count)}</td>

                        <td>
                            <button
                                class="btn-secondary"
                                data-view-summary="${h(row.id)}"
                            >
                                View
                            </button>
                        </td>
                    </tr>
                `).join("")
                : `
                    <tr>
                        <td colspan="6">
                            No saved summaries found.
                        </td>
                    </tr>
                `;

            listMessage.textContent = "";

            find("page").textContent = savedRows.length
                ? `Showing ${offset + 1}–${offset + savedRows.length}`
                : "";

            previousButton.disabled = offset === 0;
            nextButton.disabled = !hasMore;
        } catch (error) {
            if (
                !isCurrentView()
                || requestNumber !== listRequestNumber
            ) {
                return;
            }

            rowsContainer.innerHTML = `
                <tr>
                    <td colspan="6">
                        Unable to load saved summaries.
                    </td>
                </tr>
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
                `/notes_summary/${encodeURIComponent(id)}`,
                { project }
            );

            if (
                !isCurrentView()
                || requestNumber !== reportRequestNumber
            ) {
                return;
            }

            if (!data.summary) {
                throw new Error("Saved summary was not returned.");
            }

            renderSummaryReport(reportContainer, data.summary);
            message.textContent = "";

            reportContainer.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        } catch (error) {
            if (
                !isCurrentView()
                || requestNumber !== reportRequestNumber
            ) {
                return;
            }

            message.textContent = error.message;
        }
    }

    /* -------------------------------------------------------
    GENERATE AND SAVE A NEW SUMMARY
    ------------------------------------------------------- */

    async function generateSummary() {
        if (!canGenerate || generating || checkingNotes) return;

        const contactId = selectedContact?.contact_id;
        const from = fromInput.value;
        const to = toInput.value;

        if (!contactId) {
            message.textContent = "Select a contact first.";
            return;
        }

        if (!selectedContactHasNotes) {
            message.textContent = "No notes found for this contact.";
            return;
        }

        if (!from || !to) {
            message.textContent = "Select both From and To dates.";
            return;
        }

        if (from > to) {
            message.textContent =
                "From date must not be later than To date.";
            return;
        }

        generating = true;
        updateGenerationControls();
        generateButton.textContent = "Generating…";

        const requestNumber = ++reportRequestNumber;

        message.textContent =
            "Generating and saving the summary. Please wait…";

        try {
            const data = await summaryApi(
                "/notes_history/period-summary",
                null,
                {
                    project,
                    ...identity,
                    contact_id: contactId,
                    from,
                    to,
                    time_zone: timeZone
                }
            );

            if (!isCurrentView()) return;

            if (!data.report) {
                if (requestNumber === reportRequestNumber) {
                    reportContainer.innerHTML = "";
                    message.textContent = data.message
                        || "No notes found for this contact in the selected date range.";
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

                if (data.usage_warning) {
                    message.textContent += `\n${data.usage_warning}`;
                }
            }

            // Keep the saved-list filter independent of the
            // generation contact selection.
            offset = 0;
            await loadSavedSummaries();

        } catch (error) {
            if (
                !isCurrentView()
                || requestNumber !== reportRequestNumber
            ) return;
            message.textContent = error.message;

        } finally {
            generating = false;

            if (isCurrentView()) {
                generateButton.textContent = "Generate Summary";
                updateGenerationControls();
            }
        }
    }

    // Contacts are searched only when Find is clicked.
    // Saved summaries still load immediately for the project.
    await loadSavedSummaries();
}

/* -------------------------------------------------------
API REQUESTS
------------------------------------------------------- */

async function summaryApi(path, query = null, body = null) {
    const url = new URL(`${CONTACTS_API}${path}`);

    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (
                value !== undefined
                && value !== null
                && value !== ""
            ) {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const response = await fetch(url.toString(), {
        method: body ? "POST" : "GET",
        cache: "no-cache",
        ...(body
            ? {
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            }
            : {})
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error(
            `The server returned an invalid response (${response.status}).`
        );
    }

    if (!response.ok || data?.status === "error") {
        throw new Error(
            typeof data?.error === "string"
                ? data.error
                : `Request failed (${response.status}).`
        );
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
