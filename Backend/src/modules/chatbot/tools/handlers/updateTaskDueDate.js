const { pool } = require('../../../../config/db.config');
const { Task } = require('../../../../models/task.model');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');
const { nowIST, addDays, atTime, formatDDMMYYYYWithOptionalTime, formatLocalDateTimeForDb } = require('../../utils/time');
const employeeAdapter = require('../../adapters/employeeAdapter');
const logger = require('../../utils/logger');

const schema = {
  taskId: { type: 'integer' },
  taskTitle: { type: 'string', max: 200 },
  dueDate: { type: 'string', required: true, max: 80 },
};

module.exports = async function updateTaskDueDate(args, user, ctx) {
  const log = logger.child({ tool: 'updateTaskDueDate' });

  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { taskId, taskTitle, dueDate } = v.value;
  const resolvedDueDate = resolveDueDate(dueDate);
  if (!resolvedDueDate) return { ok: false, error: 'Please provide a valid due date.' };

  let targetTask = null;

  if (taskId) {
    const { rows } = await pool.query(
      `SELECT id, task_title, doer_id, doer_name, delegator_id, delegator_name,
              due_date, priority, status, in_loop_ids
         FROM tasks
        WHERE id = $1
          AND deleted_at IS NULL
          AND (delegator_id = $2 OR doer_id = $2 OR $2 = ANY(in_loop_ids))`,
      [taskId, userId]
    );
    targetTask = rows[0] || null;
  }

  if (!targetTask && taskTitle) {
    const { rows: allTasks } = await pool.query(
      `SELECT id, task_title, doer_id, doer_name, delegator_id, delegator_name,
              due_date, priority, status, in_loop_ids
         FROM tasks
        WHERE deleted_at IS NULL
          AND (delegator_id = $1 OR doer_id = $1 OR $1 = ANY(in_loop_ids))
        ORDER BY created_at DESC`,
      [userId]
    );
    const targetKey = normalizeText(taskTitle);
    const exact = allTasks.find((task) => normalizeText(task.task_title || '') === targetKey);
    if (exact) targetTask = exact;

    const wordCount = targetKey.split(/\s+/).filter(Boolean).length;
    const match = !targetTask && wordCount > 1
      ? bestMatch(taskTitle, allTasks, (t) => t.task_title || '', 0.55)
      : null;
    if (match) targetTask = match.item;
  }

  if (!targetTask && ctx?.slots?.lastCreatedTaskId) {
    const found = await Task.findById(ctx.slots.lastCreatedTaskId);
    if (found) {
      targetTask = {
        id: found.id,
        task_title: found.taskTitle,
        doer_id: found.doerId,
        doer_name: found.doerName,
        delegator_id: found.assignerId,
        delegator_name: found.assignerName,
        due_date: found.dueDate,
        priority: found.priority,
        status: found.status,
      };
    }
  }

  if (!targetTask) {
    return {
      ok: false,
      notFound: true,
      message: taskTitle
        ? 'Task not found. Please mention the exact task name.'
        : 'No recent task found. Please mention the task name.',
    };
  }

  log.info('updateTaskDueDate - before save', {
    taskId: targetTask.id,
    oldDueDate: targetTask.due_date,
    newDueDate: resolvedDueDate,
  });

  await Task.update(targetTask.id, { due_date: resolvedDueDate });
  const confirmed = await Task.findById(targetTask.id);

  const finalDueDate = confirmed?.dueDate || resolvedDueDate;
  const assignedTo = await resolveTaskPersonName('doer', confirmed, targetTask, user);
  const assignedBy = await resolveTaskPersonName('assigner', confirmed, targetTask, user);

  return {
    ok: true,
    taskId: targetTask.id,
    summary: {
      title: confirmed?.taskTitle || targetTask.task_title,
      assignedTo,
      assignedBy,
      oldDueDate: formatDDMMYYYYWithOptionalTime(targetTask.due_date),
      dueDate: formatDDMMYYYYWithOptionalTime(finalDueDate),
      priority: confirmed?.priority || targetTask.priority,
      status: confirmed?.status || targetTask.status,
    },
    slot: {
      lastEntity: 'task',
      lastCreatedTaskId: targetTask.id,
      lastCreatedTaskTitle: confirmed?.taskTitle || targetTask.task_title,
    },
  };
};

