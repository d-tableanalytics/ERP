/**
 * OpenAI-compatible JSON-schema tool definitions.
 * Each entry maps to a handler in tools/handlers/*.
 * The orchestrator filters this list by role before sending to the LLM.
 */

const TOOL_DEFINITIONS = [
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getMyTasks',
      description: 'Get the current user\'s tasks (assigned to them). Use this for "show my tasks", "pending tasks", "what tasks do I have", etc. Supports filtering by status and priority.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Rejected', 'Hold'], description: 'Filter by status' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'Filter by priority' },
          dueBefore: { type: 'string', description: 'ISO date — only tasks due before this date' },
          dueAfter: { type: 'string', description: 'ISO date — only tasks due after this date' },
          limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Max results (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getTaskDetail',
      description: 'Get full detail for a specific task, including description, assigner, due date, status, priority, and counts of remarks/revisions/subtasks. Provide taskId if known, otherwise taskTitle for fuzzy match against the user\'s tasks.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'integer', description: 'The exact task id' },
          taskTitle: { type: 'string', description: 'Task title or fragment (fuzzy match)' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'countTasks',
      description: 'Count the current user\'s tasks. Use for "how many tasks…" questions. Optional status filter. Optional role: "mine" (default), "delegated", "subscribed".',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status filter — Pending, In Progress, Completed, Overdue' },
          role: { type: 'string', enum: ['mine', 'delegated', 'subscribed'], description: 'Which set of tasks to count' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getMyChecklists',
      description: 'Get the current user\'s checklists (where they are assignee, doer, or verifier). Supports status and frequency filters.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Pending, Completed, In Progress, Verified, Hold, or Overdue' },
          frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'custom'] },
          limit: { type: 'integer', minimum: 1, maximum: 25 },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getChecklistDetail',
      description: 'Get detail of a specific checklist by id or name (fuzzy match).',
      parameters: {
        type: 'object',
        properties: {
          checklistId: { type: 'integer' },
          name: { type: 'string', description: 'Checklist name / question fragment' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getOverdueItems',
      description: 'Get the current user\'s overdue items. entityType controls which set: task, checklist, or all.',
      parameters: {
        type: 'object',
        properties: {
          entityType: { type: 'string', enum: ['task', 'checklist', 'all'], default: 'all' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getAttendanceStatus',
      description: 'Get the user\'s attendance — for a specific date (YYYY-MM-DD) or for a relative period: today, yesterday, tomorrow, this week, last week, this month.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          period: { type: 'string', enum: ['today', 'yesterday', 'tomorrow', 'this week', 'last week', 'this month'] },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getMyHelpTickets',
      description: 'Get the user\'s help tickets (raised, accountable, or solving). Optional status.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'OPEN, CLOSED, IN_PROGRESS, etc.' },
          limit: { type: 'integer', minimum: 1, maximum: 25 },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getDashboardSummary',
      description: 'Get aggregated counts for the current user across tasks, checklists, and tickets.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    role: 'admin',
    function: {
      name: 'searchEmployees',
      description: '[Admin/SuperAdmin only] Search employees by name or email (fuzzy).',
      parameters: {
        type: 'object',
        properties: {
          nameQuery: { type: 'string', description: 'Full or partial name / email' },
          limit: { type: 'integer', minimum: 1, maximum: 10 },
        },
        required: ['nameQuery'],
      },
    },
  },
  {
    type: 'function',
    role: 'admin',
    function: {
      name: 'getTeamWorkload',
      description: '[Admin/SuperAdmin only] Get workload counts (pending/overdue/total tasks) per employee, optionally filtered by department.',
      parameters: {
        type: 'object',
        properties: {
          department: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getHelpGuidance',
      description: 'Search the ERP knowledge base for how-to / workflow / module overview guidance. Use this when the user asks "how to…", "what is…", "explain…", "guide me through…" for ERP topics.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'The topic or question to search for' },
        },
        required: ['topic'],
      },
    },
  },
];

/**
 * Strip the internal `role` gate before sending to OpenAI (keeps the schema spec-compliant).
 */
function definitionsForRole(role) {
  const isAdmin = role === 'Admin' || role === 'SuperAdmin';
  return TOOL_DEFINITIONS
    .filter((t) => t.role === 'any' || (t.role === 'admin' && isAdmin))
    .map(({ role: _role, ...rest }) => rest);
}

module.exports = { TOOL_DEFINITIONS, definitionsForRole };
