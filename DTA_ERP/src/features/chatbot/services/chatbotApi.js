import api from '../../../services/api';

/**
 * Chatbot API - Handles API communication with backend chatbot service
 */
class ChatbotApi {
  /**
   * Send message to chatbot backend
   * @param {string} message - User's message
   * @returns {Promise<Object>} Response from backend
   */
  async sendMessage(message) {
    try {
      const response = await api.post('/chatbot/message', { message });

      if (!response.data || !response.data.success) {
        throw new Error(response.data?.message || 'Failed to get response');
      }

      return response.data;
    } catch (error) {
      console.error('Chatbot API error:', error);
      throw error;
    }
  }

  /**
   * Get conversation history (for future use)
   * @returns {Promise<Object>} History data
   */
  async getHistory() {
    try {
      const response = await api.get('/chatbot/history');
      return response.data;
    } catch (error) {
      console.error('Chatbot history error:', error);
      throw error;
    }
  }
}

const chatbotApi = new ChatbotApi();
export default chatbotApi;