import React from 'react';

/**
 * ChatMessage Component - Displays individual chat messages
 */
const ChatMessage = ({ message }) => {
  const isBot = message.sender === 'bot';

  return (
    <div className={`flex mb-3 ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] p-3 rounded-lg text-sm ${
          isBot
            ? 'bg-bg-card text-text-main border border-border-main'
            : 'bg-blue-600 text-white'
        }`}
      >
        <p className="whitespace-pre-line">{message.text}</p>
        <span className={`text-xs mt-1 block ${
          isBot ? 'text-text-muted' : 'text-blue-100'
        }`}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
};

export default ChatMessage;