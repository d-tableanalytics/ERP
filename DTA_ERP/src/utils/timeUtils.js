import { formatDistanceToNow } from 'date-fns';

/**
 * Formats a date to relative time (e.g., "2 hours ago")
 * @param {Date|string|number} date 
 * @returns {string}
 */
export const getRelativeTime = (date) => {
    if (!date) return 'N/A';
    try {
        const d = typeof date === 'string' && !date.endsWith('Z') ? new Date(date + 'Z') : new Date(date);
        return formatDistanceToNow(d, { addSuffix: true });
    } catch (error) {
        console.error('Error formatting relative time:', error);
        return 'N/A';
    }
};
