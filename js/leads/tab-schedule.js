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
  let hasDisplayedAppointment = false;

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

  const showNoAppointment = () => {
    hasDisplayedAppointment = false;
    appointmentText.textContent = "No appointment found.";
    setNote("");
  };

  const displayAppointment = lead => {
    const rawDatetime = lead?.inspection_datetime;

    if (
      rawDatetime === null ||
      rawDatetime === undefined ||
      String(rawDatetime).trim() === ""
    ) {
      showNoAppointment();
      return;
    }

    const date = new Date(rawDatetime);

    if (!Number.isFinite(date.getTime())) {
      hasDisplayedAppointment = false;
      appointmentText.textContent =
        "The saved appointment date/time is invalid.";
      setNote("");
      return;
    }

    const timezone = lead.inspection_timezone || "UTC";

    try {
      const formatted = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(date);

      appointmentText.textContent = formatted;
      hasDisplayedAppointment = true;

      setNote(
        lead.inspection_timezone
          ? `Appointment timezone: ${timezone}.`
          : "Shown in UTC because the appointment timezone " +
            "was not included in the lead response."
      );
    } catch (error) {
      console.error(
        "[Schedule Tab] Invalid appointment timezone:",
        error
      );

      hasDisplayedAppointment = false;
      appointmentText.textContent =
        "The saved appointment timezone is invalid.";
      setNote("");
    }
  };

  const loadAppointment = async () => {
    if (!isCurrent()) {
      cleanup();
      return;
    }

    if (loadingAppointment) return;
    loadingAppointment = true;

    try {
      const response = await fetch(
        `/leads/get?id=${encodeURIComponent(leadId)}`,
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
        showNoAppointment();
        return;
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
        throw new Error("The matching lead was not returned.");
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

      // Requested display fallback.
      // Preserve an appointment already displayed successfully.
      // Errors remain logged rather than shown in this panel.
      if (!hasDisplayedAppointment) {
        showNoAppointment();
      }
    } finally {
      loadingAppointment = false;
    }
  };

  /* -------------------------------------------------------
     EXISTING GHL BOOKING CALENDAR
  ------------------------------------------------------- */

  const calendarMessage = document.createElement("p");
  calendarMessage.className = "muted";
  calendarMessage.style.marginBottom = "16px";
  calendarMessage.textContent = "Loading booking calendar…";

  card.appendChild(calendarMessage);

  const loadCalendar = async () => {
    let scheduleConfig = null;
    let configFailed = false;

    try {
      const response = await fetch(
        `/leads/config?project=${encodeURIComponent(project)}`,
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
        throw new Error("Calendar URL must use HTTPS.");
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
    card.appendChild(wrapper);

    const embedScript = document.createElement("script");
    embedScript.src =
      "https://api.leadconnectorhq.com/js/form_embed.js";
    embedScript.type = "text/javascript";
    embedScript.async = true;

    wrapper.appendChild(embedScript);
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
