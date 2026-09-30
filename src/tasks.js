// tasks.js — pure task-domain helpers: stats, filtering, sorting, date math.
// Ported from the legacy plain-JS app (js/tasks.js) with DOM code removed.

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const PRIO_WEIGHT = { Low: 1, Medium: 2, High: 3, Urgent: 4 };

export function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export function soonStr() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().split("T")[0];
}

export function getDaysLeft(due) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d - today) / 86400000);
}

export function formatDate(s) {
  const [, m, d] = s.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[+m - 1]} ${+d}`;
}

export function computeStats(tasks) {
  const today = todayStr();
  const soon = soonStr();
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter((t) => t.status !== "done" && t.due && t.due < today).length;
  const dueSoon = tasks.filter((t) => t.status !== "done" && t.due && t.due >= today && t.due <= soon).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { total, done, overdue, dueSoon, pct };
}

export function filterAndSortTasks(tasks, { activeFilter, search, sort, statusFilter, showDone, groupBySubject }) {
  const q = (search || "").toLowerCase();
  let list = tasks.filter((t) => {
    if (!showDone && t.status === "done") return false;
    if (statusFilter === "pending" && t.status === "done") return false;
    if (statusFilter === "done" && t.status !== "done") return false;
    if (activeFilter !== "All" && t.subject !== activeFilter) return false;
    if (q && !t.title.toLowerCase().includes(q) && !(t.notes || "").toLowerCase().includes(q) && !t.subject.toLowerCase().includes(q)) return false;
    return true;
  });

  list.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (sort === "due") {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    }
    if (sort === "priority") return (PRIO_WEIGHT[b.priority] || 0) - (PRIO_WEIGHT[a.priority] || 0);
    if (sort === "subject") return a.subject.localeCompare(b.subject);
    if (sort === "alpha") return a.title.localeCompare(b.title);
    return b.created - a.created;
  });

  if (!groupBySubject) return [{ subject: null, items: list }];

  const groups = [];
  const byName = new Map();
  for (const t of list) {
    if (!byName.has(t.subject)) {
      byName.set(t.subject, { subject: t.subject, items: [] });
      groups.push(byName.get(t.subject));
    }
    byName.get(t.subject).items.push(t);
  }
  return groups;
}
