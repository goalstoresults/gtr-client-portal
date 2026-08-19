// js/groups/tab-fees.js
// GROUP FEES TAB — modular version
import {
  escapeHtml,
  formatCurrency,
  formatDateTime,
  formatDateOnly
} from "../utilities.js";

export async function renderGroupFees(container, portalState, groupId) {
  if (!groupId) {
    container.innerHTML = `
      <section class="card">
        <p>Select a group to view fees.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Fees</h3>
        ${portalState.canEdit ? `<button id="btnAddFee" class="btn-primary">Add Fee</button>` : ``}
      </div>
      <div id="feesTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#feesTable");

  // Fetch fees
  const url =
    `https://groups-module.dennis-e64.workers.dev/groups/fees?project=${portalState.project}&group_id=${groupId}`;
  const res = await fetch(url, { cache: "no-cache" });
  let fees = await res.json();
  if (!Array.isArray(fees)) fees = [];

  // Derive year if missing
  fees = fees.map(f => {
    const d = f.fee_date ? new Date(f.fee_date) : null;
    const year = f.year || (d ? d.getFullYear() : null);
    return { ...f, year };
  });

  let currentSortField = "fee_date";
  let currentSortDirection = "desc";
  let adding = false;
  let editing = null;

  const columns = [
    { key: "fee_date", label: "Fee Date" },
    { key: "fee_amount", label: "Amount", numeric: true },
    { key: "description", label: "Description" },
    { key: "year", label: "Year", numeric: true },
    { key: "created_at", label: "Created" }
  ];

  function sortFees() {
    fees.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (currentSortField === "fee_date" || currentSortField === "created_at") {
        const dA = A ? new Date(A).getTime() : 0;
        const dB = B ? new Date(B).getTime() : 0;
        return currentSortDirection === "asc" ? dA - dB : dB - dA;
      }

      if (columns.find(c => c.key === currentSortField)?.numeric) {
        const numA = Number(A) || 0;
        const numB = Number(B) || 0;
        return currentSortDirection === "asc" ? numA - numB : numB - numA;
      }

      const strA = String(A).toLowerCase();
      const strB = String(B).toLowerCase();
      return currentSortDirection === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }

  function toInputDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function renderTable() {
    sortFees();

    const headerHtml = columns
      .map(col => {
        const isSorted = currentSortField === col.key;
        const up = isSorted && currentSortDirection === "asc" ? "▲" : "△";
        const down = isSorted && currentSortDirection === "desc" ? "▼" : "▽";
        return `
          <th class="sortable" data-field="${col.key}">
            ${escapeHtml(col.label)}
            <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
              <span>${up}</span>
              <span>${down}</span>
            </span>
          </th>
        `;
      })
      .join("");

    const addRow = adding
      ? `
        <tr class="editing-row">
          <td><input id="feeAddDate" type="date" class="form-control" /></td>
          <td><input id="feeAddAmount" type="number" step="0.01" class="form-control" /></td>
          <td><input id="feeAddDesc" type="text" class="form-control" /></td>
          <td>(auto)</td>
          <td>(auto)</td>
          <td>
            ${portalState.canEdit ? `<button id="btnSaveNewFee" class="btn-primary">Save</button>` : ``}
            <button id="btnCancelNewFee" class="btn-secondary">Cancel</button>
          </td>
        </tr>
      `
      : "";

    const rowsHtml = fees
      .map(f => {
        if (editing === f.fee_id) {
          return `
            <tr class="editing-row" data-fee-id="${f.fee_id}">
              <td><input type="date" class="form-control fee-edit-date" value="${escapeHtml(
                toInputDate(f.fee_date)
              )}" /></td>
              <td><input type="number" step="0.01" class="form-control fee-edit-amount" value="${escapeHtml(
                String(f.fee_amount || "")
              )}" /></td>
              <td><input type="text" class="form-control fee-edit-desc" value="${escapeHtml(
                f.description || ""
              )}" /></td>
              <td>${escapeHtml(String(f.year || ""))}</td>
              <td>${formatDateTime(f.created_at)}</td>
              <td>
                ${portalState.canEdit ? `<button class="btn-primary btn-save-fee" data-id="${f.fee_id}">Save</button>` : ``}
                <button class="btn-secondary btn-cancel-edit" data-id="${f.fee_id}">Cancel</button>
              </td>
            </tr>
          `;
        }
        return `
          <tr data-fee-id="${f.fee_id}">
            <td>${formatDateOnly(f.fee_date)}</td>
            <td class="amount">${formatCurrency(f.fee_amount)}</td>
            <td>${escapeHtml(f.description || "")}</td>
            <td>${escapeHtml(String(f.year || ""))}</td>
            <td>${formatDateTime(f.created_at)}</td>
            <td>
              ${portalState.canEdit ? `<button class="btn-secondary btn-edit-fee" data-id="${f.fee_id}">Edit</button>` : ``}
              ${portalState.deleteAllowed ? `<button class="btn-danger btn-delete-fee" data-id="${f.fee_id}">Delete</button>` : ``}
            </td>
          </tr>
        `;
      })
      .join("");

    tableDiv.innerHTML = `
      <h4>Showing ${fees.length} fee ${fees.length === 1 ? "record" : "records"}</h4>
      <table class="notes-table">
        <thead>
          <tr>${headerHtml}<th>Actions</th></tr>
        </thead>
        <tbody>
          ${addRow}
          ${
            rowsHtml ||
            (!adding ? `<tr><td colspan="6">(no fees recorded)</td></tr>` : "")
          }
        </tbody>
      </table>
    `;

    // Sorting
    tableDiv.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;
        if (currentSortField === field) {
          currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }
        renderTable();
      });
    });

    // Add row save
    if (adding) {
      const saveNewFeeBtn = tableDiv.querySelector("#btnSaveNewFee");
      if (saveNewFeeBtn) {
        saveNewFeeBtn.addEventListener("click", async () => {
          const dateVal = document.getElementById("feeAddDate").value;
          const amountVal = document.getElementById("feeAddAmount").value;
          const descVal = document.getElementById("feeAddDesc").value;
          const amount = Number(amountVal);

          if (!dateVal || !amount) {
            alert("Date and amount are required");
            return;
          }

          await fetch(
            `https://groups-module.dennis-e64.workers.dev/groups/fees/add?project=${portalState.project}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                group_id: groupId,
                fee_date: dateVal,
                fee_amount: amount,
                description: descVal || ""
              })
            }
          );

          adding = false;
          await renderGroupFees(container, portalState, groupId);
        });
      }

      tableDiv.querySelector("#btnCancelNewFee").addEventListener("click", () => {
        adding = false;
        renderTable();
      });
    }

    // Edit
    tableDiv.querySelectorAll(".btn-edit-fee").forEach(btn => {
      btn.addEventListener("click", () => {
        editing = btn.dataset.id;
        adding = false;
        renderTable();
      });
    });

    // Cancel edit
    tableDiv.querySelectorAll(".btn-cancel-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        editing = null;
        renderTable();
      });
    });

    // Save edit
    tableDiv.querySelectorAll(".btn-save-fee").forEach(btn => {
      btn.addEventListener("click", async () => {
        const feeId = btn.dataset.id;
        const row = tableDiv.querySelector(`tr[data-fee-id="${feeId}"]`);
        const dateVal = row.querySelector(".fee-edit-date").value;
        const amountVal = row.querySelector(".fee-edit-amount").value;
        const descVal = row.querySelector(".fee-edit-desc").value;
        const amount = Number(amountVal);

        if (!dateVal || !amount) {
          alert("Date and amount are required");
          return;
        }

        await fetch(
          `https://groups-module.dennis-e64.workers.dev/groups/fees/update/${feeId}?project=${portalState.project}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fee_date: dateVal,
              fee_amount: amount,
              description: descVal || ""
            })
          }
        );

        editing = null;
        await renderGroupFees(container, portalState, groupId);
      });
    });

    // Delete
    tableDiv.querySelectorAll(".btn-delete-fee").forEach(btn => {
      btn.addEventListener("click", async () => {
        const feeId = btn.dataset.id;
        if (!confirm("Delete this fee record?")) return;

        await fetch(
          `https://groups-module.dennis-e64.workers.dev/groups/fees/delete/${feeId}?project=${portalState.project}`,
          {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
          }
        );

        await renderGroupFees(container, portalState, groupId);
      });
    });
  }

  // Initial render
  renderTable();

  // Add Fee button
  const addFeeBtn = container.querySelector("#btnAddFee");
  if (addFeeBtn) {
    addFeeBtn.addEventListener("click", () => {
      editing = null;
      adding = true;
      renderTable();
    });
  }
}
