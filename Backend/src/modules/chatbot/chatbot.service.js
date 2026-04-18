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

      // Pronoun detection for context reuse
      const pronouns = ['they', 'them', 'those', 'it'];
      const hasPronouns = pronouns.some(p => cleanMessage.includes(p));
      const mentionsEntity = ['checklist', 'chcklst', 'delegat', 'ticket', 'tict', 'task', 'work'].some(e => cleanMessage.includes(e));
      
      let contextEntity = null;
      if (hasPronouns && !mentionsEntity) {
        contextEntity = await this.getLastEntity(userId);
      }

      for (const segment of segments) {
        // Detect intent using keyword matching for this segment
        const intent = this.detectIntent(segment);
        if (intent !== 'unknown' && primaryIntent === 'unknown') primaryIntent = intent;

        // Priority 1: Rule-based (Greetings, Help)
        if (['greeting', 'help'].includes(intent)) {
          const resp = this.generateResponse(intent, userRole);
          responses.push({ text: resp, type: intent });
          continue;
        }

        // Priority 2: Data Query (with list mode support)
        if (this.isDataQuery(segment) || this.isListQuery(segment)) {
          const dataResult = await this.handleDataQuery(userId, segment, lastEntity || contextEntity);
          if (dataResult) {
            responses.push({ text: dataResult.message, type: 'data_query' });
            if (dataResult.entity) lastEntity = dataResult.entity;
            if (primaryIntent === 'unknown') primaryIntent = 'data_query';
            continue;
          }
        }

        // Priority 3: Knowledge Base
        const knowledgeEntry = this.findKnowledgeEntry(segment);
        const knowledgeContent = knowledgeEntry ? this.sanitizeKnowledgeContent(knowledgeEntry.content) : null;
        if (knowledgeContent) {
          responses.push({ text: knowledgeContent, type: 'knowledge' });
          if (primaryIntent === 'unknown') primaryIntent = 'knowledge';
          continue;
        }

        // Priority 4: Rule-based fallback (Module info)
        if (intent !== 'unknown') {
          responses.push({ text: this.generateResponse(intent, userRole), type: intent });
          continue;
        }

        // Priority 5: OpenAI fallback
        if (responses.length === 0 || segments.length === 1) {
          try {
            const openaiResult = await this.generateOpenAIResponse(segment, userRole, knowledgeContent);
            if (openaiResult.success) {
              responses.push({ text: openaiResult.message, type: 'openai' });
              totalTokens += (openaiResult.tokens || 0);
              if (primaryIntent === 'unknown') primaryIntent = 'openai';
            }
          } catch (error) {
            console.error('OpenAI integration error:', error);
          }
        }
      }

      const substantiveResponses = responses.filter(r => !['greeting', 'help'].includes(r.type));
      let finalResponses = [];
      let finalIntent = primaryIntent;
      let finalResponseType = 'standard';

      if (substantiveResponses.length > 0) {
        finalResponses = substantiveResponses.map(r => r.text);
        // Use the first substantive intent as primary if not already set meaningfully
        if (substantiveResponses[0].type !== 'unknown') {
          finalIntent = substantiveResponses[0].type;
        }
        
        // Map response type for compatibility
        const firstType = substantiveResponses[0].type;
        if (['knowledge', 'openai', 'fallback'].includes(firstType)) {
          finalResponseType = firstType;
        } else if (firstType === 'data_query') {
          finalResponseType = 'standard'; // Data queries were historically 'standard' in this codebase
        } else {
          finalResponseType = 'rule-based';
        }
      } else {
        finalResponses = responses.map(r => r.text);
        if (responses.length > 0) {
          finalIntent = responses[0].type;
          finalResponseType = 'rule-based';
        }
      }

      if (responses.length > 1) finalResponseType = 'multi-intent';
      if (finalResponses.length === 0) {
        finalResponseType = 'fallback';
        finalIntent = 'unknown';
      }

      const finalResponse = finalResponses.length > 0 ? finalResponses.join('\n\n') : this.getFallbackResponse();

      // Log conversation with aggregated response
      await this.logConversation(userId, cleanMessage, finalResponse, finalIntent, finalResponseType, totalTokens);

      return {
        success: true,
        message: finalResponse,
        intent: finalIntent,
        responseType: finalResponseType,
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
   * Detect intent using keyword matching with fuzzy support
   * @param {string} message - Cleaned user message
   * @returns {string} Detected intent
   */
  detectIntent(message) {
    const intents = CHATBOT_CONTEXT.intents;
    const threshold = 0.8;

    // 1. Exact matching with word boundaries
    const words = message.split(/\s+/);
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => {
        if (keyword.includes(' ')) return message.includes(keyword); // Multi-word exact match
        return words.includes(keyword); // Single-word exact match
      })) {
        return intent;
      }
    }

    // 2. Fuzzy matching fallback
    for (const [intent, keywords] of Object.entries(intents)) {
      for (const keyword of keywords) {
        // Multi-word keywords
        if (keyword.includes(' ')) {
          if (this.calculateSimilarity(message, keyword) > threshold) return intent;
        } else {
          // Single word check
          for (const word of words) {
            // Avoid matching pronouns to short greetings (e.g., 'they' -> 'hey')
            const isPronoun = ['they', 'them', 'those', 'it'].includes(word.toLowerCase());
            if (isPronoun && intent === 'greeting') continue;

            const similarity = this.calculateSimilarity(word, keyword);
            // Higher threshold for very short words
            const minSimilarity = keyword.length <= 3 ? 0.9 : threshold;
            if (similarity >= minSimilarity) return intent;
          }
        }
      }
    }

    return 'unknown';
  }

  /**
   * Calculate string similarity (0-1) using Levenshtein-based similarity
   */
  calculateSimilarity(s1, s2) {
    if (!s1 || !s2) return 0;
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    
    if (s1 === s2) return 1.0;
    
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array.from({ length: len1 + 1 }, () => new Int32Array(len2 + 1));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * Helper to handle singular/plural grammar
   */
  pluralize(count, singular, plural) {
    return parseInt(count) === 1 ? singular : plural;
  }

  /**
   * Standardize list responses with bullet points
   */
  formatResponseList(items, title = '') {
    if (!items || items.length === 0) return '';
    const list = items.map(item => `• ${item}`).join('\n');
    return title ? `${title}\n${list}` : list;
  }

  /**
   * Retrieve the last meaningful entity from conversation history
   * @param {number} userId - User ID
   * @returns {string|null} Last entity found or null
   */
  async getLastEntity(userId) {
    try {
      // Query recent 5 messages to find a meaningful intent that maps to an entity
      const q = `
        SELECT intent, response_text FROM chatbot_conversations 
        WHERE user_id = $1 
        AND intent NOT IN ('greeting', 'help', 'unknown', 'error')
        ORDER BY created_at DESC LIMIT 5
      `;
      const res = await pool.query(q, [userId]);
      
      for (const row of res.rows) {
        if (row.intent === 'checklist') return 'checklist';
        if (row.intent === 'help_ticket') return 'help_tickets';
        if (row.intent === 'delegation') return 'delegation';
        
        // Sometimes intent is data_query, infer from response text
        const text = row.response_text.toLowerCase();
        if (text.includes('checklist')) return 'checklist';
        if (text.includes('ticket')) return 'help_tickets';
        if (text.includes('delegat')) return 'delegation';
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch last entity:', error);
      return null;
    }
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
    const hasDataKeyword = dataKeywords.some(keyword => message.includes(keyword));
    const hasPronoun = /\bit\b|\bthem\b|\bthose\b|\bthey\b/i.test(message);
    return hasDataKeyword || hasPronoun;
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
    const hasListKeyword = listKeywords.some(k => message.includes(k)) || /\blist\b/i.test(message);
    const hasPronoun = /\bthem\b|\bthose\b|\bthey\b/i.test(message);
    return hasListKeyword || hasPronoun;
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
      const msg = message.toLowerCase();

      // Entity detection (Checklists, Delegations, Help Tickets, Tasks)
      if (msg.includes('checklist') || msg.includes('chcklst')) entity = 'checklist';
      else if (msg.includes('delegation') || msg.includes('delegat')) entity = 'delegation';
      else if (msg.includes('ticket') || msg.includes('tict')) entity = 'help_tickets';
      else if (msg.includes('task') || msg.includes('work')) entity = 'task';

      if (!entity) return null;

      // Filter flags
      const isTotal = msg.includes('total') || msg.includes('all');
      const isPending = !isTotal && (msg.includes('pending') || msg.includes('open') || msg.includes('statu'));
      const isCompleted = msg.includes('completed') || msg.includes('closed') || msg.includes('done');
      const isMy = msg.includes('my') || msg.includes('mine') || msg.includes('i have') || msg.includes('assigned');
      
      const isCount = this.isCountQuery(msg);
      const isList = !isCount && this.isListQuery(msg);

      let response = '';

      if (entity === 'checklist') {
        let statusFilter = isTotal ? "1=1" : (isCompleted ? "status = 'Completed'" : "status = 'Pending'");
        
        if (isList) {
          const q = `SELECT question FROM checklist WHERE ${statusFilter} ${isMy ? 'AND doer_id = $1' : ''} LIMIT 5`;
          const res = await pool.query(q, isMy ? [userId] : []);
          if (res.rows.length === 0) {
            response = `I couldn't find any ${isCompleted ? 'completed' : (isTotal ? '' : 'pending')} checklists ${isMy ? 'assigned to you' : ''}.`.replace('  ', ' ');
          } else {
            const items = res.rows.map(r => r.question);
            response = this.formatResponseList(items, `Here are some of the ${isCompleted ? 'completed' : (isTotal ? '' : 'pending')} checklists:`.replace('  ', ' '));
          }
        } else {
          const q = `SELECT COUNT(*) FROM checklist WHERE ${statusFilter} ${isMy ? 'AND doer_id = $1' : ''}`;
          const res = await pool.query(q, isMy ? [userId] : []);
          const count = res.rows[0].count;
          const label = this.pluralize(count, 'checklist', 'checklists');
          const statusLabel = isTotal ? 'total' : (isCompleted ? 'completed' : 'pending');
          
          response = isMy 
            ? `You have ${count} ${statusLabel} ${label}.` 
            : `There are ${count} ${statusLabel} ${label}.`;
        }
      } else if (entity === 'delegation') {
        let statusFilter = isTotal ? "1=1" : (isCompleted ? "status = 'COMPLETED'" : "status != 'COMPLETED'");
        
        if (isList) {
          const q = `SELECT delegation_name FROM delegation WHERE ${statusFilter} ${isMy ? 'AND doer_id = $1' : ''} LIMIT 5`;
          const res = await pool.query(q, isMy ? [userId] : []);
          if (res.rows.length === 0) {
            response = `No ${isCompleted ? 'completed' : (isTotal ? '' : 'pending')} delegations found.`.replace('  ', ' ');
          } else {
            const items = res.rows.map(r => r.delegation_name);
            response = this.formatResponseList(items, `Found these ${isCompleted ? 'completed' : (isTotal ? '' : 'pending')} delegations:`.replace('  ', ' '));
          }
        } else {
          const q = `SELECT COUNT(*) FROM delegation WHERE ${statusFilter} ${isMy ? 'AND doer_id = $1' : ''}`;
          const res = await pool.query(q, isMy ? [userId] : []);
          const count = res.rows[0].count;
          const label = this.pluralize(count, 'delegation', 'delegations');
          const statusLabel = isTotal ? 'total' : (isCompleted ? 'completed' : 'pending');

          response = isMy 
            ? `You have ${count} ${statusLabel} ${label}.` 
            : `There are ${count} ${statusLabel} ${label}.`;
        }
      } else if (entity === 'help_tickets') {
        let statusFilter = isTotal ? "1=1" : (isCompleted ? "status = 'CLOSED'" : "status = 'OPEN'");
        
        if (isList) {
          const q = `SELECT help_ticket_no, issue_description FROM help_tickets WHERE ${statusFilter} ${isMy ? 'AND (raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1)' : ''} LIMIT 5`;
          const res = await pool.query(q, isMy ? [userId] : []);
          if (res.rows.length === 0) {
            response = `No ${isCompleted ? 'closed' : (isTotal ? '' : 'open')} help tickets found.`.replace('  ', ' ');
          } else {
            const items = res.rows.map(r => `${r.help_ticket_no}: ${r.issue_description.substring(0, 50)}${r.issue_description.length > 50 ? '...' : ''}`);
            response = this.formatResponseList(items, `Here are some ${isCompleted ? 'closed' : (isTotal ? '' : 'open')} help tickets:`.replace('  ', ' '));
          }
        } else {
          const q = `SELECT COUNT(*) FROM help_tickets WHERE ${statusFilter} ${isMy ? 'AND (raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1)' : ''}`;
          const res = await pool.query(q, isMy ? [userId] : []);
          const count = res.rows[0].count;
          const label = this.pluralize(count, 'help ticket', 'help tickets');
          const statusLabel = isTotal ? 'total' : (isCompleted ? 'closed' : 'open');

          response = isMy 
            ? `You have ${count} ${statusLabel} ${label} assigned or raised by you.` 
            : `There are ${count} ${statusLabel} ${label}.`;
        }
      } else if (entity === 'task') {
        if (isList) {
          const resChecklist = await pool.query(`SELECT question FROM checklist WHERE status = 'Pending' AND doer_id = $1 LIMIT 3`, [userId]);
          const resDelegation = await pool.query(`SELECT delegation_name FROM delegation WHERE status != 'COMPLETED' AND doer_id = $1 LIMIT 3`, [userId]);
          const items = [
            ...resChecklist.rows.map(r => `[Checklist] ${r.question}`),
            ...resDelegation.rows.map(r => `[Delegation] ${r.delegation_name}`)
          ].slice(0, 5);
          
          response = items.length > 0 
            ? this.formatResponseList(items, `Your pending tasks include:`)
            : `You have no pending tasks.`;
        } else {
          const r1 = await pool.query(`SELECT COUNT(*) FROM checklist WHERE status = 'Pending' AND doer_id = $1`, [userId]);
          const r2 = await pool.query(`SELECT COUNT(*) FROM delegation WHERE status != 'COMPLETED' AND doer_id = $1`, [userId]);
          const c1 = parseInt(r1.rows[0].count);
          const c2 = parseInt(r2.rows[0].count);
          const total = c1 + c2;
          const label = this.pluralize(total, 'pending task', 'pending tasks');
          
          response = `You have ${total} ${label} (${c1} ${this.pluralize(c1, 'checklist', 'checklists')} and ${c2} ${this.pluralize(c2, 'delegation', 'delegations')}).`;
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
    return "I didn’t fully understand that. Please try rephrasing.";
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