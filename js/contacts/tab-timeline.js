// js/contacts/tab-timeline.js
export async function renderContactTimeline(container, portalState, contactId) {
  container.innerHTML = `
    <section class="card">
      <h2>Contact Timeline</h2>
      <p>The full cross-platform timeline will appear here.</p>
      <p>Contact ID: <strong>${contactId}</strong></p>
      <p>This is a placeholder shell while we build the event feed.</p>
    </section>
  `;
}
