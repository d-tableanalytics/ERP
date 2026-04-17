/**
 * Chatbot Knowledge Base - structured internal knowledge for DTA_RACPL ERP
 * This file contains safe company and ERP-specific information only.
 */

const KNOWLEDGE_BASE = [
  {
    keywords: ['delegation module', 'delegation', 'delegation workflow', 'assign task', 'how to delegate', 'create delegation', 'how do i create a delegation', 'what is delegation used for', 'purpose of delegation', 'assign work', 'task delegation', 'create task assignment', 'request support for delegation'],
    content: `The Delegation module is used to assign and track work tasks across teams. It helps managers and employees create task assignments, add details, attach files, set priority, and review progress.

How to access it:
- Open the sidebar and click on the Delegation menu.

Common workflow:
- Click create new delegation or add task.
- Enter the task title, description, assignee, due date, and any remarks.
- Attach supporting documents if needed.
- Submit the delegation and monitor its status on the delegation list.

Use it when you need to delegate a task, request work from another team member, or follow up on ongoing work items.`
  },
  {
    keywords: ['create delegation', 'new delegation', 'assign a task', 'how do i create a delegation', 'how to create a delegation', 'how to delegate', 'task assignment', 'add delegation', 'delegate job'],
    content: `To create a delegation, open the Delegation module, choose create or add new delegation, provide the task title and description, assign it to the right employee or team, set the due date and priority, attach files if needed, and submit. After submission, you can track the status and add remarks until the task is complete.`
  },
  {
    keywords: ['help ticket module', 'help ticket', 'support ticket', 'support request', 'raise ticket', 'create ticket', 'open ticket', 'submit ticket', 'how do i raise a help ticket', 'how to raise a help ticket', 'how to create ticket', 'log issue', 'report issue', 'ticket support', 'helpdesk ticket'],
    content: `The Help Ticket module is used for support requests and issue tracking. Employees can report technical issues, request features, or ask for assistance.

How to access it:
- Open the sidebar and click on Help Ticket.

Common workflow:
- Click create new ticket.
- Enter a clear subject and description of the issue.
- Choose priority and category if available.
- Attach screenshots or files if they help explain the problem.
- Submit the ticket and watch for updates in the ticket list.

Use this module whenever you need official support or need to log a problem that requires follow-up.`
  },
  {
    keywords: ['attendance module', 'attendance', 'punch in', 'punch out', 'time tracking', 'mark attendance', 'check attendance', 'attendance workflow'],
    content: `The Attendance module tracks employee work hours, punch-in/punch-out events, and daily attendance records.

How to access it:
- Open the sidebar and choose Attendance.

Common workflow:
- Use the punch in button to start your workday.
- Use punch out when your shift ends.
- Review your attendance history for completed days, leaves, and exceptions.
- Request leave or update missing punches if the option is available.

This module helps maintain accurate work time records and compliance with company attendance policies.`
  },
  {
    keywords: ['checklist module', 'checklist', 'daily checklist', 'todo list', 'tasks list', 'what is checklist module used for', 'purpose of checklist', 'how to use checklist', 'create checklist'],
    content: `The Checklist module supports daily routines and recurring tasks by letting users create and manage checklists. It is used to organize work items, track completion, and ensure important steps are not missed.

How to access it:
- Open the sidebar and click on Checklist.

Common workflow:
- Create a new checklist or add items to an existing list.
- Add descriptions or notes for each checklist item.
- Mark items complete as you finish them.
- Review the checklist history to confirm tasks were completed.

This module is useful for daily work routines, onboarding steps, review processes, or any repeated task sequence.`
  },
  {
    keywords: ['dashboard module', 'dashboard', 'overview', 'summary', 'report', 'what is dashboard used for', 'purpose of dashboard', 'dashboard overview'],
    content: `The Dashboard provides a summary view of key ERP metrics, recent activities, and module status. It is the main landing area that helps users quickly understand pending tasks, new tickets, attendance summaries, and overall workflow health.

How to access it:
- Open the sidebar and click Dashboard.

Common workflow:
- Review widgets or cards showing task counts, ticket statuses, attendance summaries, and recent activity.
- Use the dashboard to identify high-priority items and next actions.
- Navigate from the dashboard to specific modules for deeper details.

The dashboard is useful for getting a quick snapshot of your work and monitoring the overall ERP status.`
  },
  {
    keywords: ['what is checklist used for', 'purpose of checklist', 'checklist purpose', 'why use checklist', 'checklist explanation'],
    content: `The Checklist module is used for organizing recurring work and daily routines. It allows you to create task lists, mark items complete, and monitor progress. This ensures that important regular tasks are not missed and helps maintain consistent workflow standards.`
  },
  {
    keywords: ['what is delegation used for', 'delegation purpose', 'why use delegation', 'delegation explanation'],
    content: `The Delegation module is used to assign and track tasks between employees and teams. It provides a structured way to hand off work, set expectations, and follow progress until completion.`
  },
  {
    keywords: ['what is help ticket used for', 'help ticket purpose', 'why create ticket', 'ticket purpose'],
    content: `The Help Ticket module is used to log support requests, technical problems, and service inquiries. It ensures issues are formally recorded, prioritized, and tracked until resolution.`
  }
];

module.exports = KNOWLEDGE_BASE;
