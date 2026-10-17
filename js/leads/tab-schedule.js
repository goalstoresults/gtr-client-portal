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
  let appointmentRequest = null;

  // null = not yet successfully determined
  // false = no saved appointment
  // true = saved appointment exists
  let appointmentFound = null;

  // Preserve the last successfully loaded appointment note
  // when a later refresh fails.
  let savedAppointmentNote = "";

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

  const summaryHeader = document.createElement("div");
  summaryHeader.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "flex-wrap:wrap",
    "gap:12px",
    "margin-bottom:8px"
  ].join(";");

  const summaryHeading = document.createElement("h3");
  summaryHeading.textContent = "Scheduled Inspection";
  summaryHeading.style.margin = "0";

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "secondary";
  refreshButton.textContent = "Refresh Appointment";
  refreshButton.setAttribute(
    "aria-label",
    "Refresh saved inspection appointment"
  );
  refreshButton.style.cssText = [
    "padding:8px 12px",
    "border:1px solid #244b70",
    "border-radius:6px",
    "background:#fff",
    "color:#244b70",
    "font:inherit",
    "font-weight:600",
    "cursor:pointer"
  ].join(";");

  summaryHeader.append(
    summaryHeading,
    refreshButton
  );

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

  const refreshStatus = document.createElement("p");
  refreshStatus.className = "muted";
  refreshStatus.style.cssText =
    "margin:8px 0 0;font-size:13px;";
  refreshStatus.setAttribute("role", "status");
  refreshStatus.setAttribute("aria-live", "polite");
  refreshStatus.hidden = true;

  summary.append(
    summaryHeader,
    appointmentText,
    appointmentNote,
    refreshStatus
  );

  card.appendChild(summary);

  const setNote = text => {
    appointmentNote.textContent = text;
    appointmentNote.hidden = !text;
  };

  const setRefreshStatus = text => {
    refreshStatus.textContent = text;
    refreshStatus.hidden = !text;
  };

  const setRefreshing = refreshing => {
    refreshButton.disabled = refreshing;
    refreshButton.textContent =
      refreshing
        ? "Refreshing…"
        : "Refresh Appointment";

    refreshButton.style.opacity =
      refreshing ? "0.6" : "1";

    refreshButton.style.cursor =
      refreshing ? "wait" : "pointer";

    refreshButton.setAttribute(
      "aria-busy",
      String(refreshing)
    );
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
     Keep the iframe mounted so refreshing the appointment
     does not reload the booking calendar.
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
    savedAppointmentNote = "";
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

    savedAppointmentNote = timezoneText
      ? `Appointment timezone: ${timezoneText}`
      : "";

    setNote(savedAppointmentNote);
    updateBookingVisibility();
  };

  /* -------------------------------------------------------
     FETCH AND DISPLAY THE SAVED APPOINTMENT
  ------------------------------------------------------- */

  const fetchAndDisplayAppointment = async () => {
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

      if (!isCurrent()) {
        return { state: "stopped" };
      }

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

      if (appointmentFound === true) {
        // Clear any previous "not found yet" or error message.
        setRefreshStatus("");
      }

      return {
        state:
          appointmentFound === true
            ? "found"
            : "empty"
      };
    } catch (error) {
      if (
        error.name === "AbortError" ||
        !isCurrent()
      ) {
        return { state: "stopped" };
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
              "Click Refresh Appointment to try again."
        );
      } else {
        // Preserve the last successfully loaded state
        // and its timezone while reporting the refresh error.
        setNote(savedAppointmentNote);

        setRefreshStatus(
          "Unable to refresh the schedule. " +
          "The last loaded information is still shown. " +
          "Click Refresh Appointment to try again."
        );
      }

      updateBookingVisibility();

      return {
        state: "error",
        code: error.code || ""
      };
    }
  };

  /* -------------------------------------------------------
     SHARED LOAD / MANUAL REFRESH

     Reuse an active request instead of starting overlapping
     requests. This also lets the Refresh button await an
     automatic check already in progress.
  ------------------------------------------------------- */

  const loadAppointment = async () => {
    if (!isCurrent()) {
      cleanup();
      return { state: "stopped" };
    }

    if (appointmentRequest) {
      return appointmentRequest;
    }

    appointmentRequest = fetchAndDisplayAppointment();

    try {
      return await appointmentRequest;
    } finally {
      appointmentRequest = null;
    }
  };

  refreshButton.addEventListener("click", async () => {
    if (!isCurrent() || refreshButton.disabled) return;

    setRefreshing(true);
    setRefreshStatus("Checking for your saved appointment…");

    try {
      const result = await loadAppointment();

      if (!isCurrent()) return;

      if (result.state === "found") {
        setRefreshStatus("Appointment refreshed.");
      } else if (result.state === "empty") {
        setRefreshStatus(
          "No appointment found yet. If you just booked, " +
          "please wait a few seconds and click " +
          "Refresh Appointment again."
        );
      } else if (result.state === "error") {
        setRefreshStatus(
          result.code === "missing_schedule_field"
            ? "The lead API is not returning the saved schedule field."
            : "Unable to refresh the appointment. Please try again."
        );
      }
    } finally {
      if (isCurrent()) {
        setRefreshing(false);
      }
    }
  });

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
      "Use the calendar below to book this lead's appointment. " +
      "After the booking confirmation appears, click " +
      "Refresh Appointment above to update the Portal. " +
      "If it does not appear immediately, wait a few seconds " +
      "and try again.";

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
