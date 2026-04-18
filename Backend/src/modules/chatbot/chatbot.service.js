const { pool } = require("../../config/db.config");
const CHATBOT_CONTEXT = require("./chatbot.context");
const chatbotOpenAI = require("./chatbot.openai");

/**
 * Chatbot Service - Handles intent detection, Context generation, and OpenAI response
 */
class ChatbotService {
  /**
   * Process user message and generate response using hybrid approach
   * @param {number} userId - User ID
   * @param {string} message - User's message
   * @param {string} userRole - User's role
   * @param {string} userName - User's name
   * @returns {Object} Response object
   */
  async processMessage(userId, message, userRole, userName = 'Employee') {
    try {
      // 1. Sanitize input
      const cleanMessage = this.sanitizeInput(message);

      // 2. Build Context
      const { intent, contextString } = await CHATBOT_CONTEXT.buildContext(userId, cleanMessage, userRole);

      // 3. Dynamic Prompt Generation
      const dynamicPrompt = `
You are the ERP AI Assistant for DTA_RACPL.

User:
Name: ${userName}
Role: ${userRole}

Context:
${contextString}

Rules:
- Answer ONLY using the context above. If no data is available in the context, say "I couldn't find specific data for your query" but try to answer general ERP workflow questions if asked.
- Use structured Markdown formatting.
- Use bullet points and headings.
- Be clear, professional, and concise.
- Group the counts by user/assignee if applicable.
- Do NOT guess or hallucinate any database entries that are not in the Context.
`;

      // 4. OpenAI Generation (passing temperature = 0.2 down)
      const openaiResult = await chatbotOpenAI.generateResponse(
        cleanMessage,
        dynamicPrompt,
        0.2 // Reduced temperature for grounded response
      );

      // 5. Logging
      await this.logConversation(userId, cleanMessage, openaiResult.message, intent, 'openai', openaiResult.tokens || 0);

      return {
        success: true,
        message: openaiResult.message,
        intent: intent,
        responseType: 'openai',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Chatbot service error:', error);
      return {
        success: false,
        message:
          "I ran into an issue while processing your request. Please try rephrasing your question.\n\n" +
          "**Examples I can help with:**\n" +
          "- *Show my pending checklist*\n" +
          "- *Which employee is overloaded?*\n" +
          "- *Show delegations assigned to Rahul*\n" +
          "- *Who raised the most help tickets?*\n\n" +
          "If the issue persists, please contact your system administrator.",
        intent: 'error',
        responseType: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Sanitize user input to prevent injection
   */
  sanitizeInput(message) {
    if (!message || typeof message !== 'string') return '';
    return message
      .trim()
      .replace(/[<>]/g, '') // Remove HTML
      .substring(0, 500) // Limit length
      .toLowerCase();
  }

  /**
   * Log conversation
   */
  async logConversation(userId, userMessage, botResponse, intent, responseType, openaiTokens) {
    try {
      const query = `
        INSERT INTO chatbot_conversations (user_id, message_text, response_text, intent, response_type, openai_tokens, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `;
      await pool.query(query, [userId, userMessage, botResponse, intent, responseType, openaiTokens]);
    } catch (error) {
      console.error('Failed to log conversation:', error);
    }
  }
}

module.exports = new ChatbotService();