import React from 'react';

const SuggestionChips = ({ suggestions = [], onPick }) => {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {suggestions.map((s, i) => (
        <button
          key={`${s}-${i}`}
          onClick={() => onPick?.(s)}
          className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
};

export default SuggestionChips;
