// js/groups.js v8.0
console.log("[Groups.js] loaded");

import {
  escapeHtml,
  formatCurrency,
  formatDateTime, 
  getEasternDateOnly,
  formatDateOnly
} from "./utilities.js";

// -------------------------------------------------------------
// GROUPS TAB LOADER (updated with Fees tab, ROI removed)
// -------------------------------------------------------------
export async function loadGroupsTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <nav id="groups-subtabs" class="subtabs" style="margin-bottom:12px;">
        <button data-subtab="add">Add</button>
        <button data-subtab="list">List</button>
        <button data-subtab="details">Details</button>
        <button data-subtab="members">Members</button>
        <button data-subtab="fees">Fees</button>
      </nav>
      <div id="groupsContent"></div>
    </section>
  `;

  const content = tabContent.querySelector("#groupsContent");
  const buttons = tabContent.querySelectorAll("#groups-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      switch (subtab) {
        case "add":
          await renderGroupAdd(content, portalState);
          break;

        case "list":
          await renderGroupList(content, portalState);
          break;

        case "details":
          if (portalState.selectedGroupId) {
            await renderGroupDetails(content, portalState, portalState.selectedGroupId);
          } else {
            content.innerHTML = `<section class="card"><p>Select a group to view details.</p></section>`;
          }
          break;

        case "members":
          if (portalState.selectedGroupId) {
            await renderGroupMembers(content, portalState, portalState.selectedGroupId);
          } else {
            content.innerHTML = `<section class="card"><p>Select a group to view members.</p></section>`;
          }
          break;

        case "fees":
          if (portalState.selectedGroupId) {
            await renderGroupFees(content, portalState, portalState.selectedGroupId);
          } else {
            content.innerHTML = `<section class="card"><p>Select a group to view fees.</p></section>`;
          }
          break;

        default:
          content.innerHTML = `<section class="card"><p>Select a subtab to begin.</p></section>`;
      }
    });
  });

  // Default to List
  const defaultBtn = tabContent.querySelector('#groups-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    await renderGroupList(content, portalState);
  }
}

// -----------------------------------------------------------------------------
// GROUP LIST (now powered by group_roi_summary view)
// -----------------------------------------------------------------------------
async function renderGroupList(container, portalState) {
  const prevName = document.getElementById("filter-group-name")?.value.trim() || "";

  container.innerHTML = `
    <section class="card">
      <h2>Groups for ${
        escapeHtml(
          portalState.projects_config?.business_name ||
          portalState.display_name ||
          portalState.project
        )
      }</h2>

      <div id="groupsFilters" style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <label>Name: <input type="text" id="filter-group-name" value="${escapeHtml(prevName)}" /></label>
        <button id="btnApplyGroupsFilter" class="btn-secondary">Apply Filter</button>
        <button id="btnClearGroupsFilter" class="btn-secondary">Clear Filter</button>
      </div>

      <div id="groupTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#groupTable");

  // Fetch ROI summary view
  const url = `https://groups-module.dennis-e64.workers.dev/groups/roi-list?project=${portalState.project}&limit=500`;
  const res = await fetch(url, { cache: "no-cache" });
  let groups = await res.json();
  if (!Array.isArray(groups)) groups = groups.rows || [];
  if (!Array.isArray(groups)) groups = [];

  // Apply name filter
  if (prevName && prevName.length >= 3) {
    const term = prevName.toLowerCase();
    groups = groups.filter(g => (g.group_name || "").toLowerCase().includes(term));
  }

  // Sorting state
  let currentSortField = "group_name";
  let currentSortDirection = "asc";

  const columns = [
    { key: "group_name", label: "Name" },
    { key: "fee_amount", label: "Total Amount", numeric: true },
    { key: "referral_amount", label: "Total Referral Amount", numeric: true },
    { key: "roi", label: "ROI (%)", numeric: true },
    { key: "created_at", label: "Created" }
  ];

  function sortGroups() {
    groups.sort((a, b) => {
      let A = a[currentSortField];
      let B = b[currentSortField];

      if (A == null) A = "";
      if (B == null) B = "";

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

  function renderTable() {
    sortGroups();

    const headerHtml = columns.map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow   = isSorted && currentSortDirection === "asc"  ? "▲" : "△";
      const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

      return `
        <th class="sortable" data-field="${col.key}">
          ${escapeHtml(col.label)}
          <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
            <span class="sort-up">${upArrow}</span>
            <span class="sort-down">${downArrow}</span>
          </span>
        </th>
      `;
    }).join("");

    const rowsHtml = groups.map(g => `
      <tr>
        <td>${escapeHtml(g.group_name || "")}</td>
        <td class="amount">${formatCurrency(g.fee_amount)}</td>
        <td class="amount">${formatCurrency(g.referral_amount)}</td>
        <td class="amount">
          ${(Number(g.roi || 0) * 100).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}%
        </td>
        <td>${formatDateTime(g.created_at)}</td>
        <td><button class="btn-primary btn-select" data-id="${g.group_id}">Select</button></td>
      </tr>
    `).join("");


    tableDiv.innerHTML = `
      <h4>Showing ${groups.length} ${prevName ? "filtered" : "recent"} groups</h4>
      <table class="notes-table">
        <thead>
          <tr>
            ${headerHtml}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="6">(no groups found)</td></tr>`}
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

    // Select buttons
    tableDiv.querySelectorAll(".btn-select").forEach(btn => {
      btn.addEventListener("click", async () => {
        const groupId = btn.dataset.id;
        portalState.selectedGroupId = groupId;

        const buttons = document.querySelectorAll("#groups-subtabs button");
        buttons.forEach(b => b.classList.remove("active"));
        const detailsBtn = document.querySelector('#groups-subtabs button[data-subtab="details"]');
        if (detailsBtn) detailsBtn.classList.add("active");

        const content = document.querySelector("#groupsContent");
        await renderGroupDetails(content, portalState, groupId);
      });
    });
  }

  renderTable();

  document.getElementById("btnApplyGroupsFilter").addEventListener("click", () => {
    renderGroupList(container, portalState);
  });

  document.getElementById("btnClearGroupsFilter").addEventListener("click", () => {
    document.getElementById("filter-group-name").value = "";
    renderGroupList(container, portalState);
  });
}




