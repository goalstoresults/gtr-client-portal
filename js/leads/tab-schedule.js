// js/leads/tab-schedule.js

export async function renderLeadSchedule(container, portalState) {

  // Safety: If no lead exists yet, block the tab
  if (!portalState.activeLeadId) {
    container.innerHTML = `
      <section class="card">
        <h2>Schedule</h2>
        <p class="muted">Create a lead first before accessing the schedule.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Schedule</h2>

      <p class="muted" style="margin-bottom:16px;">
        Use the calendar below to schedule appointments for this lead.
      </p>

      <div class="calendar-wrapper">
        <iframe 
          src="https://api.leadconnectorhq.com/widget/booking/4m6uvnvkeO5frly4Eb5o"
          style="width:100%; border:none; overflow:hidden;"
          scrolling="no"
          id="lead-calendar-iframe">
        </iframe>

        <script src="https://api.leadconnectorhq.com/js/form_embed.js" type="text/javascript"></script>
      </div>
    </section>
  `;
}
