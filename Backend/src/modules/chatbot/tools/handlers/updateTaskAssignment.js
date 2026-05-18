const { pool } = require('../../../../config/db.config');
const { Task } = require('../../../../models/task.model');
const employeeAdapter = require('../../adapters/employeeAdapter');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');
const logger = require('../../utils/logger');

const schema = {
  taskTitle:  { type: 'string', max: 200 },
  assignedTo: { type: 'string', max: 100 },
  loopUsers:  { type: 'array' },
};

/**
 * updateTaskAssignment handler
 *
 * Handles follow-up prompts that want to REASSIGN an existing task to a
 * different employee, optionally while also adding loop/watcher users.
 *
 * This is the correct tool when the message contains:
 *   "assign to X", "reassign to X", "give to X", "change assignee to X"
 *   optionally combined with "keep in loop", "cc", "notify" etc.
 *
 * Fields updated in DB:
 *   doer_id    → new assignee's user_id
 *   doer_name  → new assignee's display name
 *   in_loop_ids → merged with new loop user IDs (no duplicates)
 *
 * Fields NEVER touched:
 *   delegator_id / delegator_name, status, due_date, priority, title
 *
 * Task resolution order:
 *   1. taskTitle provided → fuzzy-match tasks visible to current user
 *   2. taskTitle omitted  → ctx.slots.lastCreatedTaskId (last task in session)
 */
module.exports = async function updateTaskAssignment(args, user, ctx) {
  const log = logger.child({ tool: 'updateTaskAssignment' });

  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { taskTitle, assignedTo, loopUsers } = v.value;

  if (!assignedTo && (!loopUsers || loopUsers.length === 0)) {
    return { ok: false, error: 'Provide at least assignedTo or loopUsers to update.' };
  }

  // ── 1. Find the target task ──────────────────────────────────────────────

  let targetTask = null;

  if (taskTitle) {
    const { rows: allTasks } = await pool.query(
      `SELECT id, task_title, doer_id, doer_name, delegator_id, delegator_name,
              due_date, priority, status, in_loop_ids
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

  // Fallback: use the last task created / touched in this session
  if (!targetTask && ctx?.slots?.lastCreatedTaskId) {
    const found = await Task.findById(ctx.slots.lastCreatedTaskId);
    if (found) {
      // found comes from BASE_QUERY (camelCase). Normalise to snake_case for
      // consistency with the raw query result above.
      targetTask = {
        id:             found.id,
        task_title:     found.taskTitle,
        doer_id:        found.doerId,
        doer_name:      found.doerName,
        delegator_id:   found.assignerId,
        delegator_name: found.assignerName,
        due_date:       found.dueDate,
        priority:       found.priority,
        status:         found.status,
        in_loop_ids:    found.inLoopIds,
      };
    }
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

  // ── 2. Resolve new assignee ───────────────────────────────────────────────

  let newDoerId   = null;
  let newDoerName = null;

  if (assignedTo) {
    try {
      const matches = await employeeAdapter.search(assignedTo, { limit: 1 });
      if (matches.length > 0) {
        newDoerId   = matches[0].id;
        newDoerName = matches[0].name;
      } else {
        return { ok: false, error: `Employee "${assignedTo}" not found.` };
      }
    } catch {
      return { ok: false, error: `Employee lookup failed for "${assignedTo}".` };
    }
  }

  // ── 3. Resolve loop users ─────────────────────────────────────────────────

  const addedLoopNames = [];
  const addedLoopIds   = [];

  for (const rawName of (loopUsers || [])) {
    if (!rawName) continue;
    try {
      const matches = await employeeAdapter.search(rawName, { limit: 1 });
      if (matches.length > 0) {
        addedLoopIds.push(matches[0].id);
        addedLoopNames.push(matches[0].name);
      }
    } catch { /* skip */ }
  }

  // ── 4. Merge loop IDs (no duplicates) ─────────────────────────────────────

  const existingLoopIds = Array.isArray(targetTask.in_loop_ids)
    ? targetTask.in_loop_ids
    : [];
  const existingSet = new Set(existingLoopIds.map(Number));
  const newLoopIds  = [...existingLoopIds, ...addedLoopIds.filter(id => !existingSet.has(Number(id)))];

  // ── 5. Build update payload & validate before save ────────────────────────

  const updateData = {};

  if (newDoerId) {
    updateData.doer_id   = newDoerId;
    updateData.doer_name = newDoerName;
  }

  if (newLoopIds.length > 0 || addedLoopIds.length > 0) {
    updateData.in_loop_ids = newLoopIds;
  }

  console.log(`[Validation] Before save:`);
  console.log(`assignedTo = ${newDoerId ? newDoerId : 'unchanged'}`);
  console.log(`loopUsers = [${addedLoopIds.join(', ')}]`);

  log.info('updateTaskAssignment — before save', {
    taskId:       targetTask.id,
    taskTitle:    targetTask.task_title,
    assignedTo:   newDoerId   ? `${newDoerName} (id=${newDoerId})` : '(unchanged)',
    loopUsers:    addedLoopNames.length ? addedLoopNames.join(', ') : '(none)',
    newLoopIds,
  });

  // ── 6. Persist ────────────────────────────────────────────────────────────

  await Task.update(targetTask.id, updateData);

  // ── 7. Confirm saved values ───────────────────────────────────────────────

  const confirmed = await Task.findById(targetTask.id);

  console.log(`[Validation] After save:`);
  console.log(`confirm task.assignedTo is ${confirmed ? confirmed.doerName : 'not found'} (id = ${confirmed ? confirmed.doerId : 'not found'})`);

  log.info('updateTaskAssignment — after save', {
    taskId:     confirmed?.id,
    doerId:     confirmed?.doerId,
    doerName:   confirmed?.doerName,
    inLoopIds:  confirmed?.inLoopIds,
  });

  // ── 8. Build full loop name list for response ─────────────────────────────

  const allLoopNames = [];
  const allLoopIds   = Array.isArray(confirmed?.inLoopIds) ? confirmed.inLoopIds : newLoopIds;
  for (const lid of allLoopIds) {
    try {
      const emp = await employeeAdapter.findById(lid);
      if (emp) allLoopNames.push(emp.name);
    } catch { /* skip */ }
  }

  const finalTitle      = confirmed?.taskTitle  || targetTask.task_title;
  const finalAssignedTo = confirmed?.doerName   || newDoerName || targetTask.doer_name;
  const finalDueDate    = confirmed?.dueDate     || targetTask.due_date;

  return {
    ok: true,
    taskId: targetTask.id,
    summary: {
      title:      finalTitle,
      assignedTo: finalAssignedTo,
      inLoop:     allLoopNames.join(', ') || '—',
      dueDate:    finalDueDate ? formatFriendly(finalDueDate) : null,
    },
    slot: {
      lastEntity:           'task',
      lastCreatedTaskId:    targetTask.id,
      lastCreatedTaskTitle: finalTitle,
    },
  };
};

// ── Helpers ───────────────────────────────────────────────────────────────

function formatFriendly(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
