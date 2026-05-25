import React, { useEffect, useRef, useState } from 'react';
import chatbotApi from '../services/chatbotApi';

/**
 * ChatInput Component - Input field for sending messages
 */
const ChatInput = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const voiceSendTimerRef = useRef(null);
  const SpeechRecognition =
    typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const supportsVoiceInput = Boolean(SpeechRecognition);
  const inputRightPadding = supportsVoiceInput && !disabled ? 'pr-28' : 'pr-16';

  useEffect(() => () => {
    if (voiceSendTimerRef.current) {
      window.clearTimeout(voiceSendTimerRef.current);
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  useEffect(() => {
    if (disabled && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [disabled]);

  const sendMessage = (text) => {
    const cleanText = text.trim();
    if (cleanText && !disabled) {
      onSendMessage(cleanText);
      setMessage('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(message);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  const startVoiceInput = () => {
    if (!supportsVoiceInput || disabled) return;

    setVoiceError('');

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    transcriptRef.current = '';
    if (voiceSendTimerRef.current) {
      window.clearTimeout(voiceSendTimerRef.current);
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      if (voiceSendTimerRef.current) {
        window.clearTimeout(voiceSendTimerRef.current);
        voiceSendTimerRef.current = null;
      }

      const finalMessage = transcriptRef.current.trim();
      if (finalMessage) {
        sendMessage(finalMessage);
        transcriptRef.current = '';
      }
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (voiceSendTimerRef.current) {
        window.clearTimeout(voiceSendTimerRef.current);
        voiceSendTimerRef.current = null;
      }
      const nextError = event.error === 'not-allowed'
        ? 'Microphone permission was blocked'
        : 'Could not hear clearly';
      setVoiceError(nextError);
    };
    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current = `${transcriptRef.current} ${transcript}`.replace(/\s+/g, ' ').trim();
        } else {
          interimTranscript += transcript;
        }
      }

      const nextMessage = `${transcriptRef.current} ${interimTranscript}`.replace(/\s+/g, ' ').trim();
      if (!nextMessage) return;

      setMessage(nextMessage);

      if (voiceSendTimerRef.current) {
        window.clearTimeout(voiceSendTimerRef.current);
      }
      voiceSendTimerRef.current = window.setTimeout(() => {
        recognition.stop();
      }, 1600);
    };

    recognition.start();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-bg-card">
      <div className="relative flex items-center">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isListening ? 'Listening...' : 'Ask me anything...'}
          disabled={disabled}
          className={`w-full pl-4 ${inputRightPadding} py-3 text-sm border border-border-main rounded-xl bg-bg-main text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all disabled:opacity-50`}
          maxLength={500}
        />
        {supportsVoiceInput && !disabled && (
          <button
            type="button"
            onClick={startVoiceInput}
            className={`absolute right-14 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all ${
              isListening
                ? 'bg-red-50 text-red-600 animate-pulse hover:bg-red-100'
                : 'text-text-muted hover:text-primary hover:bg-primary/5'
            }`}
            title={isListening ? 'Stop listening' : 'Use microphone'}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          >
            <span className="material-symbols-outlined !text-[22px] leading-none">{isListening ? 'mic_off' : 'mic'}</span>
          </button>
        )}
        {disabled ? (
          <button
            type="button"
            onClick={() => chatbotApi.abortStream()}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 transition-all"
            title="Stop"
          >
            <span className="material-symbols-outlined !text-[20px] leading-none">stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!message.trim()}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-30 disabled:grayscale transition-all"
            title="Send"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined !text-[20px] leading-none">send</span>
          </button>
        )}
      </div>
      <p className="text-[9px] text-text-muted mt-2 px-1 flex justify-between">
        <span>{voiceError || (isListening ? 'Listening for your question' : 'Max 500 characters')}</span>
        <span>{supportsVoiceInput ? 'Speak or press Enter' : 'Press Enter to send'}</span>
      </p>
    </form>
  );
};

export default ChatInput;
