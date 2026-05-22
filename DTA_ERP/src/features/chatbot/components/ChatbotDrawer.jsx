import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  openChatbot,
  closeChatbot,
  sendMessageStream,
  resetSession,
  clearError,
  loadHistory,
  loadSessions,
  deleteSession,
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

const formatSessionTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const sessionLabel = (session) => {
  const title = session?.title && session.title !== 'null' ? session.title : '';
  if (title) return title;
  return `Chat ${formatSessionTime(session?.last_activity || session?.created_at) || ''}`.trim();
};

/**
 * ChatbotDrawer Component - Main floating chatbot interface.
 * Wires the streaming pipeline, renders cards, quick actions, and suggestions.
 */
const ChatbotDrawer = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    messages,
    isOpen,
    isTyping,
    error,
    sessionId,
    sessions,
    isLoadingSessions,
  } = useSelector((s) => s.chatbot);
  const messagesEndRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);
  const isChatbotRoute = location.pathname === '/chatbot';

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => () => { if (error) dispatch(clearError()); }, [error, dispatch]);

  useEffect(() => {
    if (isChatbotRoute && !isOpen) dispatch(openChatbot());
  }, [dispatch, isChatbotRoute, isOpen]);

  useEffect(() => {
    if (isOpen && showHistory) dispatch(loadSessions());
  }, [isOpen, showHistory, dispatch]);

  useEffect(() => {
    if (isOpen && sessionId && messages.length === 0) {
      dispatch(loadHistory(sessionId));
    }
  }, [isOpen, sessionId, messages.length, dispatch]);

  const handleSendMessage = (message) => {
    if (!message) return;
    dispatch(sendMessageStream(message));
  };

  const handleOpen = () => {
    dispatch(openChatbot());
    if (!isChatbotRoute) {
      navigate('/chatbot', {
        state: { from: `${location.pathname}${location.search}${location.hash}` },
      });
    }
  };

  const handleClose = () => {
    dispatch(closeChatbot());
    if (isChatbotRoute) {
      navigate(location.state?.from || '/dashboard', { replace: true });
    }
  };
  const handleNewChat = () => {
    dispatch(resetSession());
    if (showHistory) dispatch(loadSessions());
  };
  const handleToggleHistory = () => {
    const nextShowHistory = !showHistory;
    setShowHistory(nextShowHistory);
    if (nextShowHistory) dispatch(loadSessions());
  };
  const handleOpenSession = (nextSessionId) => {
    if (!nextSessionId || nextSessionId === sessionId) return;
    dispatch(loadHistory(nextSessionId));
  };
  const handleDeleteSession = (event, nextSessionId) => {
    event.stopPropagation();
    if (!nextSessionId) return;
    dispatch(deleteSession(nextSessionId));
  };

  // The bot bubble is created lazily on the first delta/card/done. So while we're
  // still waiting, the last message is the user's turn - show typing indicator.
  // Once the bot bubble appears (with content), hide the indicator.
  const lastMsg = messages[messages.length - 1];
  const noBotBubbleYet = !lastMsg || lastMsg.sender === 'user';
  const showTyping = isTyping && noBotBubbleYet;

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="chatbot-toggle-btn group"
          aria-label="Open chatbot"
        >
          <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform duration-300">smart_toy</span>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></div>
        </button>
      )}

      <div className={`chatbot-drawer ${showHistory ? 'chatbot-drawer-history-open' : ''} ${isOpen ? 'chatbot-drawer-open' : 'chatbot-drawer-closed'}`}>
        {showHistory && (
        <aside className="w-48 shrink-0 border-r border-border-main bg-bg-main/60 p-3 flex flex-col gap-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-base">edit_square</span>
            New Chat
          </button>

          <div className="min-h-0 flex-1">
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">History</p>
              {isLoadingSessions && (
                <span className="material-symbols-outlined text-sm text-text-muted animate-spin">progress_activity</span>
              )}
            </div>
            <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 max-h-full">
              {sessions.length === 0 && !isLoadingSessions ? (
                <p className="px-1 py-2 text-[11px] text-text-muted">No chats yet</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`group flex w-full items-center gap-1 rounded-lg px-2 py-2 transition-colors ${
                      session.session_id === sessionId
                        ? 'bg-primary/10 text-primary'
                        : 'text-text-main hover:bg-bg-card'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenSession(session.session_id)}
                      className="min-w-0 flex-1 text-left"
                      title={sessionLabel(session)}
                    >
                      <span className="block truncate text-xs font-medium">{sessionLabel(session)}</span>
                      <span className="block text-[10px] text-text-muted mt-0.5">
                        {formatSessionTime(session.last_activity || session.created_at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => handleDeleteSession(event, session.session_id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                      title="Delete chat"
                      aria-label={`Delete ${sessionLabel(session)}`}
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
        )}

        <div className="min-w-0 flex flex-1 flex-col">
          <div className="chatbot-header">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-primary text-xl">smart_toy</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main leading-none">ERP Assistant</h3>
                <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                  {sessionId ? 'Conversation in progress' : 'AI Powered - Ready to help'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleToggleHistory}
                className="p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                title={showHistory ? 'Hide history' : 'Show history'}
                aria-label={showHistory ? 'Hide chat history' : 'Show chat history'}
              >
                <span className="material-symbols-outlined text-xl">
                  {showHistory ? 'right_panel_close' : 'right_panel_open'}
                </span>
              </button>
              <button
                onClick={handleNewChat}
                className="sm:hidden p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
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

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-bg-card/50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
                <div className="w-16 h-16 bg-primary/5 rounded-3xl flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-4xl text-primary/40">chat_bubble</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-main">Hi, I'm ERP Assistant.</p>
                  <p className="text-xs text-text-muted mt-1 max-w-[220px]">
                    Ask me about your tasks, checklists, attendance, tickets, or your dashboard. I understand follow-ups - try a question, then ask "show details".
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
      </div>
    </>
  );
};

export default ChatbotDrawer;
