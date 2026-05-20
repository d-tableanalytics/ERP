const db = require('../../../../config/db.config');
const employeeAdapter = require('../../adapters/employeeAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const {
  addDays,
  atTime,
  formatDDMMYYYYWithOptionalTime,
  formatLocalDateTimeForDb,
  nowIST,
} = require('../../utils/time');

const schema = {
  question: { type: 'string', required: true, max: 500 },
  assignee: { type: 'string', max: 100 },
  doer: { type: 'string', max: 100 },
  priority: { type: 'string', enum: ['low', 'medium', 'high', 'Low', 'Medium', 'High'] },
  department: { type: 'string', max: 100 },
  frequency: {
    type: 'string',
    enum: [
      'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom',
      'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom',
    ],
  },
  fromDate: { type: 'string', max: 50 },
  dueDate: { type: 'string', max: 50 },
  verificationRequired: { type: 'boolean' },
  verifier: { type: 'string', max: 100 },
  attachmentRequired: { type: 'boolean' },
};

module.exports = async function createChecklist(args, user) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const question = String(v.value.question || '').trim();
  if (!question) {
    return {
      ok: false,
      error: [
        'To create a checklist, please provide the required field:',
        'Question/Task',
      ].join('\n'),
    };
  }

  const priority = normalizeChoice(v.value.priority, 'medium');
  const frequency = normalizeChoice(v.value.frequency, 'daily');
  const department = v.value.department || user.department || null;
  const fromDateValue = resolveDateTime(v.value.fromDate) || nowIST();
  const dueDateValue = resolveDateTime(v.value.dueDate) || fromDateValue;
  const fromDate = formatLocalDateTimeForDb(fromDateValue);
  const dueDate = formatLocalDateTimeForDb(dueDateValue);

  const assignee = await resolveEmployee(v.value.assignee, user);
  const doer = await resolveEmployee(v.value.doer, user);
  const verifier = v.value.verificationRequired
    ? await resolveEmployee(v.value.verifier, null)
    : { id: null, name: null };

  if (v.value.verificationRequired && !verifier.id) {
    return { ok: false, error: 'Verifier not found. Please mention a valid verifier name.' };
  }

  const insertMaster = `
    INSERT INTO checklist_master (
      question, assignee_id, assignee_name, doer_id, doer_name, priority, department,
      verification_required, verifier_id, verifier_name, attachment_required,
      frequency, from_date, due_date, weekly_days, selected_dates
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`;
  const insertChecklist = `
    INSERT INTO checklist (
      master_id, question, assignee_id, assignee_name, doer_id, doer_name, priority, department,
      verification_required, verifier_id, verifier_name, attachment_required, frequency, due_date, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *`;

  const weeklyDays = frequency === 'weekly' ? [dayName(fromDateValue)] : [];
  const selectedDates = ['monthly', 'quarterly', 'yearly', 'custom'].includes(frequency)
    ? [dayOfMonth(fromDateValue)]
    : [];
  const values = [
    question,
    assignee.id,
    assignee.name,
    doer.id,
    doer.name,
    priority,
    department,
    !!v.value.verificationRequired,
    verifier.id,
    verifier.name,
    !!v.value.attachmentRequired,
    frequency,
    fromDate,
    dueDate,
    weeklyDays,
    selectedDates,
  ];

  const client = await db.pool.connect();
  let created;
  let visibleChecklist;
  try {
    await client.query('BEGIN');
    const masterResult = await client.query(insertMaster, values);
    created = masterResult.rows[0];

    const checklistValues = [
      created.id,
      question,
      assignee.id,
      assignee.name,
      doer.id,
      doer.name,
      priority,
      department,
      !!v.value.verificationRequired,
      verifier.id,
      verifier.name,
      !!v.value.attachmentRequired,
      frequency,
      dueDate,
      'Pending',
    ];
    const checklistResult = await client.query(insertChecklist, checklistValues);
    visibleChecklist = checklistResult.rows[0];
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    ok: true,
    checklistId: created.id,
    checklistTaskId: visibleChecklist?.id || null,
    summary: {
      question,
      assignee: assignee.name,
      doer: doer.name,
      priority,
      frequency,
      fromDate,
      fromDateFormatted: formatDDMMYYYYWithOptionalTime(fromDateValue),
      dueDate,
      dueDateFormatted: formatDDMMYYYYWithOptionalTime(dueDateValue),
      department,
      verificationRequired: !!v.value.verificationRequired,
      verifier: verifier.name,
      attachmentRequired: !!v.value.attachmentRequired,
    },
    slot: {
      lastEntity: 'checklist',
      selectedChecklistId: visibleChecklist?.id || created.id,
      selectedChecklistName: question,
    },
  };
};

async function resolveEmployee(name, fallbackUser) {
  if (name) {
    const matches = await employeeAdapter.search(name, { limit: 1 });
    if (matches.length) return { id: matches[0].id, name: matches[0].name };
  }
  if (!fallbackUser) return { id: null, name: null };
  const fallbackId = resolveUserId(fallbackUser);
  if (fallbackId) {
    const employee = await employeeAdapter.findById(fallbackId).catch(() => null);
    if (employee) return { id: employee.id, name: employee.name };
  }
  return { id: fallbackId, name: userName(fallbackUser) };
}

function userName(user) {
  const parts = [
    user?.first_name || user?.firstName || user?.First_Name || user?.name || user?.email,
    user?.last_name || user?.lastName || user?.Last_Name,
  ].filter(Boolean);
  return parts.join(' ').trim() || 'Unknown';
}

function normalizeChoice(value, fallback) {
  return String(value || fallback).trim().toLowerCase();
}

function resolveDateTime(raw) {
  if (!raw) return null;
  const phrase = String(raw).trim().toLowerCase();
  const base = nowIST();
  const day = /\btomorrow\b/.test(phrase) ? addDays(base, 1) : base;
  const explicitTime = parseTimePhrase(phrase);

  if (/\btoday\b|\btomorrow\b/.test(phrase)) {
    if (explicitTime) return atTime(day, explicitTime.hour, explicitTime.minute);
    if (/\bmorning\b/.test(phrase)) return atTime(day, 7, 0);
    if (/\bevening\b/.test(phrase)) return atTime(day, 18, 0);
    if (/\bafternoon\b/.test(phrase)) return atTime(day, 12, 0);
    if (/\bnight\b/.test(phrase)) return atTime(day, 21, 0);
    return day;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  if (explicitTime) return atTime(parsed, explicitTime.hour, explicitTime.minute);
  return parsed;
}

function parseTimePhrase(text) {
  const match = String(text || '').match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toLowerCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return { hour, minute };
}

function dayName(dateText) {
  return new Date(dateText).toLocaleDateString('en-US', { weekday: 'long' });
}

function dayOfMonth(dateText) {
  return new Date(dateText).getDate();
}
