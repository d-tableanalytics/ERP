import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  toggleChatbot,
  closeChatbot,
  sendMessage,
  clearMessages,
  clearError
} from '../store/chatbotSlice';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

/**
 * ChatbotDrawer Component - Main floating chatbot interface
 */
const ChatbotDrawer = () => {
  const dispatch = useDispatch();
  const { messages, isOpen, isTyping, error } = useSelector((state) => state.chatbot);
  const messagesEndRef = useRef(null);

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

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => dispatch(toggleChatbot())}
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
          aria-label="Open chatbot"
        >
          <span className="material-symbols-outlined text-2xl group-hover:scale-110 transition-transform">
            chat
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="w-80 h-96 bg-bg-card border border-border-main rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border-main bg-bg-main">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-sm">smart_toy</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-main">ERP Assistant</h3>
              <p className="text-xs text-text-muted">Ask me anything about the system</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClearChat}
              className="p-1 text-text-muted hover:text-text-main transition-colors"
              aria-label="Clear chat"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
            <button
              onClick={handleClose}
              className="p-1 text-text-muted hover:text-text-main transition-colors"
              aria-label="Close chat"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="text-center text-text-muted py-8">
              <span className="material-symbols-outlined text-4xl mb-2 block">chat</span>
              <p className="text-sm">Hello! I'm your ERP assistant.</p>
              <p className="text-xs mt-1">Ask me about delegations, help tickets, attendance, or checklists.</p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          )}

          {isTyping && (
            <div className="flex justify-start mb-3">
              <div className="bg-bg-main border border-border-main p-3 rounded-lg">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
      </div>
    </div>
  );
};

export default ChatbotDrawer;
