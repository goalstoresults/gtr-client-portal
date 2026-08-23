// /js/jobs.js

export async function loadJobsTab({ portalState, tabContent }) {

  tabContent.innerHTML = `
    <section class="card">
      <h2>Jobs</h2>

      <nav class="subtabs" id="jobs-subtabs">
        <button data-subtab="list">List</button>
        <button data-subtab="details">Details</button>
        <button data-subtab="cost">Cost</button>
        <button data-subtab="staff">Staff</button>
        <button data-subtab="timeline">Timeline</button>
      </nav>

      <div id="jobsSubContent">Loading…</div>
    </section>
  `;

  const subContent = document.getElementById("jobsSubContent");

  async function show(tab) {
    switch (tab) {
      case "list": {
        const { renderJobsList } = await import("./jobs/tab-list.js");
        return renderJobsList(subContent, portalState);
      }

      case "details":
        subContent.innerHTML = `<h3>Job Details</h3><p>(placeholder)</p>`;
        break;

      case "cost":
        subContent.innerHTML = `<h3>Job Cost</h3><p>(placeholder)</p>`;
        break;

      case "staff":
        subContent.innerHTML = `<h3>Job Staff</h3><p>(placeholder)</p>`;
        break;

      case "timeline":
        subContent.innerHTML = `<h3>Job Timeline</h3><p>(placeholder)</p>`;
        break;

      default:
        subContent.innerHTML = `<p>Unknown tab.</p>`;
    }
  }

  document.querySelectorAll("#jobs-subtabs button").forEach(btn => {
    btn.addEventListener("click", () => show(btn.dataset.subtab));
  });

  show("list");
}
