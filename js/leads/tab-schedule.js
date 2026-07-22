// js/leads/tab-schedule.js

export async function renderLeadSchedule(container, portalState, { tabLabel }) {

  // Safety: If no lead exists yet, block the tab
  if (!portalState.activeLeadId) {
    container.innerHTML = `
      <section class="card">
        <h2>${tabLabel}</h2>
        <p class="muted">Create a lead first before accessing the ${tabLabel.toLowerCase()}.</p>
      </section>
    `;
    return;
  }

  /* -------------------------------------------------------
     FETCH PROJECT CONFIG (to get schedule iframe if needed)
  ------------------------------------------------------- */
  let scheduleConfig = null;

  try {
    const configRes = await fetch(`/leads/config?project=${portalState.project}`);
    const configData = await configRes.json();

    // Find the "calendar" tab config
    scheduleConfig = (configData.tabs || []).find(t => t.key === "calendar");
  } catch (err) {
    console.error("[Schedule Tab] Failed to load project config:", err);
  }

  // Default fallback iframe (CSI)
  const iframeSrc =
    scheduleConfig?.iframe_src ||
    "https://api.leadconnectorhq.com/widget/booking/4m6uvnvkeO5frly4Eb5o";

  container.innerHTML = `
    <section class="card">
      <h2>${tabLabel}</h2>

      <p class="muted" style="margin-bottom:16px;">
        Use the calendar below to schedule appointments for this lead.
      </p>

      <div class="calendar-wrapper">
        <iframe 
          src="${iframeSrc}"
          style="width:100%; border:none; overflow:hidden;"
          scrolling="no"
          id="lead-calendar-iframe">
        </iframe>

        <script src="https://api.leadconnectorhq.com/js/form_embed.js" type="text/javascript"></script>
      </div>
    </section>
  `;
}
