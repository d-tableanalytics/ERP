const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { nowIST, addDays, atTime, formatLocalDateTimeForDb, formatDDMMYYYYWithOptionalTime } = require('../../utils/time');

const MONTH_INDEX = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TODO_REQUIRED_FIELDS_MESSAGE = 'To create a To-Do, please provide task title, description, priority, due date, and assigned person.';
const TODO_TITLE_CLARIFICATION_MESSAGE = "Please tell me the task title. Example: Create a todo 'Check PO entry' for Aashu due tomorrow.";

function requireUser(user) {
  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };
  return { ok: true, userId };
}

function validateArgs(args, schema) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  return { ok: true, value: v.value };
}

function resolveNaturalDate(raw) {
  if (!raw) return null;
  const phrase = String(raw).trim().toLowerCase();
  const today = nowIST();
  const timeHint = extractTimeHint(phrase);
  const datePhrase = cleanupDatePhrase(timeHint ? timeHint.remaining : phrase);
  const withTime = (date) => formatIstDateTimeForDb(atTime(date, timeHint?.hour || 0, timeHint?.minute || 0));

  if (datePhrase === 'today') return withTime(today);
  if (datePhrase === 'tomorrow') return withTime(addDays(today, 1));
  if (datePhrase === 'day after tomorrow') return withTime(addDays(today, 2));

  const nextDay = datePhrase.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  const dayName = nextDay?.[1] || datePhrase.match(/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/)?.[1];
  if (dayName) {
    const target = DAY_NAMES.indexOf(dayName);
    let diff = target - today.getDay();
    if (diff <= 0 || nextDay) diff += 7;
    return withTime(addDays(today, diff));
  }

  const dayMonth = parseDayMonth(datePhrase, today);
  if (dayMonth) return withTime(dayMonth);

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return timeHint ? withTime(parsed) : formatIstDateTimeForDb(parsed);

  return null;
}

function extractTimeHint(phrase) {
  const explicit = phrase.match(/\b(?:before|by|at)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (explicit) {
    let hour = Number(explicit[1]);
    const minute = explicit[2] ? Number(explicit[2]) : 0;
    const suffix = explicit[3].toLowerCase();
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    return { hour, minute, remaining: phrase.replace(explicit[0], ' ') };
  }
  if (/\bevening\b/.test(phrase)) return { hour: 18, minute: 0, remaining: phrase.replace(/\bevening\b/g, ' ') };
  if (/\bafternoon\b/.test(phrase)) return { hour: 13, minute: 0, remaining: phrase.replace(/\bafternoon\b/g, ' ') };
  if (/\bmorning\b/.test(phrase)) return { hour: 9, minute: 0, remaining: phrase.replace(/\bmorning\b/g, ' ') };
  return null;
}

function parseDayMonth(phrase, baseDate) {
  const match = phrase.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s/-]+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)(?:[\s/-]+(\d{4}))?$/);
  if (!match) return null;
  const date = new Date(baseDate);
  date.setFullYear(match[3] ? Number(match[3]) : baseDate.getFullYear(), MONTH_INDEX[match[2]], Number(match[1]));
  date.setHours(0, 0, 0, 0);
  if (!match[3] && date < startOfToday(baseDate)) date.setFullYear(date.getFullYear() + 1);
  return date;
}

function formatIstDateTimeForDb(date) {
  const local = formatLocalDateTimeForDb(date);
  return local ? `${local}+05:30` : null;
}

function cleanupDatePhrase(value) {
  return String(value || '').replace(/\b(due|date|deadline|before|by|on|at)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

function startOfToday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTodoDate(todo, fallback = null) {
  return formatDDMMYYYYWithOptionalTime(todo?.dueDate) || fallback || 'Not set';
}

function selectionResult(result) {
  if (!result?.needsSelection) return null;
  return {
    ok: true,
    needsSelection: true,
    message: result.message,
    options: result.options,
  };
}

function normalizeTodoText(value = '') {
  return String(value || '')
    .replace(/\bc\s+reate\b/ig, 'create')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTodoRequiredFieldsQuestion(value = '') {
  const text = normalizeTodoText(value);
  const msg = text.toLowerCase();
  if (!msg || !/\b(todo|to-do|to do|task board|board task)\b/.test(msg)) return false;

  const hasExplicitTitle = /:\s*\S/.test(text)
    || /["'`][^"'`]+["'`]/.test(text)
    || /\btitle\s+(?:is|:)\s+\S/i.test(text);
  if (hasExplicitTitle) return false;

  return /\bhow\s+(?:do\s+i\s+|to\s+)?create\s+(?:a\s+)?(?:todo|to-do|to do)\b/.test(msg)
    || /\bwhat\s+(?:we\s+|i\s+)?(?:need|needed|is\s+needed|are\s+needed|required|is\s+required|are\s+required)\b.*\b(?:create|creating|for)\b.*\b(?:todo|to-do|to do)\b/.test(msg)
    || /\bwhat\s+fields?\s+(?:are\s+)?(?:required|needed)\b.*\b(?:todo|to-do|to do)\b/.test(msg)
    || /\bcreate\s+(?:a\s+)?(?:todo|to-do|to do)\b.*\bwhat\s+(?:i\s+)?(?:need|is\s+needed|needed|required)\b/.test(msg);
}

function isUnclearTodoCreateTitle(value = '') {
  const text = normalizeTodoText(value)
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .trim();
  const msg = text.toLowerCase();
  if (!msg) return true;
  if (/^(?:create|add|make|new)?\s*(?:a|an)?\s*(?:todo|to-do|to do|task)?$/i.test(msg)) return true;
  if (isTodoRequiredFieldsQuestion(text)) return true;
  if (/^(?:what|how)\b/.test(msg) && /\b(?:need|needed|required|create|todo|to-do|to do)\b/.test(msg)) return true;
  if (/\bwhat\s+(?:we\s+)?(?:need|needed|is\s+needed|required)\b/i.test(msg)) return true;
  return false;
}

module.exports = {
  requireUser,
  validateArgs,
  resolveNaturalDate,
  formatIstDateTimeForDb,
  formatTodoDate,
  selectionResult,
  normalizeTodoText,
  isTodoRequiredFieldsQuestion,
  isUnclearTodoCreateTitle,
  TODO_REQUIRED_FIELDS_MESSAGE,
  TODO_TITLE_CLARIFICATION_MESSAGE,
};
