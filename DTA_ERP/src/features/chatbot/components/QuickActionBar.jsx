import React from 'react';

const QuickActionBar = ({ actions = [], onAction }) => {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {actions.map((a, i) => (
        <button
          key={`${a.label}-${i}`}
          onClick={() => onAction?.(a)}
          className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
};

export default QuickActionBar;
