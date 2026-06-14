// leads.js
export async function loadLeadsTab({ portalState, tabContent }) {

  // Store active lead in portalState
  portalState.activeLeadId = portalState.activeLeadId || null;

  // --- Main Layout ---
  tabContent.innerHTML = `
    <section class="card">
      <h2>Leads</h2>

      <nav class="subtabs">
        <button data-tab="list">List</button>
        <button data-tab="client">Client</button>
        <button data-tab="details">Details</button>
        <button data-tab="services">Services</button>
        <button data-tab="pricing">Pricing Chart</button>
        <button data-tab="schedule">Schedule</button>
        <button data-tab="timeline">Timeline</button>
      </nav>

      <div id="leadsSubContent">Loading…</div>
    </section>
  `;

  const subContent = document.getElementById("leadsSubContent");

  // --- Subtab Loaders (Skeletons Only) ---
  async function show(tab) {
    switch (tab) {

      case "list":
        subContent.innerHTML = `
          <h3>Lead List</h3>
          <p>Filter bar goes here…</p>
          <p>Add Lead button goes here…</p>
          <p>Lead table goes here…</p>
        `;
        break;

      case "client":
        subContent.innerHTML = `
          <h3>Client</h3>
          <p>Linked contact info will load here…</p>
        `;
        break;

      case "details":
        subContent.innerHTML = `
          <h3>Lead Details</h3>
          <p>Dynamic lead fields will load here…</p>
        `;
        break;

      case "services":
        subContent.innerHTML = `
          <h3>Services</h3>
          <p>Lead services selection will load here…</p>
        `;
        break;

      case "pricing":
        subContent.innerHTML = `
          <h3>Pricing Chart</h3>
          <p>Pricing Engine output will load here…</p>
        `;
        break;

      case "schedule":
        subContent.innerHTML = `
          <h3>Schedule</h3>
          <p>GHL calendar + PDF generation will load here…</p>
        `;
        break;

      case "timeline":
        subContent.innerHTML = `
          <h3>Timeline</h3>
          <p>Lead timeline events will load here…</p>
        `;
        break;

      default:
        subContent.innerHTML = `<p>Unknown tab.</p>`;
    }
  }

  // --- Subtab Click Handlers ---
  document.querySelectorAll(".subtabs button").forEach(btn => {
    btn.addEventListener("click", () => show(btn.dataset.tab));
  });

  // Default tab
  show("list");
}