// -----------------------------------------------------------------------------
// GROUP DETAILS
// -----------------------------------------------------------------------------
async function renderGroupDetails(container, portalState, groupId) {
  container.innerHTML = `<section class="card"><p>Loading group details...</p></section>`;
  const url = `https://groups-module.dennis-e64.workers.dev/groups/details/${groupId}?project=${portalState.project}`;
  console.log("[Groups] Fetching details:", url);

  const res = await fetch(url);
  const raw = await res.json();
  const group = Array.isArray(raw) ? raw[0] : raw;
  if (!group || !group.group_id) {
    container.innerHTML = `<section class="card"><p>(Group not found)</p></section>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Group Details</h3>
        <div>
          <button id="btnSaveGroup" class="btn-primary">Save</button>
          <button id="btnDeleteGroup" class="btn-danger">Delete</button>
        </div>
      </div>
      <div class="notes-row">
        <label class="notes-label">Name</label>
        <input id="groupNameInput" class="form-control" value="${escapeHtml(group.group_name || "")}" />
      </div>
      <div class="notes-row">
        <label class="notes-label">Date Started</label>
        <input class="form-control" value="${formatDateTime(group.date_started)}" readonly />
      </div>
      <div class="notes-row">
        <label class="notes-label">Created At</label>
        <input class="form-control" value="${formatDateTime(group.created_at)}" readonly />
      </div>
    </section>
  `;

  // Save
  document.getElementById("btnSaveGroup").addEventListener("click", async () => {
    const newName = document.getElementById("groupNameInput").value.trim();
    if (!newName) {
      alert("Name cannot be empty");
      return;
    }
    await fetch(`https://groups-module.dennis-e64.workers.dev/groups/update/${group.group_id}?project=${portalState.project}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: newName })
    });
    alert("Group name updated");
  });

  // Delete
  document.getElementById("btnDeleteGroup").addEventListener("click", async () => {
    if (!confirm("Delete this group?")) return;
    await fetch(`https://groups-module.dennis-e64.workers.dev/groups/delete/${group.group_id}?project=${portalState.project}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });
    alert("Group deleted");

    const listBtn = document.querySelector('#groups-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#groupsContent");
      await renderGroupList(content, portalState);
    }
  });
}

// -----------------------------------------------------------------------------
// GROUP MEMBERS
// -----------------------------------------------------------------------------
async function renderGroupMembers(container, portalState, groupId) {
  if (!portalState.project || !groupId) {
    container.innerHTML = `<section class="card"><p>Select a group to view members.</p></section>`;
    return;
  }

  const groupRes = await fetch(
    `https://groups-module.dennis-e64.workers.dev/groups/details/${groupId}?project=${portalState.project}`,
    { cache: "no-cache" }
  );
  const groupData = await groupRes.json();
  const group = Array.isArray(groupData) ? groupData[0] : groupData;

  const prevName = document.getElementById("filter-member-name")?.value.trim() || "";
  const prevBiz  = document.getElementById("filter-member-business")?.value.trim() || "";

  container.innerHTML = `
    <section class="card">
      <h2>Group Members for ${escapeHtml(group?.group_name || "(Unnamed Group)")}</h2>
      <div style="margin-bottom:12px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <label>Name: <input type="text" id="filter-member-name" value="${escapeHtml(prevName)}" /></label>
        <label>Business: <input type="text" id="filter-member-business" value="${escapeHtml(prevBiz)}" /></label>
        <button id="btnApplyMemberFilter" class="secondary">Apply Filter</button>
        <button id="btnClearMemberFilter" class="secondary">Clear Filter</button>
      </div>
      <div id="groupMemberTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#groupMemberTable");

  const url = `https://groups-module.dennis-e64.workers.dev/groups/members/${groupId}?project=${portalState.project}&limit=500`;
  const membersRes = await fetch(url, { cache: "no-cache" });
  let contacts = await membersRes.json();
  if (!Array.isArray(contacts)) contacts = [];

  if (prevName && prevName.length >= 3) {
    const term = prevName.toLowerCase();
    contacts = contacts.filter(c => (c.contact_name || "").toLowerCase().includes(term));
  }
  if (prevBiz && prevBiz.length >= 3) {
    const term = prevBiz.toLowerCase();
    contacts = contacts.filter(c => (c.business_name || "").toLowerCase().includes(term));
  }

  let currentSortField = "contact_name";
  let currentSortDirection = "asc";

  const columns = [
    { key: "contact_name", label: "Name" },
    { key: "business_name", label: "Business Name" },
    { key: "contact_type", label: "Contact Type" }
  ];

  function sortMembers() {
    contacts.sort((a, b) => {
      let A = a[currentSortField] || "";
      let B = b[currentSortField] || "";

      A = A.toString().toLowerCase();
      B = B.toString().toLowerCase();

      return currentSortDirection === "asc"
        ? A.localeCompare(B)
        : B.localeCompare(A);
    });
  }

  function renderMembersTable() {
    sortMembers();

    const headerHtml = columns.map(col => {
      const isSorted = currentSortField === col.key;
      const upArrow   = isSorted && currentSortDirection === "asc"  ? "▲" : "△";
      const downArrow = isSorted && currentSortDirection === "desc" ? "▼" : "▽";

      return `
        <th class="sortable" data-field="${col.key}">
          ${escapeHtml(col.label)}
          <span class="sort-arrows" style="margin-left:4px; font-size:0.8em;">
            <span class="sort-up">${upArrow}</span>
            <span class="sort-down">${downArrow}</span>
          </span>
        </th>
      `;
    }).join("");

    const rowsHtml = contacts.map(c => `
      <tr>
        <td>${escapeHtml(c.contact_name || "")}</td>
        <td>${escapeHtml(c.business_name || "")}</td>
        <td>${escapeHtml(c.contact_type || "")}</td>
      </tr>
    `).join("");

    tableDiv.innerHTML = `
      <h4>Showing ${contacts.length} ${prevName || prevBiz ? "filtered" : "members"} contacts</h4>
      <table class="notes-table">
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="3">(no contacts found)</td></tr>`}
        </tbody>
      </table>
    `;

    tableDiv.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.field;

        if (currentSortField === field) {
          currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }

        renderMembersTable();
      });
    });
  }

  renderMembersTable();

  document.getElementById("btnApplyMemberFilter").addEventListener("click", () => {
    renderGroupMembers(container, portalState, groupId);
  });

  document.getElementById("btnClearMemberFilter").addEventListener("click", () => {
    document.getElementById("filter-member-name").value = "";
    document.getElementById("filter-member-business").value = "";
    renderGroupMembers(container, portalState, groupId);
  });
}

// -----------------------------------------------------------------------------
// ADD GROUP
// -----------------------------------------------------------------------------
async function renderGroupAdd(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Add Group</h3>
        <button id="btnSaveNewGroup" class="btn-primary">Save</button>
      </div>

      <div class="notes-row">
        <label class="notes-label">Name</label>
        <input id="newGroupName" class="form-control" placeholder="Enter group name" />
      </div>
    </section>
  `;

  document.getElementById("btnSaveNewGroup").addEventListener("click", async () => {
    const name = document.getElementById("newGroupName").value.trim();
    if (!name) {
      alert("Group name cannot be empty");
      return;
    }

    await fetch(
      `https://groups-module.dennis-e64.workers.dev/groups/add?project=${portalState.project}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_name: name })
      }
    );

    alert("Group added");

    const listBtn = document.querySelector('#groups-subtabs button[data-subtab="list"]');
    if (listBtn) {
      listBtn.classList.add("active");
      const content = document.querySelector("#groupsContent");
      await renderGroupList(content, portalState);
    }
  });
}

// ------------------------------------------------------------
// FEES TAB (updated for fee_date, fee_amount, description)
// ------------------------------------------------------------

async function renderGroupFees(container, portalState, groupId) {
  if (!groupId) {
    container.innerHTML = `<section class="card"><p>Select a group to view fees.</p></section>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Fees</h3>
        <button id="btnAddFee" class="btn-primary">Add Fee</button>
      </div>
      <div id="feesTable">Loading...</div>
    </section>
  `;

  const tableDiv = container.querySelector("#feesTable");

  // Fetch fees
  const url = `https://groups-module.dennis-e64.workers.dev/groups/fees?project=${portalState.project}&group_id=${groupId}`;
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
            <button id="btnSaveNewFee" class="btn-primary">Save</button>
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
                <button class="btn-primary btn-save-fee" data-id="${f.fee_id}">Save</button>
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
              <button class="btn-secondary btn-edit-fee" data-id="${f.fee_id}">Edit</button>
              <button class="btn-danger btn-delete-fee" data-id="${f.fee_id}">Delete</button>
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
          currentSortDirection =
            currentSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentSortField = field;
          currentSortDirection = "asc";
        }
        renderTable();
      });
    });

    // Add row save
    if (adding) {
      tableDiv.querySelector("#btnSaveNewFee").addEventListener("click", async () => {
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
  container.querySelector("#btnAddFee").addEventListener("click", () => {
    editing = null;
    adding = true;
    renderTable();
  });
}
