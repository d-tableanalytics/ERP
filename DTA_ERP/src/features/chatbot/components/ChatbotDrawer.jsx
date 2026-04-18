import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  MessageSquare, 
  Bot, 
  Minimize2, 
  Sparkles
} from 'lucide-react';
import {
  toggleChatbot,
  closeChatbot,
  sendMessage,
  clearMessages,
  clearError
} from '../store/chatbotSlice';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import ChatSuggestions from './ChatSuggestions';

/**
 * ChatbotDrawer Component - Premium floating chatbot interface
 * Supports Light and Dark modes with smooth transitions
 */
const ChatbotDrawer = () => {
  const dispatch = useDispatch();
  const { messages, isOpen, isTyping, error } = useSelector((state) => state.chatbot);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  // Clear error when component unmounts or chat closes
  useEffect(() => {
    return () => {
      if (error) {
        dispatch(clearError());
      }
    };
  }, [error, dispatch]);

  const handleSendMessage = (message) => {
    dispatch(sendMessage(message));
  };

  const handleClose = () => {
    dispatch(closeChatbot());
  };

  const handleClearChat = () => {
    dispatch(clearMessages());
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.button
            key="chat-trigger"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => dispatch(toggleChatbot())}
            className="w-16 h-16 bg-[var(--cb-accent)] text-white rounded-2xl shadow-2xl flex items-center justify-center group relative overflow-hidden"
            aria-label="Open chatbot"
          >
            <div className="absolute inset-0 bg-white/10 group-hover:bg-white/20 transition-colors" />
            <MessageSquare size={28} className="relative z-10" />
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 bg-white/20 blur-xl"
            />
          </motion.button>
        ) : (
          <motion.div
            key="chat-window"
            initial={{ y: 100, opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ y: 100, opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-[400px] h-[600px] max-h-[80vh] bg-[var(--cb-bg)] border border-[var(--cb-border)] rounded-[32px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_128px_-16px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden transition-colors duration-300"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--cb-border)] bg-[var(--cb-surface)] transition-colors duration-300">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                    <Bot size={24} className="text-white -rotate-3" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[var(--cb-bg)] rounded-full shadow-sm animate-cb-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-bold text-[var(--cb-text)] tracking-tight transition-colors duration-300">ERP Assistant</h3>
                    <Sparkles size={12} className="text-[var(--cb-accent)]" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-[11px] font-semibold text-[var(--cb-text)] opacity-50 uppercase tracking-widest transition-colors duration-300">Online • AI Assistant</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearChat}
                  className="p-2.5 text-[var(--cb-text)] opacity-40 hover:opacity-100 hover:bg-[var(--cb-text)] hover:bg-opacity-5 rounded-xl transition-all"
                  title="Clear chat"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={handleClose}
                  className="p-2.5 text-[var(--cb-text)] opacity-40 hover:opacity-100 hover:bg-[var(--cb-text)] hover:bg-opacity-5 rounded-xl transition-all"
                >
                  <Minimize2 size={18} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar scroll-smooth bg-[var(--cb-bg)] transition-colors duration-300"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-10">
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="p-6 bg-[var(--cb-surface)] border border-[var(--cb-border)] rounded-[32px] transition-colors duration-300"
                  >
                    <Bot size={48} className="text-[var(--cb-accent)] mb-2 inline-block" />
                    <h4 className="text-xl font-bold text-[var(--cb-text)] transition-colors duration-300">How can I help you?</h4>
                    <p className="text-sm text-[var(--cb-text)] opacity-50 mt-1 max-w-[240px] transition-colors duration-300">
                      Ask me anything about your tasks, checklists, or delegations.
                    </p>
                  </motion.div>
                  
                  <div className="w-full">
                    <p className="text-[10px] text-[var(--cb-text)] opacity-30 uppercase tracking-[0.2em] font-bold mb-4 transition-colors duration-300">Quick Suggestions</p>
                    <ChatSuggestions onSelect={handleSendMessage} />
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))}
                  
                  {isTyping && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start items-start gap-4 mb-6"
                    >
                      <div className="flex-shrink-0 pt-0.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-700 border border-blue-400/20 text-white flex items-center justify-center shadow-sm">
                          <Bot size={18} />
                        </div>
                      </div>
                      <div className="px-5 py-3.5 bg-[var(--cb-bot-msg)] border border-[var(--cb-bot-border)] rounded-2xl rounded-tl-none shadow-sm transition-colors duration-300">
                        <div className="flex gap-1.5 pt-1">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{
                                y: [0, -5, 0],
                                opacity: [0.4, 1, 0.4]
                              }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                delay: i * 0.15
                              }}
                              className="w-1.5 h-1.5 bg-[var(--cb-accent)] rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatbotDrawer;