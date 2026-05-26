const { Task } = require('../../../models/task.model');
const employeeAdapter = require('./employeeAdapter');
const { isOverdue, formatDDMMYYYYWithOptionalTime } = require('../utils/time');
const { bestMatch } = require('../utils/fuzzy');

/**
 * Task adapter — wraps the existing Task model so we never duplicate SQL.
 * All filtering / sorting / limiting happens in this thin layer and returns
 * plain objects shaped for the chatbot card schema.
 */

function applyFilters(tasks, { status, priority, dueBefore, dueAfter, assignedToId, assignedTo } = {}) {
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
  if (assignedToId) {
    const target = normalizeName(assignedTo);
    list = list.filter((t) => {
      const idMatches = Number(t.doerId || t.doer_id) === Number(assignedToId);
      const nameMatches = target && normalizeName(t.doerName || t.doer_name).includes(target);
      return idMatches || nameMatches;
    });
  } else if (assignedTo) {
    const target = normalizeName(assignedTo);
    list = list.filter((t) => normalizeName(t.doerName || t.doer_name).includes(target));
  }
  return list;
}

function nameFromParts(first, last) {
  return properName([first, last].filter(Boolean).join(' ').trim()) || null;
}

function properName(name) {
  if (!name || typeof name !== 'string') return null;
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '')
    .join(' ');
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function summarize(task, loopNameLookup = new Map()) {
  if (!task) return null;
  const loopIds = Array.isArray(task.inLoopIds || task.in_loop_ids) ? (task.inLoopIds || task.in_loop_ids) : [];
  const loopNames = loopIds.map((id) => properName(loopNameLookup.get(Number(id)))).filter(Boolean);
  return {
    id: task.id,
    title: task.taskTitle || task.task_title || task.delegation_name || 'Untitled',
    status: task.status || 'Pending',
    priority: task.priority || null,
    dueDate: task.dueDate || task.due_date || null,
    dueDateFormatted: formatDDMMYYYYWithOptionalTime(task.dueDate || task.due_date),
    overdue: isOverdue(task.dueDate || task.due_date) && String(task.status || '').toLowerCase() !== 'completed',
    assignedBy: nameFromParts(task.assignerFirstName, task.assignerLastName) || properName(task.assignerName || task.delegator_name),
    assignedTo: nameFromParts(task.doerFirstName, task.doerLastName) || properName(task.doerName || task.doer_name),
    inLoop: loopNames.join(', ') || null,
    inLoopNames: loopNames,
    description: task.description || null,
    createdAt: task.createdAt || task.created_at || null,
  };
}

async function summarizeMany(tasks) {
  const loopIds = new Set();
  for (const task of tasks || []) {
    const ids = task.inLoopIds || task.in_loop_ids;
    if (Array.isArray(ids)) ids.forEach((id) => loopIds.add(Number(id)));
  }

  const employees = loopIds.size ? await employeeAdapter.findByIds([...loopIds]).catch(() => []) : [];
  const loopNameLookup = new Map(employees.map((employee) => [Number(employee.id), employee.name]));
  return (tasks || []).map((task) => summarize(task, loopNameLookup));
}

async function getMyTasks(userId, filters = {}) {
  const tasks = await Task.findMyTasks(userId);
  const filtered = applyFilters(tasks, filters);
  if (filters.summary) return summarizeMany(filtered);
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 25) : 10;
  return summarizeMany(filtered.slice(0, limit));
}

async function getDelegatedTasks(userId, filters = {}) {
  const tasks = await Task.findDelegatedTasks(userId);
  const filtered = applyFilters(tasks, filters);
  if (filters.summary) return summarizeMany(filtered);
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 25) : 10;
  return summarizeMany(filtered.slice(0, limit));
}

async function getSubscribedTasks(userId, filters = {}) {
  const tasks = await Task.findSubscribedTasks(userId);
  const filtered = applyFilters(tasks, filters);
  if (filters.summary) return summarizeMany(filtered);
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 25) : 10;
  return summarizeMany(filtered.slice(0, limit));
}

async function getAllInvolvedTasks(userId, filters = {}) {
  const tasks = await Task.findAll({}, userId);
  const filtered = applyFilters(tasks, filters);
  if (filters.summary) return summarizeMany(filtered);
  const limit = filters.limit && filters.limit > 0 ? Math.min(filters.limit, 25) : 10;
  return summarizeMany(filtered.slice(0, limit));
}

async function countMyTasks(userId, { status, role } = {}) {
  let tasks;
  if (role === 'all') tasks = await Task.findAll({}, userId);
  else if (role === 'delegated') tasks = await Task.findDelegatedTasks(userId);
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
  const overdue = tasks.filter((t) => isOverdue(t.dueDate) && String(t.status || '').toLowerCase() !== 'completed');
  return summarizeMany(overdue);
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

  const loopIds = task.inLoopIds || task.in_loop_ids || [];
  const employees = Array.isArray(loopIds) && loopIds.length ? await employeeAdapter.findByIds(loopIds).catch(() => []) : [];
  const loopNameLookup = new Map(employees.map((employee) => [Number(employee.id), employee.name]));
  const base = summarize(task, loopNameLookup);
  return {
    ...base,
    description: task.description || base.description || null,
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
  getSubscribedTasks,
  getAllInvolvedTasks,
  countMyTasks,
  getOverdue,
  getTaskDetail,
  _summarize: summarize, // exported for tests
};
