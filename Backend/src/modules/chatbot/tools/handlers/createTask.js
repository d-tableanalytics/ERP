const { Task } = require('../../../../models/task.model');
const employeeAdapter = require('../../adapters/employeeAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { similarity } = require('../../utils/fuzzy');
const { nowIST, addDays, atTime, formatDDMMYYYY, formatDDMMYYYYWithOptionalTime, formatLocalDateTimeForDb, formatTime12, hasMeaningfulTime } = require('../../utils/time');

const schema = {
  title: { type: 'string', required: true, max: 200 },
  description: { type: 'string', max: 500 },
  assignedTo: { type: 'string', max: 100 },
  dueDate: { type: 'string', max: 50 },
  priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
  loopUsers: { type: 'array' },
};

/**
 * createTask handler — creates a task in the `tasks` table using the existing Task model.
 *
 * The LLM extracts fields from natural language. This handler:
 *   1. Validates + applies defaults
 *   2. Resolves assignedTo name → employee user_id via fuzzy search
 *   3. Resolves loopUsers names → employee user_ids via fuzzy search
 *   4. Resolves relative due dates (today, tomorrow, monday, etc.)
 *   5. Inserts via Task.create()
 *   6. Returns a short ERP-style confirmation
 */
module.exports = async function createTask(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const currentEmployee = await resolveCurrentEmployee(userId, user);
  const currentUserName = userName(user, currentEmployee);
  const title = v.value.title;
  const description = v.value.description || title;
  const priority = v.value.priority || 'Medium';
  const rawDueDate = v.value.dueDate || null;
  const rawAssignee = v.value.assignedTo || null;

  // --- Resolve assignee ---
  let doerId = userId;    // default: self
  let doerName = currentUserName;

  if (rawAssignee) {
    try {
      const matches = await employeeAdapter.search(rawAssignee, { limit: 1 });
      if (matches.length > 0) {
        doerId = matches[0].id;
        doerName = matches[0].name;
      }
      // If no match found, keep self as assignee (don't fail the task)
    } catch {
      // employee search failed — assign to self silently
    }
  }

  // --- Resolve loop users ---
  const loopUsers = v.value.loopUsers || [];
  const inLoopIds = [];
  const inLoopNames = [];

  for (const rawLoopUser of loopUsers) {
    if (!rawLoopUser) continue;
    try {
      const matches = await employeeAdapter.search(rawLoopUser, { limit: 1 });
      if (matches.length > 0) {
        inLoopIds.push(matches[0].id);
        inLoopNames.push(matches[0].name);
      }
    } catch {
      // Ignore if search fails for a specific loop user
    }
  }

  // --- Resolve due date ---
  const dueDate = resolveNaturalDate(rawDueDate);

  const duplicate = await findSimilarExistingTask({
    title,
    description,
    doerId,
    dueDate,
    priority,
    inLoopIds,
  });

  if (duplicate) {
    return {
      ok: true,
      duplicate: true,
      message: 'A similar task already exists.',
      summary: await buildExistingTaskSummary(duplicate),
      slot: { lastEntity: 'task', lastCreatedTaskId: duplicate.id, lastCreatedTaskTitle: duplicate.taskTitle || duplicate.task_title || title },
    };
  }

  // --- Assigner info ---
  const delegatorId = userId;
  const delegatorName = currentUserName;

  // --- Create via existing model ---
  const taskData = {
    task_title: title,
    description: description,
    delegator_id: delegatorId,
    delegator_name: delegatorName,
    doer_id: doerId,
    doer_name: doerName,
    department: user.department || currentEmployee?.department || null,
    priority: priority,
    due_date: dueDate,
    status: 'Pending',
    category: 'Chatbot',
    tags: ['chatbot-created'],
    voice_note_url: null,
    reference_docs: null,
    evidence_required: false,
    checklist: [],
    repeat_settings: {},
    in_loop_ids: inLoopIds,
    group_id: null,
    parent_id: null,
    approval_status: 'PENDING',
  };

  const created = await Task.create(taskData);

  return {
    ok: true,
    taskId: created.id,
    summary: {
      title: title,
      assignedTo: doerName,
      assignedBy: delegatorName,
      inLoop: inLoopNames.join(', '),
      dueDate: dueDate ? formatFriendly(dueDate) : 'Tomorrow',
      priority: priority,
      status: 'Pending',
    },
    slot: { lastEntity: 'task', lastCreatedTaskId: created.id, lastCreatedTaskTitle: title },
  };
};

// ── Helpers ──────────────────────────────────────────────

async function resolveCurrentEmployee(userId, user) {
  if (hasUserName(user)) return null;
  try {
    return await employeeAdapter.findById(userId);
  } catch {
    return null;
  }
}

function hasUserName(user) {
  return !!(user && (user.name || user.first_name || user.firstName || user.full_name || user.fullName));
}

function userName(user, employee = null) {
  const source = hasUserName(user) ? user : employee;
  if (!source) return 'Unknown';
  const explicit = source.name || source.full_name || source.fullName;
  const parts = explicit
    ? [explicit]
    : [source.first_name || source.firstName, source.last_name || source.lastName];
  return parts.filter(Boolean).join(' ').trim() || 'Unknown';
}

/**
 * Convert natural language date phrases to ISO date strings.
 * Handles: today, tomorrow, day-after-tomorrow, day names (monday-sunday),
 * "next week", "in X days", or raw ISO/dd-mm-yyyy dates.
 */
function resolveNaturalDate(raw) {
  if (!raw) {
    // Default: tomorrow
    return addDays(nowIST(), 1).toISOString();
  }

  const phrase = String(raw).trim().toLowerCase();
  const today = nowIST();

  if (phrase === 'today') return today.toISOString();
  if (phrase === 'tomorrow') return addDays(today, 1).toISOString();
  if (phrase === 'day after tomorrow') return addDays(today, 2).toISOString();

  // "in X days" / "after X days"
  const inDaysMatch = phrase.match(/^(?:in|after)\s+(\d+)\s+days?$/i);
  if (inDaysMatch) return addDays(today, parseInt(inDaysMatch[1], 10)).toISOString();

  // Day names: monday, tuesday, ... sunday
  const dayIdx = dayNames.indexOf(phrase);
  if (dayIdx !== -1) {
    const currentDay = today.getDay();
    let diff = dayIdx - currentDay;
    if (diff <= 0) diff += 7; // next occurrence
    return addDays(today, diff).toISOString();
  }

  // "next week" → next Monday
  if (phrase === 'next week') {
    const currentDay = today.getDay();
    const diff = ((1 - currentDay) + 7) % 7 || 7;
    return addDays(today, diff).toISOString();
  }

  // Try parsing as a real date (ISO or common formats)
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  // Fallback: tomorrow
  return addDays(today, 1).toISOString();
}

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function formatFriendly(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function findSimilarExistingTask({ title, description, doerId, dueDate, priority, inLoopIds = [] }) {
  if (!doerId || !dueDate) return null;

  const candidates = await Task.findMyTasks(doerId);
  const dueKeys = dateTimeKeys(dueDate);
  const loopKey = idSetKey(inLoopIds);
  const priorityKey = normalizeText(priority || 'Medium');
  const activeCandidates = (candidates || []).filter((task) => {
    if (!task || String(task.status || '').toLowerCase() === 'cancelled') return false;
    if (Number(task.doerId || task.doer_id) !== Number(doerId)) return false;
    if (!hasAnySharedKey(dateTimeKeys(task.dueDate || task.due_date), dueKeys)) return false;
    if (normalizeText(task.priority || 'Medium') !== priorityKey) return false;
    if (idSetKey(task.inLoopIds || task.in_loop_ids || []) !== loopKey) return false;
    return true;
  });

  let best = null;
  for (const task of activeCandidates) {
    const taskTitle = task.taskTitle || task.task_title || '';
    const taskDescription = task.description || taskTitle;
    const titleScore = similarity(normalizeWorkText(title), normalizeWorkText(taskTitle));
    const meaningScore = similarity(normalizeWorkText(description || title), normalizeWorkText(taskDescription));
    const tokenScore = tokenOverlap(title, taskTitle);
    const score = Math.max(titleScore, meaningScore, tokenScore);

    if (!best || score > best.score) best = { task, score };
  }

  return best && best.score >= 0.6 ? best.task : null;
}

async function buildExistingTaskSummary(task) {
  const loopIds = Array.isArray(task.inLoopIds || task.in_loop_ids) ? (task.inLoopIds || task.in_loop_ids) : [];
  const employees = loopIds.length ? await employeeAdapter.findByIds(loopIds).catch(() => []) : [];
  const loopNames = employees.map((employee) => employee.name).filter(Boolean).join(', ');
  const dueDate = task.dueDate || task.due_date || null;

  return {
    title: task.taskTitle || task.task_title || 'Untitled',
    assignedTo: task.doerName || task.doer_name || userNameFromParts(task.doerFirstName, task.doerLastName),
    inLoop: loopNames,
    dueDate: formatDDMMYYYY(dueDate),
    dueTime: hasMeaningfulTime(dueDate) ? formatTime12(dueDate) : '',
    priority: task.priority || 'Medium',
    status: normalizeStatus(task.status),
  };
}

function normalizeWorkText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(task|please|kindly|need to|have to|must|should|the|a|an|for|to|by|on|at|before|today|tomorrow|morning|evening|afternoon|night)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlap(a, b) {
  const left = new Set(normalizeWorkText(a).split(/\s+/).filter((token) => token.length > 2));
  const right = new Set(normalizeWorkText(b).split(/\s+/).filter((token) => token.length > 2));
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / Math.max(left.size, right.size);
}

function dateTimeKeys(value) {
  const keys = new Set();
  const text = String(value || '');
  const directDateTime = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (directDateTime) keys.add(`${directDateTime[1]} ${directDateTime[2]}:${directDateTime[3]}`);

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return keys;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  keys.add(`${yyyy}-${mm}-${dd} ${hh}:${min}`);

  const utcYyyy = d.getUTCFullYear();
  const utcMm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const utcDd = String(d.getUTCDate()).padStart(2, '0');
  const utcHh = String(d.getUTCHours()).padStart(2, '0');
  const utcMin = String(d.getUTCMinutes()).padStart(2, '0');
  keys.add(`${utcYyyy}-${utcMm}-${utcDd} ${utcHh}:${utcMin}`);

  return keys;
}

function hasAnySharedKey(left, right) {
  for (const key of left || []) {
    if (right?.has(key)) return true;
  }
  return false;
}

function idSetKey(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => Number(id))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .join(',');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'in progress' || s === 'in-progress') return 'In Progress';
  if (s === 'completed' || s === 'complete') return 'Completed';
  if (s === 'hold' || s === 'on hold') return 'Hold';
  return 'Pending';
}

