import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * ChatMessage Component - Displays individual chat messages with refined UI,
 * circular avatars, theme-aware premium cards, and full Markdown support.
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
        className={`flex flex-col max-w-[85%] ${
          isBot ? 'items-start' : 'items-end'
        }`}
      >
        <div
          style={{ background: isBot ? 'var(--cb-bot-msg)' : 'var(--cb-user-grad)' }}
          className={`p-3.5 px-4 rounded-2xl shadow-sm transition-all duration-300 min-w-[100px] overflow-hidden ${
            isBot
              ? 'border border-[var(--cb-bot-border)] rounded-tl-none backdrop-blur-sm'
              : 'bg-blue-600 rounded-tr-none shadow-blue-500/20'
          }`}
        >
          <div 
            className={`text-sm leading-relaxed break-words markdown-body ${
              isBot 
                ? 'text-[var(--cb-text)] !opacity-100 prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0' 
                : '!text-white !opacity-100 font-semibold text-right'
            }`}
          >
            {isBot ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.text}
              </ReactMarkdown>
            ) : (
              message.text
            )}
          </div>
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