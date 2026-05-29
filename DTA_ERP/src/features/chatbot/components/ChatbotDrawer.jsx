import React, { useRef, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  openChatbot,
  closeChatbot,
  sendMessageStream,
  resetSession,
  clearError,
  loadHistory,
  loadSessions,
  deleteSession,
  loadSharedChat,
  createShareLink,
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
    isLoadingSharedChat,
    sharedChatError,
    isSharedChat,
  } = useSelector((s) => s.chatbot);
  const { token } = useSelector((s) => s.auth);
  const messagesScrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const historyListRef = useRef(null);
  const loadedSessionRef = useRef(null);
  const loadedShareTokenRef = useRef(null);
  const justCreatedShareTokenRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);
  const [messageDraft, setMessageDraft] = useState(null);
  const [historyMode, setHistoryMode] = useState('recents');
  const [historySearch, setHistorySearch] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isErpGptHome = location.pathname === '/erpgpt' || location.pathname === '/chatbot';
  const sessionMatch = location.pathname.match(/^\/erpgpt\/c\/([^/]+)$/);
  const routeSessionId = sessionMatch ? decodeURIComponent(sessionMatch[1]) : null;
  const shareMatch = location.pathname.match(/^\/erpgpt\/share\/([^/]+)$/);
  const shareToken = shareMatch ? decodeURIComponent(shareMatch[1]) : null;
  const isErpGptRoute = isErpGptHome || !!routeSessionId || !!shareToken;

  useEffect(() => {
    if (messages.length === 0) {
      messagesScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  useEffect(() => () => { if (error) dispatch(clearError()); }, [error, dispatch]);

  useEffect(() => {
    if (isErpGptHome && (!isOpen || isSharedChat)) {
      // Start a fresh chat when navigating to /erpgpt (like ChatGPT's new chat).
      dispatch(resetSession());
      dispatch(openChatbot());
    }
  }, [dispatch, isErpGptHome, isOpen, isSharedChat]);

  useEffect(() => {
    if (!routeSessionId) return;
    if (!isOpen) dispatch(openChatbot());
    if (loadedSessionRef.current === routeSessionId && sessionId === routeSessionId) return;
    loadedSessionRef.current = routeSessionId;
    setShowHistory(false);
    dispatch(loadHistory(routeSessionId));
  }, [dispatch, routeSessionId, sessionId, isOpen]);

  useEffect(() => {
    if (!shareToken || !token) return;
    if (!isOpen) dispatch(openChatbot());
    if (justCreatedShareTokenRef.current === shareToken) {
      justCreatedShareTokenRef.current = null;
      loadedShareTokenRef.current = shareToken;
      return;
    }
    if (loadedShareTokenRef.current === shareToken) return;
    loadedShareTokenRef.current = shareToken;
    setShowHistory(false);
    dispatch(loadSharedChat(shareToken));
  }, [dispatch, shareToken, token, isOpen]);

  useEffect(() => {
    if (isOpen && showHistory) dispatch(loadSessions());
  }, [isOpen, showHistory, dispatch]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      if (!isOpen) return;
      event.preventDefault();
      handleOpenSearch();
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isOpen]);

  const handleSendMessage = (message) => {
    if (!message) return;
    if (isSharedChat) return;
    dispatch(sendMessageStream(message))
      .unwrap()
      .then((envelope) => {
        if (envelope?.sessionId && location.pathname !== `/erpgpt/c/${envelope.sessionId}`) {
          navigate(`/erpgpt/c/${envelope.sessionId}`, { replace: location.pathname === '/erpgpt' });
        }
      })
      .catch(() => {});
  };

  const handleOpen = () => {
    // Always reset session when opening the drawer to start a new chat by default
    dispatch(resetSession());
    dispatch(openChatbot());
    navigate('/erpgpt');
  };

  const handleClose = () => {
    dispatch(closeChatbot());
    setIsFullscreen(false);
    if (isErpGptRoute) {
      navigate(location.state?.from || '/dashboard', { replace: true });
    }
  };
  const handleNewChat = () => {
    dispatch(resetSession());
    loadedSessionRef.current = null;
    navigate('/erpgpt');
    window.requestAnimationFrame(() => {
      messagesScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      historyListRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
    if (showHistory) dispatch(loadSessions());
  };
  const handleToggleHistory = () => {
    const nextShowHistory = !showHistory;
    setShowHistory(nextShowHistory);
    if (nextShowHistory) dispatch(loadSessions());
  };
  const handleOpenSearch = () => {
    setHistoryMode('search');
    setShowHistory(true);
    dispatch(loadSessions());
  };
  const handleOpenRecents = () => {
    setHistoryMode('recents');
    setShowHistory(true);
    setHistorySearch('');
    dispatch(loadSessions());
  };
  const handleOpenSession = (nextSessionId) => {
    if (!nextSessionId || nextSessionId === sessionId) return;
    navigate(`/erpgpt/c/${nextSessionId}`);
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
  const visibleSessions = sessions
    .filter((session) => {
      const query = historySearch.trim().toLowerCase();
      if (historyMode === 'search' && query) {
        return sessionLabel(session).toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => new Date(b.last_activity || b.created_at || 0) - new Date(a.last_activity || a.created_at || 0));

  const handleShareChat = async () => {
    if (!sessionId) return;
    await handleShareSession(sessionId, { navigateToShare: true });
  };

  const handleShareSession = async (nextSessionId, { navigateToShare = false } = {}) => {
    if (!nextSessionId) return;
    try {
      const data = await dispatch(createShareLink(nextSessionId)).unwrap();
      const nextShareToken = data?.shareToken;
      if (!nextShareToken) throw new Error('Share token was not returned');

      const sharePath = `/erpgpt/share/${nextShareToken}`;
      const shareUrl = new URL(sharePath, window.location.origin).toString();
      justCreatedShareTokenRef.current = nextShareToken;
      if (navigateToShare) navigate(sharePath);

      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied');
      } catch (_) {
        toast.success('Share link ready');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not create share link');
    }
  };

  const handleCopyMessage = async (message) => {
    const text = message?.text?.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Message copied');
    } catch (_) {
      toast.error('Could not copy message');
    }
  };

  const handleShareMessage = async (message) => {
    const text = message?.text?.trim();
    if (!text) return;
    try {
      if (navigator.share) {
        await navigator.share({ text, title: 'ERP Assistant message' });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success('Message copied for sharing');
    } catch (err) {
      if (err?.name !== 'AbortError') {
        toast.error('Could not share message');
      }
    }
  };

  const handleEditMessage = (message) => {
    if (isSharedChat || isTyping || !message?.text) return;
    setMessageDraft({ id: message.id, text: message.text });
  };

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

      <div className={`chatbot-drawer ${showHistory ? 'chatbot-drawer-history-open' : ''} ${isFullscreen ? 'chatbot-drawer-fullscreen' : ''} ${isOpen ? 'chatbot-drawer-open' : 'chatbot-drawer-closed'}`}>
        {!showHistory && (
        <aside className="chatbot-rail" aria-label="Chatbot navigation">
          <button
            type="button"
            onClick={handleToggleHistory}
            className={`chatbot-rail-btn ${showHistory ? 'chatbot-rail-btn-active' : ''}`}
            data-tooltip={showHistory ? 'Close sidebar' : 'Open sidebar'}
            aria-label={showHistory ? 'Close sidebar' : 'Open sidebar'}
          >
            <span className="material-symbols-outlined">left_panel_open</span>
          </button>
          <div className="chatbot-rail-actions">
            <button
              type="button"
              onClick={handleNewChat}
              className="chatbot-rail-btn"
              data-tooltip="New chat"
              aria-label="New chat"
            >
              <span className="material-symbols-outlined">edit_square</span>
            </button>
            <button
              type="button"
              onClick={handleOpenSearch}
              className={`chatbot-rail-btn ${showHistory && historyMode === 'search' ? 'chatbot-rail-btn-active' : ''}`}
              data-tooltip="Search chats  Ctrl + K"
              aria-label="Search chats"
            >
              <span className="material-symbols-outlined">search</span>
            </button>
            <button
              type="button"
              onClick={handleOpenRecents}
              className={`chatbot-rail-btn ${showHistory && historyMode === 'recents' ? 'chatbot-rail-btn-active' : ''}`}
              data-tooltip="Recents"
              aria-label="Recent chats"
            >
              <span className="material-symbols-outlined">chat_bubble</span>
            </button>
          </div>
        </aside>
        )}

        {showHistory && (
        <aside className="chatbot-history-panel w-64 shrink-0 p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-text-main">ERP Chats</h2>
            <button
              type="button"
              onClick={handleToggleHistory}
              className="chatbot-history-toggle"
              title="Close sidebar"
              aria-label="Close chat history sidebar"
            >
              <span className="material-symbols-outlined">left_panel_close</span>
            </button>
          </div>

          <button
            onClick={handleNewChat}
            className="chatbot-history-new-chat w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all"
          >
            <span className="material-symbols-outlined text-base">edit_square</span>
            New Chat
          </button>

          <div className="min-h-0 flex-1">
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="chatbot-history-title text-[11px] font-semibold uppercase tracking-wide">
                {historyMode === 'search' ? 'Search Chats' : 'Recents'}
              </p>
              {isLoadingSessions && (
                <span className="material-symbols-outlined text-sm chatbot-history-title animate-spin">progress_activity</span>
              )}
            </div>
            {historyMode === 'search' && (
              <div className="relative mb-2">
                <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-text-muted">search</span>
                <input
                  type="search"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Search chats"
                  className="chatbot-history-search w-full rounded-lg border py-2 pl-8 pr-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2"
                  autoFocus
                />
              </div>
            )}
            <div ref={historyListRef} className="chatbot-history-list space-y-1 overflow-y-auto custom-scrollbar pr-1 max-h-full">
              {visibleSessions.length === 0 && !isLoadingSessions ? (
                <p className="px-1 py-2 text-[11px] text-text-muted">
                  {historyMode === 'search' && historySearch ? 'No matching chats' : 'No chats yet'}
                </p>
              ) : (
                visibleSessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`group flex w-full items-center gap-1 rounded-lg px-2 py-2 transition-all ${
                      session.session_id === sessionId
                        ? 'chatbot-history-item-active'
                        : 'chatbot-history-item'
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
              {token && (
                <button
                  onClick={handleShareChat}
                  disabled={!sessionId || isSharedChat}
                  className="p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all disabled:opacity-40 disabled:hover:text-text-muted disabled:hover:bg-transparent"
                  title={isSharedChat ? 'Shared chats are read-only' : 'Share chat'}
                  aria-label="Share chat"
                >
                  <span className="material-symbols-outlined text-xl">ios_share</span>
                </button>
              )}
              <button
                onClick={() => setIsFullscreen((value) => !value)}
                className="p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                title={isFullscreen ? 'Exit full screen' : 'Full screen'}
                aria-label={isFullscreen ? 'Exit full screen' : 'Open chatbot full screen'}
              >
                <span className="material-symbols-outlined text-xl">
                  {isFullscreen ? 'close_fullscreen' : 'open_in_full'}
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

          <div ref={messagesScrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar chatbot-message-area">
            {isLoadingSharedChat ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                <span className="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
                <p className="text-sm font-semibold text-text-main">Loading shared chat...</p>
              </div>
            ) : sharedChatError ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-red-500">lock</span>
                </div>
                <p className="text-sm font-semibold text-text-main">{sharedChatError}</p>
              </div>
            ) : messages.length === 0 ? (
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
                  onCopy={handleCopyMessage}
                  onShare={handleShareMessage}
                  onEdit={!isSharedChat && !isTyping ? handleEditMessage : undefined}
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
            {isSharedChat ? (
              <div className="flex items-center gap-2 rounded-lg border border-border-main bg-bg-card px-3 py-2 text-xs text-text-muted">
                <span className="material-symbols-outlined text-base">visibility</span>
                Shared chat is read-only.
              </div>
            ) : (
              <ChatInput
                onSendMessage={handleSendMessage}
                disabled={isTyping}
                editDraft={messageDraft}
                onEditDraftConsumed={() => setMessageDraft(null)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatbotDrawer;
