// js/contacts.js v1.2
export async function loadContactsTab({ portalState, tabContent }) {
  const res = await fetch("./components/contacts.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = tabContent.querySelector("#contactsContent");
  const buttons = tabContent.querySelectorAll("#contacts-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;
      switch (subtab) {
        case "add":
          await renderAddContactForm(content, portalState);
          break;

        case "list":
          content.innerHTML = `
            <section class="card">
              <h2>Contact List for ${escapeHtml(portalState.display_name || portalState.project)}</h2>
              <div id="contactTable">Loading...</div>
            </section>
          `;
          const tableDiv = content.querySelector("#contactTable");
          const resList = await fetch(
            `https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${portalState.project}`
          );
          const contacts = await resList.json();
          tableDiv.innerHTML = `
            <table class="notes-table">
              <thead><tr><th>Name</th><th>Email</th></tr></thead>
              <tbody>
                ${contacts.map(c => `<tr><td>${escapeHtml(c.name || "")}</td><td>${escapeHtml(c.email || "")}</td></tr>`).join("")}
              </tbody>
            </table>
          `;
          break;

        case "details":
          content.innerHTML = `
            <section class="card">
              <h2>Contact Details</h2>
              <p>(Placeholder for detailed contact view)</p>
            </section>
          `;
          break;

        case "relationships":
          content.innerHTML = `
            <section class="card">
              <h2>Relationships</h2>
              <p>(Placeholder for relationship mapping UI)</p>
            </section>
          `;
          break;

        case "notes":
          content.innerHTML = `
            <section class="card">
              <h2>Contact Notes</h2>
              <p>(Placeholder for notes integration with Contacts)</p>
            </section>
          `;
          break;

        default:
          content.innerHTML = `
            <section class="card">
              <p>Select a subtab to begin.</p>
            </section>
          `;
      }
    });
  });
}

// 🔧 Dynamic Add Contact Form
async function renderAddContactForm(container, portalState) {
  const projectId = portalState.project;
  if (!projectId) {
    container.innerHTML = `<section class="card"><p>No project selected.</p></section>`;
    return;
  }

  const res = await fetch(
    `https://contacts-module.dennis-e64.workers.dev/contact_fields?project=${projectId}`,
    { cache: "no-cache" }
  );
  const data = await res.json();
  const fields = Array.isArray(data.rows) ? data.rows : [];
  fields.sort((a, b) => a.sort_order - b.sort_order);

  container.innerHTML = `
    <section class="card">
      <h2>Add Contact for ${escapeHtml(portalState.display_name || projectId)}</h2>
      <form id="addContactForm" class="notes-form">
        ${fields.map(f => `
          <div class="form-row" style="margin-bottom:12px;">
            <label style="display:block; font-weight:bold; margin-bottom:4px;">
              ${escapeHtml(f.label || f.field_key)}
            </label>
            <input type="text" name="${f.field_key}" style="width:100%;" />
          </div>
        `).join("")}
        <button type="submit" class="btn-primary">Save Contact</button>
      </form>
    </section>
  `;

  const form = container.querySelector("#addContactForm");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = {};

    fields.forEach(f => {
      payload[f.field_key] = formData.get(f.field_key);
    });

    // 🔑 Generate contact_id
    payload.contact_id = crypto.randomUUID();
    payload.project = projectId;
    payload.created_at = new Date().toISOString();

    // 📝 Calculate name from first + last
    const first = formData.get("first_name") || "";
    const last = formData.get("last_name") || "";
    payload.name = `${first} ${last}`.trim();

    try {
      const res = await fetch("https://contacts-module.dennis-e64.workers.dev/contacts/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      container.innerHTML = `<section class="card"><p>${escapeHtml(result.message || "Contact saved.")}</p></section>`;
    } catch (err) {
      container.innerHTML = `<section class="card"><p>Error saving contact: ${escapeHtml(err.message)}</p></section>`;
    }
  });
}

// helper
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}
