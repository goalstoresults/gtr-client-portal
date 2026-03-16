// tab-list-logic.js — state, filters, sort, show-mine, CSV

import { fetchTasks, computeDueIn } from "./tab-list-data.js";

let tasks = [];
let filteredTasks = [];
let sortLevels = [
  { field: "due_date", dir: "asc" },
  { field: "", dir: "asc" },
  { field: "", dir: "asc" },
  { field: "", dir: "asc" }
];

export function getTasks() {
  return tasks;
}

export function getFilteredTasks() {
  return filteredTasks;
}

export function setFilteredTasks(newArr) {
  filteredTasks = newArr;
}

export function getSortLevels() {
  return sortLevels;
}

export function setSortLevels(newLevels) {
  sortLevels = newLevels;
}

export async function initListLogic({ portalState }) {
  tasks = computeDueIn(await fetchTasks(portalState.project));
  filteredTasks = [...tasks];

  portalState.refreshTasks = async () => {
    tasks = computeDueIn(await fetchTasks(portalState.project));
    filteredTasks = [...tasks];
  };
}

export function applyFiltersRaw(tasksArr, filterValues) {
  const {
    statusSel,
    prioritySel,
    assignedSel,
    areaSel,
    forSel,
    dueFilter,
    followDueToday
  } = filterValues;

  const result = tasksArr.filter(t => {
    if (statusSel.length && !statusSel.includes(t.status)) return false;
    if (prioritySel.length && !prioritySel.includes(String(t.priority))) return false;
    if (areaSel.length && !areaSel.includes(t.area)) return false;
    if (forSel.length && !forSel.includes(t.who_is_this_for)) return false;

    if (assignedSel) {
      if (assignedSel.startsWith("user:")) {
        const id = assignedSel.replace("user:", "");
        if (t.assigned_to_user_id !== id) return false;
      } else if (assignedSel.startsWith("contact:")) {
        const id = assignedSel.replace("contact:", "");
        if (t.assigned_to_contact_id !== id) return false;
      } else if (assignedSel === "other") {
        if (t.who !== "Other") return false;
      }
    }

    const today = new Date();
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const due = t.due_date ? new Date(t.due_date) : null;
    const dueMid = due ? new Date(due.getFullYear(), due.getMonth(), due.getDate()) : null;

    if (dueFilter === "today" && (!dueMid || dueMid.getTime() !== todayMid.getTime())) return false;
    if (dueFilter === "overdue" && (!dueMid || dueMid >= todayMid)) return false;
    if (dueFilter === "7" && (!dueMid || dueMid > new Date(todayMid.getTime() + 7 * 86400000))) return false;
    if (dueFilter === "30" && (!dueMid || dueMid > new Date(todayMid.getTime() + 30 * 86400000))) return false;

    if (followDueToday) {
      const f = t.followup_date ? new Date(t.followup_date) : null;
      const fMid = f ? new Date(f.getFullYear(), f.getMonth(), f.getDate()) : null;
      if (!fMid || fMid > todayMid) return false;
    }

    return true;
  });

  return result;
}

export function applySortInPlace(arr, sortLevels, helpers) {
  const { resolveAssigned } = helpers;

  arr.sort((a, b) => {
    for (const lvl of sortLevels) {
      if (!lvl.field) continue;

      let A, B;

      if (lvl.field === "assigned_to") {
        A = resolveAssigned(a).toLowerCase();
        B = resolveAssigned(b).toLowerCase();
      } else if (lvl.field === "created_at") {
        A = a.created_at ? new Date(a.created_at) : new Date(0);
        B = b.created_at ? new Date(b.created_at) : new Date(0);
      } else {
        A = a[lvl.field];
        B = b[lvl.field];

        if (lvl.field === "due_date" || lvl.field === "followup_date") {
          A = A ? new Date(A) : new Date(0);
          B = B ? new Date(B) : new Date(0);
        } else if (lvl.field === "priority" || lvl.field === "due_in") {
          A = Number(A) || 0;
          B = Number(B) || 0;
        } else {
          A = (A || "").toString().toLowerCase();
          B = (B || "").toString().toLowerCase();
        }
      }

      if (A < B) return lvl.dir === "asc" ? -1 : 1;
      if (A > B) return lvl.dir === "asc" ? 1 : -1;
    }
    return 0;
  });
}

export function applyShowMineFilterRaw(arr, portalState) {
  const showMine = portalState.showMineChecked ?? true;
  if (!showMine) return arr;

  const myId = portalState.user_id;
  return arr.filter(t => t.assigned_to_user_id === myId);
}
