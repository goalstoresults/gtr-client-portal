// js/leads/tab-pricing.js
// Saved-price readiness and unchanged-save protection.

import { escapeHtml } from "../utilities.js";

const LEADS_MODULE_URL =
  "https://leads-module.dennis-e64.workers.dev";

// Public quotes-worker base URL, not a secret.
// Copy the value of QUOTES_MODULE_URL already saved on leads-module.
const QUOTES_MODULE_URL = "https://quotes-module.dennis-e64.workers.dev/";


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

    let quote = data.quote || null;
    let lines = Array.isArray(data.lines) ? data.lines : [];

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
      void renderQuoteHistory(container, portalState, leadId, project, null);
      return;
    }

    const accepted =
      quote.status === "accepted" || Boolean(quote.accepted_at);

    const draft = quote.status === "draft" && !accepted;

    const canEdit =
      draft &&
      data.can_edit_prices === true &&
      portalState.canEdit === true;

    let offeredLines = lines.filter(
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
        "Quote remains available after pricing has been saved. " +
        "Save changed prices before opening the quote. " +
        "Unchanged prices do not need to be saved again.";
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

        <dialog
          id="internalQuotePreview"
          aria-label="Saved quote preview"
          style="
            width:min(1000px,90vw);
            max-height:85vh;
            overflow:auto;
            border:1px solid #cbd5e1;
            border-radius:6px;
            padding:0;
            background:#fff;
          "
        ></dialog>
      </section>
    `;

    void renderQuoteHistory(container, portalState, leadId, project, quote.quote_id);

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

    let savedPriceBaseline = new Map(
      offeredLines.map(line => [
        line.quote_service_id,
        numericPrice(line.unit_price)
      ])
    );

    let historyWarning = "";

    function isCurrentView() {
      return (
        container.contains(quoteButton) &&
        portalState.activeLeadId === leadId &&
        portalState.project === project
      );
    }

    function hasUnsavedChanges() {
      return inputs.some(input => {
        const raw = input.value.trim();
        const price = numericPrice(raw);

        return (
          input.validity.badInput ||
          (raw !== "" && price === null) ||
          price !== savedPriceBaseline.get(
            input.dataset.quoteServiceId
          )
        );
      });
    }

    function currentOfferedLines() {
      const inputValues = new Map(
        inputs.map(input => [
          input.dataset.quoteServiceId,
          input.value
        ])
      );

      return offeredLines.map(line => (
        inputValues.has(line.quote_service_id)
          ? {
              ...line,
              unit_price: inputValues.get(line.quote_service_id)
            }
          : line
      ));
    }

    function closePreview() {
      if (previewDiv.open) previewDiv.close();
      previewDiv.innerHTML = "";
    }

    function hideQuote() {
      previewReady = false;
      quoteButton.hidden = true;
      quoteButton.style.display = "none";
      closePreview();
    }

    function showQuote() {
      previewReady = true;
      quoteButton.hidden = false;
      quoteButton.style.display = "";
    }

    function refreshQuoteAvailability() {
      const totals = calculateTotals(currentOfferedLines());
      const dirty = hasUnsavedChanges();

      const savedReady =
        quote.status !== "draft" ||
        Boolean(quote.prices_saved_at);

      const ready =
        !dirty &&
        offeredLines.length > 0 &&
        totals.unpricedCount === 0 &&
        savedReady &&
        (
          !isCsi ||
          (
            portalState.canEdit === true &&
            portalState.isDemoAccount !== true &&
            ["draft", "sent", "viewed", "accepted"].includes(quote.status)
          )
        );

      if (ready) {
        showQuote();
      } else {
        hideQuote();
      }

      quoteButton.disabled = saving || previewLoading;

      if (saveButton) {
        const unchangedAndSaved =
          !dirty && Boolean(quote.prices_saved_at);

        saveButton.disabled =
          saving || previewLoading || unchangedAndSaved;

        saveButton.title = unchangedAndSaved
          ? "Prices are already saved. Change a price to save again."
          : "Save this quote's service prices";
      }
    }

    function showPriceStatus(unpricedCount) {
      const dirty = hasUnsavedChanges();
      const attention = unpricedCount > 0 || dirty || historyWarning;

      priceStatus.style.background =
        attention ? "#fff8e8" : "#eef7ee";

      priceStatus.style.borderLeft =
        attention
          ? "3px solid #e0a52d"
          : "3px solid #4f9b57";

      if (historyWarning) {
        priceStatus.textContent = historyWarning;
      } else if (dirty) {
        priceStatus.textContent =
          "Unsaved price changes. Click Save Prices before opening Quote.";
      } else if (accepted) {
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
          `${unpricedCount === 1 ? "needs" : "need"} a valid price or quantity.`;
      } else if (!offeredLines.length) {
        priceStatus.textContent =
          "No offered services are available.";
      } else if (quote.status !== "draft" || quote.prices_saved_at) {
        priceStatus.textContent =
          "Saved quote is ready. Click Quote to open it. " +
          "Unchanged prices do not need to be saved again.";
      } else {
        priceStatus.textContent =
          "All offered services have a price. " +
          "Click Save Prices once to record pricing and enable Quote.";
      }
    }

    function refreshLiveTotal() {
      const totals = calculateTotals(currentOfferedLines());

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
      }

      totalDisplay.textContent = formatMoney(
        canEdit ? totals.total : quote.offered_total
      );

      refreshQuoteAvailability();
      showPriceStatus(totals.unpricedCount);
    }

    // Initialize from database state, not a save in this screen visit.
    refreshLiveTotal();

    previewDiv.addEventListener("close", () => {
      if (isCurrentView()) quoteButton.focus();
    });

    for (const input of inputs) {
      input.addEventListener("input", () => {
        closePreview();
        refreshLiveTotal();
      });

      input.addEventListener("blur", () => {
        const price = numericPrice(input.value);

        if (price !== null) {
          input.value = price.toFixed(2);
          refreshLiveTotal();
        }
      });
    }

    refreshButton.addEventListener("click", async () => {
      if (saving || previewLoading) return;

      if (
        hasUnsavedChanges() &&
        !window.confirm("Discard unsaved price changes and refresh?")
      ) {
        return;
      }

      closePreview();
      await renderLeadPricing(container, portalState);
    });

    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        if (saving || previewLoading) return;

        // Do not write another save event for unchanged saved prices.
        if (!hasUnsavedChanges() && quote.prices_saved_at) {
          refreshLiveTotal();
          return;
        }

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

        closePreview();
        saving = true;
        saveButton.disabled = true;
        saveButton.textContent = "Saving…";
        refreshButton.disabled = true;
        quoteButton.disabled = true;

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

          quote = saved.quote;
          historyWarning = saved.warning || "";

          // Match the two-decimal values saved by the backend.
          inputs.forEach(input => {
            const price = numericPrice(input.value);

            if (price !== null) {
              input.value = price.toFixed(2);
            }
          });

          savedPriceBaseline = new Map(
            inputs.map(input => [
              input.dataset.quoteServiceId,
              numericPrice(input.value)
            ])
          );

          lines = lines.map(line => (
            savedPriceBaseline.has(line.quote_service_id)
              ? {
                  ...line,
                  unit_price: savedPriceBaseline.get(
                    line.quote_service_id
                  )
                }
              : line
          ));

          offeredLines = lines.filter(
            line => line.offered === true
          );

          refreshLiveTotal();
        } catch (error) {
          console.error("[Pricing Chart] Price save failed:", error);

          if (isCurrentView()) {
            // A partial backend save may have invalidated readiness.
            quote = { ...quote, prices_saved_at: null };
            hideQuote();
            historyWarning =
              "Save did not complete. Refresh to verify saved data before retrying.";
            alert(`Unable to save prices: ${error.message}`);
          }
        } finally {
          saving = false;

          if (isCurrentView()) {
            saveButton.textContent = "Save Prices";
            refreshButton.disabled = false;

            inputs.forEach(input => {
              input.disabled = false;
            });

            refreshLiveTotal();
          }
        }
      });
    }

    quoteButton.addEventListener("click", async () => {
      if (
        !previewReady ||
        hasUnsavedChanges() ||
        saving ||
        previewLoading
      ) {
        return;
      }

      let quoteWindow = null;
      let quoteOpened = false;

      if (isCsi) {
        if (!QUOTES_MODULE_URL.trim()) {
          alert("Set QUOTES_MODULE_URL at the top of tab-pricing.js first.");
          return;
        }

        if (!String(portalState.userEmail || "").trim()) {
          alert("Your Portal email is missing. Reopen the Portal and log in again.");
          return;
        }

        try {
          quoteWindow = window.open("about:blank", "_blank");
          if (quoteWindow) quoteWindow.opener = null;
        } catch {
          if (quoteWindow && !quoteWindow.closed) quoteWindow.close();
          quoteWindow = null;
        }
      }

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
          savedQuote.status !== quote.status ||
          Boolean(savedQuote.accepted_at) !== Boolean(quote.accepted_at)
        ) {
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

        if (
          !savedLines.length ||
          totals.unpricedCount > 0 ||
          (savedQuote.status === "draft" && !savedQuote.prices_saved_at)
        ) {
          quote = { ...quote, prices_saved_at: null };
          hideQuote();
          throw new Error(
            "The saved quote needs pricing review. " +
            "Refresh, complete pricing, and save again."
          );
        }

        if (isCsi) {
          const workerUrl = new URL(QUOTES_MODULE_URL.trim());

          if (
            workerUrl.protocol !== "https:" ||
            workerUrl.username || workerUrl.password ||
            workerUrl.search || workerUrl.hash ||
            workerUrl.pathname !== "/"
          ) {
            throw new Error("QUOTES_MODULE_URL must be the HTTPS worker base URL.");
          }

          const prepared = await readJson(
            new URL("/quotes/public/prepare", workerUrl).toString(),
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              cache: "no-store",
              body: JSON.stringify({
                project: "csi",
                lead_id: leadId,
                quote_id: savedQuote.quote_id,
                userEmail: portalState.userEmail.trim()
              })
            }
          );

          if (!isCurrentView()) return;

          if (
            prepared.success !== true ||
            prepared.project !== "csi" ||
            prepared.quote_id !== savedQuote.quote_id ||
            typeof prepared.customer_url !== "string"
          ) {
            throw new Error("The customer quote link could not be verified.");
          }

          const customerUrl = new URL(prepared.customer_url);

          if (
            customerUrl.origin !== "https://portal.redumbrella.pro" ||
            customerUrl.pathname !== "/csi/quote.html" ||
            customerUrl.username || customerUrl.password || customerUrl.hash ||
            !/^[a-f0-9]{64}$/.test(customerUrl.searchParams.get("token") || "")
          ) {
            throw new Error("The customer quote link is invalid.");
          }

          if (quoteWindow && !quoteWindow.closed) {
            quoteWindow.location.replace(customerUrl.toString());
            quoteOpened = true;
          } else {
            previewDiv.innerHTML = `
              <section style="padding:22px;background:#fff;">
                <h2>Customer Quote</h2>
                <p>Your browser blocked the new tab. Use the link below.</p>
                <p>
                  <a
                    id="customerQuoteLink"
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerpolicy="no-referrer"
                  >Open Customer Quote</a>
                </p>
                <p class="muted">The quote action may release the quote and update GHL. Email delivery is handled by the GHL workflow.</p>
                <button type="button" id="btnCloseQuotePreview" class="secondary">
                  Close
                </button>
              </section>
            `;

            previewDiv.querySelector("#customerQuoteLink").href =
              customerUrl.toString();

            previewDiv.querySelector("#btnCloseQuotePreview")
              .addEventListener("click", closePreview);

            if (!previewDiv.open) previewDiv.showModal();
          }

          return;
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

              ${
                isCsi && Number(line.quantity) > 1
                  ? `
                    <div class="muted">
                      Quantity: ${escapeHtml(String(line.quantity))}
                    </div>
                  `
                  : ""
              }
            </td>

            ${
              !isCsi
                ? `
                  <td style="padding:12px;text-align:center;">
                    ${escapeHtml(String(line.quantity))}
                  </td>

                  <td style="padding:12px;text-align:right;">
                    ${escapeHtml(formatMoney(line.unit_price))}
                  </td>
                `
                : ""
            }

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
          <section style="padding:22px;background:#fff;">
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

                ${
                  savedQuote.prices_saved_at
                    ? `
                      <div class="muted">
                        Prices saved:
                        ${escapeHtml(formatDate(savedQuote.prices_saved_at))}
                      </div>
                    `
                    : ""
                }
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
              Internal Saved Quote View.
              Opening this screen does not release a link or send the quote.
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

                    ${
                      !isCsi
                        ? `
                          <th style="text-align:center;">Qty</th>
                          <th style="text-align:right;">Unit Price</th>
                        `
                        : ""
                    }

                    <th style="text-align:right;">
                      ${isCsi ? "Service Price" : "Service Total"}
                    </th>
                  </tr>
                </thead>

                <tbody>${previewRows}</tbody>

                <tfoot>
                  <tr>
                    <th
                      colspan="${isCsi ? 1 : 3}"
                      style="text-align:right;"
                    >
                      Offered Total
                    </th>

                    <th style="text-align:right;">
                      ${escapeHtml(formatMoney(totals.total))}
                    </th>
                  </tr>

                  ${
                    savedQuote.accepted_at || savedQuote.status === "accepted"
                      ? `
                        <tr>
                          <th
                            colspan="${isCsi ? 1 : 3}"
                            style="text-align:right;"
                          >
                            Confirmed Total
                          </th>
                          <th style="text-align:right;color:#26703b;">
                            ${escapeHtml(formatMoney(savedQuote.accepted_total))}
                          </th>
                        </tr>
                      `
                      : ""
                  }
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
              Customer selection and acceptance are not enabled here.
              Customer-link generation is not connected in this version.
            </p>
          </section>
        `;

        previewDiv.querySelector("#btnCloseQuotePreview")
          .addEventListener("click", () => {
            closePreview();
          });

        if (!previewDiv.open) previewDiv.showModal();
      } catch (error) {
        console.error("[Quote Preview] Load failed:", error);

        if (isCurrentView()) {
          alert(`Unable to open quote: ${error.message}`);
        }
      } finally {
        if (quoteWindow && !quoteWindow.closed && !quoteOpened) {
          quoteWindow.close();
        }

        previewLoading = false;

        if (isCurrentView()) {
          quoteButton.textContent = "Quote";
          refreshButton.disabled = false;

          inputs.forEach(input => {
            input.disabled = false;
          });

          refreshQuoteAvailability();
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

/* Quote history is read-only: never call /quotes/public/prepare here. */
async function renderQuoteHistory(container, portalState, leadId, project, currentQuoteId) {
  const section = document.createElement("section");
  section.className = "card";
  section.style.marginTop = "20px";
  section.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
      <h2 style="margin:0;">Quote History</h2>
      <button type="button" class="secondary" data-history-refresh>Refresh History</button>
    </div>
    <p class="muted">Saved quote versions, newest first. Viewing a quote does not release it or send an email.</p>
    <div data-history-content role="status">Loading quote history…</div>
    <dialog data-history-dialog aria-label="Saved quote version"
      style="width:min(1000px,90vw);max-height:85vh;overflow:auto;border:1px solid #cbd5e1;border-radius:6px;padding:0;background:#fff;"></dialog>
  `;
  container.appendChild(section);
  const content = section.querySelector("[data-history-content]");
  const refresh = section.querySelector("[data-history-refresh]");
  const dialog = section.querySelector("[data-history-dialog]");
  let loading = false;
  let viewLoading = false;
  const current = () => container.contains(section) &&
    portalState.activeLeadId === leadId && portalState.project === project;

  function showVersion(savedQuote, savedLines) {
    const offered = savedLines.filter(line => line.offered === true);
    const totals = calculateTotals(offered);
    const confirmed = savedQuote.status === "accepted" || Boolean(savedQuote.accepted_at);
    dialog.innerHTML = `
      <section style="padding:22px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
          <div>
            <h2 style="margin:0 0 8px;">Quote ${escapeHtml(savedQuote.quote_number || "Unnamed Quote")}</h2>
            <div>Status: ${escapeHtml(savedQuote.status || "")}</div>
            ${savedQuote.created_at ? `<div class="muted">Created: ${escapeHtml(formatDate(savedQuote.created_at))}</div>` : ""}
            ${savedQuote.sent_at ? `<div class="muted">Released: ${escapeHtml(formatDate(savedQuote.sent_at))}</div>` : ""}
            ${savedQuote.accepted_at ? `<div class="muted">Accepted: ${escapeHtml(formatDate(savedQuote.accepted_at))}</div>` : ""}
          </div>
          <button type="button" class="secondary" data-history-close>Close</button>
        </div>
        <p style="padding:12px;background:#f6f9fc;border-left:3px solid #7ea3c9;">
          Read-only saved quote view. Services and prices belong to this exact quote record.
          Opening it does not generate a link, change its status, update GHL, or send an email.
          ${savedQuote.status === "draft" ? "This draft can still change until released." : ""}
        </p>
        <div style="overflow-x:auto;">
          <table class="notes-table" style="width:100%;">
            <thead><tr>
              <th>Service</th><th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Service Total</th><th>Customer Selection</th>
            </tr></thead>
            <tbody>${savedLines.length ? savedLines.map(line => `
              <tr>
                <td><strong>${escapeHtml(line.service_name || "")}</strong>
                  ${line.service_description ? `<div class="muted">${escapeHtml(line.service_description)}</div>` : ""}
                  ${line.required ? '<div class="muted">Required service</div>' : ""}
                  ${!line.offered ? '<div class="muted">Not offered</div>' : ""}
                </td>
                <td style="text-align:center;">${escapeHtml(String(line.quantity ?? ""))}</td>
                <td style="text-align:right;">${escapeHtml(formatMoney(line.unit_price))}</td>
                <td style="text-align:right;">${escapeHtml(formatMoney(lineTotal(line)))}</td>
                <td>${escapeHtml(!line.offered ? "Not offered" :
                  line.customer_selected === true ? "Selected" :
                  line.customer_selected === false ? "Not selected" :
                  confirmed ? "Not selected" : "Not yet confirmed")}</td>
              </tr>`).join("") : '<tr><td colspan="5" class="muted">No saved service lines.</td></tr>'}
            </tbody>
            <tfoot>
              <tr><th colspan="3" style="text-align:right;">Saved Offered Total</th>
                <th style="text-align:right;">${escapeHtml(formatMoney(savedQuote.offered_total))}</th><th></th></tr>
              ${confirmed ? `<tr><th colspan="3" style="text-align:right;">Confirmed Total</th>
                <th style="text-align:right;color:#26703b;">${escapeHtml(formatMoney(savedQuote.accepted_total))}</th><th></th></tr>` : ""}
            </tfoot>
          </table>
        </div>
        ${totals.unpricedCount ? `<p class="muted">${totals.unpricedCount} offered service(s) do not have a valid saved price or quantity.</p>` : ""}
        ${savedQuote.customer_message ? `<div style="margin-top:16px;white-space:pre-wrap;overflow-wrap:anywhere;">${escapeHtml(savedQuote.customer_message)}</div>` : ""}
      </section>`;
    dialog.querySelector("[data-history-close]").addEventListener("click", () => dialog.close());
    if (!dialog.open) dialog.showModal();
  }

  async function loadHistory() {
    if (loading || viewLoading || !current()) return;
    loading = true;
    refresh.disabled = true;
    content.textContent = "Loading quote history…";
    try {
      const params = new URLSearchParams({ project, lead_id: leadId });
      const result = await readJson(`${LEADS_MODULE_URL}/quotes/history?${params}`, { cache: "no-store" });
      if (!current()) return;
      const quotes = Array.isArray(result.quotes) ? result.quotes : [];
      if (!quotes.length) {
        content.textContent = "No quotes have been created for this lead yet.";
        return;
      }
      content.innerHTML = `
        ${result.truncated ? '<p class="muted">Showing the newest 200 quotes.</p>' : ""}
        <div style="overflow-x:auto;">
          <table class="notes-table" style="width:100%;">
            <thead><tr><th>Quote</th><th>Created</th><th>Released</th><th>Services</th>
              <th style="text-align:right;">Offered Total</th><th style="text-align:right;">Confirmed Total</th>
              <th>Status</th><th>Action</th></tr></thead>
            <tbody>${quotes.map(q => `<tr>
              <td><strong>${escapeHtml(q.quote_number || "Unnamed Quote")}</strong>
                ${q.quote_id === currentQuoteId ? '<div class="muted">Shown above</div>' : ""}</td>
              <td>${escapeHtml(formatDate(q.created_at) || "—")}</td>
              <td>${escapeHtml(formatDate(q.sent_at) || "—")}</td>
              <td title="${escapeHtml((q.service_names || []).join(", "))}">${escapeHtml(String(q.offered_service_count ?? 0))}</td>
              <td style="text-align:right;">${escapeHtml(formatMoney(q.offered_total))}</td>
              <td style="text-align:right;">${q.status === "accepted" || q.accepted_at ? escapeHtml(formatMoney(q.accepted_total)) : "—"}</td>
              <td>${escapeHtml(q.status || "")}</td>
              <td><button type="button" class="secondary" data-view-history-quote="${escapeHtml(q.quote_id)}">View Quote</button></td>
            </tr>`).join("")}</tbody>
          </table>
        </div>`;
      content.querySelectorAll("[data-view-history-quote]").forEach(button => {
        button.addEventListener("click", async () => {
          if (viewLoading || !current()) return;
          viewLoading = true;
          button.disabled = true;
          button.textContent = "Loading…";
          refresh.disabled = true;
          try {
            const quoteId = button.dataset.viewHistoryQuote;
            const params = new URLSearchParams({ project, lead_id: leadId, quote_id: quoteId });
            const saved = await readJson(`${LEADS_MODULE_URL}/quotes/current?${params}`, { cache: "no-store" });
            if (!current()) return;
            if (!saved.quote || saved.quote.quote_id !== quoteId || saved.quote.lead_id !== leadId ||
                (saved.quote.project && saved.quote.project !== project)) {
              throw new Error("The requested quote version could not be verified.");
            }
            showVersion(saved.quote, Array.isArray(saved.lines) ? saved.lines : []);
            dialog.addEventListener("close", () => { if (current() && button.isConnected) button.focus(); }, { once: true });
          } catch (error) {
            if (current()) alert(`Unable to view saved quote: ${error.message}`);
          } finally {
            viewLoading = false;
            if (current()) {
              button.disabled = false;
              button.textContent = "View Quote";
              refresh.disabled = false;
            }
          }
        });
      });
    } catch (error) {
      if (current()) content.textContent = `Unable to load quote history: ${error.message}`;
    } finally {
      loading = false;
      if (current()) refresh.disabled = viewLoading;
    }
  }
  refresh.addEventListener("click", loadHistory);
  await loadHistory();
}

