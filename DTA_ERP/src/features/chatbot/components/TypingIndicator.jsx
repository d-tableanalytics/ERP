import React from 'react';

const TypingIndicator = () => (
  <div className="flex justify-start mb-4 animate-slide-up">
    <div className="bg-bg-main border border-border-main p-3 rounded-2xl rounded-tl-none shadow-sm">
      <div className="flex space-x-1.5">
        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
      </div>
    </div>
  </div>
);

export default TypingIndicator;
