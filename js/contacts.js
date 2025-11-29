// js/contacts.js v0.7
export async function loadContactsTab({ portalState, tabContent }) {
  // Load the partial shell
  const res = await fetch("./components/contacts.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = tabContent.querySelector("#contactsContent");
  const buttons = tabContent.querySelectorAll("#contacts-subtabs button");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      // Reset active state
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;
      switch (subtab) {
        case "add":
          content.innerHTML = `
            <section class="card">
              <h2>Add Contact</h2>
              <form id="addContactForm">
                <label>Name:<br><input type="text" name="name" required /></label><br><br>
                <label>Email:<br><input type="email" name="email" required /></label><br><br>
                <button type="submit">Save Contact</button>
              </form>
            </section>
          `;
          const form = content.querySelector("#addContactForm");
          form.addEventListener("submit", async e => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(form));
            const res = await fetch("/contacts/add", {
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
              <h2>Contact List</h2>
              <div id="contactTable"></div>
            </section>
          `;
          const tableDiv = content.querySelector("#contactTable");
          const resList = await fetch("/contacts/list");
          const contacts = await resList.json();
          tableDiv.innerHTML = `
            <table>
              <tr><th>Name</th><th>Email</th></tr>
              ${contacts.map(c => `<tr><td>${c.name}</td><td>${c.email}</td></tr>`).join("")}
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
