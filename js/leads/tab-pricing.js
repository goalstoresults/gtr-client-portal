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

async function readJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok || data?.success === false) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : `Request failed (${response.status}).`
    );
  }

  return data;
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
    const currentUrl =
      `${LEADS_MODULE_URL}/quotes/current` +
      `?project=${encodeURIComponent(project)}` +
      `&lead_id=${encodeURIComponent(leadId)}`;

    const data = await readJson(currentUrl, {
      cache: "no-store"
    });

    const quote = data.quote || null;
    const lines = Array.isArray(data.lines) ? data.lines : [];

    if (!quote) {
      container.innerHTML = `
        <section class="card">
          <h2>Pricing Chart</h2>
          <p class="muted">No quote exists for this lead yet.</p>
          <p class="muted">
            Choose services in the Services tab and click
            Save Services to create the initial draft.
          </p>
        </section>
      `;
      return;
    }

    const accepted =
      quote.status === "accepted" || Boolean(quote.accepted_at);

    const draft = quote.status === "draft" && !accepted;

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

    function selectionLabel(line) {
      if (!line.offered) return "Not offered";

      if (accepted) {
        return line.customer_selected === true
          ? "Selected"
          : "Not selected";
      }

      if (line.customer_selected === true) return "Selected";
      if (line.customer_selected === false) return "Not selected";

      return draft
        ? "Not yet confirmed"
        : "Awaiting confirmation";
    }

    const rows = lines.length
      ? lines.map(line => {
          const price = numericPrice(line.unit_price);
          const quantity = Number(line.quantity);

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
        "Save Prices first. The Quote button appears after a " +
        "successful save when every offered service has a valid price.";
    } else if (draft) {
      notice =
        "This is a draft quote. Your current Portal permissions " +
        "do not allow price editing.";
    } else {
      notice =
        "This quote is read-only in its current status. " +
        "Customer selections appear here after confirmation.";
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

            <button
              type="button"
              id="btnRefreshQuote"
              class="secondary"
            >
              Refresh
            </button>

            ${
              canEdit && offeredLines.length
                ? `
                  <button
                    type="button"
                    id="btnSaveQuotePrices"
                    class="btn-primary"
                  >
                    Save Prices
                  </button>
                `
                : ""
            }

            <button
              type="button"
              id="btnPreviewQuote"
              class="btn-primary"
              hidden
              style="display:none;"
            >
              Quote
            </button>
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
                      <th style="text-align:center;">Qty</th>
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

            <tbody>${rows}</tbody>

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
                    canEdit ? initialTotals.total : quote.offered_total
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

        <p
          id="quotePriceStatus"
          class="muted"
          role="status"
          aria-live="polite"
          style="margin:14px 0 0;padding:10px 12px;"
        ></p>

        <div id="internalQuotePreview" hidden></div>
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

    const quoteButton =
      container.querySelector("#btnPreviewQuote");

    const previewDiv =
      container.querySelector("#internalQuotePreview");

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
    let previewLoading = false;
    let previewReady = false;

    function isCurrentView() {
      return (
        container.contains(quoteButton) &&
        portalState.activeLeadId === leadId &&
        portalState.project === project
      );
    }

    function hideQuote() {
      previewReady = false;
      quoteButton.hidden = true;
      quoteButton.style.display = "none";
      previewDiv.hidden = true;
      previewDiv.innerHTML = "";
    }

    function showQuote() {
      previewReady = true;
      quoteButton.hidden = false;
      quoteButton.style.display = "";
    }

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
        priceStatus.textContent = offeredLines.length
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
      input.addEventListener("input", () => {
        hideQuote();
        refreshLiveTotal();
      });

      input.addEventListener("blur", () => {
        const price = numericPrice(input.value);

        if (price !== null) {
          const formatted = price.toFixed(2);
          const changed = Number(formatted) !== price;

          input.value = formatted;

          if (changed) hideQuote();

          refreshLiveTotal();
        }
      });
    }

    refreshButton.addEventListener("click", async () => {
      if (saving || previewLoading) return;

      await renderLeadPricing(container, portalState);
    });

    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        if (saving || previewLoading) return;

        const priceLines = [];
        let invalid = false;

        for (const input of inputs) {
          const raw = input.value.trim();
          const price = numericPrice(raw);

          if (
            input.validity.badInput ||
            (raw !== "" && price === null)
          ) {
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
          hideQuote();
          alert("Every entered price must be zero or greater.");
          return;
        }

        hideQuote();

        saving = true;
        saveButton.disabled = true;
        saveButton.textContent = "Saving…";
        refreshButton.disabled = true;

        inputs.forEach(input => {
          input.disabled = true;
        });

        try {
          const saved = await readJson(
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

          if (!isCurrentView()) return;

          if (
            !saved.quote ||
            saved.quote.quote_id !== quote.quote_id ||
            saved.quote.status !== "draft" ||
            saved.quote.accepted_at
          ) {
            throw new Error(
              "The quote is no longer an editable draft. Refresh to reload it."
            );
          }

          // Match the two-decimal values saved by the backend.
          inputs.forEach(input => {
            const price = numericPrice(input.value);

            if (price !== null) {
              input.value = price.toFixed(2);
            }
          });

          refreshLiveTotal();

          const locallyComplete = inputs.length > 0 &&
            inputs.every(input =>
              lineTotal({
                unit_price: input.value,
                quantity: input.dataset.quantity
              }) !== null
            );

          if (
            saved.unpriced_count === 0 &&
            locallyComplete &&
            numericPrice(saved.offered_total) !== null
          ) {
            showQuote();

            priceStatus.textContent =
              `Prices saved. Offered total: ` +
              `${formatMoney(saved.offered_total)}. ` +
              `Click Quote to open the internal preview.`;
          } else {
            priceStatus.textContent =
              "Prices saved. Complete all offered service prices " +
              "and save again to enable Quote.";
          }
        } catch (error) {
          console.error("[Pricing Chart] Price save failed:", error);

          if (isCurrentView()) {
            hideQuote();
            alert(`Unable to save prices: ${error.message}`);
          }
        } finally {
          saving = false;

          if (isCurrentView()) {
            saveButton.disabled = false;
            saveButton.textContent = "Save Prices";
            refreshButton.disabled = false;

            inputs.forEach(input => {
              input.disabled = false;
            });
          }
        }
      });
    }

    quoteButton.addEventListener("click", async () => {
      if (!previewReady || saving || previewLoading) return;

      previewLoading = true;
      quoteButton.disabled = true;
      quoteButton.textContent = "Loading Quote…";
      refreshButton.disabled = true;

      if (saveButton) saveButton.disabled = true;

      inputs.forEach(input => {
        input.disabled = true;
      });

      try {
        // Read this exact quote, not whichever quote is now newest.
        const quoteUrl =
          currentUrl +
          `&quote_id=${encodeURIComponent(quote.quote_id)}`;

        const leadUrl =
          `${LEADS_MODULE_URL}/leads/get` +
          `?id=${encodeURIComponent(leadId)}`;

        const [savedData, lead] = await Promise.all([
          readJson(quoteUrl, { cache: "no-store" }),
          readJson(leadUrl, { cache: "no-store" })
        ]);

        if (!isCurrentView()) return;

        const savedQuote = savedData.quote;

        if (
          !savedQuote ||
          savedQuote.quote_id !== quote.quote_id
        ) {
          throw new Error("The saved quote could not be found.");
        }

        if (
          savedQuote.status !== "draft" ||
          savedQuote.accepted_at
        ) {
          hideQuote();
          throw new Error(
            "The quote status has changed. Refresh Pricing Chart."
          );
        }

        if (lead.project && lead.project !== project) {
          throw new Error("The lead belongs to a different project.");
        }

        const savedLines = Array.isArray(savedData.lines)
          ? savedData.lines.filter(line => line.offered === true)
          : [];

        const totals = calculateTotals(savedLines);

        if (!savedLines.length || totals.unpricedCount > 0) {
          hideQuote();
          throw new Error(
            "The saved quote has missing prices or invalid quantities. " +
            "Refresh, complete pricing, and save again."
          );
        }

        const addressLines = [
          lead.inspection_address1,
          lead.inspection_address2,
          [
            lead.inspection_city,
            lead.inspection_state,
            lead.inspection_postal_code
          ].filter(Boolean).join(" ")
        ].filter(Boolean);

        const previewRows = savedLines.map(line => `
          <tr>
            <td style="padding:12px;border-bottom:1px solid #e1e6ec;">
              <strong>${escapeHtml(line.service_name || "")}</strong>

              ${
                line.service_description
                  ? `
                    <div class="muted" style="margin-top:4px;">
                      ${escapeHtml(line.service_description)}
                    </div>
                  `
                  : ""
              }

              ${
                line.required
                  ? '<div class="muted">Required service</div>'
                  : ""
              }
            </td>

            <td style="
              padding:12px;
              text-align:center;
              border-bottom:1px solid #e1e6ec;
            ">
              ${escapeHtml(String(line.quantity))}
            </td>

            <td style="
              padding:12px;
              text-align:right;
              border-bottom:1px solid #e1e6ec;
            ">
              ${escapeHtml(formatMoney(line.unit_price))}
            </td>

            <td style="
              padding:12px;
              text-align:right;
              border-bottom:1px solid #e1e6ec;
            ">
              ${escapeHtml(formatMoney(lineTotal(line)))}
            </td>
          </tr>
        `).join("");

        previewDiv.innerHTML = `
          <section style="
            margin-top:24px;
            padding:22px;
            border:1px solid #cbd5e1;
            border-radius:6px;
            background:#fff;
          ">
            <div style="
              display:flex;
              justify-content:space-between;
              align-items:flex-start;
              gap:16px;
              flex-wrap:wrap;
            ">
              <div>
                <h2 style="margin:0 0 6px;">
                  ${isCsi ? "Clear Sight Inspections" : escapeHtml(project)}
                </h2>

                <h3 style="margin:0 0 8px;">
                  Quote ${escapeHtml(savedQuote.quote_number || "")}
                </h3>

                <div class="muted">
                  Status: ${escapeHtml(savedQuote.status || "")}
                </div>
              </div>

              <button
                type="button"
                id="btnCloseQuotePreview"
                class="secondary"
              >
                Close Preview
              </button>
            </div>

            <div style="
              margin:18px 0;
              padding:12px 14px;
              background:#fff8e8;
              border-left:3px solid #e0a52d;
            ">
              Internal Preview — Not Sent.
              No customer link has been released by this action.
            </div>

            <div style="margin-bottom:18px;">
              <div>
                <strong>Lead:</strong>
                ${escapeHtml(lead.lead_name || "Not recorded")}
              </div>

              <div style="margin-top:8px;">
                <strong>Inspection Property:</strong><br>
                ${
                  addressLines.length
                    ? addressLines
                        .map(value => escapeHtml(String(value)))
                        .join("<br>")
                    : '<span class="muted">Not recorded</span>'
                }
              </div>

              <p class="muted" style="font-size:0.85em;margin-bottom:0;">
                Lead and property information comes from the current
                lead record. Services and prices below come from
                the saved quote.
              </p>
            </div>

            <div style="overflow-x:auto;">
              <table class="notes-table" style="width:100%;">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th style="text-align:center;">Qty</th>
                    <th style="text-align:right;">Unit Price</th>
                    <th style="text-align:right;">Service Total</th>
                  </tr>
                </thead>

                <tbody>${previewRows}</tbody>

                <tfoot>
                  <tr>
                    <th colspan="3" style="text-align:right;">
                      Offered Total
                    </th>

                    <th style="text-align:right;">
                      ${escapeHtml(formatMoney(totals.total))}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>

            ${
              savedQuote.customer_message
                ? `
                  <div style="
                    margin-top:18px;
                    white-space:pre-wrap;
                    overflow-wrap:anywhere;
                  ">${escapeHtml(savedQuote.customer_message)}</div>
                `
                : ""
            }

            <p class="muted" style="margin-bottom:0;">
              This is an internal review only.
              Customer selection and acceptance are not enabled here.
            </p>
          </section>
        `;

        previewDiv.hidden = false;

        previewDiv.querySelector("#btnCloseQuotePreview")
          .addEventListener("click", () => {
            previewDiv.hidden = true;
            previewDiv.innerHTML = "";
            quoteButton.focus();
          });

        previewDiv.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      } catch (error) {
        console.error("[Quote Preview] Load failed:", error);

        if (isCurrentView()) {
          alert(`Unable to open quote: ${error.message}`);
        }
      } finally {
        previewLoading = false;

        if (isCurrentView()) {
          quoteButton.disabled = false;
          quoteButton.textContent = "Quote";
          refreshButton.disabled = false;

          if (saveButton) saveButton.disabled = false;

          inputs.forEach(input => {
            input.disabled = false;
          });
        }
      }
    });
  } catch (error) {
    console.error("[Pricing Chart] Quote load failed:", error);

    container.innerHTML = `
      <section class="card">
        <h2>Pricing Chart</h2>

        <p class="error">Unable to load the quote.</p>

        <p class="muted">
          ${escapeHtml(error.message || "Please try again.")}
        </p>
      </section>
    `;
  }
}
