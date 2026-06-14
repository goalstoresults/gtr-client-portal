// js/leads/tab-details.js
export async function renderLeadDetails(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h2>Lead Details</h2>
      <p>Dynamic lead fields (based on Setup → Lead Fields) will load here.</p>
    </section>
  `;
}
