// tab-list-data.js — data + helpers for Tasks List

import { escapeHtml } from "../utilities.js";

export async function fetchLookups(project) {
  let lookups = [];
  try {
    const res = await fetch(
      `https://tasks-manager.dennis-e64.workers.dev/lookups/list?project=${encodeURIComponent(project)}`,
      { cache: "no-cache" }
    );
    const j = await res.json();
    lookups = Array.isArray(j) ? j : [];
  } catch {
    lookups = [];
  }
  return lookups;
}

export function getOptions(lookups, field) {
  return lookups
    .filter(r => r.field === field && r.active)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function buildMultiSelect(lookups, field) {
  const opts = getOptions(lookups, field);
  return opts
    .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.value)}</option>`)
    .join("");
}

export function renderDueIn(dueIn) {
  if (dueIn === null) return `<span style="color:#999;">⚪ —</span>`;
  if (dueIn <= 2) return `<span style="color:#d00;">🔴 ${dueIn}d</span>`;
  if (dueIn <= 5) return `<span style="color:#c9a000;">🟡 ${dueIn}d</span>`;
  return `<span style="color:#0a0;">🟢 ${dueIn}d</span>`;
}

export async function fetchProjectStaff(project) {
  let projectStaff = [];
  try {
    const res = await fetch(
      `https://tasks-manager.dennis-e64.workers.dev/projects/staff?project=${encodeURIComponent(project)}`,
      { cache: "no-cache" }
    );
    projectStaff = await res.json();
    if (!Array.isArray(projectStaff)) projectStaff = [];
  } catch {
    projectStaff = [];
  }
  return projectStaff;
}

export function resolveAssigned(t, projectStaff, portalState) {
  if (t.assigned_to_user_id) {
    const u = projectStaff.find(x => x.id === t.assigned_to_user_id);
    if (u) {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
      return name || u.staff_name || u.staff_email || "";
    }
  }

  if (t.assigned_to_contact_id && t.assigned_to_contact_id === portalState.project_contact_id) {
    return "Client";
  }

  if (t.who === "Other") return "Other";

  return "";
}

export function buildAssignedFilterOptions(projectStaff, portalState) {
  let html = `<option value="">-- All --</option>`;

  for (const u of projectStaff) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
    const label = name || u.staff_name || u.staff_email || "";
    html += `<option value="user:${escapeHtml(u.id)}">${escapeHtml(label)}</option>`;
  }

  if (portalState.project_contact_id) {
    html += `<option value="contact:${escapeHtml(portalState.project_contact_id)}">Client</option>`;
  }

  html += `<option value="other">Other</option>`;
  return html;
}

export async function fetchTasks(project) {
  try {
    const res = await fetch(
      `https://tasks-manager.dennis-e64.workers.dev/tasks/list?project=${encodeURIComponent(project)}`,
      { cache: "no-cache" }
    );
    const j = await res.json();
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}

export function computeDueIn(arr) {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return arr.map(t => {
    if (!t.due_date) return { ...t, due_in: null };

    const [y, m, d] = t.due_date.split("-").map(Number);
    const dueMid = new Date(y, m - 1, d);
    const diffDays = Math.round((dueMid - todayMid) / 86400000);

    return { ...t, due_in: diffDays };
  });
}
