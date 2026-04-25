/**
 * taskConstants.js
 * Shared constants for the Task Management module.
 * Import these instead of repeating magic strings across pages.
 */

export const TASK_STATUS = {
    ALL: 'All',
    OVERDUE: 'Overdue',
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    HOLD: 'Hold',
};

export const TASK_PRIORITY = {
    ALL: 'All',
    URGENT: 'Urgent',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
};

export const DATE_RANGES = [
    'All Time',
    'Today',
    'Yesterday',
    'This Week',
    'Last Week',
    'This Month',
    'Last Month',
    'This Year',
    'Custom',
];

/** Standard status tab definitions used across all task list pages. */
export const STATUS_TABS = [
    { label: 'All',         key: 'All',         dotClass: 'bg-slate-400' },
    { label: 'Overdue',     key: 'Overdue',     dotClass: 'bg-red-500' },
    { label: 'Pending',     key: 'Pending',     dotClass: 'border-2 border-slate-400 bg-transparent' },
    { label: 'In Progress', key: 'In Progress', dotClass: 'bg-orange-500' },
    { label: 'Completed',   key: 'Completed',   dotClass: 'bg-emerald-500' },
];
