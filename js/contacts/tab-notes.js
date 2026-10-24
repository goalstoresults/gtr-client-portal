// js/contacts/tab-notes.js

// Contact Notes Tab — now with Date + Subject filters + Timeline deep linking

import { escapeHtml, formatDateTime } from "../utilities.js";
// ADDED: period-report state is kept only in memory, separately per client.
const CN_PERIOD_STATES = new WeakMap();
const CN_PERIOD_VIEWS = new WeakMap();


/* -------------------------------------------------------
REMOVE UNRESOLVED EMAIL SIGNATURE IMAGES BEFORE RENDERING
------------------------------------------------------- */

function removeCidImages(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html ?? "");

    template.content.querySelectorAll("img").forEach(img => {
        const src = (img.getAttribute("src") || "").trim();

        if (/^cid:/i.test(src)) {
            img.remove();
        }
    });

    return template.innerHTML;
}

/* -------------------------------------------------------
MAIN ENTRY: Render Contact Notes
------------------------------------------------------- */

export async function renderContactNotes(container, portalState, contactId) {
    // ADDED: prevent an old report/notes request from populating a new view.
    const periodViewToken = Symbol("contact-notes-view");
    CN_PERIOD_VIEWS.set(container, periodViewToken);


    if (!portalState.project || !contactId) {
        container.innerHTML = `
            <section class="card">
                <h2>Contact Notes</h2>
                <p>Select a contact from the list first, then open Notes.</p>
            </section>
        `;
        return;
    }

    /* -------------------------------------------------------
    FETCH NOTES
    ------------------------------------------------------- */
    const url = `https://contacts-module.dennis-e64.workers.dev/notes_history?project=${portalState.project}&contact_id=${contactId}`;
    const res = await fetch(url, { cache: "no-cache" });
    let notes = await res.json();
    if (!Array.isArray(notes)) notes = [];
    // ADDED: navigation/rerender may have changed while notes were loading.
    if (CN_PERIOD_VIEWS.get(container) !== periodViewToken) return;


    /* -------------------------------------------------------
    APPLY FILTERS FROM portalState (Timeline deep link)
    ------------------------------------------------------- */
    const filterDate = portalState.notesFilterDate || "";
    const filterSubject = portalState.notesFilterSubject || "";

    function applyFilters(list) {
        let filtered = [...list];

        if (filterDate) {
            const cutoff = new Date(filterDate);
            filtered = filtered.filter(n => {
                if (!n.note_date) return false;
                return new Date(n.note_date) >= cutoff;
            });
        }

        if (filterSubject) {
            const term = filterSubject.toLowerCase();
            filtered = filtered.filter(n =>
                (n.subject || "").toLowerCase().includes(term)
            );
        }

        return filtered;
    }

    const filteredNotes = applyFilters(notes);

    /* -------------------------------------------------------
    RENDER FILTER BAR + NOTES TABLE
    ------------------------------------------------------- */
    container.innerHTML = `
        <section class="card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2>Notes</h2>

                ${portalState.canEdit
                    ? `<button id="contactAddNoteBtn" class="btn-primary">+ Add Note</button>`
                    : ``}
            </div>

            <!-- FILTER BAR -->
            <div style="display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; margin:12px 0;">
                <label style="display:flex; flex-direction:column;">
                    <span>Date ≥</span>
                    <input type="date" id="notesFilterDate" value="${filterDate}" style="min-width:160px;">
                </label>

                <label style="display:flex; flex-direction:column;">
                    <span>Subject Contains</span>
                    <input type="text" id="notesFilterSubject" value="${escapeHtml(filterSubject)}" style="min-width:240px;">
                </label>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:12px;">
                <button id="btnApplyNotesFilter" class="secondary">Apply Filter</button>
                <button id="btnClearNotesFilter" class="secondary">Clear Filter</button>
            </div>


            <!-- ADDED: independent raw-note period report -->
            ${cnPeriodPanelMarkup(portalState, contactId)}
            <!-- END ADDED period report controls -->

            <table class="notes-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Summary</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="notesRows">
                    ${
                        filteredNotes.length > 0
                        ? filteredNotes.map((n, idx) => `
                            <tr>
                                <td>${n.note_date ? formatDateTime(n.note_date) : ""}</td>
                                <td>${escapeHtml(n.subject || "")}</td>
                                <td>${escapeHtml(n.summary || "")}</td>
                                <td>
                                    <button class="btn-secondary btn-expand" data-idx="${idx}" style="display:flex; align-items:center; gap:4px;">
                                        ▶ Expand
                                    </button>
                                </td>
                            </tr>

                            <tr class="note-details" data-idx="${idx}" style="display:none;">
                                <td colspan="4" style="background:#f9f9f9; padding:12px;">
                                    <div><strong>From:</strong> ${escapeHtml(n.from_name || "")} (${escapeHtml(n.from_email || "")})</div>
                                    <div><strong>Status:</strong> ${escapeHtml(n.review_status || "")}</div>
                                    <div><strong>Needs Review:</strong> ${n.needs_review ? "Yes" : "No"}</div>

                                    <div style="margin-top:8px;"><strong>Raw Text:</strong></div>

                                    ${
                                        /<\/?[a-z][^>]*>/i.test(String(n.raw_text ?? ""))
                                        ? `<div class="html-note-block">${removeCidImages(n.raw_text)}</div>`
                                        : `<div class="raw-text-block">${escapeHtml(String(n.raw_text ?? ""))}</div>`
                                    }

                                    ${portalState.canEdit
                                    ? `<button class="btn-primary btn-review-note" data-id="${n.id}" style="margin-top:8px; margin-right:8px;">Review Note
                                    </button>`
                                    : ``}

                                    ${
                                        portalState.deleteAllowed
                                        ? `<button class="btn-danger btn-delete-note" data-id="${n.id}" style="margin-top:8px;">Delete Note</button>`
                                        : ``
                                    }
                                </td>
                            </tr>
                        `).join("")
                        : `<tr><td colspan="4">(no notes found)</td></tr>`
                    }
                </tbody>
            </table>
        </section>
    `;


    /* -------------------------------------------------------
    ADDED: Wire period report; existing note handlers stay intact
    ------------------------------------------------------- */
    cnMountPeriodReport(container, portalState, contactId, periodViewToken);

    /* -------------------------------------------------------
    FILTER BUTTON HANDLERS
    ------------------------------------------------------- */
    document.getElementById("btnApplyNotesFilter").addEventListener("click", () => {
        portalState.notesFilterDate = document.getElementById("notesFilterDate").value || null;
        portalState.notesFilterSubject = document.getElementById("notesFilterSubject").value.trim() || null;
        renderContactNotes(container, portalState, contactId);
    });

    document.getElementById("btnClearNotesFilter").addEventListener("click", () => {
        portalState.notesFilterDate = null;
        portalState.notesFilterSubject = null;
        renderContactNotes(container, portalState, contactId);
    });

    /* -------------------------------------------------------
    ADD NOTE BUTTON
    ------------------------------------------------------- */
    document.getElementById("contactAddNoteBtn")
        ?.addEventListener("click", () =>
            showContactAddNoteForm(container, portalState, contactId)
        );

    /* -------------------------------------------------------
    EXPAND / COLLAPSE
    ------------------------------------------------------- */
    container.querySelectorAll(".btn-expand").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = btn.dataset.idx;
            const row = container.querySelector(`.note-details[data-idx="${idx}"]`);
            const isVisible = row.style.display !== "none";
            row.style.display = isVisible ? "none" : "table-row";
            btn.innerHTML = isVisible ? "▶ Expand" : "▼ Collapse";
        });
    });

    /* -------------------------------------------------------
    DELETE NOTE
    ------------------------------------------------------- */
    container.querySelectorAll(".btn-delete-note").forEach(btn => {
        btn.addEventListener("click", async () => {
            if (!confirm("Delete this note?")) return;

            const noteId = btn.dataset.id;

            await fetch(
                `https://notes-history-module.dennis-e64.workers.dev/note_history?id=${noteId}&project=${portalState.project}`,
                { method: "DELETE" }
            );

            await renderContactNotes(container, portalState, contactId);
        });
    });

    /* -------------------------------------------------------
    REVIEW NOTE — Jump to Notes → Review
    ------------------------------------------------------- */
    container.querySelectorAll(".btn-review-note").forEach(btn => {
        btn.addEventListener("click", () => {
            const noteId = btn.dataset.id;
            portalState.selectedNoteId = noteId;

            const notesTabBtn = document.querySelector('#tabs button[data-tab="3"]');
            if (notesTabBtn) notesTabBtn.click();

            const waitForReviewTab = setInterval(() => {
                const reviewBtn = document.querySelector('#notes-subtabs button[data-subtab="review"]');
                if (reviewBtn) {
                    clearInterval(waitForReviewTab);
                    reviewBtn.click();
                }
            }, 50);
        });
    });
}

