const db = require('../../../config/db.config');
const employeeAdapter = require('./employeeAdapter');
const { bestMatch } = require('../utils/fuzzy');
const { isAdmin } = require('../validators/permissions');
const { formatDDMMYYYYWithOptionalTime, isOverdue } = require('../utils/time');

const STATUSES = new Set(['To Do', 'In Progress', 'Done']);
const PRIORITIES = new Set(['Low', 'Normal', 'High', 'Urgent']);

function normalizeStatus(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['start', 'started', 'working on', 'work on', 'progress', 'in progress', 'move to progress'].includes(text)) return 'In Progress';
  if (['complete', 'completed', 'done', 'finished', 'finish'].includes(text)) return 'Done';
  if (['pending', 'todo', 'to do', 'not started', 'open'].includes(text)) return 'To Do';
  if (STATUSES.has(value)) return value;
  return null;
}

function normalizePriority(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'urgent' || text === 'critical') return 'Urgent';
  if (text === 'high' || text === 'important') return 'High';
  if (text === 'low') return 'Low';
  if (text === 'normal' || text === 'medium') return 'Normal';
  if (PRIORITIES.has(value)) return value;
  return null;
}

function summarize(row) {
  if (!row) return null;
  const assignedTo = nameFromParts(row.assignee_first_name, row.assignee_last_name) || row.assigned_to_name || null;
  const createdBy = nameFromParts(row.creator_first_name, row.creator_last_name) || row.created_by_name || null;
  return {
    id: row.todo_id,
    title: row.title,
    description: row.description || '',
    priority: row.priority || 'Normal',
    status: row.status || 'To Do',
    dueDate: row.due_date || null,
    dueDateFormatted: formatDDMMYYYYWithOptionalTime(row.due_date),
    overdue: isOverdue(row.due_date) && String(row.status || '').toLowerCase() !== 'done',
    assignedTo,
    assignedToId: row.assigned_to,
    createdBy,
    createdById: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create({ title, description, priority, dueDate, assignedToId, createdById }) {
  const { rows } = await db.query(
    `INSERT INTO todos (title, description, priority, status, due_date, created_by, assigned_to)
     VALUES ($1, $2, $3, 'To Do', $4, $5, $6)
     RETURNING *`,
    [title, description || title, normalizePriority(priority) || 'Normal', dueDate || null, createdById, assignedToId || createdById]
  );
  return getById(rows[0].todo_id);
}

async function getVisible(user, filters = {}) {
  const userId = Number(user.user_id ?? user.id ?? user.User_Id);
  const params = [];
  const clauses = [];

  if (!isAdmin(user)) {
    params.push(userId);
    clauses.push(`(t.assigned_to = $${params.length} OR t.created_by = $${params.length})`);
  }
  if (filters.status) {
    params.push(normalizeStatus(filters.status) || filters.status);
    clauses.push(`t.status = $${params.length}`);
  }
  if (filters.priority) {
    params.push(normalizePriority(filters.priority) || filters.priority);
    clauses.push(`t.priority = $${params.length}`);
  }
  if (filters.assignedToId) {
    params.push(Number(filters.assignedToId));
    clauses.push(`t.assigned_to = $${params.length}`);
  }

  params.push(Math.min(Math.max(Number(filters.limit) || 25, 1), 100));
  const limitParam = `$${params.length}`;
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await db.query(`${baseSelect()} ${where} ORDER BY t.created_at DESC LIMIT ${limitParam}`, params);
  return rows.map(summarize);
}

async function getById(id) {
  const { rows } = await db.query(`${baseSelect()} WHERE t.todo_id = $1`, [id]);
  return summarize(rows[0]);
}

async function findByTitle(user, title) {
  const visible = await getVisible(user, { limit: 100 });
  const key = normalizeText(title);
  const exact = visible.filter((todo) => normalizeText(todo.title) === key);
  if (exact.length) return exact;
  const match = bestMatch(title, visible, (todo) => todo.title, 0.45);
  return match ? [match.item] : [];
}

async function updateField(user, { todoId, title, field, value }) {
  const target = await resolveOne(user, { todoId, title });
  if (!target.ok) return target;
  if (target.notFound || target.needsSelection || !target.todo) return target;
  if (!canUpdate(user, target.todo, field)) {
    return { ok: false, error: 'You can update only tasks assigned to you or created by you.' };
  }

  const column = {
    title: 'title',
    status: 'status',
    priority: 'priority',
    dueDate: 'due_date',
    assignedToId: 'assigned_to',
  }[field];
  if (!column) return { ok: false, error: 'Unsupported todo update.' };

  await db.query(`UPDATE todos SET ${column} = $1, updated_at = CURRENT_TIMESTAMP WHERE todo_id = $2`, [value, target.todo.id]);
  return { ok: true, todo: await getById(target.todo.id), previous: target.todo };
}

async function remove(user, { todoId, title }) {
  const target = await resolveOne(user, { todoId, title });
  if (!target.ok) return target;
  if (target.notFound || target.needsSelection || !target.todo) return target;
  if (!canUpdate(user, target.todo, 'delete')) {
    return { ok: false, error: 'You can delete only tasks created by you unless you are Admin.' };
  }
  await db.query('DELETE FROM todos WHERE todo_id = $1', [target.todo.id]);
  return { ok: true, todo: target.todo };
}

async function summary(user) {
  const todos = await getVisible(user, { limit: 100 });
  return {
    total: todos.length,
    toDo: todos.filter((t) => t.status === 'To Do').length,
    inProgress: todos.filter((t) => t.status === 'In Progress').length,
    done: todos.filter((t) => t.status === 'Done').length,
    overdue: todos.filter((t) => t.overdue).length,
    urgentTasks: todos.filter((t) => t.priority === 'Urgent'),
  };
}

async function overdue(user, { limit = 25 } = {}) {
  const todos = await getVisible(user, { limit: 100 });
  return todos.filter((t) => t.overdue).slice(0, Math.min(Math.max(Number(limit) || 25, 1), 100));
}

async function resolveAssignee(rawName, fallbackUserId) {
  if (!rawName) return { id: fallbackUserId, name: null };
  const matches = await employeeAdapter.search(rawName, { limit: 1 }).catch(() => []);
  return matches[0] ? { id: matches[0].id, name: matches[0].name } : { id: fallbackUserId, name: rawName };
}

async function resolveOne(user, { todoId, title }) {
  if (todoId) {
    const todo = await getById(todoId);
    if (!todo || !canView(user, todo)) return { ok: true, notFound: true, message: 'Todo task not found.' };
    return { ok: true, todo };
  }
  const matches = await findByTitle(user, title);
  if (matches.length === 0) return { ok: true, notFound: true, message: 'Todo task not found.' };
  if (matches.length > 1) {
    return { ok: true, needsSelection: true, message: 'Multiple tasks match this title. Please choose the correct task.', options: matches };
  }
  return { ok: true, todo: matches[0] };
}

function canView(user, todo) {
  if (isAdmin(user)) return true;
  const userId = Number(user.user_id ?? user.id ?? user.User_Id);
  return Number(todo.assignedToId) === userId || Number(todo.createdById) === userId;
}

function canUpdate(user, todo, field) {
  if (isAdmin(user)) return true;
  const userId = Number(user.user_id ?? user.id ?? user.User_Id);
  if (field === 'status') return Number(todo.assignedToId) === userId;
  return Number(todo.createdById) === userId;
}

function baseSelect() {
  return `SELECT t.*,
                 c.first_name AS creator_first_name,
                 c.last_name AS creator_last_name,
                 a.first_name AS assignee_first_name,
                 a.last_name AS assignee_last_name
          FROM todos t
          LEFT JOIN employees c ON t.created_by = c.user_id
          LEFT JOIN employees a ON t.assigned_to = a.user_id`;
}

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function nameFromParts(first, last) {
  return [first, last].filter(Boolean).join(' ').trim();
}

module.exports = {
  create,
  getVisible,
  getById,
  findByTitle,
  updateField,
  remove,
  summary,
  overdue,
  resolveAssignee,
  resolveOne,
  normalizeStatus,
  normalizePriority,
};
