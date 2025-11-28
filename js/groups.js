// js/groups.js v1.0.0
console.log("[Groups.js] loaded");

export async function loadGroupsTab({ portalState, tabContent }) {
  await loadPartial("/components/groups.html", tabContent);
  initGroups(portalState);
}

async function loadPartial(url, tabContent) {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const html = await res.text();
    tabContent.innerHTML = html;
    const header = tabContent.querySelector("h2");
    if (header) header.textContent = "Groups (v1.0.0)";
  } catch (err) {
    tabContent.innerHTML = `<section class="card"><p>Error loading partial (${url}): ${err.message}</p></section>`;
  }
}

function initGroups(portalState) {
  const container = document.getElementById("groupsContent");
  if (container) {
    container.innerHTML = `
      <h3>Networking Groups & Associations</h3>
      <p>Here you’ll manage professional groups, associations, and memberships.</p>
      <button id="btnAddGroup" class="primary">+ Add Group</button>
      <div id="groupsGrid" style="margin-top:12px;"></div>
    `;

    document.getElementById("btnAddGroup").addEventListener("click", () => {
      alert("TODO: Add Group form goes here.");
    });
  }
}
