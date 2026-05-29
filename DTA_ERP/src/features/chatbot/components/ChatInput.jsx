import React, { useEffect, useRef, useState } from 'react';
import chatbotApi from '../services/chatbotApi';

/**
 * ChatInput Component - Input field for sending messages
 */
const ChatInput = ({ onSendMessage, disabled, editDraft, onEditDraftConsumed }) => {
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const inputRef = useRef(null);
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

  useEffect(() => {
    if (!editDraft?.text || disabled) return;
    setMessage(editDraft.text);
    onEditDraftConsumed?.();
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(editDraft.text.length, editDraft.text.length);
    }, 0);
  }, [disabled, editDraft, onEditDraftConsumed]);

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
    <form onSubmit={handleSubmit} style={{ background: 'var(--chatbot-shell-bg)' }}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={isListening ? 'Listening...' : 'Ask me anything...'}
          disabled={disabled}
          className={`w-full pl-3.5 ${inputRightPadding} py-2.5 text-sm border rounded-lg text-text-main placeholder:text-text-muted shadow-sm focus:outline-none focus:ring-4 transition-all disabled:opacity-50`}
          style={{
            background: 'var(--chatbot-input-bg)',
            borderColor: 'var(--chatbot-input-border)',
            '--tw-ring-color': 'var(--chatbot-input-ring)',
          }}
          maxLength={500}
        />
        {supportsVoiceInput && !disabled && (
          <button
            type="button"
            onClick={startVoiceInput}
            className={`absolute right-14 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all ${
              isListening
                ? 'bg-red-50 text-red-600 animate-pulse hover:bg-red-100'
                : 'text-primary hover:text-blue-700 hover:bg-primary/5 dark:text-blue-300 dark:hover:bg-blue-500/10'
            }`}
            title={isListening ? 'Stop listening' : 'Use microphone'}
            aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          >
            <span className="material-symbols-outlined !text-[21px] leading-none">{isListening ? 'mic_off' : 'mic'}</span>
          </button>
        )}
        {disabled ? (
          <button
            type="button"
            onClick={() => chatbotApi.abortStream()}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-white shadow-md shadow-blue-500/20 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
            title="Stop"
          >
            <span className="material-symbols-outlined !text-[19px] leading-none">stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!message.trim()}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-primary text-white shadow-md shadow-blue-500/20 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-30 disabled:grayscale transition-all"
            title="Send"
            aria-label="Send message"
          >
            <span className="material-symbols-outlined !text-[19px] leading-none">send</span>
          </button>
        )}
      </div>
      <p className="text-[9px] text-text-muted mt-1.5 px-1 flex justify-between">
        <span>{voiceError || (isListening ? 'Listening for your question' : 'Max 500 characters')}</span>
        <span>{supportsVoiceInput ? 'Speak or press Enter' : 'Press Enter to send'}</span>
      </p>
    </form>
  );
};

export default ChatInput;
