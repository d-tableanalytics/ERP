/**
 * Chatbot Knowledge Base - structured internal knowledge for DTA_RACPL ERP
 * This file contains safe company and ERP-specific information only.
 */

const KNOWLEDGE_BASE = [
  // --- SPECIFIC ACTION GUIDANCE (PRIORITIZED) ---
  {
    keywords: ['complete task', 'complete tasks', 'how to complete tasks', 'how i can complete tasks', 'steps to complete task', 'finish task', 'task completion', 'mark task as completed', 'mark task as done', 'mark task completed', 'task finished'],
    title: 'Task Completion Guide',
    content: {
      intro: 'To complete a task in the ERP system, follow these steps:',
      steps: [
        'Open the **Delegation** module from the sidebar.',
        'Locate the **Pending** task in your list.',
        'Click to open the task details.',
        'Locate the **Status** dropdown (usually showing Pending or In Progress).',
        'Select **Completed** from the options.',
        'Click the **Update** or **Save** button to finalize the completion.'
      ],
      notes: [
        'Completed tasks move to history.',
        'Managers may receive status updates automatically.'
      ],
      closing: 'Let me know if you\'d also like help with other task actions.'
    }
  },
  {
    keywords: ['update task status', 'change task status', 'how to update status', 'how do i update task status', 'task status change', 'set task to pending', 'set task to in progress', 'set task to completed'],
    title: 'Updating Task Status',
    content: {
      intro: 'You can easily update the status of any task to keep your team informed:',
      steps: [
        'Open the **Delegation** module.',
        'Click on the specific task you want to update.',
        'Look for the **Status** dropdown menu.',
        'Select the appropriate status: **Pending**, **In Progress**, or **Completed**.',
        'Save the changes to update the task status across the system.'
      ],
      notes: [
        'Accurate status updates help in workload tracking.'
      ]
    }
  },
  {
    keywords: ['create checklist', 'how to create checklist', 'how i can create checklist', 'steps to create checklist', 'new checklist', 'add checklist', 'checklist creation', 'guide me to create checklist', 'how do i create a checklist', 'how can i create a checklist'],
    title: 'Checklist Creation Steps',
    content: {
      intro: 'Follow these steps to create a new checklist for your team:',
      steps: [
        'Go to the **Checklist** module in the sidebar.',
        'Click on the **Create Checklist** or **Add New** button.',
        'Enter the **Checklist Title** and a clear **Description**.',
        '**Assign Members** who will be responsible for the checklist items.',
        'Set the **Due Date** and any **Recurring Settings** if it\'s a routine task.',
        'Click **Save** to create the checklist and notify the assignees.'
      ]
    }
  },
  {
    keywords: ['complete checklist', 'how to complete checklist', 'how i can complete checklist', 'checklist completion steps', 'mark checklist as done', 'how do i complete a checklist', 'complete a checklist'],
    title: 'Completing a Checklist',
    content: {
      intro: 'To finalize a checklist, ensure all items are addressed:',
      steps: [
        'Open the **Checklist** module.',
        'Select the active checklist you are working on.',
        'Mark each individual item or sub-task as **Completed** by clicking its checkbox.',
        'Once all items are checked, the overall checklist status can be updated to **Completed**.',
        'Save your progress to finalize the completion.'
      ],
      closing: 'You can filter by "Completed" status to see finished checklists later.'
    }
  },
  {
    keywords: ['assign checklist', 'assign members to checklist', 'checklist assignment process', 'add team to checklist', 'who is assigned to checklist', 'process of assigning checklist', 'assign a checklist', 'how to assign a checklist', 'how do i assign a checklist'],
    title: 'Checklist Assignment Process',
    content: {
      intro: 'You can assign checklists to one or more team members:',
      steps: [
        'While creating or editing a checklist, locate the **Assignees** or **Members** section.',
        'Search for the employee names or select them from the list.',
        'You can assign multiple members to a single checklist.',
        'Each assigned member will see the checklist in their pending items.',
        'Save the checklist to trigger notifications to the assigned members.'
      ]
    }
  },
  {
    keywords: ['view completed checklists', 'see completed checklists', 'completed checklist history', 'find finished checklists', 'guide me to see completed checklists'],
    title: 'Checklist History',
    content: {
      intro: 'To review your past work, you can access the checklist history:',
      steps: [
        'Open the **Checklist** module from the sidebar.',
        'Use the **Filter** or **Status** dropdown at the top of the list.',
        'Select **Completed** or **Verified** from the filter options.',
        'The list will refresh to show all your historical completed checklists.',
        'Click on any entry to view the details and completion history.'
      ]
    }
  },
  {
    keywords: ['overdue tasks', 'check overdue tasks', 'how do i check overdue tasks', 'see late tasks', 'list overdue items'],
    title: 'Managing Overdue Work',
    content: {
      intro: 'Keep track of items that need immediate attention:',
      steps: [
        'Open the **Delegation** or **Checklist** module.',
        'Look for the **Filter** section at the top of the list.',
        'Apply the **Overdue** filter to see only tasks that have passed their due date.',
        'Alternatively, check the **Dashboard** summary for a quick count of overdue items.'
      ],
      closing: 'The dashboard count is the fastest way to see your pending workload.'
    }
  },
  {
    keywords: ['recurring checklist', 'create recurring checklist', 'help me create a recurring checklist', 'repeat checklist', 'checklist schedule', 'checklist recurring', 'recurring'],
    title: 'Recurring Checklist Guide',
    content: {
      intro: 'Automate routine tasks by setting up recurring checklists:',
      steps: [
        'Open the **Checklist** module and click **Create Checklist**.',
        'Fill in the title and description.',
        'Locate the **Recurring** or **Repeat** setting.',
        'Choose the frequency: **Daily**, **Weekly**, **Monthly**, or **Custom**.',
        'Set the start date and the time the checklist should regenerate.',
        'Save the checklist.'
      ],
      notes: [
        'The system will automatically create new instances based on your schedule.'
      ]
    }
  },
  {
    keywords: ['create delegation', 'new delegation', 'assign a task', 'how do i create a delegation', 'how to create a delegation', 'how to delegate', 'task assignment', 'add delegation', 'delegate job'],
    title: 'Delegation Workflow',
    content: {
      intro: 'Follow these steps to delegate a task to an employee:',
      steps: [
        'Open the **Delegation** module.',
        'Choose **Create** or **Add New Delegation**.',
        'Provide the task title and description.',
        'Assign it to the right employee or team.',
        'Set the due date and priority.',
        'Attach files if needed and submit.'
      ],
      notes: [
        'After submission, you can track the status and add remarks.'
      ]
    }
  },

  // --- GENERAL MODULE DESCRIPTIONS (FALLBACKS) ---
  {
    keywords: ['delegation module', 'what is delegation', 'delegation overview', 'what is delegation used for', 'purpose of delegation', 'describe delegation', 'about delegation module'],
    title: 'Delegation Module Overview',
    content: {
      intro: 'The Delegation module is used to assign and track work tasks across teams.',
      steps: [
        'Access it from the sidebar menu under **Delegation**.',
        'Use it to create task assignments, add details, and attach files.',
        'Review progress through status updates and remarks.'
      ]
    }
  },
  {
    keywords: ['help ticket module', 'what is help ticket', 'help ticket overview', 'how do i raise a help ticket', 'how to raise a help ticket', 'how to create ticket', 'helpdesk ticket', 'what is a help ticket'],
    title: 'Help Ticket Process',
    content: {
      intro: 'Use the Help Ticket module for support requests and issue tracking:',
      steps: [
        'Open the sidebar and click on **Help Ticket**.',
        'Click **Create New Ticket**.',
        'Enter a clear subject and description.',
        'Choose priority and category if available.',
        'Attach screenshots if helpful and submit.'
      ]
    }
  },
  {
    keywords: ['attendance module', 'what is attendance', 'attendance overview', 'check attendance history', 'attendance workflow', 'about attendance module'],
    title: 'Attendance Information',
    content: {
      intro: 'The Attendance module tracks your work hours and daily records:',
      steps: [
        'Open the sidebar and choose **Attendance**.',
        'Use the **Punch In** button to start your workday.',
        'Use **Punch Out** when your shift ends.',
        'Review your history for completed days and leaves.'
      ]
    }
  },
  {
    keywords: ['checklist module', 'what is checklist', 'checklist overview', 'what is checklist module used for', 'what is checklist used for', 'purpose of checklist', 'how to use checklist', 'about checklist module'],
    title: 'Checklist Module Overview',
    content: {
      intro: 'Checklists support daily routines and recurring tasks:',
      steps: [
        'Open the sidebar and click on **Checklist**.',
        'Create a new checklist or add items to an existing list.',
        'Mark items complete as you finish them.'
      ],
      notes: [
        'Regular completion helps maintain productivity standards.'
      ]
    }
  },
  {
    keywords: ['dashboard module', 'what is dashboard', 'dashboard overview', 'what is dashboard used for', 'purpose of dashboard', 'about dashboard module'],
    title: 'Dashboard Overview',
    content: {
      intro: 'The Dashboard provides a summary view of your key ERP metrics:',
      steps: [
        'Review widgets showing task counts and ticket statuses.',
        'Identify high-priority items and next actions.',
        'Access all modules quickly from the landing page.'
      ]
    }
  }
];

module.exports = KNOWLEDGE_BASE;