/* -------------------------------------------------------
ADD NOTE FORM (Contacts → Notes)
------------------------------------------------------- */

function showContactAddNoteForm(container, portalState, contactId) {
    container.innerHTML = `
        <section class="card">
            <h3>Add Note for ${portalState.selectedContactName}</h3>

            <label>Date:</label>
            <input type="date" id="noteDate"
                value="${new Date().toISOString().split('T')[0]}"
                style="width:200px;margin-bottom:8px;" />
            <br/>

            <label>Subject:</label>
            <input type="text" id="noteSubject" style="width:100%;margin-bottom:8px;" />

            <label>Note:</label>
            <textarea id="noteContent" rows="6" style="width:100%;"></textarea>

            <div style="margin-top:12px;">
                <button id="saveContactNoteBtn" class="btn-primary">Save Note</button>
                <button id="cancelContactNoteBtn" class="btn-secondary" style="margin-left:8px;">Cancel</button>
            </div>

            <div id="contactNoteAddResult" style="margin-top:8px;"></div>
        </section>
    `;

    document.getElementById("saveContactNoteBtn")
        .addEventListener("click", () =>
            saveContactNote(portalState, contactId, container)
        );

    document.getElementById("cancelContactNoteBtn")
        .addEventListener("click", () =>
            renderContactNotes(container, portalState, contactId)
        );
}

