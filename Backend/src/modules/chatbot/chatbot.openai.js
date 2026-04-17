const OpenAI = require('openai');

/**
 * OpenAI Integration for Chatbot
 * Handles OpenAI API calls with proper error handling and validation
 */
class ChatbotOpenAI {
  constructor() {
    this.client = null;
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 150;
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;
    this.timeout = 10000; // 10 seconds

    this.initializeClient();
  }

  /**
   * Initialize OpenAI client if API key is available
   */
  initializeClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey
      });
    } else {
      console.warn('OpenAI API key not found. OpenAI features will be disabled.');
    }
  }

  /**
   * Check if OpenAI is available
   * @returns {boolean} True if client is initialized
   */
  isAvailable() {
    return this.client !== null;
  }

  /**
   * Generate response using OpenAI
   * @param {string} userMessage - User's message
   * @param {string} systemPrompt - System instructions
   * @param {string} userRole - User's role
   * @returns {Object} Response object with message and metadata
   */
  async generateResponse(userMessage, systemPrompt, userRole) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI client not available');
    }

    try {
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `User (${userRole}): ${userMessage}`
        }
      ];

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature
      });

      const response = completion.choices[0]?.message?.content?.trim();

      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      return {
        success: true,
        message: response,
        model: this.model,
        tokens: completion.usage?.total_tokens || 0
      };

    } catch (error) {
      console.error('OpenAI API error:', error.message);
      throw new Error(`OpenAI request failed: ${error.message}`);
    }
  }

  /**
   * Validate OpenAI response for safety and relevance
   * @param {string} response - OpenAI response
   * @returns {boolean} True if response is safe
   */
  validateResponse(response) {
    if (!response || typeof response !== 'string') {
      return false;
    }

    // Check for sensitive information patterns
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /salary/i,
      /personal/i,
      /confidential/i,
      /admin/i,
      /database/i,
      /server/i
    ];

    if (sensitivePatterns.some(pattern => pattern.test(response))) {
      return false;
    }

    // Check response length
    if (response.length > 1000) {
      return false;
    }

    // Check for professional tone (basic check)
    const unprofessionalPatterns = [
      /fuck/i,
      /shit/i,
      /damn/i,
      /hell/i
    ];

    if (unprofessionalPatterns.some(pattern => pattern.test(response))) {
      return false;
    }

    return true;
  }
}

module.exports = new ChatbotOpenAI();