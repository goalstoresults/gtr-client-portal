// /js/relationships/tab-details.js

export async function renderRelDetails(container, portalState) {
  try {
    const contactId = portalState.selectedContactId;

    if (!contactId) {
      container.innerHTML = `
        <section class="card">
          <h3>Relationships — Details View</h3>
          <p>No contact selected.</p>
        </section>
      `;
      return;
    }

    /* -------------------------------------------------------
       FETCH RELATIONSHIPS FOR THIS CONTACT
       (Correct URL format: /relationships/details/:id)
    ------------------------------------------------------- */
    const url = `https://relationships-topview.dennis-e64.workers.dev/relationships/details/${contactId}?project=${portalState.project}`;

    const res = await fetch(url, { cache: "no-cache" });
    const data = await res.json();

    const rels = Array.isArray(data) ? data : [];

    /* -------------------------------------------------------
       UPDATE CONTEXT BAR
    ------------------------------------------------------- */
    const contextBar = document.getElementById("contact-context-bar");
    if (contextBar) {
      contextBar.textContent = portalState.selectedContactName
        ? `Contact: ${portalState.selectedContactName}`
        : "Contact Details";
    }

    /* -------------------------------------------------------
       BUILD TABLE ROWS
    ------------------------------------------------------- */
    const rowsHtml = rels
      .map((r) => {
        const direction =
          r.source_contact_id === contactId ? "→" : "←";

        const relatedName =
          r.source_contact_id === contactId
            ? r.related_contact?.search_name
            : r.source_contact?.search_name;

        const relatedId =
          r.source_contact_id === contactId
            ? r.related_contact_id
            : r.source_contact_id;

        return `
          <tr>
            <td>${relatedName || "(unknown)"}</td>
            <td>${r.relationship_type || ""}</td>
            <td style="text-align:center;">${direction}</td>
            <td>${r.relationship_role || ""}</td>
            <td>
              <button class="btn-primary rel-jump" data-id="${relatedId}">
                View
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    /* -------------------------------------------------------
       RENDER DETAILS TABLE
    ------------------------------------------------------- */
    container.innerHTML = `
      <section class="card">
        <h3>Relationships for ${portalState.selectedContactName || ""}</h3>

        <table class="notes-table" style="margin-top:12px;">
          <thead>
            <tr>
              <th>Related Contact</th>
              <th>Type</th>
              <th>Dir</th>
              <th>Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${
              rowsHtml ||
              `<tr><td colspan="5" class="muted">(no relationships found)</td></tr>`
            }
          </tbody>
        </table>
      </section>
    `;

    /* -------------------------------------------------------
       CLICK HANDLER: JUMP TO ANOTHER CONTACT'S DETAILS
    ------------------------------------------------------- */
    container.querySelectorAll(".rel-jump").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const newId = btn.dataset.id;

        // Fetch contact name for context bar
        const res = await fetch(
          `https://contacts-module.dennis-e64.workers.dev/contacts/details/${newId}`,
          { cache: "no-cache" }
        );
        const data = await res.json();
        const contact = Array.isArray(data) ? data[0] : data;

        portalState.selectedContactId = newId;
        portalState.selectedContactName =
          contact.search_name ||
          `${contact.first_name || ""} ${contact.last_name || ""}`.trim();

        // Switch to Details tab
        document
          .querySelectorAll("#relationships-subtabs button")
          .forEach((b) => b.classList.remove("active"));

        const detailsBtn = document.querySelector(
          '#relationships-subtabs button[data-subtab="details"]'
        );
        if (detailsBtn) detailsBtn.classList.add("active");

        // Re-render Details for the new contact
        renderRelDetails(container, portalState);
      });
    });
  } catch (err) {
    container.innerHTML = `
      <section class="card">
        <h3>Relationships — Details View</h3>
        <p>Error: ${err.message}</p>
      </section>
    `;
  }
}

