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

function atTime(date, hour = 0, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
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

function hasMeaningfulTime(date) {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

function formatTime12(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

function formatDDMMYYYYWithOptionalTime(date) {
  const formattedDate = formatDDMMYYYY(date);
  if (!formattedDate) return null;
  if (!hasMeaningfulTime(date)) return formattedDate;
  return `${formattedDate} ${formatTime12(date)}`;
}

function formatLocalDateTimeForDb(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
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
  atTime,
  resolveDateRange,
  formatDDMMYYYY,
  formatDDMMYYYYWithOptionalTime,
  formatLocalDateTimeForDb,
  formatTime12,
  hasMeaningfulTime,
  isOverdue,
};
