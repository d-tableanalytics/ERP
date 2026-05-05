import React from 'react';

/**
 * ChatMessage Component - Displays individual chat messages
 */
const ChatMessage = ({ message }) => {
  const isBot = message.sender === 'bot';

  return (
    <div className={`flex w-full mb-4 animate-slide-up ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`chatbot-message-bubble ${
          isBot ? 'chatbot-message-bot' : 'chatbot-message-user'
        }`}
      >
        <div className="whitespace-pre-line leading-relaxed">
          {message.text}
        </div>
        <div className={`text-[10px] mt-1 opacity-70 flex ${isBot ? 'justify-start' : 'justify-end'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
