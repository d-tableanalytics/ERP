const { pool } = require('../../../../config/db.config');
const { Task } = require('../../../../models/task.model');
const employeeAdapter = require('../../adapters/employeeAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');

const schema = {
  taskTitle: { type: 'string', max: 200 },
  loopUsers: { type: 'array' },
};

/**
 * updateTaskLoopUsers handler
 *
 * Detects "keep in loop / add watcher / cc / notify" intent and UPDATES an
 * existing task's in_loop_ids field. It never creates a new task and never
 * changes assignedTo / status / due date.
 *
 * Resolution order for the target task:
 *  1. taskTitle provided  → fuzzy-match against ALL tasks visible to this user
 *  2. taskTitle omitted   → use ctx.slots.lastCreatedTaskId (most recent task
 *                           created in this session) as a fallback
 *
 * Duplicate-safe: existing IDs are preserved; new IDs are appended only if not
 * already present.
 */
module.exports = async function updateTaskLoopUsers(args, user, ctx) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { taskTitle, loopUsers } = v.value;

  if (!loopUsers || loopUsers.length === 0) {
    return { ok: false, error: 'No loop users specified.' };
  }

  // ── 1. Find the target task ──────────────────────────────────────────────

  let targetTask = null;

  if (taskTitle) {
    // Search all tasks where the current user is delegator OR doer so they can
    // manage loop users on tasks they created or are assigned to.
    const { rows: allTasks } = await pool.query(
      `SELECT id, task_title, doer_id, doer_name, delegator_id, delegator_name,
              due_date, priority, status, in_loop_ids
         FROM tasks
        WHERE deleted_at IS NULL
          AND (delegator_id = $1 OR doer_id = $1)
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

  // Fallback: last task created in this session
  if (!targetTask && ctx?.slots?.lastCreatedTaskId) {
    const found = await Task.findById(ctx.slots.lastCreatedTaskId);
    if (found) targetTask = found;
  }

  if (!targetTask) {
    return {
      ok: false,
      notFound: true,
      message: taskTitle
        ? `Task not found. Please mention the exact task name.`
        : `No recent task found. Please mention the task name.`,
    };
  }

  // ── 2. Resolve loop user names → IDs ────────────────────────────────────

  const resolvedNames = [];
  const resolvedIds   = [];

  for (const rawName of loopUsers) {
    if (!rawName) continue;
    try {
      const matches = await employeeAdapter.search(rawName, { limit: 1 });
      if (matches.length > 0) {
        resolvedIds.push(matches[0].id);
        resolvedNames.push(matches[0].name);
      }
      // If not found, silently skip — don't abort the whole update
    } catch {
      // employee search failed — skip this user
    }
  }

  if (resolvedIds.length === 0) {
    return {
      ok: false,
      error: `Could not find any of the specified users: ${loopUsers.join(', ')}`,
    };
  }

  // ── 3. Merge IDs (no duplicates) ─────────────────────────────────────────

  // in_loop_ids is stored as a Postgres integer[] column; Task.findById returns
  // it as inLoopIds (camelCase alias from BASE_QUERY), while a raw pool query
  // returns it as in_loop_ids.
  const existing = Array.isArray(targetTask.inLoopIds)
    ? targetTask.inLoopIds
    : Array.isArray(targetTask.in_loop_ids)
      ? targetTask.in_loop_ids
      : [];

  const existingSet = new Set(existing.map(Number));
  const toAdd = resolvedIds.filter((id) => !existingSet.has(Number(id)));

  if (toAdd.length === 0) {
    // All users are already in the loop — still return success
    return {
      ok: true,
      alreadyInLoop: true,
      taskId: targetTask.id,
      summary: {
        title:      targetTask.task_title || targetTask.taskTitle,
        assignedTo: targetTask.doer_name  || targetTask.doerName,
        inLoop:     resolvedNames.join(', '),
        message:    `${resolvedNames.join(', ')} already in loop for this task.`,
      },
      slot: { lastEntity: 'task', lastCreatedTaskId: targetTask.id, lastCreatedTaskTitle: targetTask.task_title || targetTask.taskTitle },
    };
  }

  const updatedLoopIds = [...existing, ...toAdd];

  // ── 4. Persist ────────────────────────────────────────────────────────────

  await pool.query(
    `UPDATE tasks SET in_loop_ids = $1 WHERE id = $2`,
    [updatedLoopIds, targetTask.id]
  );

  // Fetch fresh to confirm and get all fields for the response
  const updated = await Task.findById(targetTask.id);

  // Build full in-loop name list from all current in_loop_ids
  const allLoopNames = [];
  const allLoopIds = Array.isArray(updated?.inLoopIds) ? updated.inLoopIds : updatedLoopIds;
  for (const lid of allLoopIds) {
    try {
      const emp = await employeeAdapter.findById(lid);
      if (emp) allLoopNames.push(emp.name);
    } catch { /* skip */ }
  }

  const title      = updated?.taskTitle  || targetTask.task_title || targetTask.taskTitle;
  const assignedTo = updated?.doerName   || targetTask.doer_name  || targetTask.doerName;
  const dueDate    = updated?.dueDate    || targetTask.due_date;

  return {
    ok: true,
    taskId: targetTask.id,
    summary: {
      title,
      assignedTo,
      inLoop:   allLoopNames.join(', '),
      dueDate:  dueDate ? formatFriendly(dueDate) : null,
      addedUsers: resolvedNames.join(', '),
    },
    slot: { lastEntity: 'task', lastCreatedTaskId: targetTask.id, lastCreatedTaskTitle: title },
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatFriendly(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
