const { Task } = require('../../../../models/task.model');
const employeeAdapter = require('../../adapters/employeeAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { nowIST, addDays, atTime, formatDDMMYYYYWithOptionalTime, formatLocalDateTimeForDb } = require('../../utils/time');

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

  const title = v.value.title;
  const description = v.value.description || title;
  const priority = v.value.priority || 'Medium';
  const rawDueDate = v.value.dueDate || null;
  const rawAssignee = v.value.assignedTo || null;

  // --- Resolve assignee ---
  let doerId = userId;    // default: self
  let doerName = userName(user);

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

  // --- Assigner info ---
  const delegatorId = userId;
  const delegatorName = userName(user);

  // --- Create via existing model ---
  const taskData = {
    task_title: title,
    description: description,
    delegator_id: delegatorId,
    delegator_name: delegatorName,
    doer_id: doerId,
    doer_name: doerName,
    department: user.department || null,
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
      inLoop: inLoopNames.join(', '),
      dueDate: dueDate ? formatFriendly(dueDate) : 'Tomorrow',
      priority: priority,
      status: 'Pending',
    },
    slot: { lastEntity: 'task', lastCreatedTaskId: created.id, lastCreatedTaskTitle: title },
  };
};

// ── Helpers ──────────────────────────────────────────────

function userName(user) {
  if (!user) return 'Unknown';
  const parts = [user.first_name || user.name, user.last_name].filter(Boolean);
  return parts.join(' ') || 'Unknown';
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

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    if (timeHint) return withTime(parsed);
    return formatLocalDateTimeForDb(parsed);
  }

  return withTime(addDays(today, 1));
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
