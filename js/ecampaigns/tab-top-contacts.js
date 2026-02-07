// ------------------------------------------------------------
// RENDER E‑CAMPAIGNS → TOP CONTACTS
// ------------------------------------------------------------
export async function renderECTopContacts(container, portalState) {
  container.innerHTML = `
    <section class="card">
      <h3>Top Contacts</h3>
      <p>Loading top contacts...</p>
    </section>
  `;

  const project = portalState.project;

  try {
    const url = new URL(`${portalState.apiBase}/analytics/top-contacts`);
    url.searchParams.set("project", project);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const rows = await res.json();

    // Build table rows
    const tableRows = rows
      .map(r => {
        const last = r.last_activity
          ? new Date(r.last_activity).toLocaleString()
          : "-";

        return `
          <tr>
            <td>${r.contact_name || "(no name)"}</td>
            <td>${r.contact_type || "-"}</td>
            <td>${r.total_opens || 0}</td>
            <td>${r.total_clicks || 0}</td>
            <td>${last}</td>
          </tr>
        `;
      })
      .join("");

    container.innerHTML = `
      <section class="card">
        <h3>Top Contacts</h3>
        <p>Contacts with the highest engagement across all campaigns.</p>

        <table class="table">
          <thead>
            <tr>
              <th>Contact Name</th>
              <th>Type</th>
              <th>Opens (All)</th>
              <th>Clicks (All)</th>
              <th>Last Activity</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows || `
              <tr>
                <td colspan="5" style="text-align:center; padding:20px;">
                  No engagement found.
                </td>
              </tr>
            `}
          </tbody>
        </table>
      </section>
    `;
  } catch (err) {
    container.innerHTML = `
      <section class="card">
        <h3>Top Contacts</h3>
        <p class="error">Error loading top contacts: ${err.message}</p>
      </section>
    `;
  }
}
