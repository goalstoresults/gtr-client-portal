// js/leads/tab-pricing.js

import { escapeHtml } from "../utilities.js";

const LEADS_MODULE_URL =
  "https://leads-module.dennis-e64.workers.dev";

function numericPrice(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) && number >= 0
    ? number
    : null;
}

function formatMoney(value) {
  const number = numericPrice(value);

  return number === null
    ? "Not priced"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
      }).format(number);
}

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString();
}

function lineTotal(line) {
  const price = numericPrice(line.unit_price);
  const quantity = Number(line.quantity);

  if (
    price === null ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  return Math.round(price * 100) * quantity / 100;
}

function calculateTotals(lines) {
  let totalCents = 0;
  let unpricedCount = 0;

  for (const line of lines) {
    const total = lineTotal(line);

    if (total === null) {
      unpricedCount += 1;
    } else {
      totalCents += Math.round(total * 100);
    }
  }

  return {
    total: totalCents / 100,
    unpricedCount
  };
}

export async function renderLeadPricing(container, portalState) {
  const leadId = portalState.activeLeadId;
  const project = portalState.project;
  const isCsi = String(project || "").toLowerCase() === "csi";

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
      <p class="muted">Loading quote…</p>
    </section>
  `;

  try {
    const url =
      `${LEADS_MODULE_URL}/quotes/current` +
      `?project=${encodeURIComponent(project)}` +
      `&lead_id=${encodeURIComponent(leadId)}`;

    const response = await fetch(url, {
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || `Unable to load quote (${response.status}).`
      );
    }

    const quote = data.quote || null;
    const lines = Array.isArray(data.lines) ? data.lines : [];

    if (!quote) {
      container.innerHTML = `
        <section class="card">
          <h2>Pricing Chart</h2>
          <p class="muted">No quote exists for this lead yet.</p>
          <p class="muted">
            To create the initial draft, choose services in the
            Services tab and click Save Services.
          </p>
        </section>
      `;
      return;
    }

    const accepted =
      quote.status === "accepted" || Boolean(quote.accepted_at);

    const draft =
      quote.status === "draft" && !accepted;

    const canEdit =
      draft &&
      data.can_edit_prices === true &&
      portalState.canEdit === true;

    const offeredLines = lines.filter(
      line => line.offered === true
    );

    const initialTotals = calculateTotals(offeredLines);
    const acceptedDate = formatDate(quote.accepted_at);
    const sentDate = formatDate(quote.sent_at);

    const columnCount = isCsi ? 3 : 6;
    const totalLabelColspan = isCsi ? 1 : 4;

    const selectionLabel = (line) => {
      if (!line.offered) {
        return "Not offered";
      }

      if (accepted) {
        return line.customer_selected === true
          ? "Selected"
          : "Not selected";
      }

      if (line.customer_selected === true) {
        return "Selected";
      }

      if (line.customer_selected === false) {
        return "Not selected";
      }

      return draft
        ? "Not yet confirmed"
        : "Awaiting confirmation";
    };

    const rows = lines.length
      ? lines.map((line) => {
          const price = numericPrice(line.unit_price);
          const quantity = Number(line.quantity);

          // CSI normally uses quantity 1.
          // Preserve existing quantity calculations for all projects.
          const showQuantityNote =
            isCsi &&
            Number.isInteger(quantity) &&
            quantity > 1;

          const priceInput = `
            <input
              type="number"
              min="0"
              step="0.01"
              inputmode="decimal"
              class="quote-price-input"
              data-quote-service-id="${escapeHtml(
                line.quote_service_id || ""
              )}"
              data-quantity="${escapeHtml(String(line.quantity))}"
              value="${escapeHtml(
                price === null ? "" : price.toFixed(2)
              )}"
              placeholder="Enter price"
              aria-label="${isCsi ? "Service price" : "Unit price"} for ${escapeHtml(
                line.service_name || "service"
              )}"
              style="
                width:130px;
                text-align:right;
                padding:7px 8px;
                box-sizing:border-box;
              "
            >
          `;

          const serviceCell = `
            <td>
              <strong>${escapeHtml(line.service_name || "")}</strong>

              ${
                line.required
                  ? '<div class="muted">Required service</div>'
                  : ""
              }

              ${
                !line.offered
                  ? '<div class="muted">Not offered</div>'
                  : ""
              }

              ${
                showQuantityNote
                  ? `
                    <div class="muted" style="font-size:0.85em;">
                      Quantity: ${escapeHtml(String(quantity))}
                      ${
                        canEdit && line.offered
                          ? " · Enter the price per item"
                          : ""
                      }
                    </div>
                  `
                  : ""
              }
            </td>
          `;

          const selectionCell = `
            <td style="${
              accepted &&
              line.offered &&
              line.customer_selected === true
                ? "color:#26703b;font-weight:700;"
                : ""
            }">
              ${escapeHtml(selectionLabel(line))}
            </td>
          `;

          if (isCsi) {
            return `
              <tr>
                ${serviceCell}

                <td style="text-align:right;">
                  ${
                    canEdit && line.offered
                      ? `
                        ${priceInput}
                        ${
                          showQuantityNote
                            ? `
                              <div
                                class="quote-line-total"
                                data-quote-service-id="${escapeHtml(
                                  line.quote_service_id || ""
                                )}"
                                style="
                                  margin-top:4px;
                                  color:#647180;
                                  font-size:0.85em;
                                "
                              >
                                Total: ${escapeHtml(
                                  formatMoney(lineTotal(line))
                                )}
                              </div>
                            `
                            : ""
                        }
                      `
                      : escapeHtml(formatMoney(lineTotal(line)))
                  }
                </td>

                ${selectionCell}
              </tr>
            `;
          }

          return `
            <tr>
              ${serviceCell}

              <td>
                ${
                  line.service_description
                    ? escapeHtml(line.service_description)
                    : '<span class="muted">No description entered.</span>'
                }
              </td>

              <td style="text-align:center;">
                ${escapeHtml(String(line.quantity))}
              </td>

              <td style="text-align:right;">
                ${
                  canEdit && line.offered
                    ? priceInput
                    : escapeHtml(formatMoney(line.unit_price))
                }
              </td>

              <td
                class="quote-line-total"
                data-quote-service-id="${escapeHtml(
                  line.quote_service_id || ""
                )}"
                style="text-align:right;"
              >
                ${escapeHtml(formatMoney(lineTotal(line)))}
              </td>

              ${selectionCell}
            </tr>
          `;
        }).join("")
      : `
        <tr>
          <td colspan="${columnCount}" class="muted">
            No service lines exist on this quote.
          </td>
        </tr>
      `;

    let notice;

    if (accepted) {
      notice =
        "The customer has confirmed this quote. Saved selections " +
        "and totals are shown below. Prices are read-only; " +
        "staff correction access has not been added yet.";
    } else if (canEdit) {
      notice =
        (isCsi
          ? "Enter the service price for each offered service. "
          : "Enter the unit price for each offered service. ") +
        "Prices are saved only to this draft quote and do not " +
        "change the master Services lookup list.";
    } else if (draft) {
      notice =
        "This is a draft quote. Your current Portal permissions " +
        "do not allow price editing.";
    } else {
      notice =
        "This quote is read-only in its current status. " +
        "Customer selections will appear here after confirmation.";
    }

    container.innerHTML = `
      <section class="card">
        <div style="
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:16px;
          flex-wrap:wrap;
          margin-bottom:18px;
        ">
          <div>
            <h2 style="margin:0 0 6px;">Pricing Chart</h2>

            <div>
              Quote:
              <strong>${escapeHtml(
                quote.quote_number || "Unnamed Quote"
              )}</strong>
            </div>

            <div class="muted">
              Showing the newest quote for this lead.
            </div>

            ${
              sentDate
                ? `
                  <div class="muted">
                    Released: ${escapeHtml(sentDate)}
                  </div>
                `
                : ""
            }

            ${
              acceptedDate
                ? `
                  <div class="muted">
                    Accepted: ${escapeHtml(acceptedDate)}
                  </div>
                `
                : ""
            }
          </div>

          <div style="
            display:flex;
            gap:10px;
            align-items:center;
            flex-wrap:wrap;
          ">
            <span>
              Status:
              <strong>${escapeHtml(quote.status || "")}</strong>
            </span>

            <button id="btnRefreshQuote" class="secondary">
              Refresh
            </button>

            ${
              canEdit && offeredLines.length
                ? `
                  <button id="btnSaveQuotePrices" class="btn-primary">
                    Save Prices
                  </button>
                `
                : ""
            }
          </div>
        </div>

        <div style="
          padding:12px 14px;
          margin-bottom:18px;
          border-left:3px solid #7ea3c9;
          background:#f6f9fc;
        ">
          ${escapeHtml(notice)}
        </div>

        <div style="overflow-x:auto;">
          <table class="notes-table" style="width:100%;">
            <thead>
              <tr>
                <th style="min-width:220px;">Service</th>

                ${
                  isCsi
                    ? `
                      <th style="text-align:right;min-width:150px;">
                        Service Price
                      </th>
                    `
                    : `
                      <th style="min-width:220px;">Description</th>

                      <th style="text-align:center;">
                        Qty
                      </th>

                      <th style="text-align:right;min-width:140px;">
                        Unit Price
                      </th>

                      <th style="text-align:right;min-width:120px;">
                        Line Total
                      </th>
                    `
                }

                <th style="min-width:180px;">
                  Customer Selection
                </th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>

            <tfoot>
              <tr>
                <th
                  colspan="${totalLabelColspan}"
                  style="text-align:right;"
                >
                  ${canEdit ? "Current Offered Total" : "Offered Total"}
                </th>

                <th id="quoteTotalDisplay" style="text-align:right;">
                  ${escapeHtml(formatMoney(
                    canEdit
                      ? initialTotals.total
                      : quote.offered_total
                  ))}
                </th>

                <th></th>
              </tr>

              ${
                accepted
                  ? `
                    <tr>
                      <th
                        colspan="${totalLabelColspan}"
                        style="text-align:right;"
                      >
                        Confirmed Total
                      </th>

                      <th style="text-align:right;color:#26703b;">
                        ${escapeHtml(formatMoney(quote.accepted_total))}
                      </th>

                      <th></th>
                    </tr>
                  `
                  : ""
              }
            </tfoot>
          </table>
        </div>

        <p id="quotePriceStatus" class="muted" style="
          margin:14px 0 0;
          padding:10px 12px;
        "></p>
      </section>
    `;

    const totalDisplay =
      container.querySelector("#quoteTotalDisplay");

    const priceStatus =
      container.querySelector("#quotePriceStatus");

    const saveButton =
      container.querySelector("#btnSaveQuotePrices");

    const refreshButton =
      container.querySelector("#btnRefreshQuote");

    const inputs = Array.from(
      container.querySelectorAll(".quote-price-input")
    );

    const lineTotalElements = new Map(
      Array.from(
        container.querySelectorAll(".quote-line-total")
      ).map(element => [
        element.dataset.quoteServiceId,
        element
      ])
    );

    let saving = false;

    function showPriceStatus(unpricedCount) {
      priceStatus.style.background =
        unpricedCount ? "#fff8e8" : "#eef7ee";

      priceStatus.style.borderLeft =
        unpricedCount
          ? "3px solid #e0a52d"
          : "3px solid #4f9b57";

      if (accepted) {
        const selectedCount = offeredLines.filter(
          line => line.customer_selected === true
        ).length;

        priceStatus.textContent =
          `Customer confirmed ${selectedCount} of ` +
          `${offeredLines.length} offered services.`;
      } else if (unpricedCount) {
        priceStatus.textContent =
          `${unpricedCount} offered service` +
          `${unpricedCount === 1 ? "" : "s"} still ` +
          `${unpricedCount === 1 ? "needs" : "need"} a valid price.`;
      } else {
        priceStatus.textContent =
          offeredLines.length
            ? "All offered services have a price."
            : "No offered services are available.";
      }
    }

    function refreshLiveTotal() {
      let cents = 0;
      let unpricedCount = 0;

      for (const input of inputs) {
        const total = lineTotal({
          unit_price: input.value,
          quantity: input.dataset.quantity
        });

        const totalElement = lineTotalElements.get(
          input.dataset.quoteServiceId
        );

        if (totalElement) {
          totalElement.textContent =
            (isCsi ? "Total: " : "") + formatMoney(total);
        }

        if (total === null) {
          unpricedCount += 1;
        } else {
          cents += Math.round(total * 100);
        }
      }

      totalDisplay.textContent = formatMoney(cents / 100);
      showPriceStatus(unpricedCount);
    }

    showPriceStatus(initialTotals.unpricedCount);

    for (const input of inputs) {
      input.addEventListener("input", refreshLiveTotal);

      input.addEventListener("blur", () => {
        const price = numericPrice(input.value);

        if (price !== null) {
          input.value = price.toFixed(2);
          refreshLiveTotal();
        }
      });
    }

    refreshButton.addEventListener("click", async () => {
      if (saving) return;

      await renderLeadPricing(container, portalState);
    });

    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        if (saving) return;

        const priceLines = [];
        let invalid = false;

        for (const input of inputs) {
          const raw = input.value.trim();
          const price = numericPrice(raw);

          if (raw !== "" && price === null) {
            invalid = true;
            input.style.borderColor = "#c0392b";
          } else {
            input.style.borderColor = "";

            priceLines.push({
              quote_service_id: input.dataset.quoteServiceId,
              unit_price: price
            });
          }
        }

        if (invalid) {
          alert("Every entered price must be zero or greater.");
          return;
        }

        saving = true;
        saveButton.disabled = true;
        saveButton.textContent = "Saving…";
        refreshButton.disabled = true;

        inputs.forEach(input => {
          input.disabled = true;
        });

        let succeeded = false;

        try {
          const saveResponse = await fetch(
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

          const saved = await saveResponse.json();

          if (!saveResponse.ok || saved.success === false) {
            throw new Error(
              saved.error || "Unable to save quote prices."
            );
          }

          succeeded = true;

          alert(
            `Prices saved for ${quote.quote_number}. ` +
            `Offered total: ${formatMoney(saved.offered_total)}`
          );
        } catch (error) {
          console.error("[Pricing Chart] Price save failed:", error);
          alert(`Unable to save prices: ${error.message}`);
        } finally {
          saving = false;
          saveButton.disabled = false;
          saveButton.textContent = "Save Prices";
          refreshButton.disabled = false;

          inputs.forEach(input => {
            input.disabled = false;
          });
        }

        if (succeeded) {
          await renderLeadPricing(container, portalState);
        }
      });
    }
  } catch (error) {
    console.error("[Pricing Chart] Quote load failed:", error);

    container.innerHTML = `
      <section class="card">
        <h2>Pricing Chart</h2>

        <p class="error">
          Unable to load the quote.
        </p>

        <p class="muted">
          ${escapeHtml(
            error.message || "Please try again."
          )}
        </p>
      </section>
    `;
  }
}
