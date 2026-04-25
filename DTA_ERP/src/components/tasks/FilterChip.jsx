import React from 'react';
import { X } from 'lucide-react';

/**
 * FilterChip — a removable filter tag pill.
 * Replaces 5 identical inline definitions across task pages.
 *
 * @param {string}   label    - Text to display in the chip
 * @param {Function} onRemove - Called when the × button is clicked
 */
const FilterChip = ({ label, onRemove }) => (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-card border border-primary/40 dark:border-primary/20 text-primary rounded-full text-[11px] font-bold shadow-sm">
        {label}
        <button
            onClick={onRemove}
            aria-label={`Remove filter: ${label}`}
            className="hover:text-red-500 transition-colors ml-0.5"
        >
            <X size={12} strokeWidth={3} />
        </button>
    </div>
);

export default FilterChip;
