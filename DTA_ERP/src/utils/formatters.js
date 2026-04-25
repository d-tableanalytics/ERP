/**
 * formatters.js
 * Shared formatting helpers for the Task Management module.
 */

/**
 * Returns a human-readable "time ago" string.
 * @param {string|Date} dateStr
 * @returns {string}  e.g. "Just now", "3h ago", "2d ago"
 */
export const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3_600_000);
    if (diff < 1) return 'Just now';
    if (diff < 24) return `${diff}h ago`;
    return `${Math.floor(diff / 24)}d ago`;
};

/**
 * Formats a date string to a locale-friendly display.
 * @param {string|Date|null} dateStr
 * @param {Intl.DateTimeFormatOptions} [opts]
 * @returns {string}
 */
export const formatDate = (dateStr, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', opts);
};

/**
 * Returns Tailwind CSS classes for a status badge pill.
 * @param {string} status
 * @returns {string}
 */
export const getStatusBadgeClass = (status) => {
    const base = 'px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border whitespace-nowrap';
    switch (status) {
        case 'Completed':
            return `${base} bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800`;
        case 'In Progress':
            return `${base} bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/10 dark:text-orange-400 dark:border-orange-800`;
        case 'Overdue':
        case 'OverDue':
            return `${base} bg-red-50 text-red-600 border-red-200 dark:bg-red-900/10 dark:text-red-400 dark:border-red-800`;
        case 'Hold':
            return `${base} bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-800`;
        default:
            return `${base} bg-bg-main text-text-muted border-border-main`;
    }
};

/**
 * Returns a Tailwind text-color class for a task priority.
 * @param {string} priority
 * @returns {string}
 */
export const getPriorityColor = (priority) => {
    switch (priority) {
        case 'Urgent': return 'text-red-500';
        case 'High':   return 'text-orange-500';
        case 'Medium': return 'text-blue-500';
        default:       return 'text-slate-400';
    }
};

/**
 * Parses a task's tags field safely (handles JSON string or array).
 * @param {string|Array} tags
 * @returns {Array}
 */
export const parseTags = (tags) => {
    try {
        const parsed = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/**
 * Triggers a CSV download of the provided tasks.
 * @param {Array}  exportTasks  - Array of task objects
 * @param {string} filenamePrefix - e.g. "all-tasks", "my-tasks"
 * @param {Function} toastFn  - toast.success / toast.error
 */
export const exportTasksToCSV = (exportTasks, filenamePrefix = 'tasks', toastFn = () => {}) => {
    if (!exportTasks || exportTasks.length === 0) {
        toastFn('No tasks to export with current filters');
        return;
    }

    const cell = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const fmtDate = (d) =>
        d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    const headers = [
        'Task Title', 'Status', 'Priority', 'Category',
        'Assigned By', 'Assigned To',
        'Due Date', 'Created At', 'Department', 'Description',
    ];

    const rows = exportTasks.map((t) => {
        const tagStr = parseTags(t.tags).map((tag) => tag?.text || tag).join(', ');
        return [
            cell(t.taskTitle),
            cell(t.status),
            cell(t.priority),
            cell(t.category || ''),
            cell(`${t.assignerFirstName || ''} ${t.assignerLastName || ''}`.trim()),
            cell(`${t.doerFirstName || ''} ${t.doerLastName || ''}`.trim()),
            cell(fmtDate(t.dueDate)),
            cell(fmtDate(t.createdAt)),
            cell(t.department || ''),
            cell(t.description || ''),
        ].join(',');
    });

    const filename = `${filenamePrefix}_${new Date().toLocaleDateString('en-CA')}.csv`;
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
