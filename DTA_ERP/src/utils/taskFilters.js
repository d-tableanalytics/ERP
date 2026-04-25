/**
 * taskFilters.js
 * Single source of truth for all date-range filtering logic used
 * across AllTasks, MyTasks, DelegatedTasks, SubscribedTasks, DeletedTasks.
 */

/**
 * Returns true if the given taskDate falls within the specified range.
 * @param {string|Date|null} taskDate
 * @param {string} range  - One of DATE_RANGES values
 * @param {string} customStart - ISO date string (YYYY-MM-DD), only used when range === 'Custom'
 * @param {string} customEnd   - ISO date string (YYYY-MM-DD), only used when range === 'Custom'
 * @returns {boolean}
 */
export const getDateRangeFilter = (taskDate, range, customStart = '', customEnd = '') => {
    if (!taskDate) return false;
    const d = new Date(taskDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
        case 'Today':
            return d >= today;

        case 'Yesterday': {
            const y = new Date(today);
            y.setDate(y.getDate() - 1);
            return d >= y && d < today;
        }

        case 'This Week': {
            const s = new Date(today);
            s.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
            return d >= s;
        }

        case 'Last Week': {
            const s = new Date(today);
            s.setDate(today.getDate() - today.getDay() - 6);
            const e = new Date(s);
            e.setDate(s.getDate() + 6);
            return d >= s && d <= e;
        }

        case 'Next Week': {
            const s = new Date(today);
            s.setDate(today.getDate() - today.getDay() + 7);
            const e = new Date(s);
            e.setDate(s.getDate() + 6);
            return d >= s && d <= e;
        }

        case 'This Month':
            return d >= new Date(now.getFullYear(), now.getMonth(), 1);

        case 'Last Month': {
            const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const e = new Date(now.getFullYear(), now.getMonth(), 0);
            return d >= s && d <= e;
        }

        case 'Next Month': {
            const s = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const e = new Date(now.getFullYear(), now.getMonth() + 2, 0);
            return d >= s && d <= e;
        }

        case 'This Year':
            return d >= new Date(now.getFullYear(), 0, 1);

        case 'Custom': {
            if (!customStart || !customEnd) return true;
            return d >= new Date(customStart) && d <= new Date(customEnd + 'T23:59:59');
        }

        case 'All Time':
        default:
            return true;
    }
};

/**
 * Returns true if a task is overdue (not completed and past due date).
 * @param {object} task 
 * @returns {boolean}
 */
export const isOverdue = (task) => {
    if (!task) return false;
    const isCompleted = (task.status || '').toLowerCase() === 'completed';
    if (isCompleted) return false;
    
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date();
};

/**
 * Returns the effective status of a task for display purposes.
 * @param {object} task 
 * @returns {string}
 */
export const calculateTaskStatus = (task) => {
    const s = (task.status || '').toLowerCase().replace(/[\s-]/g, '');
    
    // If it's a special status, keep it.
    if (s === 'needrevision') return 'Need Revision';
    if (s === 'hold') return 'Hold';
    if (s === 'completed') return 'Completed';

    if (isOverdue(task)) return 'Overdue';
    return task.status;
};


/**
 * Returns true if a task matches the given status filter.
 * Handles 'Overdue' as a condition and others as exact matches.
 * @param {object} task 
 * @param {string} filter 
 * @returns {boolean}
 */
export const taskMatchesStatus = (task, filter) => {
    if (filter === 'All') return true;
    if (filter === 'Overdue') return isOverdue(task);
    
    const s = (task.status || '').toLowerCase().replace(/[\s-]/g, '');
    const f = (filter || '').toLowerCase().replace(/[\s-]/g, '');
    return s === f;
};



