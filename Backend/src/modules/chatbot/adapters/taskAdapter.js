const { Task } = require('../../../models/task.model');
const { isOverdue, formatDDMMYYYY } = require('../utils/time');
const { bestMatch } = require('../utils/fuzzy');

/**
 * Task adapter — wraps the existing Task model so we never duplicate SQL.
 * All filtering / sorting / limiting happens in this thin layer and returns
 * plain objects shaped for the chatbot card schema.
 */

function applyFilters(tasks, { status, priority, dueBefore, dueAfter } = {}) {
  let list = Array.isArray(tasks) ? tasks.slice() : [];
  if (status) {
    const s = String(status).toLowerCase();
    list = list.filter((t) => String(t.status || '').toLowerCase() === s);
  }
  if (priority) {
    const p = String(priority).toLowerCase();
    list = list.filter((t) => String(t.priority || '').toLowerCase() === p);
  }
  if (dueBefore) {
    const limit = new Date(dueBefore).getTime();
    list = list.filter((t) => t.dueDate && new Date(t.dueDate).getTime() <= limit);
  }
  if (dueAfter) {
    const limit = new Date(dueAfter).getTime();
    list = list.filter((t) => t.dueDate && new Date(t.dueDate).getTime() >= limit);
  }
  return list;
}

function summarize(task) {
  if (!task) return null;
  return {
    id: task.id,
    title: task.taskTitle || task.task_title || task.delegation_name || 'Untitled',
    status: task.status || 'Pending',
    priority: task.priority || null,
    dueDate: task.dueDate || task.due_date || null,
    dueDateFormatted: formatDDMMYYYY(task.dueDate || task.due_date),
    overdue: isOverdue(task.dueDate || task.due_date) && String(task.status || '').toLowerCase() !== 'completed',
    assignedBy: task.assignerName || task.delegator_name || null,
    assignedTo: task.doerName || task.doer_name || null,
    createdAt: task.createdAt || task.created_at || null,
  };
}

async function getMyTasks(userId, filters = {}) {
  const tasks = await Task.findMyTasks(userId);
  const filtered = applyFilters(tasks, filters);
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 25) : 10;
  return filtered.slice(0, limit).map(summarize);
}

async function getDelegatedTasks(userId, filters = {}) {
  const tasks = await Task.findDelegatedTasks(userId);
  const filtered = applyFilters(tasks, filters);
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 25) : 10;
  return filtered.slice(0, limit).map(summarize);
}

async function countMyTasks(userId, { status, role } = {}) {
  let tasks;
  if (role === 'delegated') tasks = await Task.findDelegatedTasks(userId);
  else if (role === 'subscribed') tasks = await Task.findSubscribedTasks(userId);
  else tasks = await Task.findMyTasks(userId);
  if (status) {
    const s = String(status).toLowerCase();
    if (s === 'overdue') {
      tasks = tasks.filter((t) => isOverdue(t.dueDate) && String(t.status || '').toLowerCase() !== 'completed');
    } else {
      tasks = tasks.filter((t) => String(t.status || '').toLowerCase() === s);
    }
  }
  return tasks.length;
}

async function getOverdue(userId) {
  const tasks = await Task.findMyTasks(userId);
  return tasks
    .filter((t) => isOverdue(t.dueDate) && String(t.status || '').toLowerCase() !== 'completed')
    .map(summarize);
}

/**
 * Find a task by id OR fuzzy title match against the user's tasks.
 * Returns the full detail shape (with remarks, history, subtasks).
 */
async function getTaskDetail(userId, { taskId, taskTitle } = {}) {
  let task = null;
  if (taskId) {
    task = await Task.findById(taskId);
  } else if (taskTitle) {
    const candidates = await Task.findMyTasks(userId);
    const m = bestMatch(taskTitle, candidates, (t) => t.taskTitle || t.task_title || '');
    if (m) task = m.item;
  }
  if (!task) return null;

  const [remarks, history, subtasks] = await Promise.all([
    Task.getRemarks(task.id).catch(() => []),
    Task.getRevisionHistory(task.id).catch(() => []),
    Task.getSubtasks(task.id).catch(() => []),
  ]);

  const base = summarize(task);
  return {
    ...base,
    description: task.description || null,
    category: task.category || null,
    tags: task.tags || [],
    approvalStatus: task.approvalStatus || null,
    checklistItems: task.checklistItems || [],
    remarksCount: remarks.length,
    revisionsCount: history.length,
    subtasksCount: subtasks.length,
  };
}

module.exports = {
  getMyTasks,
  getDelegatedTasks,
  countMyTasks,
  getOverdue,
  getTaskDetail,
  _summarize: summarize, // exported for tests
};
