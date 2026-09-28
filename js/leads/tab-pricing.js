// js/leads/tab-pricing.js

import { escapeHtml } from "../utilities.js";

const LEADS_MODULE_URL = "https://leads-module.dennis-e64.workers.dev";

function formatMoney(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return `$${numericValue.toFixed(2)}`;
}

export async function renderLeadPricing(container, portalState) {
  const leadId = portalState.activeLeadId;
  const project = portalState.project;

  if (!leadId) {
    container.innerHTML = `
      <section class="card">
        <h2>Pricing Chart</h2>
        <p class="muted">
          Select or create a lead first.
        </p>
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
            services, and click <strong>Save Services</strong>. That will
            create the draft quote and its service rows here.
          </p>
        </section>
      `;
      return;
    }

    const totals = lines.reduce(
      (result, line) => {
        const quantity = Number(line.quantity || 1);
        const price = Number(line.unit_price);

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

    const totalDisplay = formatMoney(totals.total) || "$0.00";

    const rowsHtml = lines.length
      ? lines
          .map((line) => {
            const priceDisplay = formatMoney(line.unit_price);
            const quantity = Number(line.quantity || 1);

            return `
              <tr>
                <td>
                  <strong>${escapeHtml(line.service_name || "")}</strong>
                  ${
                    line.required
                      ? `<div class="muted" style="font-size:0.85em; margin-top:3px;">Required service</div>`
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

                <td style="text-align:right;">
                  ${
                    priceDisplay
                      ? escapeHtml(priceDisplay)
                      : `<span class="muted">Price not entered</span>`
                  }
                </td>
              </tr>
            `;
          })
          .join("")
      : `
          <tr>
            <td colspan="4" class="muted">
              No services are currently on this draft quote.
              Return to Services, select services, and click Save Services.
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
          Services are created from the Services tab.
          Pricing entry will be added next.
        </div>

        <div style="overflow-x:auto;">
          <table class="notes-table" style="width:100%;">
            <thead>
              <tr>
                <th style="min-width:190px;">Service</th>
                <th style="min-width:260px;">Description</th>
                <th style="text-align:center; min-width:80px;">Qty</th>
                <th style="text-align:right; min-width:150px;">Quoted Price</th>
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

                <th style="text-align:right;">
                  ${escapeHtml(totalDisplay)}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>

        ${
          totals.unpricedCount
            ? `
              <p
                class="muted"
                style="
                  margin:14px 0 0;
                  padding:10px 12px;
                  background:#fff8e8;
                  border-left:3px solid #e0a52d;
                "
              >
                ${totals.unpricedCount}
                service${totals.unpricedCount === 1 ? "" : "s"}
                still need${totals.unpricedCount === 1 ? "s" : ""}
                a quoted price.
              </p>
            `
            : `
              <p
                class="muted"
                style="
                  margin:14px 0 0;
                  padding:10px 12px;
                  background:#eef7ee;
                  border-left:3px solid #4f9b57;
                "
              >
                All current quote services have a price.
              </p>
            `
        }
      </section>
    `;
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
