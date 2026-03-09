// tab-lookups.js — Task Lookups (Task Dropdowns)
// This is a simplified version of Setup → Lookups,
// but uses the task_dropdowns table and does NOT allow
// creating or renaming groups.

import { escapeHtml } from "../utilities.js";

export async function loadTasksLookups({ portalState, container }) {
  if (!portalState.project) {
    container.innerHTML = `
      <section class="card">
        <p>No project selected.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Task Lookups</h2>
      <p style="margin-top:-4px;color:#666;">Manage dropdown values for this project's tasks.</p>
      <div id="taskLookupsContent">Loading…</div>
    </section>
  `;

  const content = container.querySelector("#taskLookupsContent");

  /* =========================================================
     1) Fetch lookup values (backend auto-seeds missing groups)
  ========================================================= */
  let rows = [];
  try {
    const res = await fetch(
      `https://tasks-manager.dennis-e64.workers.dev/lookups/list?project=${encodeURIComponent(
        portalState.project
      )}`,
      { cache: "no-cache" }
    );
    rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
  } catch (err) {
    content.innerHTML = `<p>Error loading lookups.</p>`;
    return;
  }

  /* =========================================================
     2) Group rows by field
  ========================================================= */
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.field]) grouped[r.field] = [];
    grouped[r.field].push(r);
  });

  /* =========================================================
     3) Render groups (⭐ SORT FIX APPLIED HERE)
  ========================================================= */
  content.innerHTML = Object.keys(grouped)
    .map(field => {

      // ⭐ SORT ITEMS ASCENDING BY sort_order
      const items = grouped[field].sort((a, b) => a.sort_order - b.sort_order);

      return `
        <section class="lookup-group card" style="margin-bottom:24px;">
          <h3>${escapeHtml(field)}</h3>

          <table class="notes-table">
            <thead>
              <tr>
                <th>Value</th>
                <th>Sort</th>
                <th>Active</th>
                <th>Color</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  item => `
                <tr data-id="${item.id}">
                  <td><input class="valueInput" value="${escapeHtml(
                    item.value
                  )}" style="width:100%;"></td>

                  <td><input class="sortInput" type="number" value="${
                    item.sort_order
                  }" style="width:70px;"></td>

                  <td>
                    <select class="activeDropdown">
                      <option value="true" ${
                        item.active ? "selected" : ""
                      }>Yes</option>
                      <option value="false" ${
                        !item.active ? "selected" : ""
                      }>No</option>
                    </select>
                  </td>

                  <td><input class="colorInput" value="${escapeHtml(
                    item.color || ""
                  )}" placeholder="#hex or name" style="width:100px;"></td>

                  <td><input class="notesInput" value="${escapeHtml(
                    item.notes || ""
                  )}" style="width:100%;"></td>

                  <td>
                    <button class="saveBtn btn-primary">Save</button>
                    <button class="deleteBtn btn-danger">Delete</button>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <button class="addValueBtn btn-primary" data-field="${escapeHtml(
            field
          )}" style="margin-top:8px;">+ Add Value</button>
        </section>
      `;
    })
    .join("");

  /* =========================================================
     4) Event delegation for Save / Delete / Add Value
  ========================================================= */
  content.addEventListener("click", async e => {
    const row = e.target.closest("tr");
    const id = row?.dataset?.id;

    /* -------------------------
       SAVE
    ------------------------- */
    if (e.target.classList.contains("saveBtn")) {
      const value = row.querySelector(".valueInput").value.trim();
      const sort_order = parseInt(row.querySelector(".sortInput").value, 10);
      const active = row.querySelector(".activeDropdown").value === "true";
      const color = row.querySelector(".colorInput").value.trim() || null;
      const notes = row.querySelector(".notesInput").value.trim() || null;

      const updates = { value, sort_order, active, color, notes };

      await fetch(
        `https://tasks-manager.dennis-e64.workers.dev/lookups/edit/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates })
        }
      );

      loadTasksLookups({ portalState, container });
    }

    /* -------------------------
       DELETE
    ------------------------- */
    if (e.target.classList.contains("deleteBtn")) {
      if (!confirm("Delete this value?")) return;

      await fetch(
        `https://tasks-manager.dennis-e64.workers.dev/lookups/delete/${id}`,
        { method: "DELETE" }
      );

      loadTasksLookups({ portalState, container });
    }

    /* -------------------------
       ADD VALUE
    ------------------------- */
    if (e.target.classList.contains("addValueBtn")) {
      const field = e.target.dataset.field;
      const groupSection = e.target.closest(".lookup-group");
      const tbody = groupSection.querySelector("tbody");

      const lastRow = tbody.querySelector("tr:last-child");
      const lastSort = lastRow
        ? parseInt(
            lastRow.querySelector(".sortInput")?.value ||
              lastRow.querySelector("td:nth-child(2)")?.textContent,
            10
          )
        : 0;

      const nextSort = (isNaN(lastSort) ? 0 : lastSort) + 10;

      const newRow = document.createElement("tr");

      newRow.innerHTML = `
        <td><input class="newValueInput" placeholder="New value"></td>
        <td><input class="newSortInput" type="number" value="${nextSort}" style="width:70px;"></td>
        <td>
          <select class="newActiveDropdown">
            <option value="true" selected>Yes</option>
            <option value="false">No</option>
          </select>
        </td>
        <td><input class="newColorInput" placeholder="#hex or name" style="width:100px;"></td>
        <td><input class="newNotesInput" placeholder="Notes" style="width:100%;"></td>
        <td>
          <button class="saveNewValueBtn btn-primary">Save</button>
          <button class="cancelNewValueBtn btn-secondary">Cancel</button>
        </td>
      `;

      tbody.appendChild(newRow);

      /* SAVE NEW VALUE */
      newRow
        .querySelector(".saveNewValueBtn")
        .addEventListener("click", async () => {
          const value = newRow.querySelector(".newValueInput").value.trim();
          const sort_order = parseInt(
            newRow.querySelector(".newSortInput").value,
            10
          );
          const active =
            newRow.querySelector(".newActiveDropdown").value === "true";
          const color =
            newRow.querySelector(".newColorInput").value.trim() || null;
          const notes =
            newRow.querySelector(".newNotesInput").value.trim() || null;

          if (!value) {
            alert("Please enter a value.");
            return;
          }

          const payload = {
            project: portalState.project,
            field,
            value,
            sort_order,
            active,
            color,
            notes,
            created_at: new Date().toISOString()
          };

          await fetch(
            "https://tasks-manager.dennis-e64.workers.dev/lookups/addValue",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            }
          );

          loadTasksLookups({ portalState, container });
        });

      /* CANCEL NEW VALUE */
      newRow
        .querySelector(".cancelNewValueBtn")
        .addEventListener("click", () => newRow.remove());
    }
  });
}

