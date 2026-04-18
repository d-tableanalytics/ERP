import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ChatInput Component - Input field for sending messages with theme-aware styling
 */
const ChatInput = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <div className="p-4 bg-[var(--cb-surface)] border-t border-[var(--cb-border)] sticky bottom-0 transition-colors duration-300">
      <form onSubmit={handleSubmit} className="relative group">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask me anything..."
          disabled={disabled}
          className={`w-full pl-5 pr-14 py-3.5 text-sm bg-[var(--cb-bg)] border border-[var(--cb-border)] rounded-2xl text-[var(--cb-text)] placeholder-[var(--cb-text)] placeholder-opacity-40 outline-none transition-all duration-300 disabled:opacity-50 ${
            isFocused 
              ? 'ring-2 ring-[var(--cb-accent)] ring-opacity-20 border-[var(--cb-accent)] border-opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
              : 'hover:border-[var(--cb-accent)] hover:border-opacity-30'
          }`}
          maxLength={500}
        />
        <AnimatePresence>
          {message.trim() && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                transition: { 
                  type: "spring",
                  stiffness: 400,
                  damping: 15
                }
              }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              type="submit"
              disabled={disabled}
              className="absolute right-2 top-2 bottom-2 w-10 h-10 flex items-center justify-center bg-[var(--cb-accent)] text-white rounded-xl hover:bg-opacity-90 transition-all shadow-lg shadow-blue-500/20"
            >
              <Send size={18} className="ml-0.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </form>
      <p className="text-[10px] text-center mt-2.5 text-[var(--cb-text)] opacity-30 font-medium tracking-tight">
        Powered by AI Assistant • Press Enter to send
      </p>
    </div>
  );
};

export default ChatInput;