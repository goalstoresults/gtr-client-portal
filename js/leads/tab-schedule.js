// js/leads/tab-schedule.js

export async function renderLeadSchedule(
  container,
  portalState,
  { tabLabel }
) {
  container._scheduleCleanup?.();

  const leadId = portalState.activeLeadId;
  const project = portalState.project;
  const label = tabLabel || "Schedule";

  container.replaceChildren();

  const card = document.createElement("section");
  card.className = "card";

  const heading = document.createElement("h2");
  heading.textContent = label;

  card.appendChild(heading);
  container.appendChild(card);

  if (!leadId) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent =
      `Create a lead first before accessing the ${label.toLowerCase()}.`;

    card.appendChild(message);
    return;
  }

  /* -------------------------------------------------------
     LIFECYCLE / REQUEST CLEANUP
  ------------------------------------------------------- */

  const controller = new AbortController();

  let stopped = false;
  let pollTimer = null;
  let loadingAppointment = false;

  // null = not yet successfully determined
  // false = no saved appointment
  // true = saved appointment exists
  let appointmentFound = null;

  const isCurrent = () =>
    !stopped &&
    card.isConnected &&
    portalState.activeLeadId === leadId &&
    portalState.project === project;

  const cleanup = () => {
    if (stopped) return;

    stopped = true;
    clearInterval(pollTimer);
    controller.abort();
    observer.disconnect();

    if (container._scheduleCleanup === cleanup) {
      delete container._scheduleCleanup;
    }
  };

  const observer = new MutationObserver(() => {
    if (!card.isConnected) {
      cleanup();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  container._scheduleCleanup = cleanup;

  /* -------------------------------------------------------
     SAVED APPOINTMENT SUMMARY

     Always remains visible.
  ------------------------------------------------------- */

  const summary = document.createElement("div");
  summary.className = "schedule-summary";
  summary.style.cssText = [
    "padding:16px",
    "margin-bottom:20px",
    "border:1px solid #dbe2ea",
    "border-radius:8px",
    "background:#f8fafc"
  ].join(";");

  const summaryHeading = document.createElement("h3");
  summaryHeading.textContent = "Scheduled Inspection";
  summaryHeading.style.cssText = "margin:0 0 8px;";

  const appointmentText = document.createElement("p");
  appointmentText.style.cssText =
    "margin:0;font-size:17px;font-weight:600;";
  appointmentText.textContent = "Loading appointment…";
  appointmentText.setAttribute("aria-live", "polite");

  const appointmentNote = document.createElement("p");
  appointmentNote.className = "muted";
  appointmentNote.style.cssText =
    "margin:8px 0 0;font-size:13px;";
  appointmentNote.hidden = true;

  summary.append(
    summaryHeading,
    appointmentText,
    appointmentNote
  );

  card.appendChild(summary);

  const setNote = text => {
    appointmentNote.textContent = text;
    appointmentNote.hidden = !text;
  };

  /* -------------------------------------------------------
     CRM MANAGEMENT MESSAGE
  ------------------------------------------------------- */

  const crmMessage = document.createElement("p");
  crmMessage.className = "muted";
  crmMessage.style.marginBottom = "16px";
  crmMessage.textContent =
    "To reschedule or cancel this appointment, please use " +
    "the CRM and open the client's contact record to continue.";
  crmMessage.hidden = true;

  card.appendChild(crmMessage);

  /* -------------------------------------------------------
     BOOKING CALENDAR SECTION

     Hide the entire section when an appointment exists.
     Keep the iframe mounted so polling does not reload it.
  ------------------------------------------------------- */

  const bookingSection = document.createElement("div");
  bookingSection.className = "schedule-booking-section";
  bookingSection.hidden = true;

  const calendarMessage = document.createElement("p");
  calendarMessage.className = "muted";
  calendarMessage.style.marginBottom = "16px";
  calendarMessage.textContent = "Loading booking calendar…";

  bookingSection.appendChild(calendarMessage);
  card.appendChild(bookingSection);

  const updateBookingVisibility = () => {
    const showBooking = appointmentFound === false;
    const showCrmMessage = appointmentFound === true;

    // Set both hidden and display to avoid existing CSS
    // accidentally overriding the hidden attribute.
    bookingSection.hidden = !showBooking;
    bookingSection.style.display =
      showBooking ? "" : "none";

    crmMessage.hidden = !showCrmMessage;
    crmMessage.style.display =
      showCrmMessage ? "" : "none";
  };

  updateBookingVisibility();

  /* -------------------------------------------------------
     DISPLAY SAVED APPOINTMENT

     Display saved values as text.
     No Date parsing.
     No timezone interpretation.
     No UTC conversion.
  ------------------------------------------------------- */

  const showNoAppointment = () => {
    appointmentFound = false;
    appointmentText.textContent = "No appointment found.";
    setNote("");
    updateBookingVisibility();
  };

  const displayAppointment = lead => {
    const rawDatetime = lead.inspection_datetime;

    const datetimeText =
      rawDatetime === null || rawDatetime === undefined
        ? ""
        : String(rawDatetime).trim();

    if (!datetimeText) {
      showNoAppointment();
      return;
    }

    const timezoneText =
      lead.inspection_timezone === null ||
      lead.inspection_timezone === undefined
        ? ""
        : String(lead.inspection_timezone).trim();

    appointmentFound = true;

    // textContent displays text without interpreting HTML.
    appointmentText.textContent = datetimeText;

    setNote(
      timezoneText
        ? `Appointment timezone: ${timezoneText}`
        : ""
    );

    updateBookingVisibility();
  };

  /* -------------------------------------------------------
     LOAD SAVED APPOINTMENT
  ------------------------------------------------------- */

  const loadAppointment = async () => {
    if (!isCurrent()) {
      cleanup();
      return;
    }

    if (loadingAppointment) return;
    loadingAppointment = true;

    try {
      const response = await fetch(
        `https://leads-module.dennis-e64.workers.dev/leads/get?id=${encodeURIComponent(leadId)}`,
        {
          cache: "no-store",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `Lead request failed (HTTP ${response.status}).`
        );
      }

      const data = await response.json();
      const lead = Array.isArray(data) ? data[0] : data;

      if (!isCurrent()) return;

      const isEmptyResponse =
        lead === null ||
        lead === undefined ||
        (
          typeof lead === "object" &&
          !Array.isArray(lead) &&
          Object.keys(lead).length === 0
        );

      if (isEmptyResponse) {
        throw new Error(
          "The lead API returned no matching lead."
        );
      }

      if (
        typeof lead !== "object" ||
        Array.isArray(lead)
      ) {
        throw new Error("Unexpected lead response.");
      }

      if (
        String(lead.lead_id).toLowerCase() !==
          String(leadId).toLowerCase() ||
        lead.project !== project
      ) {
        throw new Error(
          "The matching lead was not returned."
        );
      }

      // Missing field is not the same as an empty field.
      // An empty value means no appointment.
      // A missing property means the read path is incomplete.
      if (
        !Object.prototype.hasOwnProperty.call(
          lead,
          "inspection_datetime"
        )
      ) {
        const error = new Error(
          "The lead API response is missing inspection_datetime."
        );

        error.code = "missing_schedule_field";
        throw error;
      }

      displayAppointment(lead);
    } catch (error) {
      if (
        error.name === "AbortError" ||
        !isCurrent()
      ) {
        return;
      }

      console.error(
        "[Schedule Tab] Failed to load saved appointment:",
        error
      );

      if (appointmentFound === null) {
        appointmentText.textContent =
          "Unable to load the saved appointment.";

        setNote(
          error.code === "missing_schedule_field"
            ? "The lead API is not returning inspection_datetime. " +
              "The lead-detail API/view must include the saved " +
              "scheduling fields."
            : "The saved schedule could not be checked. " +
              "The tab will retry automatically."
        );
      } else {
        // Preserve the last successfully loaded state.
        setNote(
          "Unable to refresh the schedule. " +
          "The last loaded information is still shown. " +
          "The tab will retry automatically."
        );
      }

      updateBookingVisibility();
    } finally {
      loadingAppointment = false;
    }
  };

  /* -------------------------------------------------------
     EXISTING GHL BOOKING CALENDAR
  ------------------------------------------------------- */

  const loadCalendar = async () => {
    let scheduleConfig = null;
    let configFailed = false;

    try {
      const response = await fetch(
        `https://leads-module.dennis-e64.workers.dev/leads/config?project=${encodeURIComponent(project)}`,
        {
          cache: "no-store",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `Configuration request failed (HTTP ${response.status}).`
        );
      }

      const data = await response.json();
      const config = Array.isArray(data) ? data[0] : data;

      const tabs = Array.isArray(config?.tabs)
        ? config.tabs
        : [];

      scheduleConfig = tabs.find(
        tab => tab.key === "calendar"
      );
    } catch (error) {
      if (error.name === "AbortError") return;

      configFailed = true;

      console.error(
        "[Schedule Tab] Failed to load calendar configuration:",
        error
      );
    }

    if (!isCurrent()) return;

    // Preserve the original CSI fallback for CSI only.
    const iframeSrc =
      scheduleConfig?.iframe_src ||
      (
        String(project).toLowerCase() === "csi"
          ? "https://api.leadconnectorhq.com/widget/booking/4m6uvnvkeO5frly4Eb5o"
          : null
      );

    if (!iframeSrc) {
      calendarMessage.textContent = configFailed
        ? "Unable to load the booking calendar configuration."
        : "Scheduling is not configured for this project.";

      return;
    }

    let calendarUrl;

    try {
      calendarUrl = new URL(iframeSrc);

      if (calendarUrl.protocol !== "https:") {
        throw new Error(
          "Calendar URL must use HTTPS."
        );
      }
    } catch (error) {
      console.error(
        "[Schedule Tab] Invalid calendar URL:",
        error
      );

      calendarMessage.textContent =
        "The configured booking calendar URL is invalid.";

      return;
    }

    calendarMessage.textContent =
      "Use the calendar below to book this lead's appointment.";

    const wrapper = document.createElement("div");
    wrapper.className = "calendar-wrapper";

    const iframe = document.createElement("iframe");
    iframe.src = calendarUrl.href;
    iframe.id = "lead-calendar-iframe";
    iframe.title = "Inspection booking calendar";
    iframe.style.cssText =
      "width:100%;min-height:800px;border:none;overflow:hidden;";
    iframe.setAttribute("scrolling", "no");

    wrapper.appendChild(iframe);
    bookingSection.appendChild(wrapper);

    const embedScript = document.createElement("script");
    embedScript.src =
      "https://api.leadconnectorhq.com/js/form_embed.js";
    embedScript.type = "text/javascript";
    embedScript.async = true;

    wrapper.appendChild(embedScript);

    // Use the latest appointment state, regardless of
    // which initial request completed first.
    updateBookingVisibility();
  };

  /* -------------------------------------------------------
     INITIAL LOAD / AUTOMATIC REFRESH
  ------------------------------------------------------- */

  await Promise.all([
    loadAppointment(),
    loadCalendar()
  ]);

  if (!isCurrent()) {
    cleanup();
    return;
  }

  pollTimer = setInterval(() => {
    if (!isCurrent()) {
      cleanup();
      return;
    }

    if (document.visibilityState === "visible") {
      void loadAppointment();
    }
  }, 10000);
}
