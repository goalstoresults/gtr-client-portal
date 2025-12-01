// js/contacts.js v0.8
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
          content.innerHTML = `
            <section class="card">
              <h2>Add Contact for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>
              <form id="addContactForm">
                <label>Name:<br><input type="text" name="name" required /></label><br><br>
                <label>Email:<br><input type="email" name="email" required /></label><br><br>
                <button type="submit" class="btn-primary">Save Contact</button>
              </form>
            </section>
          `;
          const form = content.querySelector("#addContactForm");
          form.addEventListener("submit", async e => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(form));
            data.project = portalState.setup_project_id;
            data.created_at = new Date().toISOString();

            const res = await fetch("https://contacts-module.dennis-e64.workers.dev/contacts/add", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data)
            });
            const result = await res.json();
            content.innerHTML = `<section class="card"><p>${result.message}</p></section>`;
          });
          break;

        case "list":
          content.innerHTML = `
            <section class="card">
              <h2>Contact List for ${escapeHtml(portalState.display_name || portalState.setup_project_id)}</h2>
              <div id="contactTable">Loading...</div>
            </section>
          `;
          const tableDiv = content.querySelector("#contactTable");
          const resList = await fetch(`https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${portalState.setup_project_id}`);
          const contacts = await resList.json();
          tableDiv.innerHTML = `
            <table class="notes-table">
              <thead><tr><th>Name</th><th>Email</th></tr></thead>
              <tbody>
                ${contacts.map(c => `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.email)}</td></tr>`).join("")}
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

// helper
function escapeHtml(str) {
  return str?.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c])) || "";
}

