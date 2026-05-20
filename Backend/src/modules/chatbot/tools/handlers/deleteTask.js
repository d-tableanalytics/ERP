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
  let suggestions = [];

  if (taskTitle) {
    const { rows: allTasks } = await pool.query(
      `SELECT id, task_title, doer_id, delegator_id
         FROM tasks
        WHERE deleted_at IS NULL
          AND (delegator_id = $1 OR doer_id = $1)
        ORDER BY created_at DESC`,
      [userId]
    );

    const cleanedTitle = cleanDeleteTitle(taskTitle);
    const match = bestTaskTitleMatch(cleanedTitle, allTasks);
    if (match) targetTask = match.item;
    else suggestions = suggestTaskTitles(cleanedTitle, allTasks);
  }

  // Fallback: last task created or touched in this session
  if (!targetTask && !taskTitle && ctx?.slots?.lastCreatedTaskId) {
    const found = await Task.findById(ctx.slots.lastCreatedTaskId);
    if (found) {
      targetTask = {
        id: found.id,
        task_title: found.taskTitle || found.task_title
      };
    }
  }

  if (!targetTask) {
    const suggestionText = suggestions.length
      ? ` Did you mean: ${suggestions.map((title) => `"${title}"`).join(', ')}?`
      : '';
    return {
      ok: false,
      notFound: true,
      message: taskTitle
        ? `Task not found. Please mention the exact task name.${suggestionText}`
        : `No target task context found to delete. Please mention the task name.`,
      suggestions,
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

function bestTaskTitleMatch(query, tasks) {
  if (!query || !Array.isArray(tasks) || tasks.length === 0) return null;

  const direct = bestMatch(query, tasks, (t) => t.task_title || '', 0.45);
  if (direct) return direct;

  const normalizedQuery = normalizeTitleForMatch(query);
  const normalizedTasks = tasks.map((task) => ({
    ...task,
    _normalizedTitle: normalizeTitleForMatch(task.task_title || ''),
  }));
  return bestMatch(normalizedQuery, normalizedTasks, (t) => t._normalizedTitle, 0.45);
}

function cleanDeleteTitle(title) {
  return String(title || '')
    .replace(/^\s*(i\s+want\s+to\s+)?(delete|remove|cancel)\s+/i, '')
    .replace(/^\s*(the\s+)?task\s+(name\s+is\s+|called\s+|titled\s+)?/i, '')
    .replace(/\s+task\s*$/i, '')
    .trim();
}

function normalizeTitleForMatch(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(task|the|a|an|please|delete|remove|cancel|called|named|title|name|is)\b/g, ' ')
    .replace(/\bqueries\b/g, 'query')
    .replace(/\busers\b/g, 'user')
    .replace(/\s+/g, ' ')
    .trim();
}

function suggestTaskTitles(query, tasks, limit = 3) {
  const normalizedQuery = normalizeTitleForMatch(query);
  const queryTokens = new Set(normalizedQuery.split(' ').filter((token) => token.length > 2));
  if (!queryTokens.size) return [];

  return (tasks || [])
    .map((task) => {
      const title = task.task_title || '';
      const normalizedTitle = normalizeTitleForMatch(title);
      const titleTokens = new Set(normalizedTitle.split(' ').filter((token) => token.length > 2));
      const overlap = [...queryTokens].filter((token) => titleTokens.has(token)).length;
      const score = overlap / Math.max(1, queryTokens.size);
      return { title, score };
    })
    .filter((item) => item.title && item.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map((item) => item.title);
}
