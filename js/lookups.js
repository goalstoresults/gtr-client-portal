function loadLookupsTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2>Lookup Groups</h2>
      <div id="lookupGroups">Loading...</div>
      <button id="addGroupBtn">+ Add Lookup Group</button>
    </section>
  `;

  const groupsDiv = tabContent.querySelector("#lookupGroups");

  fetch(`/lookups/list?project=${portalState.project}`)
    .then(res => res.json())
    .then(data => {
      const grouped = {};
      data.forEach(row => {
        if (!grouped[row.lookup_type]) grouped[row.lookup_type] = [];
        grouped[row.lookup_type].push(row);
      });

      groupsDiv.innerHTML = Object.keys(grouped).map(type => `
        <section class="lookup-group">
          <h3>${type}</h3>
          <table>
            <tr><th>Value</th><th>Sort</th><th>Active</th></tr>
            ${grouped[type].map(item => `
              <tr>
                <td>${item.value}</td>
                <td>${item.sort_order}</td>
                <td>${item.is_active}</td>
              </tr>
            `).join("")}
          </table>
        </section>
      `).join("");
    });
}

export { loadLookupsTab };
