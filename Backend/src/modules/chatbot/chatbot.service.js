const { pool } = require("../../config/db.config");
const CHATBOT_CONTEXT = require("./chatbot.context");
const chatbotOpenAI = require("./chatbot.openai");
const KNOWLEDGE_BASE = require("./chatbot.knowledge");

/**
 * Chatbot Service - Handles rule-based intent detection, knowledge search, and OpenAI integration
 * Uses hybrid approach: rule-based first, knowledge-aware OpenAI as fallback
 */
class ChatbotService {
  /**
   * Process user message and generate response using hybrid approach
   * @param {number} userId - User ID from JWT
   * @param {string} message - User's message
   * @param {string} userRole - User's role (Admin, SuperAdmin, Employee)
   * @returns {Object} Response object with message and metadata
   */
  async processMessage(userId, message, userRole) {
    try {
      // Sanitize input
      const cleanMessage = this.sanitizeInput(message);

      // Split queries for multi-intent handling
      const segments = this.splitQueries(cleanMessage);
      let responses = [];
      let lastEntity = null;
      let totalTokens = 0;
      let primaryIntent = 'unknown';

      for (const segment of segments) {
        // Detect intent using keyword matching for this segment
        const intent = this.detectIntent(segment);
        if (intent !== 'unknown' && primaryIntent === 'unknown') primaryIntent = intent;

        // Priority 1: Rule-based (Greetings, Help)
        if (['greeting', 'help'].includes(intent)) {
          responses.push(this.generateResponse(intent, userRole));
          continue;
        }

        // Priority 2: Data Query (with list mode support)
        if (this.isDataQuery(segment) || this.isListQuery(segment)) {
          const dataResult = await this.handleDataQuery(userId, segment, lastEntity);
          if (dataResult) {
            responses.push(dataResult.message);
            if (dataResult.entity) lastEntity = dataResult.entity;
            if (primaryIntent === 'unknown') primaryIntent = 'data_query';
            continue;
          }
        }

        // Priority 3: Knowledge Base
        const knowledgeEntry = this.findKnowledgeEntry(segment);
        const knowledgeContent = knowledgeEntry ? this.sanitizeKnowledgeContent(knowledgeEntry.content) : null;
        if (knowledgeContent) {
          responses.push(knowledgeContent);
          if (primaryIntent === 'unknown') primaryIntent = 'knowledge';
          continue;
        }

        // Priority 4: Rule-based fallback (Module info)
        if (intent !== 'unknown') {
          responses.push(this.generateResponse(intent, userRole));
          continue;
        }

        // Priority 5: OpenAI fallback (only if this is the only segment or nothing else matched)
        if (responses.length === 0 || segments.length === 1) {
          try {
            const openaiResult = await this.generateOpenAIResponse(segment, userRole, knowledgeContent);
            if (openaiResult.success) {
              responses.push(openaiResult.message);
              totalTokens += (openaiResult.tokens || 0);
            } else if (responses.length === 0) {
              responses.push(this.getFallbackResponse());
            }
          } catch (error) {
            console.error('OpenAI integration error:', error);
            if (responses.length === 0) responses.push(this.getFallbackResponse());
          }
        }
      }

      const finalResponse = responses.length > 0 ? responses.join('\n\n') : this.getFallbackResponse();
      const responseType = responses.length > 1 ? 'multi-intent' : 'standard';

      // Log conversation with aggregated response
      await this.logConversation(userId, cleanMessage, finalResponse, primaryIntent, responseType, totalTokens);

      return {
        success: true,
        message: finalResponse,
        intent: primaryIntent,
        responseType: responseType,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Chatbot service error:', error);
      return {
        success: false,
        message: "I'm sorry, I'm having trouble processing your message right now. Please try again later.",
        intent: 'error',
        responseType: 'error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Split message into multiple queries based on separators
   * @param {string} message - Sanitized message
   * @returns {string[]} Array of query segments
   */
  splitQueries(message) {
    if (!message) return [];
    // Split by common conjunctions and punctuation
    const segments = message.split(/\band\b|\balso\b|\bthen\b|[,;]/i);
    return segments.map(s => s.trim()).filter(s => s.length > 1);
  }

  /**
   * Sanitize user input to prevent injection and clean text
   * @param {string} message - Raw user message
   * @returns {string} Sanitized message
   */
  sanitizeInput(message) {
    if (!message || typeof message !== 'string') return '';

    return message
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 500) // Limit length
      .toLowerCase(); // Normalize for matching
  }

  /**
   * Detect intent using simple keyword matching from context
   * @param {string} message - Cleaned user message
   * @returns {string} Detected intent
   */
  detectIntent(message) {
    const intents = CHATBOT_CONTEXT.intents;

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        return intent;
      }
    }

    return 'unknown';
  }

  /**
   * Detect if message is a data-based query
   * @param {string} message - Cleaned user message
   * @returns {boolean} True if data query keywords are found
   */
  isDataQuery(message) {
    const dataKeywords = [
      'total', 'count', 'how many', 'number', 'pending', 'completed', 
      'statu', 'assigned', 'my tasks', 'mine'
    ];
    return dataKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Detect if message is explicitly a count query
   * @param {string} message - Cleaned user message
   * @returns {boolean} True if count keywords are found
   */
  isCountQuery(message) {
    const countKeywords = ['total', 'count', 'how many', 'number of'];
    return countKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Detect if message is asking for a list of items
   * @param {string} message - Cleaned user message
   * @returns {boolean} True if list keywords are found
   */
  isListQuery(message) {
    const listKeywords = ['what are they', 'show', 'names', 'which ones'];
    // Use regex for 'list' to avoid matching 'checklist'
    const hasExplicitList = listKeywords.some(k => message.includes(k)) || /\blist\b/i.test(message);
    return hasExplicitList;
  }

  /**
   * Handle data-based queries by executing SELECT statements
   * @param {number} userId - User ID
   * @param {string} message - Cleaned user message
   * @param {string} contextEntity - Entity from previous segment (optional)
   * @returns {Object|null} Result object or null if no entity matched
   */
  async handleDataQuery(userId, message, contextEntity = null) {
    try {
      let entity = contextEntity;
      if (message.includes('checklist') || message.includes('chcklst')) entity = 'checklist';
      else if (message.includes('delegation') || message.includes('delegat')) entity = 'delegation';
      else if (message.includes('ticket') || message.includes('tict')) entity = 'help_tickets';
      else if (message.includes('task') || message.includes('work')) entity = 'task';

      if (!entity) return null;

      const isPending = message.includes('pending') || message.includes('open') || message.includes('statu');
      const isCompleted = message.includes('completed') || message.includes('closed') || message.includes('done');
      const isMy = message.includes('my') || message.includes('mine') || message.includes('i have') || message.includes('assigned');
      
      // Intent priority: Count overrides List
      const isCount = this.isCountQuery(message);
      const isList = !isCount && this.isListQuery(message);

      let response = '';

      if (entity === 'checklist') {
        let statusFilter = "status = 'Pending'";
        if (isCompleted) statusFilter = "status = 'Completed'";
        
        if (isList) {
          const q = `SELECT question FROM checklist WHERE ${statusFilter} ${isMy ? 'AND doer_id = $1' : ''} LIMIT 5`;
          const res = await pool.query(q, isMy ? [userId] : []);
          if (res.rows.length === 0) {
            response = `I couldn't find any ${isCompleted ? 'completed' : 'pending'} checklists ${isMy ? 'assigned to you' : ''}.`;
          } else {
            const list = res.rows.map(r => `• ${r.question}`).join('\n');
            response = `Here are some of the ${isCompleted ? 'completed' : 'pending'} checklists:\n${list}`;
          }
        } else {
          const q = `SELECT COUNT(*) FROM checklist WHERE ${statusFilter} ${isMy ? 'AND doer_id = $1' : ''}`;
          const res = await pool.query(q, isMy ? [userId] : []);
          const count = res.rows[0].count;
          response = isMy 
            ? `You have ${count} ${isCompleted ? 'completed' : 'pending'} checklists.` 
            : `There are ${count} ${isCompleted ? 'completed' : 'pending'} checklists.`;
        }
      } else if (entity === 'delegation') {
        let statusFilter = "status != 'COMPLETED'";
        if (isCompleted) statusFilter = "status = 'COMPLETED'";
        
        if (isList) {
          const q = `SELECT delegation_name FROM delegation WHERE ${statusFilter} ${isMy ? 'AND doer_id = $1' : ''} LIMIT 5`;
          const res = await pool.query(q, isMy ? [userId] : []);
          if (res.rows.length === 0) {
            response = `No ${isCompleted ? 'completed' : 'pending'} delegations found.`;
          } else {
            const list = res.rows.map(r => `• ${r.delegation_name}`).join('\n');
            response = `Found these ${isCompleted ? 'completed' : 'pending'} delegations:\n${list}`;
          }
        } else {
          const q = `SELECT COUNT(*) FROM delegation WHERE ${statusFilter} ${isMy ? 'AND doer_id = $1' : ''}`;
          const res = await pool.query(q, isMy ? [userId] : []);
          const count = res.rows[0].count;
          response = isMy 
            ? `You have ${count} ${isCompleted ? 'completed' : 'pending'} delegations.` 
            : `There are ${count} ${isCompleted ? 'completed' : 'pending'} delegations.`;
        }
      } else if (entity === 'help_tickets') {
        let statusFilter = "status = 'OPEN'";
        if (isCompleted) statusFilter = "status = 'CLOSED'";
        
        if (isList) {
          const q = `SELECT help_ticket_no, issue_description FROM help_tickets WHERE ${statusFilter} ${isMy ? 'AND (raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1)' : ''} LIMIT 5`;
          const res = await pool.query(q, isMy ? [userId] : []);
          if (res.rows.length === 0) {
            response = `No ${isCompleted ? 'closed' : 'open'} help tickets found.`;
          } else {
            const list = res.rows.map(r => `• ${r.help_ticket_no}: ${r.issue_description.substring(0, 50)}...`).join('\n');
            response = `Here are some ${isCompleted ? 'closed' : 'open'} help tickets:\n${list}`;
          }
        } else {
          const q = `SELECT COUNT(*) FROM help_tickets WHERE ${statusFilter} ${isMy ? 'AND (raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1)' : ''}`;
          const res = await pool.query(q, isMy ? [userId] : []);
          const count = res.rows[0].count;
          response = isMy 
            ? `You have ${count} ${isCompleted ? 'closed' : 'pending'} help tickets assigned or raised by you.` 
            : `There are ${count} ${isCompleted ? 'closed' : 'open'} help tickets.`;
        }
      } else if (entity === 'task') {
        if (isList) {
          const resChecklist = await pool.query(`SELECT question FROM checklist WHERE status = 'Pending' AND doer_id = $1 LIMIT 3`, [userId]);
          const resDelegation = await pool.query(`SELECT delegation_name FROM delegation WHERE status != 'COMPLETED' AND doer_id = $1 LIMIT 3`, [userId]);
          const checklistItems = resChecklist.rows.map(r => `• [Checklist] ${r.question}`);
          const delegationItems = resDelegation.rows.map(r => `• [Delegation] ${r.delegation_name}`);
          const combined = [...checklistItems, ...delegationItems].slice(0, 5).join('\n');
          response = combined ? `Your pending tasks include:\n${combined}` : `You have no pending tasks.`;
        } else {
          const resChecklist = await pool.query(`SELECT COUNT(*) FROM checklist WHERE status = 'Pending' AND doer_id = $1`, [userId]);
          const resDelegation = await pool.query(`SELECT COUNT(*) FROM delegation WHERE status != 'COMPLETED' AND doer_id = $1`, [userId]);
          const total = parseInt(resChecklist.rows[0].count) + parseInt(resDelegation.rows[0].count);
          response = `You have ${total} pending tasks (${resChecklist.rows[0].count} checklists and ${resDelegation.rows[0].count} delegations).`;
        }
      }

      return response ? { message: response, type: 'data-query', entity } : null;
    } catch (error) {
      console.error('Data query handling error:', error);
      return null;
    }
  }

  /**
   * Generate response based on intent and user role from context
   * @param {string} intent - Detected intent
   * @param {string} userRole - User's role
   * @returns {string} Response message
   */
  generateResponse(intent, userRole) {
    const responses = CHATBOT_CONTEXT.responses;
    return responses[intent] || responses.unknown;
  }

  /**
   * Generate response using OpenAI with validation
   * @param {string} message - User's message
   * @param {string} userRole - User's role
   * @returns {Object} OpenAI response result
   */
  async generateOpenAIResponse(message, userRole, knowledgeContent = null) {
    // Check if message contains blocked topics
    if (this.containsBlockedTopics(message)) {
      return {
        success: false,
        message: "I'm sorry, I can only assist with questions about the DTA_RACPL ERP system and related workflows."
      };
    }

    const userPrompt = knowledgeContent
      ? `${CHATBOT_CONTEXT.knowledgeInstruction}\n\nCompany knowledge:\n${knowledgeContent}\n\nUser question: ${message}`
      : message;

    // Generate OpenAI response
    const openaiResult = await chatbotOpenAI.generateResponse(
      userPrompt,
      CHATBOT_CONTEXT.openaiSystemPrompt,
      userRole
    );

    // Validate response
    if (!chatbotOpenAI.validateResponse(openaiResult.message)) {
      return {
        success: false,
        message: "I'm sorry, I can only assist with questions about the DTA_RACPL ERP system and related workflows."
      };
    }

    return openaiResult;
  }

  /**
   * Find matching knowledge entry based on message keywords
   * @param {string} message - Cleaned user message
   * @returns {Object|null} Matching knowledge entry or null
   */
  findKnowledgeEntry(message) {
    if (!message) return null;

    const normalized = message.toLowerCase();

    const exactMatch = KNOWLEDGE_BASE.find((entry) =>
      entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
    );
    if (exactMatch) return exactMatch;

    const messageTokens = new Set(normalized.split(/[^a-z0-9]+/).filter(Boolean));
    let bestEntry = null;
    let bestScore = 0;

    for (const entry of KNOWLEDGE_BASE) {
      const keywordTokens = new Set(
        entry.keywords
          .flatMap((keyword) => keyword.toLowerCase().split(/[^a-z0-9]+/))
          .filter(Boolean)
      );
      const overlap = [...messageTokens].filter((token) => keywordTokens.has(token)).length;
      const score = overlap / Math.max(keywordTokens.size, 1);

      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    return bestScore >= 0.25 ? bestEntry : null;
  }

  /**
   * Sanitize knowledge content to avoid unsafe injection
   * @param {string} content - Knowledge entry content
   * @returns {string} Sanitized content
   */
  sanitizeKnowledgeContent(content) {
    if (!content || typeof content !== 'string') return '';
    return content.replace(/[<>]/g, '').trim().substring(0, 1500);
  }

  /**
   * Check if message contains blocked topics
   * @param {string} message - User's message
   * @returns {boolean} True if contains blocked topics
   */
  containsBlockedTopics(message) {
    const blockedTopics = CHATBOT_CONTEXT.blockedTopics;
    return blockedTopics.some(topic => message.includes(topic));
  }

  /**
   * Get safe fallback response
   * @returns {string} Fallback message
   */
  getFallbackResponse() {
    return "I'm sorry, I can only assist with questions about the DTA_RACPL ERP system and related workflows. Please ask about delegations, help tickets, attendance, checklists, or dashboard features.";
  }

  /**
   * Log conversation for future analytics and debugging
   * @param {number} userId - User ID
   * @param {string} userMessage - User's message
   * @param {string} botResponse - Bot's response
   * @param {string} intent - Detected intent
   * @param {string} responseType - Type of response (rule-based, openai, fallback)
   * @param {number} openaiTokens - Token usage for OpenAI responses
   */
  async logConversation(userId, userMessage, botResponse, intent, responseType, openaiTokens) {
    try {
      const query = `
        INSERT INTO chatbot_conversations (user_id, message_text, response_text, intent, response_type, openai_tokens, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `;
      await pool.query(query, [userId, userMessage, botResponse, intent, responseType, openaiTokens]);
    } catch (error) {
      // Log error but don't fail the response
      console.error('Failed to log conversation:', error);
    }
  }
}

module.exports = new ChatbotService();