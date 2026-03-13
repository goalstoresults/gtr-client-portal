// tab-submit.js — Submit Help Request (workspace layout)

import { escapeHtml } from "../utilities.js";

export async function loadHelpSubmit({ portalState, container }) {
  if (!portalState.project) {
    container.innerHTML = `
      <section class="card">
        <p>No project selected.</p>
      </section>
    `;
    return;
  }

  /* =========================================================
     1) Render shell
  ========================================================== */
  container.innerHTML = `
    <section class="card">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
        <h2 style="margin:0;">Submit Help Request</h2>
        <button id="submitHelpBtn" class="btn-primary">Submit</button>
      </div>

      <div id="helpSubmitContent">Loading…</div>
    </section>
  `;

  const content = container.querySelector("#helpSubmitContent");
  const submitBtn = container.querySelector("#submitHelpBtn");

  /* =========================================================
     2) Build form
  ========================================================== */
  content.innerHTML = `
    <form id="helpForm" class="workspace-form" style="display:flex; flex-direction:column; gap:12px;">

      <!-- Row 1: Module, Issue Type, Severity -->
      <div style="display:flex; gap:12px;">
        <div style="flex:0 0 30%;">
          <label>Module</label>
          <select id="moduleInput" style="width:100%;">
            <option value="">-- Select --</option>
            <option value="contacts">Contacts</option>
            <option value="notes">Notes</option>
            <option value="tasks">Tasks</option>
            <option value="pipelines">Pipelines</option>
            <option value="financials">Financials</option>
            <option value="operations">Operations</option>
            <option value="setup">Setup</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style="flex:0 0 30%;">
          <label>Issue Type</label>
          <select id="issueTypeInput" style="width:100%;">
            <option value="">-- Select --</option>
            <option value="bug">Bug</option>
            <option value="confusion">Confusion</option>
            <option value="feature_request">Feature Request</option>
            <option value="data_issue">Data Issue</option>
            <option value="permission_issue">Permission Issue</option>
          </select>
        </div>

        <div style="flex:0 0 20%;">
          <label>Severity</label>
          <select id="severityInput" style="width:100%;">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="blocking">Blocking</option>
          </select>
        </div>
      </div>

      <!-- Row 2: Description -->
      <div style="display:flex; flex-direction:column;">
        <label>Description</label>
        <textarea id="descriptionInput" placeholder="Describe the issue…" style="width:100%; height:120px;"></textarea>
      </div>

      <!-- Row 3: Steps to Reproduce -->
      <div style="display:flex; flex-direction:column;">
        <label>Steps to Reproduce (optional)</label>
        <textarea id="stepsInput" placeholder="If possible, list the steps…" style="width:100%; height:100px;"></textarea>
      </div>

      <!-- Row 4: Screenshot URL -->
      <div style="display:flex; flex-direction:column;">
        <label>Screenshot URL (optional)</label>
        <input id="screenshotInput" placeholder="Paste screenshot URL" style="width:100%;">
      </div>

      <!-- Row 5: Screenshot Upload -->
      <div style="display:flex; flex-direction:column;">
        <label>Upload Screenshot (optional)</label>

        <input 
          type="file" 
          id="screenshot_file" 
          accept="image/png, image/jpeg, image/jpg, image/webp"
          style="margin-top:6px;"
        />

        <!-- Preview container -->
        <div id="screenshot_preview" style="margin-top:10px; display:none;">
          <img 
            id="screenshot_thumb" 
            src="" 
            alt="Screenshot Preview" 
            style="max-width:200px; border:1px solid #ccc; border-radius:4px;"
          />
          <button 
            type="button" 
            id="remove_screenshot_btn" 
            style="display:block; margin-top:6px;"
          >
            Remove
          </button>
        </div>
      </div>

    </form>
  `;

  const form = content.querySelector("#helpForm");

  const fileInput = form.querySelector("#screenshot_file");
  const previewBox = form.querySelector("#screenshot_preview");
  const thumb = form.querySelector("#screenshot_thumb");
  const removeBtn = form.querySelector("#remove_screenshot_btn");
  const screenshotUrlInput = form.querySelector("#screenshotInput");

  /* =========================================================
     Preview + Upload Logic
  ========================================================== */
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) {
      previewBox.style.display = "none";
      thumb.src = "";
      screenshotUrlInput.value = "";
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      thumb.src = e.target.result;
      previewBox.style.display = "block";
    };
    reader.readAsDataURL(file);

    // Upload to Supabase Storage
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${portalState.project}/${portalState.user_id}/${fileName}`;

      const uploadRes = await fetch(
        "https://cwzlbwqzosoreyndenok.supabase.co/storage/v1/object/help_screenshots/" + encodeURIComponent(storagePath),
        {
          method: "POST",
          headers: {
            "Content-Type": file.type,
            "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3emxid3F6b3NvcmV5bmRlbm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTkyODIsImV4cCI6MjA2ODc3NTI4Mn0.6yZV9E0RcNaHqEfEmaBZH15RC02_FkxwiGMyuX0THdM",
            "Authorization": `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3emxid3F6b3NvcmV5bmRlbm9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTkyODIsImV4cCI6MjA2ODc3NTI4Mn0.6yZV9E0RcNaHqEfEmaBZH15RC02_FkxwiGMyuX0THdM`
          },
          body: file
        }
      );

      if (!uploadRes.ok) {
        console.error("Upload failed", await uploadRes.text());
        alert("Screenshot upload failed.");
        return;
      }

      const publicUrl =
        "https://cwzlbwqzosoreyndenok.supabase.co/storage/v1/object/public/help_screenshots/" +
        encodeURIComponent(storagePath);

      screenshotUrlInput.value = publicUrl;
    } catch (err) {
      console.error("Upload error", err);
      alert("Screenshot upload failed.");
    }
  });

  removeBtn.addEventListener("click", () => {
    fileInput.value = "";
    thumb.src = "";
    previewBox.style.display = "none";
    screenshotUrlInput.value = "";
  });

  /* =========================================================
     3) Submit Handler
  ========================================================== */
  submitBtn.addEventListener("click", async () => {
    const moduleVal = form.querySelector("#moduleInput").value;
    const issueTypeVal = form.querySelector("#issueTypeInput").value;
    const severityVal = form.querySelector("#severityInput").value;
    const descriptionVal = form.querySelector("#descriptionInput").value.trim();
    const stepsVal = form.querySelector("#stepsInput").value.trim();
    const screenshotVal = screenshotUrlInput.value.trim();

    if (!moduleVal) {
      alert("Please select a module.");
      return;
    }
    if (!issueTypeVal) {
      alert("Please select an issue type.");
      return;
    }
    if (!descriptionVal) {
      alert("Please enter a description.");
      return;
    }

    const payload = {
      user_id: portalState.user_id,
      project: portalState.project,
      first_name: portalState.first_name,
      last_name: portalState.last_name,
      email: portalState.email,

      module: moduleVal,
      issue_type: issueTypeVal,
      severity: severityVal,

      description: descriptionVal,
      steps_to_reproduce: stepsVal || null,
      screenshot_url: screenshotVal || null
    };

    await fetch(
      "https://help-center-worker.dennis-e64.workers.dev/help/submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    alert("Help request submitted.");
    form.reset();

    fileInput.value = "";
    thumb.src = "";
    previewBox.style.display = "none";
    screenshotUrlInput.value = "";
  });
}

