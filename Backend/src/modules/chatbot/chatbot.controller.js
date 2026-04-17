const chatbotService = require('./chatbot.service');

/**
 * Chatbot Controller - Handles HTTP requests for chatbot functionality
 */
class ChatbotController {
  /**
   * Handle incoming chat messages
   * POST /api/chatbot/message
   */
  async handleMessage(req, res) {
    try {
      const { message } = req.body;
      const userId = req.user?.user_id || req.user?.id; // Support both token payload formats
      const userRole = req.user?.role || 'Employee';

      // Validate input
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message is required and cannot be empty'
        });
      }

      if (message.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Message is too long (maximum 500 characters)'
        });
      }

      // Process message through service
      const result = await chatbotService.processMessage(userId, message, userRole);

      // Return response
      res.json(result);

    } catch (error) {
      console.error('Chatbot controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error. Please try again later.',
        intent: 'error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get conversation history (for future use)
   * GET /api/chatbot/history
   */
  async getHistory(req, res) {
    try {
      const userId = req.user?.user_id;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      // This would be implemented when history feature is needed
      res.json({
        success: true,
        message: 'History feature coming soon',
        conversations: []
      });

    } catch (error) {
      console.error('Chatbot history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversation history'
      });
    }
  }
}

module.exports = new ChatbotController();