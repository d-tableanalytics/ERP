import React, { useState } from 'react';

/**
 * ChatInput Component - Input field for sending messages
 */
const ChatInput = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg-card">
      <div className="relative flex items-center">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask me anything..."
          disabled={disabled}
          className="w-full pl-4 pr-12 py-3 text-sm border border-border-main rounded-xl bg-bg-main text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all disabled:opacity-50"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="absolute right-1.5 p-2 bg-primary text-white rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-30 disabled:grayscale transition-all"
        >
          <span className="material-symbols-outlined text-lg">send</span>
        </button>
      </div>
      <p className="text-[9px] text-text-muted mt-2 px-1 flex justify-between">
        <span>Max 500 characters</span>
        <span>Press Enter to send</span>
      </p>
    </form>
  );
};

export default ChatInput;
