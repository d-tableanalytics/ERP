import { fetchJSON } from '../../../services/api';
import { API_BASE_URL } from '../../../config';

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
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetchJSON(`${API_BASE_URL}/api/chatbot/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });

      if (!response.success) {
        throw new Error(response.message || 'Failed to get response');
      }

      return response;
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
      const token = localStorage.getItem('token');

      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetchJSON(`${API_BASE_URL}/api/chatbot/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response;
    } catch (error) {
      console.error('Chatbot history error:', error);
      throw error;
    }
  }
}

const chatbotApi = new ChatbotApi();
export default chatbotApi;