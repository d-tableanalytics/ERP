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
      description: 'Get tasks visible in the current user\'s task lists. Default is tasks assigned to the current user. Use role="delegated" for "tasks assigned by me", "tasks I assigned to Adarsh", or "assigned by me to X"; use role="subscribed" for tasks where the current user is only in loop/subscribed; use role="all" for the same set as the UI All Tasks page. "me" means the authenticated logged-in user. Supports filtering by status, priority, period, and assignee.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Hold'], description: 'Filter by task status. Priority phrases are not status.' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'Filter by priority' },
          role: { type: 'string', enum: ['mine', 'delegated', 'subscribed', 'all'], description: 'Use "delegated" for tasks assigned by the current logged-in user to someone else. Use "subscribed" for in-loop/subscribed tasks. Use "all" for the same involved-task set as the UI All Tasks page.' },
          assignedTo: { type: 'string', description: 'Employee name to filter assigned-to/doer, e.g. "Adarsh". Use with role="delegated" for "assigned by me to Adarsh".' },
          dueBefore: { type: 'string', description: 'ISO date — only tasks due before this date' },
          dueAfter: { type: 'string', description: 'ISO date — only tasks due after this date' },
          period: { type: 'string', enum: ['today', 'tomorrow'], description: 'Use for "today\'s tasks" or "tomorrow\'s tasks" date filtering.' },
          limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Max results (default 10)' },
          summary: { type: 'boolean', description: 'Set true when the user asks for a summary with task details grouped by status.' },
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
      description: 'Count the current user\'s tasks. Use for "how many tasks" questions. Optional status filter. Optional role: "mine" (default), "delegated", "subscribed", or "all" for the same involved-task count as the UI All Tasks page.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status filter — Pending, In Progress, Completed, Overdue' },
          role: { type: 'string', enum: ['mine', 'delegated', 'subscribed', 'all'], description: 'Which set of tasks to count' },
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
          frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] },
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
    role: 'any',
    function: {
      name: 'getChatSummary',
      description: 'Summarize the current user\'s saved chatbot conversation for a date. Use for "give me summary of today chat", "summarize chat on 21/05/2026", "this date chat summary", or "what did we discuss yesterday". Defaults to today if no date is specified.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Chat date such as YYYY-MM-DD, DD/MM/YYYY, "21 June 2026", today, or yesterday.' },
          period: { type: 'string', enum: ['today', 'yesterday'], description: 'Relative chat date when the user says today or yesterday.' },
          limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Maximum saved messages to summarize. Default 200.' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getO2DOrders',
      description: 'Search O2D orders by PO number, firm, buyer, item, UID, delivery date, overall status, or current workflow step. Use for natural language O2D/order-to-delivery lookup questions. Employees only see allowed/assigned O2D orders; admins see all.',
      parameters: {
        type: 'object',
        properties: {
          poNumber: { type: 'string', description: 'PO number or fragment.' },
          firm: { type: 'string', description: 'Firm/company name.' },
          buyer: { type: 'string', description: 'Buyer/customer name.' },
          item: { type: 'string', description: 'Item name or fragment.' },
          uid: { type: 'string', description: 'Order UID.' },
          deliveryDate: { type: 'string', description: 'Delivery date, YYYY-MM-DD.' },
          status: { type: 'string', description: 'Overall order status such as IN_PROGRESS or COMPLETED.' },
          currentStep: { type: 'string', description: 'Current O2D step name.' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getO2DOrderByPO',
      description: 'Get full O2D order details, current step, next step, and step list for one PO number. Use when the user asks current status/current step/next step of a PO.',
      parameters: {
        type: 'object',
        properties: {
          poNumber: { type: 'string', description: 'Exact PO number.' },
        },
        required: ['poNumber'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getO2DOrdersByStep',
      description: 'Show step-wise pending/current O2D orders for a specific workflow step, such as PO Check, Payment Release, Delivery, or Doc Checker.',
      parameters: {
        type: 'object',
        properties: {
          step: { type: 'string', description: 'O2D step name.' },
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
        required: ['step'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getO2DOverdueOrders',
      description: 'Show O2D orders whose delivery date has passed and are not completed.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50 },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getO2DSummary',
      description: 'Get an O2D business summary: total orders, counts by step/status, overdue count, approaching delivery count, and stuck-order alert count.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getO2DAlerts',
      description: 'Get smart O2D alerts: overdue orders, orders stuck at one step, and orders with delivery date approaching.',
      parameters: {
        type: 'object',
        properties: {
          stuckDays: { type: 'integer', minimum: 1, maximum: 30, description: 'Days at one step before an order is considered stuck. Default 3.' },
          approachingDays: { type: 'integer', minimum: 1, maximum: 30, description: 'Days before delivery to alert. Default 3.' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateO2DStep',
      description: 'Move an O2D order from its current step to the next workflow step. Only call with confirmed=true after the user explicitly confirms the move. Validate current step and only allow the correct next step unless Admin/SuperAdmin passes adminOverride=true. Employees can update only assigned/allowed step orders.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'integer', description: 'O2D order ID if known.' },
          poNumber: { type: 'string', description: 'PO number to update.' },
          fromStep: { type: 'string', description: 'Expected current step named by the user.' },
          toStep: { type: 'string', description: 'Target next step. If omitted, the correct next step is used.' },
          remarks: { type: 'string', description: 'Business remark/history note.' },
          confirmed: { type: 'boolean', description: 'Must be true only when the user has explicitly confirmed this update.' },
          adminOverride: { type: 'boolean', description: 'Admin/SuperAdmin override for non-sequential moves.' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'correctO2DStep',
      description: 'Correct or set the current O2D step for an order when the step is missing or invalid, e.g. "Update PO PO-99999 current O2D step to Order Entry". Validate the target against the valid O2D workflow. Do not use this for normal next-step movement; use updateO2DStep for sequential moves. Admins can correct any O2D order; employees can correct only orders assigned to them. Reject invalid target steps such as Check Stock Availability.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'integer', description: 'O2D order ID if known.' },
          poNumber: { type: 'string', description: 'PO number to correct.' },
          toStep: { type: 'string', description: 'Valid target O2D step, such as Order Entry, PO Check, Doc Checker, or Delivery.' },
          remarks: { type: 'string', description: 'Correction reason or audit note.' },
        },
        required: ['toStep'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'addO2DRemark',
      description: 'Add a remark/note to an O2D order by PO number or selected order.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'integer' },
          poNumber: { type: 'string' },
          remark: { type: 'string' },
        },
        required: ['remark'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'getO2DStepHistory',
      description: 'Get O2D step movement history with fromStep, toStep, changedBy, remarks, and changedAt for a PO/order.',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'integer' },
          poNumber: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    role: 'admin',
    function: {
      name: 'listEmployees',
      description: '[Admin/SuperAdmin only] List registered employees/team members with id, name, role, department, designation, and work email. Use for "all registered employees", "all team members", "member names", "employees list", "team list".',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Max employees to return (default 50)' },
        },
      },
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
    role: 'admin',
    function: {
      name: 'getTeamCompletionAccuracy',
      description: '[Admin/SuperAdmin only] Show which employees completed work on time and calculate completion accuracy. Use for "which employee completed work on time", "employee completion accuracy", "work completed on time", or "on-time work accuracy".',
      parameters: {
        type: 'object',
        properties: {
          department: { type: 'string', description: 'Optional department filter.' },
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
      description: 'Create a new task. Supports assigning to a user, setting due date, priority, and keeping other users in the loop (CC/watchers). Use this for fresh task requests like "I told Aashu to..." even when they also say "keep Adarsh in the loop". Priority words are not status.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the task.' },
          description: { type: 'string', description: 'Detailed description of the task. If not provided, title will be used.' },
          assignedTo: { type: 'string', description: 'Name of the employee this task is assigned to. Default is the current user.' },
          dueDate: { type: 'string', description: 'Relative or absolute due date/time (e.g. "tomorrow", "tomorrow morning", "tomorrow evening", "tomorrow 5 pm", "30 May", "monday", "2026-05-30"). Preserve user-provided time phrases.' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'Priority level. Map high priority to High, medium priority to Medium, and low priority to Low. Never use priority as task status.' },
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
      name: 'createChecklist',
      description: 'Create a new checklist template/master. Use when the user asks to create/add a checklist, checklist task/question, recurring checklist, or verification checklist. This creates the same checklist master used by the checklist UI; generated checklist items follow the configured frequency.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Checklist question/task text.' },
          assignee: { type: 'string', description: 'Employee responsible as assignee. Defaults to current user, like the checklist UI.' },
          doer: { type: 'string', description: 'Employee who will do the checklist. Defaults to current user when not mentioned.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'Low', 'Medium', 'High'], description: 'Required checklist field. Default medium, like the checklist UI.' },
          department: { type: 'string', description: 'Department, if mentioned.' },
          frequency: {
            type: 'string',
            enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'Custom'],
            description: 'Required checklist frequency. Default daily. UI options are daily, weekly, monthly, quarterly, yearly.'
          },
          fromDate: { type: 'string', description: 'Required start/from date and time, e.g. today, tomorrow, tomorrow morning, tomorrow 5 pm, 2026-05-21 17:00. Default is current date/time.' },
          dueDate: { type: 'string', description: 'Due/end date/time for the master, e.g. today, tomorrow, tomorrow evening, 2026-05-21 18:00. Defaults to fromDate.' },
          verificationRequired: { type: 'boolean', description: 'Whether verification is required.' },
          verifier: { type: 'string', description: 'Verifier employee name when verification is required.' },
          attachmentRequired: { type: 'boolean', description: 'Whether proof/attachment is required.' },
          checklistItems: {
            type: 'array',
            items: { type: 'string' },
            description: 'Separate checklist row/item texts. Split multiple items; never merge them into one block.'
          }
        },
        required: ['question']
      }
    }
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateTaskStatus',
      description: 'Update the status of one or more tasks. Can update by task ID/title/index, arrays of IDs/titles/indexes, or a relative reference (e.g. latest, all_pending, all_overdue). Use arrays when the user asks to update multiple tasks in one message.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'integer', description: 'The exact task ID to update.' },
          taskIds: { type: 'array', items: { type: 'integer' }, description: 'Multiple exact task IDs to update.' },
          taskTitle: { type: 'string', description: 'Task title or fragment (fuzzy match).' },
          taskTitles: { type: 'array', items: { type: 'string' }, description: 'Multiple task titles/fragments to update.' },
          taskIndex: { type: 'integer', description: '1-based index from the last displayed task list (e.g., "task 2" -> 2).' },
          taskIndexes: { type: 'array', items: { type: 'integer' }, description: 'Multiple 1-based indexes from the last displayed task list.' },
          status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Hold'], description: 'The new status to set. Do not use priority phrases such as high priority, medium priority, or low priority as status.' },
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
      name: 'updateTaskPriority',
      description: [
        'Update the priority of an existing task by task ID or title.',
        'Use this when the user says to change/update/set task priority.',
        'Priority values are High, Medium, and Low. Map typos like "hight" to High.',
        'Do NOT list tasks for priority update requests.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'integer', description: 'The exact task ID to update.' },
          taskTitle: { type: 'string', description: 'Task title or exact title fragment.' },
          priority: { type: 'string', enum: ['High', 'Medium', 'Low'], description: 'The new priority.' },
        },
        required: ['priority'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateChecklistStatus',
      description: [
        'Update the status of an existing checklist by checklist ID or name.',
        'Use this when the user selects a new status after saying a checklist was completed by mistake.',
        'Do NOT delete the checklist for accidental completion, restore, undo, or revert wording.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          checklistId: { type: 'integer', description: 'The exact checklist ID to update.' },
          name: { type: 'string', description: 'Checklist name or fragment.' },
          status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Hold'], description: 'The new checklist status.' },
        },
        required: ['status'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateTaskLoopUsers',
      description: [
        'Add one or more users to the "in loop" (CC / watcher) list of an EXISTING task.',
        'Do NOT use this for a full new task request like "I told Aashu to do X. Keep Adarsh in the loop"; createTask must handle that.',
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
        'Do NOT use this for a full new task request like "I told Aashu to do X"; createTask must handle that.',
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
        'If a task title is mentioned anywhere in the message, extract and pass only that title as taskTitle. For example, "remove complete all user queries task" -> taskTitle="complete all user queries".',
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
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateTaskDueDate',
      description: [
        'Change or update the due date of an EXISTING task.',
        'Use this when the user says "change task due date", "update due date", "change deadline", or "task title is X into/to DATE".',
        'Pass taskTitle as the current task title or title fragment, and dueDate as the new date/time.',
        'Do NOT use updateTaskTitle for due date changes.',
        'Do NOT answer success unless this tool was called successfully.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'integer', description: 'Exact task id when known.' },
          taskTitle: { type: 'string', description: 'Current task title or fragment to find the task.' },
          dueDate: { type: 'string', description: 'New due date/time, e.g. 21/06/2026, 2026-06-21, tomorrow, tomorrow 5 pm.' },
        },
        required: ['dueDate'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'updateTaskTitle',
      description: [
        'Rename or change the title/name of an EXISTING task.',
        'Use this when the user says "change task title", "rename task", "update task name/title", or "change my task title X into Y".',
        'Pass taskTitle as the current title or title fragment, and newTitle as the new title.',
        'Do NOT use updateTaskAssignment for title changes.',
        'Do NOT answer success unless this tool was called successfully.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'integer', description: 'Exact task id when known.' },
          taskTitle: { type: 'string', description: 'Current task title or fragment to find the task.' },
          newTitle: { type: 'string', description: 'New title to save for the task.' },
        },
        required: ['newTitle'],
      },
    },
  },
  {
    type: 'function',
    role: 'any',
    function: {
      name: 'deleteChecklist',
      description: [
        'Delete an existing checklist. Use this when the user explicitly says to delete/remove/cancel a checklist.',
        'If the message contains the word checklist, NEVER use deleteTask.',
        'Extract the checklist name without the word checklist. Example: "delete website testing checklist" -> name="website testing".',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          checklistId: {
            type: 'integer',
            description: 'Exact checklist id when known.',
          },
          name: {
            type: 'string',
            description: 'Checklist name or fragment.',
          },
        },
      },
    },
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
