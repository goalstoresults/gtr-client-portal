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
        activeSummaryViews.get(container) === view;

    // Same staff permission field added to projects_staff.
    // The backend independently checks the database permission.
    const canGenerate =
        portalState.can_generate_notes_summary === true;

    const project = portalState.project;

    const identity = {
        user_id: portalState.user_id ?? "",
        user_email: portalState.userEmail || ""
    };

    let contacts = [];
    let savedRows = [];
    let offset = 0;
    let hasMore = false;
    let listRequestNumber = 0;
    let reportRequestNumber = 0;
    let generating = false;

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
                            flex:1;
                            min-width:240px;
                        ">
                            <span>Contact</span>
                            <select
                                data-summary="contact"
                                disabled
                            >
                                <option value="">
                                    Loading contacts…
                                </option>
                            </select>
                        </label>

                        <label style="
                            display:flex;
                            flex-direction:column;
                        ">
                            <span>From</span>
                            <input
                                type="date"
                                data-summary="from"
                                style="min-width:160px;"
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
                            >
                        </label>
                    </div>

                    <p style="margin:8px 0;">
                        Date range timezone:
                        <span data-summary="timezone"></span>
                    </p>

                    <button
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

    const contactSelect = find("contact");
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

    const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    if (canGenerate) {
        find("timezone").textContent = timeZone;
        generateButton.addEventListener("click", generateSummary);
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
    LOAD CONTACTS WITH NOTES
    ------------------------------------------------------- */

    async function loadContacts() {
        try {
            const data = await summaryApi(
                "/notes_summary/contacts",
                {
                    project,
                    ...identity
                }
            );

            if (!isCurrentView()) return;

            contacts = Array.isArray(data.rows) ? data.rows : [];

            if (contactSelect) {
                contactSelect.innerHTML = `
                    <option value="">Select a contact</option>
                    ${contacts.map(contact => `
                        <option value="${h(contact.contact_id)}">
                            ${h(contact.contact_name)}
                            — ${h(contact.notes_count)} notes
                        </option>
                    `).join("")}
                `;

                contactSelect.disabled = contacts.length === 0;
                generateButton.disabled = contacts.length === 0;
            }

            updateContactFilter();

            if (canGenerate && contacts.length === 0) {
                message.textContent =
                    "No contacts with notes were found in this project.";
            }
        } catch (error) {
            if (!isCurrentView()) return;

            if (contactSelect) {
                contactSelect.innerHTML = `
                    <option value="">
                        Unable to load contacts
                    </option>
                `;
            }

            message.textContent = error.message;
        }
    }

    function updateContactFilter() {
        const selected = filterSelect.value;
        const options = new Map();

        contacts.forEach(contact => {
            options.set(
                String(contact.contact_id),
                contact.contact_name || contact.contact_id
            );
        });

        // Keep saved reports filterable even when their contact
        // no longer has any current source notes.
        savedRows.forEach(row => {
            if (!options.has(String(row.contact_id))) {
                options.set(
                    String(row.contact_id),
                    row.contact_name || row.contact_id
                );
            }
        });

        // Preserve the selected filter during list refreshes.
        if (selected && !options.has(selected)) {
            const currentOption =
                filterSelect.options[filterSelect.selectedIndex];

            options.set(
                selected,
                currentOption?.textContent || selected
            );
        }

        filterSelect.innerHTML = `
            <option value="">All Contacts</option>
            ${
                [...options.entries()]
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
                    ...identity,
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
                {
                    project,
                    ...identity
                }
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
        if (!canGenerate || generating) return;

        const contactId = contactSelect.value;
        const from = fromInput.value;
        const to = toInput.value;

        if (!contactId) {
            message.textContent = "Select a contact first.";
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
        generateButton.disabled = true;
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
                }

                message.textContent =
                    data.message
                    || "No notes with original text were found in this range.";

                return;
            }

            if (requestNumber === reportRequestNumber) {
                renderSummaryReport(reportContainer, {
                    metadata: data.metadata,
                    report: data.report,
                    sources: data.sources
                });
            }

            message.textContent = data.saved
                ? "Summary generated and saved."
                : "Summary generated, but saving was not confirmed.";

            if (data.usage_warning) {
                message.textContent += `\n${data.usage_warning}`;
            }

            // Keep the saved-list filter independent of the
            // generation contact selection.
            offset = 0;
            await loadSavedSummaries();

        } catch (error) {
            if (!isCurrentView()) return;
            message.textContent = error.message;

        } finally {
            generating = false;

            if (isCurrentView()) {
                generateButton.disabled = contacts.length === 0;
                generateButton.textContent = "Generate Summary";
            }
        }
    }

    await Promise.all([
        loadContacts(),
        loadSavedSummaries()
    ]);
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