/* -------------------------------------------------------
SAVE NOTE — ⭐ FIXED WITH USER IDENTITY FIELDS
------------------------------------------------------- */

async function saveContactNote(portalState, contactId, container) {

    const noteDate = document.getElementById("noteDate").value;
    const subject = document.getElementById("noteSubject").value.trim();
    const content = document.getElementById("noteContent").value.trim();

    if (!content) {
        document.getElementById("contactNoteAddResult").textContent =
            "Note text is required.";
        return;
    }

    try {
        const res = await fetch("https://add-note-module.dennis-e64.workers.dev", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-call": "internal"
            },
            body: JSON.stringify({
                project: portalState.project,
                raw_text: content,
                note_date: noteDate || null,
                subject: subject || null,
                contact_id: contactId,
                contact_name: portalState.selectedContactName,
                contact_email: portalState.selectedContactEmail,

                // ⭐ NEW — correct identity fields
                from_name: `${portalState.firstName} ${portalState.lastName}`.trim(),
                from_email: portalState.userEmail,
                created_by_user_id: portalState.user_id,
                created_by_source: "portal"
            })
        });

        const data = await res.json();

        if (data.success || data.status === "ok") {
            await renderContactNotes(container, portalState, contactId);
        } else {
            document.getElementById("contactNoteAddResult").textContent =
                `Error: ${data.error || "Unknown error"}`;
        }

    } catch (err) {
        document.getElementById("contactNoteAddResult").textContent =
            `Error: ${err.message}`;
    }
}


/* -------------------------------------------------------
ADDED: Date-range report UI — original functions above unchanged
------------------------------------------------------- */

function cnPeriodLocalDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function cnPeriodState(portalState, contactId) {
    let states = CN_PERIOD_STATES.get(portalState);
    if (!states) {
        states = new Map();
        CN_PERIOD_STATES.set(portalState, states);
    }
    const key = JSON.stringify([portalState.project, contactId]);
    if (!states.has(key)) {
        const today = new Date();
        states.set(key, {
            from: cnPeriodLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)),
            to: cnPeriodLocalDate(today),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            result: null
        });
    }
    return states.get(key);
}

function cnPeriodPanelMarkup(portalState, contactId) {
    const state = cnPeriodState(portalState, contactId);
    return `
        <section data-cn-period-panel style="margin:18px 0; padding:16px; border:1px solid #d1d5db; border-radius:6px;">
            <h3 style="margin-top:0;">Client Period Summary</h3>
            <p>Reviews original meeting notes, emails and added notes attached to this client.
            These dates are separate from the notes-table filters above.</p>
            <div style="display:flex; gap:14px; align-items:flex-end; flex-wrap:wrap;">
                <label style="display:flex; flex-direction:column;">From
                    <input type="date" data-period-from value="${escapeHtml(state.from)}">
                </label>
                <label style="display:flex; flex-direction:column;">To (inclusive)
                    <input type="date" data-period-to value="${escapeHtml(state.to)}">
                </label>
                <label style="display:flex; flex-direction:column;">Report timezone
                    <input type="text" data-period-zone value="${escapeHtml(state.timeZone)}" style="min-width:190px;" title="IANA timezone, for example America/New_York">
                </label>
                <button type="button" class="btn-primary" data-period-generate>Generate Period Summary</button>
            </div>
            <p style="font-size:0.9em;">Uses note dates, includes the entire To date, and reads all matching notes regardless of the table's filters.
            Generating uses OpenAI API credits. The report is displayed here; it does not modify or save over notes.</p>
            <div data-period-status role="status" style="white-space:pre-wrap; margin:10px 0;"></div>
            <div data-period-result></div>
        </section>
    `;
}

