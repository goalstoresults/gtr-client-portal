// /js/jobs/tab-details.js

import { escapeHtml } from "../utilities.js";

export async function renderJobDetails(container, portalState) {

  const jobId = portalState.activeJobId;

  // ⭐ If no job selected → ADD MODE
  if (!jobId) {
    container.innerHTML = `
      <section class="card">
        <h2>Add Job</h2>

        <label>Job Name</label>
        <input type="text" id="jobNameInput" placeholder="Job name">

        <label>Contact</label>
        <select id="jobContactSelect"></select>

        <label>Status</label>
        <select id="jobStatusSelect">
          <option value="Open">Open</option>
          <option value="Scheduled">Scheduled</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <button id="btnSaveJob" class="btn-primary">Save Job</button>
      </section>
    `;

    await loadContactsIntoSelect(portalState);
    wireSaveNewJob(container, portalState);
    return;
  }

  // ⭐ EDIT MODE — fetch job details
  const job = await fetchJob(jobId, portalState);

  container.innerHTML = `
    <section class="card">
      <h2>Job Details</h2>

      <label>Job Name</label>
      <input type="text" id="jobNameInput" value="${escapeHtml(job.job_name || "")}">

      <label>Contact</label>
      <select id="jobContactSelect"></select>

      <label>Status</label>
      <select id="jobStatusSelect">
        <option value="Open">Open</option>
        <option value="Scheduled">Scheduled</option>
        <option value="Active">Active</option>
        <option value="Completed">Completed</option>
        <option value="Cancelled">Cancelled</option>
      </select>

      <button id="btnUpdateJob" class="btn-primary">Update Job</button>
    </section>
  `;

  await loadContactsIntoSelect(portalState, job.contact_id);
  document.getElementById("jobStatusSelect").value = job.status || "Open";

  wireUpdateJob(container, portalState, jobId);
}

/* -------------------------------------------------------
FETCH JOB DETAILS
------------------------------------------------------- */
async function fetchJob(jobId, portalState) {
  const url = `
    https://jobs-module.dennis-e64.workers.dev/jobs/get?id=${encodeURIComponent(jobId)}
  `.replace(/\s+/g, "");

  const res = await fetch(url);
  const data = await res.json();
  return data || {};
}

/* -------------------------------------------------------
LOAD CONTACTS INTO SELECT
------------------------------------------------------- */
async function loadContactsIntoSelect(portalState, selectedId = null) {
  const url = `
    https://contacts-module.dennis-e64.workers.dev/contacts/list?project=${encodeURIComponent(portalState.project)}
  `.replace(/\s+/g, "");

  const res = await fetch(url);
  const contacts = await res.json();

  const select = document.getElementById("jobContactSelect");
  select.innerHTML = contacts
    .map(c => `
      <option value="${c.contact_id}" ${c.contact_id === selectedId ? "selected" : ""}>
        ${escapeHtml(c.search_name)}
      </option>
    `)
    .join("");
}

/* -------------------------------------------------------
SAVE NEW JOB
------------------------------------------------------- */
function wireSaveNewJob(container, portalState) {
  const btn = container.querySelector("#btnSaveJob");

  btn.addEventListener("click", async () => {
    const jobName = document.getElementById("jobNameInput").value.trim();
    const contactId = document.getElementById("jobContactSelect").value;
    const status = document.getElementById("jobStatusSelect").value;

    const payload = {
      project: portalState.project,
      job_name: jobName,
      contact_id: contactId,
      status
    };

    const res = await fetch(
      "https://jobs-module.dennis-e64.workers.dev/jobs/add",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();

    alert("Job created.");
    portalState.activeJobId = data[0]?.job_id || null;

    const listBtn = document.querySelector('#jobs-subtabs button[data-subtab="list"]');
    if (listBtn) listBtn.click();
  });
}

/* -------------------------------------------------------
UPDATE EXISTING JOB
------------------------------------------------------- */
function wireUpdateJob(container, portalState, jobId) {
  const btn = container.querySelector("#btnUpdateJob");

  btn.addEventListener("click", async () => {
    const jobName = document.getElementById("jobNameInput").value.trim();
    const contactId = document.getElementById("jobContactSelect").value;
    const status = document.getElementById("jobStatusSelect").value;

    const payload = {
      id: jobId,
      updates: {
        job_name: jobName,
        contact_id: contactId,
        status
      }
    };

    const res = await fetch(
      "https://jobs-module.dennis-e64.workers.dev/jobs/update",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    alert("Job updated.");

    const listBtn = document.querySelector('#jobs-subtabs button[data-subtab="list"]');
    if (listBtn) listBtn.click();
  });
}
