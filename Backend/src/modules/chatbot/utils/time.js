/**
 * Date / time helpers for chatbot. IST (Asia/Kolkata) is the working timezone.
 * Provides relative-date parsing and pretty formatting used in tool args + response cards.
 */

const IST_OFFSET_MIN = 330; // +05:30

function nowIST() {
  const utc = new Date();
  return new Date(utc.getTime() + (IST_OFFSET_MIN - utc.getTimezoneOffset()) * 60_000);
}

function startOfDay(date = nowIST()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = nowIST()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Resolve relative date phrases used by users: "today", "tomorrow", "yesterday",
 * "this week", "next week", "last week", "this month".
 * Returns { from: Date, to: Date } or null.
 */
function resolveDateRange(phrase) {
  if (!phrase || typeof phrase !== 'string') return null;
  const p = phrase.trim().toLowerCase();
  const today = startOfDay();
  switch (p) {
    case 'today':
      return { from: today, to: endOfDay() };
    case 'tomorrow':
      return { from: addDays(today, 1), to: endOfDay(addDays(today, 1)) };
    case 'yesterday':
      return { from: addDays(today, -1), to: endOfDay(addDays(today, -1)) };
    case 'this week': {
      const day = today.getDay();
      const monday = addDays(today, -((day + 6) % 7));
      return { from: monday, to: endOfDay(addDays(monday, 6)) };
    }
    case 'next week': {
      const day = today.getDay();
      const monday = addDays(today, -((day + 6) % 7) + 7);
      return { from: monday, to: endOfDay(addDays(monday, 6)) };
    }
    case 'last week': {
      const day = today.getDay();
      const monday = addDays(today, -((day + 6) % 7) - 7);
      return { from: monday, to: endOfDay(addDays(monday, 6)) };
    }
    case 'this month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: first, to: endOfDay(last) };
    }
    default:
      return null;
  }
}

function formatDDMMYYYY(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function isOverdue(due) {
  if (!due) return false;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < startOfDay().getTime();
}

module.exports = {
  nowIST,
  startOfDay,
  endOfDay,
  addDays,
  resolveDateRange,
  formatDDMMYYYY,
  isOverdue,
};
