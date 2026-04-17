import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import chatbotApi from '../services/chatbotApi';

// Async thunk for sending messages
export const sendMessage = createAsyncThunk(
  'chatbot/sendMessage',
  async (message, { rejectWithValue }) => {
    try {
      const response = await chatbotApi.sendMessage(message);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to send message');
    }
  }
);

const chatbotSlice = createSlice({
  name: 'chatbot',
  initialState: {
    messages: [],
    isOpen: false,
    isTyping: false,
    error: null,
  },
  reducers: {
    toggleChatbot: (state) => {
      state.isOpen = !state.isOpen;
    },
    closeChatbot: (state) => {
      state.isOpen = false;
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    clearMessages: (state) => {
      state.messages = [];
    },
    setTyping: (state, action) => {
      state.isTyping = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isTyping = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isTyping = false;
        // Add user message and bot response
        const userMessage = {
          id: Date.now(),
          text: action.meta.arg, // The message that was sent
          sender: 'user',
          timestamp: new Date().toISOString(),
        };
        const botMessage = {
          id: Date.now() + 1,
          text: action.payload.message,
          sender: 'bot',
          timestamp: action.payload.timestamp,
        };
        state.messages.push(userMessage);
        state.messages.push(botMessage);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isTyping = false;
        state.error = action.payload;
        // Add error message
        const errorMessage = {
          id: Date.now(),
          text: 'Sorry, I encountered an error. Please try again.',
          sender: 'bot',
          timestamp: new Date().toISOString(),
        };
        state.messages.push(errorMessage);
      });
  },
});

export const {
  toggleChatbot,
  closeChatbot,
  addMessage,
  clearMessages,
  setTyping,
  clearError,
} = chatbotSlice.actions;

export default chatbotSlice.reducer;