function cnMountPeriodReport(container, portalState, contactId, viewToken) {
    const panel = container.querySelector("[data-cn-period-panel]");
    if (!panel) return;
    const project = portalState.project;
    const state = cnPeriodState(portalState, contactId);
    const fromInput = panel.querySelector("[data-period-from]");
    const toInput = panel.querySelector("[data-period-to]");
    const zoneInput = panel.querySelector("[data-period-zone]");
    const button = panel.querySelector("[data-period-generate]");
    const status = panel.querySelector("[data-period-status]");
    const output = panel.querySelector("[data-period-result]");
    const current = () => (
        panel.isConnected && container.contains(panel) &&
        CN_PERIOD_VIEWS.get(container) === viewToken && portalState.project === project
    );
    if (state.result) cnDisplayPeriodReport(output, state.result);

    for (const input of [fromInput, toInput, zoneInput]) {
        input.addEventListener("change", () => {
            state.from = fromInput.value;
            state.to = toInput.value;
            state.timeZone = zoneInput.value.trim();
            if (state.result) status.textContent = "Inputs changed. The report below still shows its original dates/timezone until you generate again.";
        });
    }

    button.addEventListener("click", async () => {
        const from = fromInput.value;
        const to = toInput.value;
        const timeZone = zoneInput.value.trim();
        if (!from || !to || from > to || !timeZone) {
            status.textContent = "Enter valid From/To dates and a timezone. From must not be after To.";
            return;
        }
        try { new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date()); }
        catch { status.textContent = "Enter a valid timezone, for example America/New_York."; return; }
        state.from = from; state.to = to; state.timeZone = timeZone;
        if (!window.confirm(`Generate a report for ${from} through ${to} (${timeZone}) using this client's original notes? This uses OpenAI API credits.`)) return;

        button.disabled = true;
        for (const input of [fromInput, toInput, zoneInput]) input.disabled = true;
        output.innerHTML = "";
        state.result = null;
        status.textContent = "Loading all matching original notes and generating the report… Please wait; large periods can take a minute or two. Do not click Generate again.";
        try {
            const res = await fetch("https://contacts-module.dennis-e64.workers.dev/notes_history/period-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project, contact_id: contactId, from, to, time_zone: timeZone })
            });
            const data = await res.json().catch(() => null);
            if (!current()) return;
            if (!res.ok || data?.status !== "ok") {
                throw new Error(data?.error || `Report request failed (${res.status}).`);
            }
            state.result = data;
            cnDisplayPeriodReport(output, data);
            status.textContent = data.report
                ? `Report generated from ${data.metadata.source_notes_count} original notes. Review the linked evidence before sharing.`
                : data.message || "No source notes found.";
        } catch (err) {
            if (current()) status.textContent = `Report failed: ${err.message}`;
        } finally {
            if (current()) {
                button.disabled = false;
                for (const input of [fromInput, toInput, zoneInput]) input.disabled = false;
            }
        }
    });
}

