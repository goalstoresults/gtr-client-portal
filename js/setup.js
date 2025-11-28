// js/setup.js v0.1
console.log("[Setup.js] loaded");

export async function loadSetupTab({ portalState, tabContent }) {
  tabContent.innerHTML = `
    <section class="card">
      <h2>Setup</h2>
      <p>This is the Setup tab. Use it to configure new projects.</p>
    </section>
  `;
}
