const { pool } = require('../../../../config/db.config');
const { Task } = require('../../../../models/task.model');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');
const logger = require('../../utils/logger');

const schema = {
  taskTitle: { type: 'string', max: 200 }
};

/**
 * deleteTask handler
 *
 * Soft deletes the target task from the tasks table.
 *
 * Resolution order for the target task:
 *  1. taskTitle provided → fuzzy-match against ALL tasks visible to this user
 *  2. taskTitle omitted  → use ctx.slots.lastCreatedTaskId (most recent task
 *                          created or updated in this session) as a fallback
 */
module.exports = async function deleteTask(args, user, ctx) {
  const log = logger.child({ tool: 'deleteTask' });

  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { taskTitle } = v.value;

  // ── 1. Find the target task ──────────────────────────────────────────────
  let targetTask = null;

  if (taskTitle) {
    const { rows: allTasks } = await pool.query(
      `SELECT id, task_title, doer_id, delegator_id
         FROM tasks
        WHERE deleted_at IS NULL
          AND (delegator_id = $1 OR doer_id = $1)
        ORDER BY created_at DESC`,
      [userId]
    );

    const match = bestMatch(
      taskTitle,
      allTasks,
      (t) => t.task_title || '',
      0.45
    );
    if (match) targetTask = match.item;
  }

  // Fallback: last task created or touched in this session
  if (!targetTask && ctx?.slots?.lastCreatedTaskId) {
    const found = await Task.findById(ctx.slots.lastCreatedTaskId);
    if (found) {
      targetTask = {
        id: found.id,
        task_title: found.taskTitle || found.task_title
      };
    }
  }

  if (!targetTask) {
    return {
      ok: false,
      notFound: true,
      message: taskTitle
        ? `Task not found. Please mention the exact task name.`
        : `No target task context found to delete. Please mention the task name.`,
    };
  }

  // ── 2. Perform Soft Delete ───────────────────────────────────────────────
  log.info('deleteTask — soft deleting task', { taskId: targetTask.id, taskTitle: targetTask.task_title });
  
  await Task.softDelete(targetTask.id, userId);

  return {
    ok: true,
    taskId: targetTask.id,
    taskTitle: targetTask.task_title,
    message: 'Task deleted successfully.',
    slot: {
      lastEntity: 'task',
      // Clear out the last created task ID so we don't accidentally refer to a deleted task
      lastCreatedTaskId: null,
      lastCreatedTaskTitle: null
    }
  };
};
