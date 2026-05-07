/**
 * Chatbot Knowledge Base - structured internal knowledge for DTA_RACPL ERP
 * This file contains safe company and ERP-specific information only.
 */

const KNOWLEDGE_BASE = [
  // --- SPECIFIC ACTION GUIDANCE (PRIORITIZED) ---
  {
    keywords: ['complete task', 'complete tasks', 'how to complete tasks', 'how i can complete tasks', 'steps to complete task', 'finish task', 'task completion', 'mark task as completed', 'mark task as done', 'mark task completed', 'task finished'],
    content: `To complete a task in the ERP:
1. Open the **Delegation** module from the sidebar.
2. Locate the **Pending** task in your list.
3. Click to open the task details.
4. Locate the **Status** dropdown (usually showing Pending or In Progress).
5. Select **Completed** from the options.
6. Click the **Update** or **Save** button to finalize the completion.
Note: For checklist items, see "complete checklist".`
  },
  {
    keywords: ['update task status', 'change task status', 'how to update status', 'how do i update task status', 'task status change', 'set task to pending', 'set task to in progress', 'set task to completed'],
    content: `To update the status of a task:
1. Open the **Delegation** module.
2. Click on the specific task you want to update.
3. Look for the **Status** dropdown menu.
4. Select the appropriate status: **Pending**, **In Progress**, or **Completed**.
5. Save the changes to update the task status across the system.`
  },
  {
    keywords: ['create checklist', 'how to create checklist', 'how i can create checklist', 'steps to create checklist', 'new checklist', 'add checklist', 'checklist creation', 'guide me to create checklist', 'how do i create a checklist', 'how can i create a checklist'],
    content: `To create a new checklist:
1. Go to the **Checklist** module in the sidebar.
2. Click on the **Create Checklist** or **Add New** button.
3. Enter the **Checklist Title** and a clear **Description**.
4. **Assign Members** who will be responsible for the checklist items.
5. Set the **Due Date** and any **Recurring Settings** if it's a routine task.
6. Click **Save** to create the checklist and notify the assignees.`
  },
  {
    keywords: ['complete checklist', 'how to complete checklist', 'how i can complete checklist', 'checklist completion steps', 'mark checklist as done', 'how do i complete a checklist', 'complete a checklist'],
    content: `To complete a checklist:
1. Open the **Checklist** module.
2. Select the active checklist you are working on.
3. Mark each individual item or sub-task as **Completed** by clicking its checkbox.
4. Once all items are checked, the overall checklist status can be updated to **Completed**.
5. Save your progress to finalize the completion.`
  },
  {
    keywords: ['assign checklist', 'assign members to checklist', 'checklist assignment process', 'add team to checklist', 'who is assigned to checklist', 'process of assigning checklist', 'assign a checklist', 'how to assign a checklist', 'how do i assign a checklist'],
    content: `To assign a checklist to team members:
1. While creating or editing a checklist, locate the **Assignees** or **Members** section.
2. Search for the employee names or select them from the list.
3. You can assign multiple members to a single checklist.
4. Each assigned member will see the checklist in their pending items.
5. Save the checklist to trigger notifications to the assigned members.`
  },
  {
    keywords: ['view completed checklists', 'see completed checklists', 'completed checklist history', 'find finished checklists', 'guide me to see completed checklists'],
    content: `To view completed checklists:
1. Open the **Checklist** module from the sidebar.
2. Use the **Filter** or **Status** dropdown at the top of the list.
3. Select **Completed** or **Verified** from the filter options.
4. The list will refresh to show all your historical completed checklists.
5. You can click on any entry to view the details and completion history.`
  },
  {
    keywords: ['overdue tasks', 'check overdue tasks', 'how do i check overdue tasks', 'see late tasks', 'list overdue items'],
    content: `To check overdue tasks:
1. Open the **Delegation** or **Checklist** module.
2. Look for the **Filter** section at the top of the list.
3. Apply the **Overdue** filter to see only tasks that have passed their due date.
4. Alternatively, check the **Dashboard** summary for a quick count of overdue items and click it to view the full list.`
  },
  {
    keywords: ['recurring checklist', 'create recurring checklist', 'help me create a recurring checklist', 'repeat checklist', 'checklist schedule'],
    content: `To create a recurring checklist (for daily, weekly, or monthly tasks):
1. Open the **Checklist** module and click **Create Checklist**.
2. Fill in the title and description.
3. Locate the **Recurring** or **Repeat** setting.
4. Choose the frequency: **Daily**, **Weekly**, **Monthly**, or **Custom**.
5. Set the start date and the time the checklist should regenerate.
6. Save the checklist. The system will automatically create new instances based on your schedule.`
  },
  {
    keywords: ['create delegation', 'new delegation', 'assign a task', 'how do i create a delegation', 'how to create a delegation', 'how to delegate', 'task assignment', 'add delegation', 'delegate job'],
    content: `To create a delegation, open the Delegation module, choose create or add new delegation, provide the task title and description, assign it to the right employee or team, set the due date and priority, attach files if needed, and submit. After submission, you can track the status and add remarks until the task is complete.`
  },

  // --- GENERAL MODULE DESCRIPTIONS (FALLBACKS) ---
  {
    keywords: ['delegation module', 'delegation', 'delegation workflow', 'assign task', 'how to delegate', 'what is delegation used for', 'purpose of delegation', 'assign work', 'task delegation', 'create task assignment', 'request support for delegation'],
    content: `The Delegation module is used to assign and track work tasks across teams. It helps managers and employees create task assignments, add details, attach files, set priority, and review progress.

How to access it:
- Open the sidebar and click on the Delegation menu.

Common workflow:
- Click create new delegation or add task.
- Enter the task title, description, assignee, due date, and any remarks.
- Attach supporting documents if needed.
- Submit the delegation and monitor its status on the delegation list.`
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
- Submit the ticket and watch for updates in the ticket list.`
  },
  {
    keywords: ['attendance module', 'attendance', 'punch in', 'punch out', 'time tracking', 'check attendance history', 'attendance workflow'],
    content: `The Attendance module tracks employee work hours, punch-in/punch-out events, and daily attendance records.

How to access it:
- Open the sidebar and choose Attendance.

Common workflow:
- Use the punch in button to start your workday.
- Use punch out when your shift ends.
- Review your attendance history for completed days, leaves, and exceptions.`
  },
  {
    keywords: ['checklist module', 'checklist', 'daily checklist', 'todo list', 'tasks list', 'what is checklist module used for', 'purpose of checklist', 'how to use checklist'],
    content: `The Checklist module supports daily routines and recurring tasks by letting users create and manage checklists. It is used to organize work items, track completion, and ensure important steps are not missed.

How to access it:
- Open the sidebar and click on Checklist.

Common workflow:
- Create a new checklist or add items to an existing list.
- Add descriptions or notes for each checklist item.
- Mark items complete as you finish them.
- Review the checklist history to confirm tasks were completed.`
  },
  {
    keywords: ['dashboard module', 'dashboard', 'overview', 'summary', 'report', 'what is dashboard used for', 'purpose of dashboard', 'dashboard overview'],
    content: `The Dashboard provides a summary view of key ERP metrics, recent activities, and module status. It is the main landing area that helps users quickly understand pending tasks, new tickets, attendance summaries, and overall workflow health.

How to access it:
- Open the sidebar and click Dashboard.

Common workflow:
- Review widgets or cards showing task counts, ticket statuses, attendance summaries, and recent activity.
- Use the dashboard to identify high-priority items and next actions.`
  }
];

module.exports = KNOWLEDGE_BASE;
