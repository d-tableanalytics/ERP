const OpenAI = require('openai');

/**
 * OpenAI Integration for Chatbot
 */
class ChatbotOpenAI {
  constructor() {
    this.client = null;
    this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 500;
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;

    this.initializeClient();
  }

  initializeClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey: apiKey });
    } else {
      console.warn('OpenAI API key not found. OpenAI features will be disabled.');
    }
  }

  isAvailable() {
    return this.client !== null;
  }

  /**
   * Generate response using OpenAI
   * @param {string} userMessage - User's message
   * @param {string} systemPrompt - System instructions including Context
   * @param {number} overrideTemp - Override temperature to enforce strict output
   */
  async generateResponse(userMessage, systemPrompt, overrideTemp = null) {
    if (!this.isAvailable()) {
      throw new Error('OpenAI client not available');
    }

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        max_tokens: this.maxTokens,
        temperature: overrideTemp !== null ? overrideTemp : this.temperature
      });

      let responseText = completion.choices[0]?.message?.content?.trim();

      if (!responseText) {
        throw new Error('Empty response from OpenAI');
      }

      return {
        success: true,
        message: responseText,
        model: this.model,
        tokens: completion.usage?.total_tokens || 0
      };
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      throw new Error(`OpenAI request failed: ${error.message}`);
    }
  }

  /**
   * Validate response for safety
   */
  validateResponse(response) {
    if (!response || typeof response !== 'string') return false;
    const sensitivePatterns = [/password/i, /secret/i, /token/i, /key/i, /salary/i];
    if (sensitivePatterns.some(p => p.test(response))) return false;
    return true;
  }
}

module.exports = new ChatbotOpenAI();