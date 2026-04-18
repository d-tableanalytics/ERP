import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';

/**
 * ChatMessage Component - Displays individual chat messages with refined UI,
 * circular avatars, and theme-aware premium cards.
 */
const ChatMessage = ({ message }) => {
  const isBot = message.sender === 'bot';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex mb-6 gap-3 group/msg ${isBot ? 'flex-row' : 'flex-row-reverse'}`}
    >
      {/* Avatar Container */}
      <div className="flex-shrink-0 pt-0.5">
        <div 
          className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm border transition-all duration-300 ${
            isBot 
              ? 'bg-gradient-to-tr from-blue-600 to-indigo-700 border-blue-400/20 text-white' 
              : 'bg-slate-800 border-slate-700 text-slate-200 dark:bg-slate-700'
          }`}
        >
          {isBot ? <Bot size={18} /> : <User size={18} />}
        </div>
      </div>
      
      {/* Message Bubble & Content */}
      <div
        className={`flex flex-col max-w-[78%] ${
          isBot ? 'items-start' : 'items-end'
        }`}
      >
        <div
          style={{ background: isBot ? 'var(--cb-bot-msg)' : 'var(--cb-user-grad)' }}
          className={`p-3.5 px-4 rounded-2xl shadow-sm transition-all duration-300 min-w-[100px] ${
            isBot
              ? 'border border-[var(--cb-bot-border)] rounded-tl-none backdrop-blur-sm'
              : 'bg-blue-600 rounded-tr-none shadow-blue-500/20'
          }`}
        >
          <p 
            className={`text-sm leading-relaxed break-words whitespace-pre-wrap ${
              isBot 
                ? 'text-[var(--cb-text)] !opacity-100' 
                : '!text-white !opacity-100 font-semibold'
            }`}
          >
            {message.text}
          </p>
        </div>
        
        {/* Timestamp */}
        <div className={`mt-1.5 flex items-center gap-1.5 px-1 opacity-0 group-hover/msg:opacity-60 transition-opacity duration-300`}>
          <span className={`text-[10px] font-bold uppercase tracking-widest text-[var(--cb-text)]`}>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;