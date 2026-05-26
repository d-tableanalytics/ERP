const { Task } = require('../../../../models/task.model');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');
const { formatDDMMYYYYWithOptionalTime } = require('../../utils/time');

const schema = {
  taskId: { type: 'integer' },
  taskIds: { type: 'array' },
  taskTitle: { type: 'string' },
  taskTitles: { type: 'array' },
  taskIndex: { type: 'integer' },
  taskIndexes: { type: 'array' },
  status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Hold'] },
  relativeReference: { type: 'string', enum: ['latest', 'all_overdue', 'all_pending'] }
};

module.exports = async function updateTaskStatus(args, user, ctx) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { taskId, taskIds, taskTitle, taskTitles, taskIndex, taskIndexes, status, relativeReference } = v.value;
  if (!status) return { ok: false, error: 'Status is required.' };

  const targetStatus = status;

  let targetTaskIds = [];

  if (taskId) {
    targetTaskIds.push(taskId);
  } else if (Array.isArray(taskIds) && taskIds.length) {
    targetTaskIds.push(...taskIds.map((id) => Number(id)).filter(Number.isInteger));
  } else if (taskIndex) {
    const lastResultIds = ctx?.slots?.lastResultIds || [];
    if (taskIndex > 0 && taskIndex <= lastResultIds.length) {
      targetTaskIds.push(lastResultIds[taskIndex - 1]);
    } else {
      return { ok: true, notFound: true, message: 'Task not found.' };
    }
  } else if (Array.isArray(taskIndexes) && taskIndexes.length) {
    const lastResultIds = ctx?.slots?.lastResultIds || [];
    for (const rawIndex of taskIndexes) {
      const index = Number(rawIndex);
      if (Number.isInteger(index) && index > 0 && index <= lastResultIds.length) {
        targetTaskIds.push(lastResultIds[index - 1]);
      }
    }
    if (targetTaskIds.length === 0) {
      return { ok: true, notFound: true, message: 'Task not found.' };
    }
  } else if (relativeReference === 'latest') {
    const lastResultIds = ctx?.slots?.lastResultIds || [];
    if (lastResultIds.length > 0) {
      targetTaskIds.push(lastResultIds[0]);
    } else {
      const myTasks = await Task.findMyTasks(userId);
      if (myTasks.length > 0) targetTaskIds.push(myTasks[0].id);
      else return { ok: true, notFound: true, message: 'Task not found.' };
    }
  } else if (relativeReference === 'all_overdue') {
      const myTasks = await Task.findMyTasks(userId);
      const { isOverdue } = require('../../utils/time');
      const overdueTasks = myTasks.filter((t) => isOverdue(t.dueDate) && String(t.status || '').toLowerCase() !== 'completed');
      if (overdueTasks.length === 0) return { ok: true, notFound: true, message: 'Task not found.' };
      targetTaskIds = overdueTasks.map(t => t.id);
  } else if (relativeReference === 'all_pending') {
      const myTasks = await Task.findMyTasks(userId);
      const pendingTasks = myTasks.filter((t) => String(t.status || '').toLowerCase() === 'pending');
      if (pendingTasks.length === 0) return { ok: true, notFound: true, message: 'Task not found.' };
      targetTaskIds = pendingTasks.map(t => t.id);
  } else if (taskTitle) {
      const candidates = await Task.findAll({}, userId);
      const m = resolveTaskTitleMatch(taskTitle, candidates);
      if (m) {
          targetTaskIds.push(m.item.id);
      } else {
          return { ok: true, notFound: true, message: 'Task not found.' };
      }
  } else if (Array.isArray(taskTitles) && taskTitles.length) {
      const candidates = await Task.findAll({}, userId);
      for (const title of taskTitles) {
          const m = resolveTaskTitleMatch(title, candidates);
          if (m) targetTaskIds.push(m.item.id);
      }
      if (targetTaskIds.length === 0) {
          return { ok: true, notFound: true, message: 'Task not found.' };
      }
  } else if (ctx?.slots?.lastCreatedTaskId) {
      targetTaskIds.push(ctx.slots.lastCreatedTaskId);
  }

  targetTaskIds = [...new Set(targetTaskIds)];

  if (targetTaskIds.length === 0) {
      return { ok: true, notFound: true, message: 'Task not found.' };
  }

  // Update tasks
  const updatedTitles = [];
  const summaries = [];
  for (const id of targetTaskIds) {
      const task = await Task.findById(id);
      if (!task) continue;
      
      const updateData = { status: targetStatus };
      if (targetStatus === 'Completed') {
          updateData.completed_at = new Date();
      } else {
          updateData.completed_at = null;
      }
      
      await Task.update(id, updateData);
      const confirmed = await Task.findById(id);
      updatedTitles.push(task.taskTitle || task.taskTitle || 'Task');
      summaries.push({
          title: confirmed?.taskTitle || task.taskTitle || task.task_title || 'Task',
          dueDate: formatDDMMYYYYWithOptionalTime(confirmed?.dueDate || task.dueDate || task.due_date),
          assignedTo: taskPersonName(confirmed, 'doer') || taskPersonName(task, 'doer'),
          assignedBy: taskPersonName(confirmed, 'assigner') || taskPersonName(task, 'assigner'),
          priority: confirmed?.priority || task.priority,
          status: confirmed?.status || targetStatus,
      });
  }

  if (updatedTitles.length === 0) {
      return { ok: true, notFound: true, message: 'Task not found.' };
  }

  return {
      ok: true,
      updatedCount: updatedTitles.length,
      titles: updatedTitles,
      newStatus: targetStatus,
      summary: summaries.length === 1 ? summaries[0] : undefined,
      summaries,
      slot: { lastEntity: 'task', lastStatus: targetStatus }
  };
};

function resolveTaskTitleMatch(taskTitle, candidates) {
    const targetKey = normalizeText(taskTitle);
    const exact = candidates.find((task) => normalizeText(task.taskTitle || task.task_title || '') === targetKey);
    if (exact) return { item: exact, score: 1 };

    const wordCount = targetKey.split(/\s+/).filter(Boolean).length;
    if (wordCount <= 1) return null;

    return bestMatch(taskTitle, candidates, (t) => t.taskTitle || t.task_title || '', 0.55);
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