function userNameFromParts(first, last) {
  return [first, last].filter(Boolean).join(' ').trim() || null;
}

function resolveNaturalDate(raw) {
  if (!raw) {
    return formatLocalDateTimeForDb(atTime(addDays(nowIST(), 1), 0, 0));
  }

  const phrase = String(raw).trim().toLowerCase();
  const today = nowIST();
  const timeHint = extractTimeHint(phrase);
  const datePhrase = timeHint ? timeHint.remaining : phrase;
  const withTime = (date) => {
    if (!timeHint) return formatLocalDateTimeForDb(atTime(date, 0, 0));
    return formatLocalDateTimeForDb(atTime(date, timeHint.hour, timeHint.minute));
  };

  if (datePhrase === 'today') return withTime(today);
  if (datePhrase === 'tomorrow') return withTime(addDays(today, 1));
  if (datePhrase === 'day after tomorrow') return withTime(addDays(today, 2));

  const inDaysMatch = datePhrase.match(/^(?:in|after)\s+(\d+)\s+days?$/i);
  if (inDaysMatch) return withTime(addDays(today, parseInt(inDaysMatch[1], 10)));

  const dayIdx = dayNames.indexOf(datePhrase);
  if (dayIdx !== -1) {
    const currentDay = today.getDay();
    let diff = dayIdx - currentDay;
    if (diff <= 0) diff += 7;
    return withTime(addDays(today, diff));
  }

  if (datePhrase === 'next week') {
    const currentDay = today.getDay();
    const diff = ((1 - currentDay) + 7) % 7 || 7;
    return withTime(addDays(today, diff));
  }

  const dayMonth = parseDayMonthDate(datePhrase, today);
  if (dayMonth) return withTime(dayMonth);

  const isoDateOnly = parseIsoDateOnly(datePhrase, today);
  if (isoDateOnly) return withTime(isoDateOnly);

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    if (timeHint) return withTime(parsed);
    return formatLocalDateTimeForDb(parsed);
  }

  return withTime(addDays(today, 1));
}

