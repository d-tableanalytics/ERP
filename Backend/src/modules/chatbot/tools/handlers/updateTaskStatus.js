const { Task } = require('../../../../models/task.model');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');

const schema = {
  taskId: { type: 'integer' },
  taskTitle: { type: 'string' },
  taskIndex: { type: 'integer' },
  status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'] },
  relativeReference: { type: 'string', enum: ['latest', 'all_overdue', 'all_pending'] }
};

module.exports = async function updateTaskStatus(args, user, ctx) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { taskId, taskTitle, taskIndex, status, relativeReference } = v.value;
  if (!status) return { ok: false, error: 'Status is required.' };

  const targetStatus = status;

  let targetTaskIds = [];

  if (taskId) {
    targetTaskIds.push(taskId);
  } else if (taskIndex) {
    const lastResultIds = ctx?.session?.lastResultIds || [];
    if (taskIndex > 0 && taskIndex <= lastResultIds.length) {
      targetTaskIds.push(lastResultIds[taskIndex - 1]);
    } else {
      return { ok: true, notFound: true, message: 'Task not found.' };
    }
  } else if (relativeReference === 'latest') {
    const lastResultIds = ctx?.session?.lastResultIds || [];
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
      const candidates = await Task.findMyTasks(userId);
      const m = bestMatch(taskTitle, candidates, (t) => t.taskTitle || t.task_title || '');
      if (m) {
          targetTaskIds.push(m.item.id);
      } else {
          return { ok: true, notFound: true, message: 'Task not found.' };
      }
  }

  if (targetTaskIds.length === 0) {
      return { ok: true, notFound: true, message: 'Task not found.' };
  }

  // Update tasks
  const updatedTitles = [];
  for (const id of targetTaskIds) {
      const task = await Task.findById(id);
      if (!task) continue;
      
      const updateData = { status: targetStatus };
      if (targetStatus === 'Completed') {
          updateData.completed_at = new Date();
      }
      
      await Task.update(id, updateData);
      updatedTitles.push(task.taskTitle || task.taskTitle || 'Task');
  }

  if (updatedTitles.length === 0) {
      return { ok: true, notFound: true, message: 'Task not found.' };
  }

  return {
      ok: true,
      updatedCount: updatedTitles.length,
      titles: updatedTitles,
      newStatus: targetStatus,
      slot: { lastEntity: 'task', lastStatus: targetStatus }
  };
};
