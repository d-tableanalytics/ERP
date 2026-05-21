const { pool } = require('../../../../config/db.config');
const { Task } = require('../../../../models/task.model');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');
const employeeAdapter = require('../../adapters/employeeAdapter');
const logger = require('../../utils/logger');

const schema = {
  taskId: { type: 'integer' },
  taskTitle: { type: 'string', max: 200 },
  newTitle: { type: 'string', required: true, max: 200 },
};

module.exports = async function updateTaskTitle(args, user, ctx) {
  const log = logger.child({ tool: 'updateTaskTitle' });

  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { taskId, taskTitle, newTitle } = v.value;
  const cleanNewTitle = String(newTitle || '').trim();
  if (!cleanNewTitle) return { ok: false, error: 'New task title is required.' };

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
    const match = bestMatch(taskTitle, allTasks, (t) => t.task_title || '', 0.45);
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

  log.info('updateTaskTitle - before save', {
    taskId: targetTask.id,
    oldTitle: targetTask.task_title,
    newTitle: cleanNewTitle,
  });

  await Task.update(targetTask.id, { task_title: cleanNewTitle });
  const confirmed = await Task.findById(targetTask.id);

  const finalTitle = confirmed?.taskTitle || cleanNewTitle;
  const assignedTo = await resolveTaskPersonName('doer', confirmed, targetTask, user);
  const assignedBy = await resolveTaskPersonName('assigner', confirmed, targetTask, user);

  return {
    ok: true,
    taskId: targetTask.id,
    summary: {
      oldTitle: targetTask.task_title,
      title: finalTitle,
      assignedTo,
      assignedBy,
      dueDate: confirmed?.dueDate ? formatFriendly(confirmed.dueDate) : null,
      priority: confirmed?.priority || targetTask.priority,
      status: confirmed?.status || targetTask.status,
    },
    slot: {
      lastEntity: 'task',
      lastCreatedTaskId: targetTask.id,
      lastCreatedTaskTitle: finalTitle,
    },
  };
};

function formatFriendly(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