function resolveDueDate(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  const lower = text.toLowerCase();
  const today = nowIST();
  const timeHint = extractTimeHint(lower);
  const dateText = timeHint ? timeHint.remaining : lower;
  const withTime = (date) => formatLocalDateTimeForDb(atTime(date, timeHint?.hour || 0, timeHint?.minute || 0));

  if (dateText === 'today') return withTime(today);
  if (dateText === 'tomorrow') return withTime(addDays(today, 1));
  if (dateText === 'day after tomorrow') return withTime(addDays(today, 2));

  const dmy = dateText.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = dmy[3] ? Number(dmy[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    return withTime(new Date(year, month - 1, day));
  }

  const monthName = dateText.match(/^(\d{1,2})\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)(?:\s+(\d{2,4}))?$/i);
  if (monthName) {
    const day = Number(monthName[1]);
    const month = monthNameToIndex(monthName[2]);
    let year = monthName[3] ? Number(monthName[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    return withTime(new Date(year, month, day));
  }

  const ymd = dateText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    return withTime(new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return formatLocalDateTimeForDb(parsed);

  return null;
}

function extractTimeHint(text) {
  if (/^\d{4}-\d{1,2}-\d{1,2}\b/.test(text)) return null;
  if (/^\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(text)) return null;

  const explicitMatch = text.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)\b/i)
    || text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  const match = explicitMatch || text.match(/\b(\d{1,2})(?::(\d{2}))?\b/);
  if (!match) return null;
  const token = match[0];

  let hour = Number(match[1]);
  const minute = match[2] && /^\d{2}$/.test(match[2]) ? Number(match[2]) : 0;
  const suffix = (match[3] || (match[2] && /^(am|pm)$/i.test(match[2]) ? match[2] : '')).toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;

  return {
    hour,
    minute,
    remaining: text.replace(token, '').replace(/\bat\b/g, '').replace(/\s+/g, ' ').trim(),
  };
}

function monthNameToIndex(value = '') {
  const key = value.slice(0, 3).toLowerCase();
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(key);
}

async function resolveTaskPersonName(role, confirmed, targetTask, user) {
  const id = role === 'assigner'
    ? (confirmed?.assignerId ?? targetTask?.delegator_id)
    : (confirmed?.doerId ?? targetTask?.doer_id);
  const fromTask = taskPersonName(confirmed, role)
    || cleanPersonName(role === 'assigner' ? targetTask?.delegator_name : targetTask?.doer_name);

  if (fromTask) return fromTask;
  if (id) {
    const employee = await employeeAdapter.findById(id).catch(() => null);
    if (employee?.name) return cleanPersonName(employee.name);
  }
  return role === 'assigner' ? cleanPersonName(userName(user)) : null;
}

function taskPersonName(task, role) {
  if (!task) return null;
  const direct = role === 'assigner' ? task.assignerName : task.doerName;
  const first = role === 'assigner' ? task.assignerFirstName : task.doerFirstName;
  const last = role === 'assigner' ? task.assignerLastName : task.doerLastName;
  return cleanPersonName([first, last].filter(Boolean).join(' ')) || cleanPersonName(direct);
}

function cleanPersonName(value) {
  if (!value || typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || /^unknown$/i.test(text)) return null;
  return text;
}

function userName(user) {
  if (!user) return '';
  return [
    user.first_name || user.firstName || user.First_Name || user.name || user.email,
    user.last_name || user.lastName || user.Last_Name,
  ].filter(Boolean).join(' ');
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
