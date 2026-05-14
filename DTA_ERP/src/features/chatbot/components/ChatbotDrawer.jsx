import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  toggleChatbot,
  closeChatbot,
  sendMessageStream,
  resetSession,
  clearError,
} from '../store/chatbotSlice';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import TypingIndicator from './TypingIndicator';

const STARTER_PROMPTS = [
  'Show my pending tasks',
  'What\'s overdue?',
  'My attendance this week',
  'Show my dashboard',
];

/**
 * ChatbotDrawer Component - Main floating chatbot interface.
 * Wires the new streaming pipeline, renders cards, quick actions, and suggestions.
 */
const ChatbotDrawer = () => {
  const dispatch = useDispatch();
  const { messages, isOpen, isTyping, error, sessionId } = useSelector((s) => s.chatbot);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => () => { if (error) dispatch(clearError()); }, [error, dispatch]);

  const handleSendMessage = (message) => {
    if (!message) return;
    dispatch(sendMessageStream(message));
  };

  const handleClose = () => dispatch(closeChatbot());
  const handleNewChat = () => dispatch(resetSession());

  // The bot bubble is created lazily on the first delta/card/done. So while we're
  // still waiting, the last message is the user's turn — show typing indicator.
  // Once the bot bubble appears (with content), hide the indicator.
  const lastMsg = messages[messages.length - 1];
  const noBotBubbleYet = !lastMsg || lastMsg.sender === 'user';
  const showTyping = isTyping && noBotBubbleYet;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => dispatch(toggleChatbot())}
          className="chatbot-toggle-btn group"
          aria-label="Open chatbot"
        >
          <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform duration-300">smart_toy</span>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
        </button>
      )}

      <div className={`chatbot-drawer ${isOpen ? 'chatbot-drawer-open' : 'chatbot-drawer-closed'}`}>
        {/* Header */}
        <div className="chatbot-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-main leading-none">ADA · ERP Assistant</h3>
              <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                {sessionId ? 'Conversation in progress' : 'AI Powered · Ready to help'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              className="p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
              title="New chat"
            >
              <span className="material-symbols-outlined text-xl">edit_square</span>
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-text-muted hover:text-text-main hover:bg-bg-main rounded-lg transition-all"
              aria-label="Close chat"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-bg-card/50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
              <div className="w-16 h-16 bg-primary/5 rounded-3xl flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-4xl text-primary/40">chat_bubble</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-text-main">Hi, I'm ADA.</p>
                <p className="text-xs text-text-muted mt-1 max-w-[220px]">
                  Ask me about your tasks, checklists, attendance, tickets, or your dashboard. I understand follow-ups — try a question, then ask "show details".
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full pt-4">
                {STARTER_PROMPTS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSendMessage(suggestion)}
                    className="text-[11px] text-primary bg-primary/5 hover:bg-primary/10 border border-primary/10 py-2 px-3 rounded-lg transition-colors text-left flex items-center justify-between group"
                  >
                    {suggestion}
                    <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSuggestionPick={handleSendMessage}
                onQuickAction={(a) => handleSendMessage(a.prompt || a.label)}
              />
            ))
          )}

          {showTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-500 text-sm">error</span>
            <p className="text-[10px] text-red-600 font-medium">{error}</p>
          </div>
        )}

        <div className="chatbot-input-container">
          <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
        </div>
      </div>
    </>
  );
};

export default ChatbotDrawer;