function cnDisplayPeriodReport(target, data) {
    const meta = data.metadata;
    const report = data.report;
    const e = value => escapeHtml(String(value ?? ""));
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const byId = new Map(sources.map(source => [source.source_id, source]));
    const noInfo = '<p>Not documented in the selected notes.</p>';

    function evidence(list) {
        if (!Array.isArray(list) || !list.length) return "";
        const ids = [...new Set(list.map(item => item.source_id))];
        return `<span style="white-space:normal;"> ${ids.map(id =>
            `<button type="button" class="btn-secondary" data-period-source="${e(id)}" style="padding:2px 5px; font-size:0.85em;" title="Open original source note">[${e(id)}]</button>`
        ).join(" ")}</span>
        <details style="margin-top:4px; font-size:0.9em;">
            <summary>Evidence excerpts</summary>
            ${list.map(item => `<blockquote style="margin:6px 12px;">[${e(item.source_id)}] ${e(item.quote)}</blockquote>`).join("")}
        </details>`;
    }

    function points(list) {
        if (!Array.isArray(list) || !list.length) return noInfo;
        return `<ul>${list.map(item => `<li style="margin-bottom:12px;">${e(item.text)}${evidence(item.evidence)}</li>`).join("")}</ul>`;
    }

    function commitments(list) {
        if (!list.length) return "<p>No outstanding commitments identified in the selected notes.</p>";
        return `<div style="overflow-x:auto;"><table class="notes-table" style="width:100%;">
            <thead><tr><th>Task / owner / deadline</th><th>Latest documented update</th><th>Completion documentation</th></tr></thead>
            <tbody>${list.map(task => `<tr>
                <td><div>${e(task.task)}</div><div>Owner: ${e(task.owner)}</div><div>Deadline: ${e(task.deadline)}</div>
                    <div>First task mention in supplied notes: ${e(task.first_documented_note_date ? formatDateTime(task.first_documented_note_date) : "Not recorded")}</div>
                    ${evidence([task.assignment])}</td>
                <td>${e(task.latest_update)}${evidence(task.evidence)}</td>
                <td>${e(task.documentation_status)}<div>Later notes in period reviewed: ${e(task.later_notes_reviewed)}</div>
                    ${evidence(task.resolution_evidence)}</td>
            </tr>`).join("")}</tbody></table></div>`;
    }

    const skipped = Array.isArray(meta.skipped_notes) ? meta.skipped_notes : [];
    const openTasks = report ? report.commitments.filter(task => task.state === "open") : [];
    const resolvedTasks = report ? report.commitments.filter(task => task.state !== "open") : [];
    target.innerHTML = `
        <article style="border-top:1px solid #d1d5db; padding-top:14px;">
            <h3>Period Summary — ${e(meta.contact_name)}</h3>
            <p>${e(meta.from)} through ${e(meta.to)} (inclusive), ${e(meta.time_zone)}<br>
                Based on ${e(meta.source_notes_count)} original notes out of ${e(meta.matched_notes)} dated notes matched.<br>
                Generated: ${e(formatDateTime(meta.generated_at))}. Not saved to the database.</p>
            <p style="font-size:0.9em;">${e(meta.scope)} AI-generated draft; verify interpretations against the sources.</p>
            ${skipped.length ? `<details open><summary>Coverage warning: ${skipped.length} notes had no original text</summary><ul>${skipped.map(note => `<li>${e(note.note_date)} — ${e(note.subject)} (${e(note.note_id)}): ${e(note.reason)}</li>`).join("")}</ul></details>` : ""}
            ${report ? `
                <h3>1. Period overview</h3>${points(report.period_overview)}
                <h3>2. Progress and wins</h3>${points(report.progress_and_wins)}
                <h3>3. Key decisions</h3>${points(report.key_decisions)}
                <h3>4. Challenges and blockers</h3>${points(report.challenges_and_blockers)}
                <h3>5. Outstanding commitments</h3>${commitments(openTasks)}
                ${resolvedTasks.length ? `<details style="margin-top:12px;"><summary>Documented completions/cancellations (${resolvedTasks.length})</summary>${commitments(resolvedTasks)}</details>` : ""}
                <h3>6. Next-period priorities</h3><h4>Agreed next steps</h4>${points(report.next_period_priorities.agreed)}
                <p style="font-size:0.9em;">No AI-suggested priorities are added in this version; the priorities above must be documented in the source notes.</p>
            ` : `<p>${e(data.message || "No original note content found.")}</p>`}
            ${sources.length ? `<details style="margin-top:18px;"><summary>Original source notes (${sources.length})</summary>
                ${sources.map(source => `<details data-period-source-note="${e(source.source_id)}" style="margin:10px 0; border:1px solid #ddd; padding:8px;">
                    <summary>[${e(source.source_id)}] ${e(formatDateTime(source.note_date))} — ${e(source.subject || "(no subject)")}</summary>
                    <p>Note ID: ${e(source.note_id)}<br>From: ${e(source.from_name)} ${e(source.from_email)}</p>
                    <pre style="white-space:pre-wrap; overflow-wrap:anywhere; max-height:450px; overflow:auto;">${e(source.content)}</pre>
                </details>`).join("")}
            </details>` : ""}
        </article>`;

    target.querySelectorAll("[data-period-source]").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.dataset.periodSource;
            if (!byId.has(id)) return;
            const detail = [...target.querySelectorAll("[data-period-source-note]")].find(el => el.dataset.periodSourceNote === id);
            if (!detail) return;
            let parent = detail;
            while (parent && parent !== target) {
                if (parent.tagName === "DETAILS") parent.open = true;
                parent = parent.parentElement;
            }
            detail.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}
