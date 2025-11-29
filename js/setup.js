// js/setup.js v0.2
export async function loadSetupTab({ portalState, tabContent }) {
  // Load the setup.html partial
  const res = await fetch("./components/setup.html", { cache: "no-cache" });
  const html = await res.text();
  tabContent.innerHTML = html;

  // Attach submenu handlers
  const submenu = tabContent.querySelector("#setup-submenu");
  const setupContent = tabContent.querySelector("#setupContent");

  submenu.querySelectorAll("button[data-sub]").forEach(btn => {
    btn.addEventListener("click", () => {
      const sub = btn.dataset.sub;
      submenu.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (sub === "client") {
        setupContent.innerHTML = `<p><strong>Client Setup</strong>: Placeholder for project config (tabs, sort order).</p>`;
      } else if (sub === "contact") {
        setupContent.innerHTML = `<p><strong>Contact Setup</strong>: Placeholder for field visibility/labels.</p>`;
      } else if (sub === "lookups") {
        setupContent.innerHTML = `<p><strong>Lookups Setup</strong>: Placeholder for dropdown values.</p>`;
      }
    });
  });
}
