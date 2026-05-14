import React from 'react';
import MarkdownLite from './MarkdownLite';
import TaskCard from './TaskCard';
import ChecklistCard from './ChecklistCard';
import TicketCard from './TicketCard';
import DashboardCard from './DashboardCard';
import EmployeeCard from './EmployeeCard';
import QuickActionBar from './QuickActionBar';
import SuggestionChips from './SuggestionChips';

/**
 * Renders a single chat turn. Supports:
 *   - User and bot bubbles
 *   - Markdown-lite content (bold, bullets, numbered lists)
 *   - Streaming caret while delta-receiving
 *   - Cards from the envelope (task / checklist / ticket / dashboard / employee)
 *   - Quick actions + follow-up suggestions
 */
const renderCard = (card, i) => {
  if (!card) return null;
  switch (card.type) {
    case 'task':         return <TaskCard key={i} card={card} />;
    case 'task-detail':  return <TaskCard key={i} card={card} detail />;
    case 'checklist':    return <ChecklistCard key={i} card={card} />;
    case 'help-ticket':  return <TicketCard key={i} card={card} />;
    case 'dashboard':    return <DashboardCard key={i} card={card} />;
    case 'employee':     return <EmployeeCard key={i} card={card} />;
    default:             return null;
  }
};

const ChatMessage = ({ message, onSuggestionPick, onQuickAction }) => {
  const isBot = message.sender === 'bot';
  const time = message.timestamp ? new Date(message.timestamp) : null;
  return (
    <div className={`flex w-full mb-4 animate-slide-up ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className={`chatbot-message-bubble ${isBot ? 'chatbot-message-bot' : 'chatbot-message-user'} max-w-[88%]`}>
        {isBot ? (
          <>
            <MarkdownLite text={message.text || ''} />
            {message.streaming && (
              <span className="inline-block w-1.5 h-3 bg-primary/60 ml-0.5 animate-pulse align-baseline" />
            )}
            {Array.isArray(message.cards) && message.cards.length > 0 && (
              <div className="mt-1">{message.cards.map(renderCard)}</div>
            )}
            {!message.streaming && Array.isArray(message.quickActions) && message.quickActions.length > 0 && (
              <QuickActionBar actions={message.quickActions} onAction={onQuickAction} />
            )}
            {!message.streaming && Array.isArray(message.suggestions) && message.suggestions.length > 0 && (
              <SuggestionChips suggestions={message.suggestions} onPick={onSuggestionPick} />
            )}
          </>
        ) : (
          <div className="whitespace-pre-line leading-relaxed">{message.text}</div>
        )}

        {time && (
          <div className={`text-[10px] mt-1 opacity-70 flex ${isBot ? 'justify-start' : 'justify-end'}`}>
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
