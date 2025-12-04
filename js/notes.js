async function renderHistory(container, portalState) {
  try {
    // --- Pull current filter values ---
    const first = document.getElementById("filter-first")?.value.trim();
    const last  = document.getElementById("filter-last")?.value.trim();
    const reviewOnly = document.getElementById("filter-review-only")?.checked ?? true;

    // --- Build query filters ---
    const filters = [`project.eq.${portalState.project}`];
    if (first && first.length >= 3) filters.push(`first_name.ilike.*${first}*`);
    if (last  && last.length  >= 3) filters.push(`last_name.ilike.*${last}*`);
    if (reviewOnly) filters.push(`needs_review.eq.true`);

    let query = "";
    if (filters.length > 1) {
      query = `and=(${filters.join(",")})`;
    } else if (filters.length === 1) {
      query = filters[0];
    } else {
      query = `project.eq.${portalState.project}`; // fallback
    }

    const url = `https://notes-history-module.dennis-e64.workers.dev/notes_history?${query}`;
    console.log("[History] Fetching:", url);

    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    // --- Build filter UI (single line) ---
    container.innerHTML = `
      <h4>Notes History ${Array.isArray(data.notes) ? `(Total: ${data.notes.length})` : ""}</h4>
      <div style="margin-bottom:12px; display:flex; align-items:center; gap:12px;">
        <label><span class="notes-label">First:</span> 
          <input type="text" id="filter-first" class="form-control" value="${first || ""}" />
        </label>
        <label><span class="notes-label">Last:</span> 
          <input type="text" id="filter-last" class="form-control" value="${last || ""}" />
        </label>
        <label style="margin-left:12px;">
          <input type="checkbox" id="filter-review-only" ${reviewOnly ? "checked" : ""}>
          Needs Review Only
        </label>
        <button id="btnApplyFilter" class="secondary">Apply Filter</button>
        <button id="btnClearFilter" class="secondary">Clear Filter</button>
      </div>
    `;

    // --- Show table or fallback ---
    if (!res.ok || data.status !== "ok" || !Array.isArray(data.notes) || data.notes.length === 0) {
      container.innerHTML += `<p>No notes found.</p>`;
    } else {
      const table = document.createElement("table");
      table.className = "notes-table";
      table.innerHTML = `
        <thead>
          <tr>
            <th>Created</th>
            <th>Subject</th>
            <th>From</th>
            <th>Client</th>
            <th>Needs Review</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.notes.map(n => {
            const created = n.created_at ? new Date(n.created_at).toLocaleString() : "(no date)";
            const subject = n.subject || "(no subject)";
            const from = n.from_name || "(unknown)";
            const client = n.last_name || "(unknown)"; // show client last name if available
            const needsReview = n.needs_review ? "Yes" : "No";
            return `
              <tr>
                <td>${escapeHtml(created)}</td>
                <td>${escapeHtml(subject)}</td>
                <td>${escapeHtml(from)}</td>
                <td>${escapeHtml(client)}</td>
                <td>${escapeHtml(needsReview)}</td>
                <td><button data-note-id="${n.id||""}" class="secondary">Review</button></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      `;
      container.appendChild(table);

      // Wire Review buttons
      table.querySelectorAll("button[data-note-id]").forEach(btn =>
        btn.addEventListener("click", () => {
          const noteId = btn.getAttribute("data-note-id");
          portalState.selectedNoteId = noteId;
          setSubtabEnabled("review", true);
          setSubtabEnabled("relationships", true);
          document.querySelectorAll("#notes-subtabs button").forEach(b => b.classList.remove("active"));
          document.querySelector('#notes-subtabs button[data-subtab="review"]')?.classList.add("active");
          renderReview(container, portalState, noteId);
        })
      );
    }

    // Wire filter buttons
    document.getElementById("btnApplyFilter").addEventListener("click", () => {
      renderHistory(container, portalState);
    });
    document.getElementById("btnClearFilter").addEventListener("click", () => {
      document.getElementById("filter-first").value = "";
      document.getElementById("filter-last").value = "";
      document.getElementById("filter-review-only").checked = true;
      renderHistory(container, portalState);
    });

  } catch (err) {
    container.innerHTML = `
      <h4>Notes History</h4>
      <p>Error loading history: ${err.message}</p>
    `;
  }
}
