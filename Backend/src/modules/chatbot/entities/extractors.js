/**
 * Lightweight entity heuristics. These are NOT the primary intent detector —
 * the LLM does that. We use these only to:
 *   (a) populate session slot hints,
 *   (b) emit useful debug logs,
 *   (c) suggest follow-up quick actions.
 */

const STATUS_WORDS = {
  pending: 'Pending',
  'in progress': 'In Progress',
  'in-progress': 'In Progress',
  completed: 'Completed',
  done: 'Completed',
  finished: 'Completed',
  overdue: 'Overdue',
  rejected: 'Rejected',
  approved: 'Approved',
};

const PRIORITY_WORDS = {
  high: 'High',
  highest: 'High',
  urgent: 'High',
  critical: 'High',
  medium: 'Medium',
  normal: 'Medium',
  low: 'Low',
};

const ENTITY_WORDS = {
  task: 'task',
  tasks: 'task',
  delegation: 'task',
  delegations: 'task',
  checklist: 'checklist',
  checklists: 'checklist',
  ticket: 'help_ticket',
  tickets: 'help_ticket',
  attendance: 'attendance',
};

function extract(message) {
  const out = { entity: null, status: null, priority: null, period: null };
  if (!message) return out;
  const m = message.toLowerCase();

  for (const [k, v] of Object.entries(STATUS_WORDS)) {
    if (m.includes(k)) { out.status = v; break; }
  }
  for (const [k, v] of Object.entries(PRIORITY_WORDS)) {
    if (new RegExp(`\\b${k}\\b`).test(m)) { out.priority = v; break; }
  }
  for (const [k, v] of Object.entries(ENTITY_WORDS)) {
    if (new RegExp(`\\b${k}\\b`).test(m)) { out.entity = v; break; }
  }
  if (m.includes('today')) out.period = 'today';
  else if (m.includes('this week')) out.period = 'this week';
  else if (m.includes('this month')) out.period = 'this month';
  else if (m.includes('yesterday')) out.period = 'yesterday';
  else if (m.includes('tomorrow')) out.period = 'tomorrow';

  return out;
}

module.exports = { extract };
