const { pool } = require('../../../../config/db.config');
const { Task } = require('../../../../models/task.model');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');
const { formatDDMMYYYYWithOptionalTime } = require('../../utils/time');

const schema = {
  taskId: { type: 'integer' },
  taskTitle: { type: 'string', max: 200 },
  priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
};

module.exports = async function updateTaskPriority(args, user, ctx) {
  const normalizedArgs = {
    ...(args || {}),
    priority: normalizePriority(args?.priority),
  };
  const v = validate(normalizedArgs, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { taskId, taskTitle, priority } = v.value;
  if (!priority) return { ok: false, error: 'Priority is required.' };

  const targetTask = await findTask({ userId, taskId, taskTitle, ctx });
  if (!targetTask) {
    return {
      ok: false,
      notFound: true,
      message: taskTitle
        ? 'Task not found. Please mention the exact task name.'
        : 'No recent task found. Please mention the task name.',
    };
  }

  const previousPriority = targetTask.priority || 'Medium';
  await Task.update(targetTask.id, { priority });
  const confirmed = await Task.findById(targetTask.id);

  const title = confirmed?.taskTitle || targetTask.task_title || taskTitle || 'Task';
  return {
    ok: true,
    taskId: targetTask.id,
    summary: {
      title,
      previousPriority,
      priority,
      dueDate: formatDDMMYYYYWithOptionalTime(confirmed?.dueDate || targetTask.due_date),
      assignedTo: taskPersonName(confirmed, 'doer') || targetTask.doer_name || targetTask.doerName,
      assignedBy: taskPersonName(confirmed, 'assigner') || targetTask.delegator_name || targetTask.assignerName,
      status: confirmed?.status || targetTask.status,
    },
    slot: {
      lastEntity: 'task',
      lastCreatedTaskId: targetTask.id,
      lastCreatedTaskTitle: title,
    },
  };
};

async function findTask({ userId, taskId, taskTitle, ctx }) {
  if (taskId) {
    const { rows } = await pool.query(
      `SELECT id, task_title, doer_name, delegator_name, due_date, priority, status
         FROM tasks
        WHERE id = $1
          AND deleted_at IS NULL
          AND (delegator_id = $2 OR doer_id = $2 OR $2 = ANY(in_loop_ids))`,
      [taskId, userId]
    );
    return rows[0] || null;
  }

  if (taskTitle) {
    const { rows } = await pool.query(
      `SELECT id, task_title, doer_name, delegator_name, due_date, priority, status
         FROM tasks
        WHERE deleted_at IS NULL
          AND (delegator_id = $1 OR doer_id = $1 OR $1 = ANY(in_loop_ids))
        ORDER BY created_at DESC`,
      [userId]
    );
    const targetKey = normalizeText(taskTitle);
    const exact = rows.find((task) => normalizeText(task.task_title || '') === targetKey);
    if (exact) return exact;

    const wordCount = targetKey.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 1) return null;

    const match = bestMatch(taskTitle, rows, (task) => task.task_title || '', 0.55);
    return match?.item || null;
  }

  if (ctx?.slots?.lastCreatedTaskId) {
    const found = await Task.findById(ctx.slots.lastCreatedTaskId);
    if (found) {
      return {
        id: found.id,
        task_title: found.taskTitle,
        doer_name: found.doerName,
        delegator_name: found.assignerName,
        due_date: found.dueDate,
        priority: found.priority,
        status: found.status,
      };
    }
  }

  return null;
}

function normalizePriority(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'high' || text === 'hight' || text === 'urgent' || text === 'important') return 'High';
  if (text === 'medium' || text === 'normal') return 'Medium';
  if (text === 'low') return 'Low';
  return value;
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function taskPersonName(task, role) {
  if (!task) return null;
  const direct = role === 'assigner' ? task.assignerName : task.doerName;
  const first = role === 'assigner' ? task.assignerFirstName : task.doerFirstName;
  const last = role === 'assigner' ? task.assignerLastName : task.doerLastName;
  return [first, last].filter(Boolean).join(' ').trim() || direct || null;
}
