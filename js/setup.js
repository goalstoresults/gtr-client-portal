// js/setup.js v0.7
export async function loadSetupTab({ portalState, tabContent }) {
  // Load the partial shell
  const res = await fetch("./components/setup.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const subtabs = tabContent.querySelector("#setup-subtabs");
  const setupContent = tabContent.querySelector("#setupContent");

  subtabs.querySelectorAll("button[data-subtab]").forEach(btn => {
    btn.addEventListener("click", () => {
      // Reset active state
      subtabs.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const sub = btn.dataset.subtab;
      switch (sub) {
        case "client":
          setupContent.innerHTML = `
            <section class="card">
              <h2>Client Setup</h2>
              <p>Placeholder for project config (tabs, sort order).</p>
            </section>
          `;
          break;
        case "contact":
          setupContent.innerHTML = `
            <section class="card">
              <h2>Contact Setup</h2>
              <p>Placeholder for field visibility/labels.</p>
            </section>
          `;
          break;
        case "lookups":
          setupContent.innerHTML = `
            <section class="card">
              <h2>Lookups Setup</h2>
              <p>Placeholder for dropdown values.</p>
            </section>
          `;
          break;
        default:
          setupContent.innerHTML = `
            <section class="card">
              <p>Select a subtab to begin.</p>
            </section>
          `;
      }
    });
  });
}
