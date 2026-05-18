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
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'createTask',
      description: 'Create a new task. Supports assigning to a user, setting due date, priority, and keeping other users in the loop (CC/watchers).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the task.' },
          description: { type: 'string', description: 'Detailed description of the task. If not provided, title will be used.' },
          assignedTo: { type: 'string', description: 'Name of the employee this task is assigned to. Default is the current user.' },
          dueDate: { type: 'string', description: 'Relative or absolute due date (e.g. "tomorrow", "30 May", "monday", "2026-05-30").' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'Priority level (High, Medium, Low).' },
          loopUsers: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of employee names to keep in the loop (CC, watchers, informed users) for this task. These users should NOT get separate tasks created.'
          }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateTaskStatus',
      description: 'Update the status of a task. Can update by task ID, exact/partial title, or a relative reference (e.g. latest, all_pending, all_overdue). Can also update by task index (e.g., "task 2" from a previously shown list).',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'integer', description: 'The exact task ID to update.' },
          taskTitle: { type: 'string', description: 'Task title or fragment (fuzzy match).' },
          taskIndex: { type: 'integer', description: '1-based index from the last displayed task list (e.g., "task 2" -> 2).' },
          status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'], description: 'The new status to set.' },
          relativeReference: { type: 'string', enum: ['latest', 'all_overdue', 'all_pending'], description: 'Update by relative reference if title/id/index is not known.' }
        },
        required: ['status']
      }
    }
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateTaskLoopUsers',
      description: [
        'Add one or more users to the "in loop" (CC / watcher) list of an EXISTING task.',
        'Use this — and ONLY this — when the message contains phrases like:',
        '  "keep in loop", "add in loop", "loop in", "cc", "notify", "add watcher",',
        '  "same task", "this task", "that task", "existing task".',
        'NEVER create a new task for this intent.',
        'If a task title is mentioned, pass it as taskTitle to find the task.',
        'If the user says "same task" / "this task" / "that task" without naming a title,',
        '  omit taskTitle — the handler will use the last task created in this session.',
        'Do NOT change assignedTo, status, due date, or any other field.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          taskTitle: {
            type: 'string',
            description: 'Title (or fragment) of the existing task to update. Omit when user refers to "same task" / "this task".',
          },
          loopUsers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Names of employees to add to the in-loop / watcher list.',
          },
        },
        required: ['loopUsers'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateTaskAssignment',
      description: [
        'Reassign an EXISTING task to a different employee, and/or add loop/watcher users to it.',
        'Use this — and ONLY this — when the message is a follow-up about an existing task and contains:',
        '  "assign to X", "reassign to X", "give to X", "change assignee to X",',
        '  optionally combined with "keep in loop", "cc", "notify", "add watcher".',
        'This tool updates doer_id and doer_name (the real assignee stored in the database).',
        'NEVER use createTask for this intent — that would create a duplicate task.',
        'If a task title is mentioned, pass it as taskTitle.',
        'If the user says "same task" / "this task" without naming a title, omit taskTitle.',
        'loopUsers are added to in_loop_ids WITHOUT replacing the assignee.',
        'Do NOT change task status, due date, priority, or title.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          taskTitle: {
            type: 'string',
            description: 'Title (or fragment) of the existing task to update. Omit for "same task" / "this task" references.',
          },
          assignedTo: {
            type: 'string',
            description: 'Name of the employee to reassign this task to (becomes the new doer).',
          },
          loopUsers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Names of employees to add to the in-loop / watcher list (not the assignee).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'deleteTask',
      description: [
        'Delete (soft-delete) an existing task.',
        'Use this — and ONLY this — when the user explicitly says to delete or remove or cancel a task.',
        'Trigger phrases: "delete it", "delete this task", "remove this task", "cancel this task", "remove last task".',
        'If a task title is mentioned, pass it as taskTitle to target that specific task.',
        'If the user refers to the last task (e.g. "delete it", "delete this task", "remove last task"),',
        '  omit taskTitle so it defaults to the last created/updated task in the session.'
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          taskTitle: {
            type: 'string',
            description: 'Title (or fragment) of the task to delete. Omit to target the last created/updated task in session.'
          }
        }
      }
    }
  }
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
