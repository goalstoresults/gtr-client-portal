// js/leads/tab-pricing.js

import { escapeHtml } from "../utilities.js";

const LEADS_MODULE_URL = "https://leads-module.dennis-e64.workers.dev";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return `$${numericValue.toFixed(2)}`;
}

function getInputPriceValue(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "";
  }

  return numericValue.toFixed(2);
}

function calculateQuoteTotals(lines) {
  return lines.reduce(
    (result, line) => {
      const rawPrice = line.unit_price;
      const quantity = Number(line.quantity || 1);

      if (
        rawPrice === null ||
        rawPrice === undefined ||
        String(rawPrice).trim() === ""
      ) {
        result.unpricedCount += 1;
        return result;
      }

      const price = Number(rawPrice);

      if (!Number.isFinite(price)) {
        result.unpricedCount += 1;
        return result;
      }

      result.total += price * quantity;
      return result;
    },
    {
      total: 0,
      unpricedCount: 0
    }
  );
}

export async function renderLeadPricing(container, portalState) {
  const leadId = portalState.activeLeadId;
  const project = portalState.project;

  if (!leadId) {
    container.innerHTML = `
      <section class="card">
        <h2>Pricing Chart</h2>
        <p class="muted">Select or create a lead first.</p>
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <h2>Pricing Chart</h2>
      <p class="muted">Loading draft quote…</p>
    </section>
  `;

  try {
    const quoteUrl =
      `${LEADS_MODULE_URL}/quotes/draft` +
      `?project=${encodeURIComponent(project)}` +
      `&lead_id=${encodeURIComponent(leadId)}`;

    const quoteRes = await fetch(quoteUrl, {
      cache: "no-cache"
    });

    const quoteData = await quoteRes.json();

    if (!quoteRes.ok) {
      throw new Error(
        quoteData?.error || `Unable to load draft quote (${quoteRes.status}).`
      );
    }

    const quote = quoteData?.quote || null;
    const lines = Array.isArray(quoteData?.lines)
      ? quoteData.lines
      : [];

    if (!quote) {
      container.innerHTML = `
        <section class="card">
          <h2>Pricing Chart</h2>

          <p class="muted">
            No draft quote exists for this lead yet.
          </p>

          <p class="muted">
            Go to the <strong>Services</strong> tab, select one or more
            services, and click <strong>Save Services</strong>.
          </p>
        </section>
      `;
      return;
    }

    const initialTotals = calculateQuoteTotals(lines);

    const rowsHtml = lines.length
      ? lines
          .map((line) => {
            const quantity = Number(line.quantity || 1);
            const priceValue = getInputPriceValue(line.unit_price);

            return `
              <tr
                data-quote-service-id="${escapeHtml(line.quote_service_id || "")}"
                data-quantity="${escapeHtml(String(quantity))}"
              >
                <td>
                  <strong>${escapeHtml(line.service_name || "")}</strong>
                  ${
                    line.required
                      ? `
                        <div
                          class="muted"
                          style="font-size:0.85em; margin-top:3px;"
                        >
                          Required service
                        </div>
                      `
                      : ""
                  }
                </td>

                <td>
                  ${
                    line.service_description
                      ? escapeHtml(line.service_description)
                      : `<span class="muted">No description entered.</span>`
                  }
                </td>

                <td style="text-align:center;">
                  ${escapeHtml(String(quantity))}
                </td>

                <td style="text-align:right; min-width:180px;">
                  <div
                    style="
                      display:flex;
                      justify-content:flex-end;
                      align-items:center;
                      gap:5px;
                    "
                  >
                    <span class="muted">$</span>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputmode="decimal"
                      class="quote-price-input"
                      data-quote-service-id="${escapeHtml(line.quote_service_id || "")}"
                      value="${escapeHtml(priceValue)}"
                      placeholder="Enter price"
                      aria-label="Quoted price for ${escapeHtml(line.service_name || "service")}"
                      style="
                        width:115px;
                        text-align:right;
                        padding:7px 8px;
                        box-sizing:border-box;
                      "
                    />
                  </div>
                </td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="4" class="muted">
              No services are currently on this draft quote.
              Return to Services, choose services, and click Save Services.
            </td>
          </tr>
        `;

    container.innerHTML = `
      <section class="card">
        <div
          style="
            display:flex;
            align-items:flex-start;
            justify-content:space-between;
            gap:16px;
            flex-wrap:wrap;
            margin-bottom:18px;
          "
        >
          <div>
            <h2 style="margin:0 0 6px;">Pricing Chart</h2>

            <div class="muted">
              Draft quote:
              <strong>${escapeHtml(quote.quote_number || "Unnamed Quote")}</strong>
            </div>
          </div>

          <div
            style="
              display:flex;
              gap:10px;
              align-items:center;
              flex-wrap:wrap;
            "
          >
            <div
              style="
                padding:8px 12px;
                border-radius:4px;
                background:#f7f7f7;
                color:#555;
                font-size:0.9em;
              "
            >
              Status:
              <strong>${escapeHtml(quote.status || "draft")}</strong>
            </div>

            ${
              lines.length
                ? `
                  <button
                    id="btnSaveQuotePrices"
                    class="btn-primary"
                  >
                    Save Prices
                  </button>
                `
                : ""
            }
          </div>
        </div>

        <div
          style="
            padding:12px 14px;
            margin-bottom:18px;
            border-left:3px solid #7ea3c9;
            background:#f6f9fc;
            color:#4a5968;
          "
        >
          Enter the quoted price for each service. Prices are saved only to
          this draft quote and do not change the master Services lookup list.
        </div>

        <div style="overflow-x:auto;">
          <table class="notes-table" style="width:100%;">
            <thead>
              <tr>
                <th style="min-width:190px;">Service</th>
                <th style="min-width:260px;">Description</th>
                <th style="text-align:center; min-width:80px;">Qty</th>
                <th style="text-align:right; min-width:180px;">Quoted Price</th>
              </tr>
            </thead>

            <tbody>
              ${rowsHtml}
            </tbody>

            <tfoot>
              <tr>
                <th colspan="3" style="text-align:right;">
                  Current Quote Total
                </th>

                <th
                  id="quoteTotalDisplay"
                  style="text-align:right;"
                >
                  ${formatMoney(initialTotals.total) || "$0.00"}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>

        <p
          id="quotePriceStatus"
          class="muted"
          style="
            margin:14px 0 0;
            padding:10px 12px;
            ${
              initialTotals.unpricedCount
                ? `
                  background:#fff8e8;
                  border-left:3px solid #e0a52d;
                `
                : `
                  background:#eef7ee;
                  border-left:3px solid #4f9b57;
                `
            }
          "
        >
          ${
            initialTotals.unpricedCount
              ? `
                ${initialTotals.unpricedCount}
                service${initialTotals.unpricedCount === 1 ? "" : "s"}
                still need${initialTotals.unpricedCount === 1 ? "s" : ""}
                a quoted price.
              `
              : `
                All current quote services have a price.
              `
          }
        </p>
      </section>
    `;

    const totalDisplay = container.querySelector("#quoteTotalDisplay");
    const priceStatus = container.querySelector("#quotePriceStatus");
    const priceInputs = Array.from(
      container.querySelectorAll(".quote-price-input")
    );

    function refreshLiveTotal() {
      let total = 0;
      let unpricedCount = 0;

      priceInputs.forEach((input) => {
        const rawValue = input.value.trim();
        const row = input.closest("tr");
        const quantity = Number(row?.dataset?.quantity || 1);

        if (rawValue === "") {
          unpricedCount += 1;
          return;
        }

        const price = Number(rawValue);

        if (!Number.isFinite(price) || price < 0) {
          unpricedCount += 1;
          return;
        }

        total += price * quantity;
      });

      totalDisplay.textContent = `$${total.toFixed(2)}`;

      if (unpricedCount > 0) {
        priceStatus.style.background = "#fff8e8";
        priceStatus.style.borderLeft = "3px solid #e0a52d";
        priceStatus.textContent =
          `${unpricedCount} service${unpricedCount === 1 ? "" : "s"} ` +
          `still need${unpricedCount === 1 ? "s" : ""} a quoted price.`;
      } else {
        priceStatus.style.background = "#eef7ee";
        priceStatus.style.borderLeft = "3px solid #4f9b57";
        priceStatus.textContent =
          "All current quote services have a price.";
      }
    }

    priceInputs.forEach((input) => {
      input.addEventListener("input", refreshLiveTotal);

      input.addEventListener("blur", () => {
        const rawValue = input.value.trim();

        if (rawValue === "") {
          return;
        }

        const numericValue = Number(rawValue);

        if (Number.isFinite(numericValue) && numericValue >= 0) {
          input.value = numericValue.toFixed(2);
          refreshLiveTotal();
        }
      });
    });

    const savePricesBtn = container.querySelector("#btnSaveQuotePrices");

    if (savePricesBtn) {
      savePricesBtn.addEventListener("click", async () => {
        const originalButtonText = savePricesBtn.textContent;

        const priceLines = [];
        let hasInvalidPrice = false;

        priceInputs.forEach((input) => {
          const rawValue = input.value.trim();

          if (rawValue !== "") {
            const numericValue = Number(rawValue);

            if (!Number.isFinite(numericValue) || numericValue < 0) {
              hasInvalidPrice = true;
              input.style.borderColor = "#c0392b";
              return;
            }
          }

          input.style.borderColor = "";

          priceLines.push({
            quote_service_id: input.dataset.quoteServiceId,
            unit_price: rawValue === "" ? null : Number(rawValue)
          });
        });

        if (hasInvalidPrice) {
          alert(
            "Please correct invalid prices. Each entered amount must be zero or greater."
          );
          return;
        }

        savePricesBtn.disabled = true;
        savePricesBtn.textContent = "Saving…";

        try {
          const saveRes = await fetch(
            `${LEADS_MODULE_URL}/quotes/draft/prices`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                project,
                quote_id: quote.quote_id,
                lines: priceLines
              })
            }
          );

          const saveData = await saveRes.json();

          if (!saveRes.ok) {
            throw new Error(
              saveData?.error ||
              `Unable to save quote prices (${saveRes.status}).`
            );
          }

          priceInputs.forEach((input) => {
            const rawValue = input.value.trim();

            if (rawValue !== "") {
              input.value = Number(rawValue).toFixed(2);
            }
          });

          refreshLiveTotal();

          alert(
            `✅ Prices saved for ${quote.quote_number}. ` +
            `Current quote total: $${Number(
              saveData.offered_total || 0
            ).toFixed(2)}`
          );
        } catch (err) {
          console.error("[Pricing Chart] Error saving prices:", err);

          alert(`❌ Unable to save quote prices: ${err.message}`);
        } finally {
          savePricesBtn.disabled = false;
          savePricesBtn.textContent = originalButtonText;
        }
      });
    }
  } catch (err) {
    console.error("[Pricing Chart] Error loading draft quote:", err);

    container.innerHTML = `
      <section class="card">
        <h2>Pricing Chart</h2>

        <p class="error">
          Unable to load the draft quote.
        </p>

        <p class="muted">
          Check the browser console and Worker logs for the specific error.
        </p>
      </section>
    `;
  }
}
