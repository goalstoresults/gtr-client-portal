// /notes/tab-history.js
// Handles: Notes list, sorting, filtering, navigation to Review tab

import { escapeHtml, formatDateTime } from "../utilities.js";
import { renderReview } from "./tab-review.js";

// ------------------------------------------------------------
// Main Renderer
// ------------------------------------------------------------
export async function renderHistory(container, portalState) {
  try {
    const reviewOnly =
      document.getElementById("filter-review-only")?.checked ?? true;
    const name =
      document.getElementById("filter-name")?.value.trim() || "";

    // ------------------------------------------------------------
    // Fetch notes
    // ------------------------------------------------------------
    const params = new URLSearchParams({
      project: portalState.project,
      limit: "500"
    });

    if (reviewOnly) params.set("needs_review", "true");

    const url = `https://notes-history-module.dennis-e64.workers.dev/notes_history?${params}`;
    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    let notes = Array.isArray(data?.notes) ? data.notes : [];

    // ------------------------------------------------------------
    // Client-side name filter
    // ------------------------------------------------------------
    if (name) {
      const term = name.toLowerCase();
      notes = notes.filter(n =>
        (n.from_name || "").toLowerCase().includes(term)
      );
    }

    // ------------------------------------------------------------
    // Initialize sort state
    // ------------------------------------------------------------
    if (!portalState.notesSort) {
      portalState.notesSort = {
        column: "created_at",
        direction: "desc"
      };
    }

    const columns = [
      { key: "created_at", label: "Created", isDate: true },
      { key: "subject", label: "Subject" },
      { key: "from_name", label: "From" },
      { key: "contact_name", label: "Contact" },
      { key: "needs_review", label: "Needs Review" }
    ];

    // ------------------------------------------------------------
    // Sorting helper
    // ------------------------------------------------------------
    function sortNotes() {
      const { column, direction } = portalState.notesSort;

      notes.sort((a, b) => {
        let A = a[column];
        let B = b[column];

        if (column === "created_at") {
          A = new Date(A);
          B = new Date(B);
        } else {
          A = (A || "").toString().toLowerCase();
          B = (B || "").toString().toLowerCase();
        }

        if (A < B) return direction === "asc" ? -1 : 1;
        if (A > B) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    // ------------------------------------------------------------
    // Table Renderer
    // ------------------------------------------------------------
    function renderTable() {
      sortNotes();

      const headerHtml = columns
        .map(col => {
          const isSorted = portalState.notesSort.column === col.key;
          const upArrow =
            isSorted && portalState.notesSort.direction === "asc"
              ? "▲"
              : "△";
          const downArrow =
            isSorted && portalState.notesSort.direction === "desc"
              ? "▼"
              : "▽";

          return `
            <th class="sortable" data-field="${col.key}">
              ${col.label}
              <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
                <span class="sort-up">${upArrow}</span>
                <span class="sort-down">${downArrow}</span>
              </span>
            </th>
          `;
        })
        .join("");

      const rowsHtml = notes
        .map(
          n => `
          <tr>
            <td>${formatDateTime(n.created_at)}</td>
            <td>${escapeHtml(n.subject || "")}</td>
            <td>${escapeHtml(n.from_name || "")}</td>
            <td>${escapeHtml(n.contact_name || "")}</td>
            <td>${n.needs_review ? "Yes" : "No"}</td>
            <td><button class="btn-primary btn-review" data-id="${n.id}">Review</button></td>
          </tr>
        `
        )
        .join("");

      container.innerHTML = `
        <h4>Notes History (Total: ${notes.length})</h4>

        <div style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <label>
            <input type="checkbox" id="filter-review-only" ${reviewOnly ? "checked" : ""}>
            Needs Review Only
          </label>

          <label>Name:
            <input type="text" id="filter-name" value="${escapeHtml(name)}">
          </label>

          <button id="btnApplyFilter" class="secondary">Apply Filter</button>
          <button id="btnClearFilter" class="secondary">Clear Filter</button>
        </div>

        <table class="notes-table">
          <thead>
            <tr>
              ${headerHtml}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              `<tr><td colspan="6" class="muted">(no notes found)</td></tr>`
            }
          </tbody>
        </table>
      `;

      // ------------------------------------------------------------
      // Sorting events
      // ------------------------------------------------------------
      container.querySelectorAll("th.sortable").forEach(th => {
        th.addEventListener("click", () => {
          const field = th.dataset.field;

          if (portalState.notesSort.column === field) {
            portalState.notesSort.direction =
              portalState.notesSort.direction === "asc"
                ? "desc"
                : "asc";
          } else {
            portalState.notesSort.column = field;
            portalState.notesSort.direction = "asc";
          }

          renderTable();
        });
      });

      // ------------------------------------------------------------
      // Review button events
      // ------------------------------------------------------------
      container.querySelectorAll(".btn-review").forEach(btn => {
        btn.addEventListener("click", () => {
          const noteId = btn.dataset.id;
          portalState.selectedNoteId = noteId;

          const clientName =
            btn.closest("tr").querySelector("td:nth-child(4)")
              ?.textContent || "";

          const contextBar = document.getElementById(
            "contact-context-bar"
          );
          if (contextBar) {
            contextBar.textContent = clientName
              ? `Contact: ${clientName}`
              : "Contact not linked yet";
          }

          // ✅ Enable Review and Relationships subtabs locally
          ["review", "relationships"].forEach(subtab => {
            const btn = document.querySelector(
              `#notes-subtabs button[data-subtab="${subtab}"]`
            );
            if (btn) {
              btn.disabled = false;
              btn.classList.remove("disabled");
            }
          });

          // Switch tab
          document
            .querySelectorAll("#notes-subtabs button")
            .forEach(b => b.classList.remove("active"));

          document
            .querySelector(
              '#notes-subtabs button[data-subtab="review"]'
            )
            ?.classList.add("active");

          renderReview(container, portalState, noteId);
        });
      });

      // ------------------------------------------------------------
      // Filter buttons
      // ------------------------------------------------------------
      document
        .getElementById("btnApplyFilter")
        .addEventListener("click", () => {
          renderHistory(container, portalState);
        });

      document
        .getElementById("btnClearFilter")
        .addEventListener("click", () => {
          document.getElementById("filter-review-only").checked = true;
          document.getElementById("filter-name").value = "";
          renderHistory(container, portalState);
        });
    }

    // ------------------------------------------------------------
    // Initial render
    // ------------------------------------------------------------
    renderTable();
  } catch (err) {
    container.innerHTML = `
      <h4>Notes History</h4>
      <p>Error loading history: ${escapeHtml(err.message)}</p>
    `;
  }
}
