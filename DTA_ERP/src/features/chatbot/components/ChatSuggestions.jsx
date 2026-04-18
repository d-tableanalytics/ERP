import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, CheckSquare, ArrowRightLeft, Ticket, CalendarCheck } from 'lucide-react';

const SUGGESTIONS = [
  { label: 'My Tasks', icon: ClipboardList, text: 'What are my tasks for today?' },
  { label: 'Pending Checklists', icon: CheckSquare, text: 'Show my pending checklists' },
  { label: 'Create Delegation', icon: ArrowRightLeft, text: 'How do I create a delegation?' },
  { label: 'Help Tickets', icon: Ticket, text: 'View my help tickets' },
  { label: 'Attendance', icon: CalendarCheck, text: 'Show my attendance summary' },
];

/**
 * ChatSuggestions Component - Modern quick-action buttons with theme support
 */
const ChatSuggestions = ({ onSelect, className = "" }) => {
  return (
    <div className={`flex flex-wrap gap-2 justify-center px-4 ${className}`}>
      {SUGGESTIONS.map((suggestion, index) => (
        <motion.button
          key={suggestion.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ 
            scale: 1.05, 
            backgroundColor: 'var(--cb-accent)',
            color: '#ffffff',
            borderColor: 'var(--cb-accent)',
            boxShadow: '0 4px 15px rgba(59, 130, 246, 0.2)'
          }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(suggestion.text)}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--cb-border)] bg-[var(--cb-surface)] text-[11px] font-bold text-[var(--cb-text)] opacity-80 hover:opacity-100 transition-all shadow-sm"
        >
          <suggestion.icon size={13} className="text-[var(--cb-accent)] group-hover:text-white transition-colors" />
          {suggestion.label}
        </motion.button>
      ))}
    </div>
  );
};

export default ChatSuggestions;
