// js/setup.js v0.5
export async function loadSetupTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <nav class="subtabs" id="setup-subtabs">
        <button data-subtab="client" class="active">Client</button>
        <button data-subtab="contact">Contact</button>
        <button data-subtab="lookups">Lookups</button>
      </nav>
      <div id="setupContent">
        <section class="card"><p>Select a subtab to begin.</p></section>
      </div>
    </section>
  `;

  const subtabs = tabContent.querySelector("#setup-subtabs");
  const setupContent = tabContent.querySelector("#setupContent");

  subtabs.querySelectorAll("button[data-subtab]").forEach(btn => {
    btn.addEventListener("click", () => {
      subtabs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const sub = btn.dataset.subtab;
      if (sub === "client") {
        setupContent.innerHTML = `<section class="card"><p><strong>Client Setup</strong>: Placeholder for project config.</p></section>`;
      } else if (sub === "contact") {
        setupContent.innerHTML = `<section class="card"><p><strong>Contact Setup</strong>: Placeholder for field visibility/labels.</p></section>`;
      } else if (sub === "lookups") {
        setupContent.innerHTML = `<section class="card"><p><strong>Lookups Setup</strong>: Placeholder for dropdown values.</p></section>`;
      }
    });
  });
}