function parseIsoDateOnly(phrase, baseDate) {
  const match = String(phrase || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;

  const date = new Date(baseDate);
  date.setFullYear(year, month, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDayMonthDate(phrase, baseDate) {
  const match = String(phrase || '').match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)(?:\s+(\d{4}))?$/i);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = MONTH_INDEX[match[2].toLowerCase()];
  const year = match[3] ? parseInt(match[3], 10) : baseDate.getFullYear();
  if (!Number.isInteger(day) || month == null || !Number.isInteger(year)) return null;

  const date = new Date(baseDate);
  date.setFullYear(year, month, day);
  date.setHours(0, 0, 0, 0);

  if (!match[3] && date < startOfToday(baseDate)) {
    date.setFullYear(year + 1);
  }

  return date;
}

const MONTH_INDEX = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function startOfToday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function extractTimeHint(phrase) {
  if (!phrase) return null;

  const namedTimes = [
    { pattern: /\bearly\s+morning\b|\bmorning\b/, hour: 7, minute: 0 },
    { pattern: /\bafternoon\b/, hour: 13, minute: 0 },
    { pattern: /\bevening\b/, hour: 18, minute: 0 },
    { pattern: /\bnight\b|\btonight\b/, hour: 21, minute: 0 },
    { pattern: /\bnoon\b/, hour: 12, minute: 0 },
    { pattern: /\bmidnight\b/, hour: 0, minute: 0 },
  ];

  for (const item of namedTimes) {
    if (item.pattern.test(phrase)) {
      return {
        hour: item.hour,
        minute: item.minute,
        remaining: cleanupDatePhrase(phrase.replace(item.pattern, ' ')),
      };
    }
  }

  const explicit = phrase.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (explicit) {
    let hour = parseInt(explicit[1], 10);
    const minute = explicit[2] ? parseInt(explicit[2], 10) : 0;
    const suffix = explicit[3].toLowerCase();
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    return {
      hour,
      minute,
      remaining: cleanupDatePhrase(phrase.replace(explicit[0], ' ')),
    };
  }

  return null;
}

function cleanupDatePhrase(phrase) {
  return String(phrase || '')
    .replace(/\bdue\b|\bby\b|\bon\b|\bat\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatFriendly(isoDate) {
  return formatDDMMYYYYWithOptionalTime(isoDate) || '';
}
