// /js/jobs.js
import { renderJobDetails } from "./jobs/tab-details.js";


export async function loadJobsTab({ portalState, tabContent }) {

  // Load base HTML
  const res = await fetch("./components/jobs.html", { cache: "no-cache" });
  tabContent.innerHTML = await res.text();

  const content = tabContent.querySelector("#jobsContent");
  const buttons = tabContent.querySelectorAll("#jobs-subtabs button");

  // ⭐ SUBTAB ROUTER (same as contacts.js)
  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {

      // REMOVE ACTIVE FROM ALL
      buttons.forEach(b => b.classList.remove("active"));

      // ADD ACTIVE TO CLICKED
      btn.classList.add("active");

      const subtab = btn.dataset.subtab;

      switch (subtab) {
        case "list": {
          const { renderJobsList } = await import("./jobs/tab-list.js");
          await renderJobsList(content, portalState);
          break;
        }

        case "details":
          await renderJobDetails(content, portalState);
          break;

        case "cost":
          content.innerHTML = `<section class="card"><h2>Job Cost</h2></section>`;
          break;

        case "staff":
          content.innerHTML = `<section class="card"><h2>Job Staff</h2></section>`;
          break;

        case "timeline":
          content.innerHTML = `<section class="card"><h2>Job Timeline</h2></section>`;
          break;

        default:
          content.innerHTML = `<section class="card"><p>Select a subtab to begin.</p></section>`;
      }
    });
  });

  // ⭐ DEFAULT TO LIST VIEW
  const defaultBtn = tabContent.querySelector('#jobs-subtabs button[data-subtab="list"]');
  if (defaultBtn) {
    defaultBtn.classList.add("active");
    const { renderJobsList } = await import("./jobs/tab-list.js");
    await renderJobsList(content, portalState);
  }
}
