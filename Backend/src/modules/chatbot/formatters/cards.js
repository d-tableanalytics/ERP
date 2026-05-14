/**
 * Card builders. Convert raw tool results into the frontend's card schema.
 * Frontend renders these as clickable, theme-consistent components.
 */

function taskCard(t) {
  if (!t) return null;
  return {
    type: 'task',
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    dueDateFormatted: t.dueDateFormatted,
    overdue: !!t.overdue,
    assignedBy: t.assignedBy,
    assignedTo: t.assignedTo,
  };
}

function taskDetailCard(t) {
  if (!t) return null;
  return {
    type: 'task-detail',
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    dueDateFormatted: t.dueDateFormatted,
    description: t.description,
    assignedBy: t.assignedBy,
    assignedTo: t.assignedTo,
    category: t.category,
    tags: t.tags,
    overdue: !!t.overdue,
    remarksCount: t.remarksCount,
    revisionsCount: t.revisionsCount,
    subtasksCount: t.subtasksCount,
  };
}

function checklistCard(c) {
  if (!c) return null;
  return {
    type: 'checklist',
    id: c.id,
    title: c.name,
    status: c.status,
    priority: c.priority,
    frequency: c.frequency,
    dueDate: c.dueDate,
    dueDateFormatted: c.dueDateFormatted,
    overdue: !!c.overdue,
    assignee: c.assignee,
    doer: c.doer,
  };
}

function ticketCard(t) {
  if (!t) return null;
  return {
    type: 'help-ticket',
    id: t.id,
    title: `Ticket ${t.ticketNo}`,
    issue: t.issue,
    status: t.status,
    priority: t.priority,
    stage: t.stage,
    location: t.location,
  };
}

function employeeCard(e) {
  if (!e) return null;
  return {
    type: 'employee',
    id: e.id,
    title: e.name,
    role: e.role,
    designation: e.designation,
    department: e.department,
    email: e.email,
  };
}

function dashboardCard(s) {
  if (!s) return null;
  return {
    type: 'dashboard',
    title: 'Your Dashboard',
    tasks: s.tasks,
    checklists: s.checklists,
    tickets: s.tickets,
  };
}

/**
 * Build cards from the array of tool results in a single turn.
 */
function fromToolResults(toolResults) {
  const cards = [];
  for (const tr of toolResults || []) {
    if (!tr || !tr.result || tr.result.ok === false) continue;
    const r = tr.result;
    switch (tr.name) {
      case 'getMyTasks':
        (r.tasks || []).forEach((t) => cards.push(taskCard(t)));
        break;
      case 'getTaskDetail':
        if (r.task) cards.push(taskDetailCard(r.task));
        break;
      case 'getMyChecklists':
        (r.checklists || []).forEach((c) => cards.push(checklistCard(c)));
        break;
      case 'getChecklistDetail':
        if (r.checklist) cards.push(checklistCard(r.checklist));
        break;
      case 'getOverdueItems':
        (r.tasks || []).forEach((t) => cards.push(taskCard(t)));
        (r.checklists || []).forEach((c) => cards.push(checklistCard(c)));
        break;
      case 'getMyHelpTickets':
        (r.tickets || []).forEach((t) => cards.push(ticketCard(t)));
        break;
      case 'getDashboardSummary':
        if (r.summary) cards.push(dashboardCard(r.summary));
        break;
      case 'searchEmployees':
        (r.employees || []).forEach((e) => cards.push(employeeCard(e)));
        break;
      default:
        // no cards
        break;
    }
  }
  return cards.filter(Boolean);
}

module.exports = {
  taskCard, taskDetailCard, checklistCard, ticketCard, employeeCard, dashboardCard,
  fromToolResults,
};
