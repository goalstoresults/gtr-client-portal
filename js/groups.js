// js/groups.js v0.1
console.log("[Groups.js] loaded");

export async function loadGroupsTab({ portalState, tabContent }) {
  // Basic scaffold for Groups tab
  tabContent.innerHTML = `
    <section class="card">
      <h2>Groups</h2>
      <div id="groupsContent">
        <p>This is the Groups tab. Here you’ll manage networking groups and associations.</p>
      </div>
    </section>
  `;
}
