// inspections.js
import { renderInspectionAdd } from "./inspections/tab-add.js";
import { renderInspectionList } from "./inspections/tab-list.js";
import { renderInspectionSummary } from "./inspections/tab-summary.js";
import { renderInspectionRevenue } from "./inspections/tab-revenue.js";

export async function loadInspectionsTab({ portalState, tabContent }) {
    const res = await fetch("./components/inspections.html", { cache: "no-cache" });
    tabContent.innerHTML = await res.text();

    let contextBar = document.getElementById("inspections-context-bar");
    if (!contextBar) {
        contextBar = document.createElement("div");
        contextBar.id = "inspections-context-bar";
        contextBar.className = "contact-context-bar";
        tabContent.prepend(contextBar);
    }

    contextBar.textContent = portalState.selectedContactName
        ? `Contact: ${portalState.selectedContactName}`
        : "No contact selected";

    const content = tabContent.querySelector("#inspectionsContent");
    const buttons = tabContent.querySelectorAll("#inspections-subtabs button");

    buttons.forEach(btn => {
        btn.addEventListener("click", async () => {
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const subtab = btn.dataset.subtab;

            if (subtab === "add") return renderInspectionAdd(content, portalState);
            if (subtab === "list") return renderInspectionList(content, portalState);
            if (subtab === "summary") return renderInspectionSummary(content, portalState);
            if (subtab === "revenue") return renderInspectionRevenue(content, portalState);

            content.innerHTML = `
                <section class="card">
                    <p>Select a subtab to begin.</p>
                </section>
            `;
        });
    });

    const defaultBtn = tabContent.querySelector(
        '#inspections-subtabs button[data-subtab="list"]'
    );

    if (defaultBtn) {
        defaultBtn.classList.add("active");
        await renderInspectionList(content, portalState);
    }
}
