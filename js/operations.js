import { loadServicesTab } from "./operations/services.js";
import { loadRevenueTab } from "./operations/revenue.js";
import { loadGoalsTab } from "./operations/goals.js";
import { loadActualsTab } from "./operations/actuals.js";
import { loadPerformanceTab } from "./operations/performance.js";

export async function loadOperationsTab({ portalState, tabContent }) {
tabContent.innerHTML = `
    <section class="card">
      <nav id="groups-subtabs" class="subtabs" style="margin-bottom:12px;">
      <button data-subtab="services">Services</button>
      <button data-subtab="revenue">Revenue Structure</button>
      <button data-subtab="goals">Goals</button>
      <button data-subtab="actuals">Actuals</button>
      <button data-subtab="performance">Performance</button>
      </nav>
      <div id="operations-content"></div>
    </section>
  `;

  const content = document.getElementById("operations-content");

  const subtabMap = {
    "services": loadServicesTab,
    "revenue": loadRevenueTab,
    "goals": loadGoalsTab,
    "actuals": loadActualsTab,
    "performance": loadPerformanceTab
  };

  function activate(subtab) {
    document.querySelectorAll(".subtabs button").forEach(btn =>
      btn.classList.remove("active")
    );
    document.querySelector(`button[data-subtab="${subtab}"]`)?.classList.add("active");

    content.innerHTML = "";
    subtabMap[subtab]({ portalState, content });
  }

  // Default subtab
  activate("services");

  document.querySelectorAll(".subtabs button").forEach(btn => {
    btn.addEventListener("click", () => activate(btn.dataset.subtab));
  });
}
