const { pool } = require("../../config/db.config");
const CHATBOT_CONTEXT = require("./chatbot.context");
const chatbotOpenAI = require("./chatbot.openai");
const KNOWLEDGE_BASE = require("./chatbot.knowledge");
const chatbotFormatter = require("./chatbot.formatter");

/**
 * Chatbot Service - Handles rule-based intent detection, knowledge search, and OpenAI integration
 * Uses hybrid approach: rule-based first, knowledge-aware OpenAI as fallback
 */
class ChatbotService {
  constructor() {
    this.sessions = new Map();
    this.CONTEXT_EXPIRY = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Get session context for a user
   * @param {number} userId 
   * @returns {Object|null}
   */
  getSession(userId) {
    if (!userId) return null;
    const now = Date.now();
    const session = this.sessions.get(userId);

    if (session && now - session.timestamp > this.CONTEXT_EXPIRY) {
      this.sessions.delete(userId);
      return null;
    }

    return session || null;
  }

  /**
   * Update session context for a user
   * @param {number} userId 
   * @param {Object} data 
   */
  updateSession(userId, data) {
    if (!userId) return;
    const current = this.sessions.get(userId) || { confidence: 0 };
    
    // Confidence logic: Reset or increase based on new data
    let newConfidence = data.lastEntity ? 1.0 : (current.confidence || 0);
    
    this.sessions.set(userId, {
      ...current,
      ...data,
      confidence: newConfidence,
      timestamp: Date.now()
    });
  }

  /**
   * Resolve pronouns in message using session context
   * @param {string} message 
   * @param {Object} session 
   * @returns {string}
   */
  resolvePronouns(message, session) {
    if (!session || !session.lastEntity || (session.confidence || 0) < 0.5) return message;
    
    const pronouns = ['it', 'them', 'those', 'these', 'that'];
    let resolved = message;
    
    const entityMapping = {
      'checklist': 'checklist',
      'task': 'task',
      'delegation': 'delegation',
      'help_tickets': 'ticket'
    };
    
    const replacement = entityMapping[session.lastEntity] || session.lastEntity;

    // Check for strong module switch - if current message has a different module keyword, don't resolve
    const moduleKeywords = ['task', 'checklist', 'delegation', 'ticket', 'attendance', 'payroll', 'salary'];
    const hasOtherModule = moduleKeywords.some(k => k !== replacement && message.includes(k));
    if (hasOtherModule) return message;

    for (const pronoun of pronouns) {
      const regex = new RegExp(`\\b${pronoun}\\b`, 'gi');
      if (regex.test(resolved)) {
        resolved = resolved.replace(regex, replacement);
      }
    }
    
    return resolved.trim();
  }

  /**
   * Detect and resolve follow-up phrases
   * @param {string} message 
   * @param {Object} session 
   * @returns {string}
   */
  detectFollowUp(message, session) {
    if (!session || !session.lastEntity) return message;

    const followUps = [
      'show details', 'show in details', 'explain more', 'continue', 
      'more info', 'show all', 'expand this', 'list them', 'open them'
    ];

    if (followUps.some(f => message.includes(f))) {
      // Injected context keywords to trigger data list logic
      const entity = session.lastEntity === 'help_tickets' ? 'ticket' : session.lastEntity;
      const status = session.lastStatus || 'pending';
      return `show ${status} ${entity} details`;
    }

    return message;
  }

  /**
   * Process user message and generate response using hybrid approach
   * @param {number} userId - User ID from JWT
   * @param {string} message - User's message
   * @param {string} userRole - User's role (Admin, SuperAdmin, Employee)
   * @returns {Object} Response object with message and metadata
   */
  async processMessage(userId, message, userRole) {
    try {
      if (!userId || !userRole) {
        console.error('Chatbot processMessage: Missing userId or userRole', { userId, userRole });
        return { success: false, message: "Authentication error. Please refresh and try again.", type: 'auth-error' };
      }

      const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';
      
      // Sanitize input
      const cleanMessage = this.sanitizeInput(message);
      if (!cleanMessage) return { success: true, message: "How can I help you today?", type: 'greeting' };

      // Retrieve session context
      const session = this.getSession(userId);
      
      // Resolve context (follow-ups and pronouns)
      let resolvedMessage = this.detectFollowUp(cleanMessage, session);
      resolvedMessage = this.resolvePronouns(resolvedMessage, session);
      
      // Split queries for multi-intent handling
      const segments = this.splitQueries(resolvedMessage);
      let responses = [];
      let lastEntity = session?.lastEntity || null;
      let lastStatus = session?.lastStatus || 'pending';
      let lastQueryType = session?.lastQueryType || 'unknown';
      let totalTokens = 0;
      let primaryIntent = 'unknown';

      for (const segment of segments) {
        try {
          // Detect intent using keyword matching for this segment
          const intent = this.detectIntent(segment);
          if (intent !== 'unknown' && primaryIntent === 'unknown') primaryIntent = intent;

          // Priority 0: Safety check (Blocked topics)
          if (this.containsBlockedTopics(segment)) {
            responses.push(this.getFallbackResponse());
            if (primaryIntent === 'unknown') primaryIntent = 'fallback';
            continue;
          }

          // Check for ambiguity (e.g., "task task task")
          if (this.isAmbiguousQuery(segment)) {
            responses.push(this.generateResponse('clarification', userRole));
            if (primaryIntent === 'unknown') primaryIntent = 'clarification';
            continue;
          }

          if (this.isGuidanceQuery(segment)) {
            const knowledgeEntry = this.findKnowledgeEntry(segment);
            if (knowledgeEntry) {
              responses.push(this.formatKnowledgeResponse(knowledgeEntry, session));
              if (primaryIntent === 'unknown') primaryIntent = 'guidance';
              
              // Extract entity from knowledge keywords to update context
              const entryKeywords = knowledgeEntry.keywords.join(' ').toLowerCase();
              if (entryKeywords.includes('checklist')) lastEntity = 'checklist';
              else if (entryKeywords.includes('delegation')) lastEntity = 'delegation';
              else if (entryKeywords.includes('ticket')) lastEntity = 'help_tickets';
              else if (entryKeywords.includes('task')) lastEntity = 'task';
              
              // Reset status for new guidance queries
              lastStatus = null;
              
              continue;
            }
          }

          // Analytics protection
          if (this.isAnalyticsQuery(segment)) {
            lastQueryType = 'analytics';
          }

          // Priority 2: Data Query (with list mode support)
          // Refined: Only fetch if it's a data query AND not just a guidance request about a module
          if (this.isDataQuery(segment) && !this.isGuidanceQuery(segment)) {
            const dataResult = await this.handleDataQuery(userId, segment, isAdmin, lastEntity);
            if (dataResult) {
              responses.push(dataResult.message);
              if (dataResult.entity) lastEntity = dataResult.entity;
              if (dataResult.status) lastStatus = dataResult.status;
              lastQueryType = dataResult.isList ? 'list' : (dataResult.isCount ? 'count' : 'data_query');
              if (primaryIntent === 'unknown') primaryIntent = 'data_query';
              continue;
            }
          }

          const knowledgeEntry = this.findKnowledgeEntry(segment);
          if (knowledgeEntry) {
            responses.push(this.formatKnowledgeResponse(knowledgeEntry, session));
            if (primaryIntent === 'unknown') primaryIntent = 'knowledge';
            
            // Extract entity from knowledge keywords to update context
            const entryKeywords = knowledgeEntry.keywords.join(' ').toLowerCase();
            if (entryKeywords.includes('checklist')) lastEntity = 'checklist';
            else if (entryKeywords.includes('delegation')) lastEntity = 'delegation';
            else if (entryKeywords.includes('ticket')) lastEntity = 'help_tickets';
            else if (entryKeywords.includes('task')) lastEntity = 'task';
            
            // Reset status for new knowledge queries
            lastStatus = null;
            
            continue;
          }

          // Priority 4: Rule-based fallback (Greetings, Help, Module info)
          if (['greeting', 'help', 'guidance', 'checklist', 'delegation', 'help_ticket', 'attendance', 'dashboard'].includes(intent)) {
            responses.push(this.generateResponse(intent, userRole));
            continue;
          }

          // Priority 5: OpenAI fallback
          // ...

          // Priority 5: OpenAI fallback (only if this is the only segment or nothing else matched)
          if (responses.length === 0 || segments.length === 1) {
            try {
              // Try to find knowledge for the fallback prompt context
              const knowledgeEntry = this.findKnowledgeEntry(segment);
              const knowledgeContent = knowledgeEntry ? (typeof knowledgeEntry.content === 'string' ? knowledgeEntry.content : JSON.stringify(knowledgeEntry.content)) : null;
              
              const openaiResult = await this.generateOpenAIResponse(segment, userRole, knowledgeContent);
              if (openaiResult.success) {
                // Sanitize OpenAI response to ensure no markdown symbols
                responses.push(chatbotFormatter.stripMarkdown(openaiResult.message));
                totalTokens += (openaiResult.tokens || 0);
              } else if (responses.length === 0) {
                responses.push(this.getFallbackResponse());
              }
            } catch (error) {
              console.error('Chatbot OpenAI integration error:', error);
              if (responses.length === 0) responses.push(this.getFallbackResponse());
            }
          }
        } catch (segmentError) {
          console.error(`Chatbot error processing segment "${segment}":`, segmentError);
          // Don't push to responses, just continue or handle as fallback
        }
      }

      // Format final response using the mixed response builder
      let finalResponse = responses.length > 0 
        ? chatbotFormatter.formatMixedResponse(responses) 
        : this.getFallbackResponse();
      
      // Final sanitization to ensure no raw markdown symbols ever reach the UI
      finalResponse = chatbotFormatter.stripMarkdown(finalResponse);
      
      const responseType = responses.length > 1 ? 'multi-intent' : 'standard';

      // Update session context
      this.updateSession(userId, {
        lastEntity,
        lastStatus,
        lastQueryType,
        lastIntent: primaryIntent,
        lastModule: lastEntity // Basic module mapping
      });

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
      console.error('Chatbot service global error:', error);
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

    let clean = message
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 500) // Limit length
      .toLowerCase(); // Normalize for matching

    // Typo normalization
    clean = clean.replace(/\bpf\b/g, 'of');
    clean = clean.replace(/\b(nme|nam)\b/g, 'name');
    clean = clean.replace(/\bitmes\b/g, 'items');
    clean = clean.replace(/\bfo\b/g, 'for'); // Normalize 'fo' to 'for'

    return clean;
  }

  /**
   * Detect intent using simple keyword matching from context
   * @param {string} message - Cleaned user message
   * @returns {string} Detected intent
   */
  detectIntent(message) {
    const intents = CHATBOT_CONTEXT.intents;

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => {
        // Use word boundaries for better matching
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        return regex.test(message);
      })) {
        return intent;
      }
    }

    return 'unknown';
  }

  /**
   * Detect if message is a guidance/instructional query
   * @param {string} message - Cleaned user message
   * @returns {boolean} True if guidance keywords are found
   */
  isGuidanceQuery(message) {
    const guidanceKeywords = ['how to', 'how i can', 'how do i', 'guide me', 'steps to', 'process of', 'instructions for', 'how can i', 'show me how'];
    return guidanceKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Detect if message is a data-based query
   * @param {string} message - Cleaned user message
   * @returns {boolean} True if data query keywords are found
   */
  isDataQuery(message) {
    const fetchKeywords = [
      'total', 'count', 'how many', 'number', 'summary', 'analytics', 'who has', 'most', 
      'highest', 'busiest', 'workload', 'report', 'list', 'show', 'all', 'details', 'who is', 'profile'
    ];
    const moduleKeywords = ['task', 'checklist', 'delegation', 'ticket', 'attendance', 'employee', 'team'];
    const statusKeywords = ['pending', 'completed', 'overdue', 'open', 'closed', 'late', 'done', 'finished'];
    
    // Explicit fetch intent with word boundaries (to avoid matching 'list' in 'checklist')
    const hasFetchIntent = fetchKeywords.some(keyword => {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      return regex.test(message);
    });
    
    // Module + status (e.g., "pending tasks", "completed checklists")
    const hasStatusModule = statusKeywords.some(s => message.includes(s)) && moduleKeywords.some(m => message.includes(m));

    // Self-summary/profile requests
    const isProfileRequest = /\bmy profile\b|\bwho am i\b|\bmy summary\b/i.test(message);

    return hasFetchIntent || hasStatusModule || isProfileRequest;
  }

  /**
   * Detect if message is an analytics-related query
   * @param {string} message - Cleaned user message
   * @returns {boolean} True if analytics keywords are found
   */
  isAnalyticsQuery(message) {
    const analyticsKeywords = ['productivity', 'statistics', 'stats', 'performance', 'summary of team', 'completion rate'];
    return analyticsKeywords.some(k => message.includes(k));
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
    const listKeywords = [
      'what are they', 'show', 'names', 'which ones', 'list', 'name of', 'names of', 
      'all', 'details', 'in detail', 'give', 'show me all', 'give the details', 'next'
    ];
    return listKeywords.some(k => message.includes(k));
  }

  /**
   * Extract employee name from message using keywords
   * @param {string} message - User message
   * @returns {string|null} Name if found
   */
  extractEmployeeName(message) {
    if (!message) return { name: null };

    // Look for patterns, prioritized to catch 'for' before generic 'of'
    const patterns = [
      /summary\s+(?:of|about|for)\s+([a-zA-Z\s]+)/i,
      /details\s+about\s+([a-zA-Z\s]+)/i,
      /profile\s+(?:of|for)\s+([a-zA-Z\s]+)/i,
      /employee\s+profile\s+of\s+([a-zA-Z\s]+)/i,
      /who\s+is\s+([a-zA-Z\s]+)/i,
      /tell\s+me\s+about\s+([a-zA-Z\s]+)/i,
      /about\s+([a-zA-Z\s]+)/i,
      /for\s+([a-zA-Z\s]+)/i,
      /assigned\s+to\s+([a-zA-Z\s]+)/i,
      /has\s+([a-zA-Z\s]+)/i,
      /of\s+([a-zA-Z\s]+)/i
    ];

    const ignoredWords = [
      'pending', 'completed', 'complete', 'done', 'finished', 'overdue', 'late', 'task', 'tasks',
      'checklist', 'checklists', 'ticket', 'tickets', 'employee', 'employees', 'name', 'names', 'random', 'show',
      'of', 'for', 'my', 'me', 'the', 'is', 'has', 'assigned', 'to', 'summary', 'details', 'about', 'operational',
      'item', 'items', 'pending items', 'pending tasks', 'overdue items', 'overdue tasks'
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        let extracted = match[1].trim().toLowerCase();
        
        // Remove trailing keywords that might be caught by [a-zA-Z\s]+
        extracted = extracted.replace(/\s+(?:summary|details|info|information|data|report|overview)$/i, '').trim();

        // Check if generic, too short, or matches ignored list
        const words = extracted.split(/\s+/);
        const isGeneric = ignoredWords.includes(extracted) || 
                         words.every(w => ignoredWords.includes(w)) ||
                         extracted.length < 2;

        if (isGeneric) {
          // Skip generic extractions (like "pending items") and try next pattern
          continue;
        }
        return { name: extracted, isInvalid: false };
      }
    }
    return { name: null, isInvalid: false };
  }

  /**
   * Handle data-based queries by executing SELECT statements
   * @param {number} userId - Current user ID
   * @param {string} message - Cleaned user message
   * @param {boolean} isAdmin - Whether user is admin
   * @param {string} contextEntity - Entity from previous segment (optional)
   * @returns {Object|null} Result object or null if no entity matched
   */
  async handleDataQuery(userId, message, isAdmin, contextEntity = null) {
    try {
      // 1. Detect status intent first
      // Refine: Only match 'complete' as status if it's not part of a guidance query
      const isCompleted = (message.includes('completed') || (message.includes('complete') && !this.isGuidanceQuery(message))) || 
                          message.includes('closed') || message.includes('done') || message.includes('finished');
      const isOverdue = message.includes('overdue') || message.includes('late');
      const isPending = message.includes('pending') || message.includes('open');
      const isToday = message.includes('today');
      const isCount = this.isCountQuery(message);
      const isList = !isCount && (this.isListQuery(message) || message.includes('show'));
      const isAll = /\ball\b/i.test(message) || message.includes('total');
      // When user asks "all tasks/checklists" with no status qualifier, show all statuses
      const isAllStatuses = isAll && !isPending && !isCompleted && !isOverdue;
      
      // Handle 'next' queries explicitly
      if (message.includes('next')) {
        return { 
          message: "Pagination is not available yet. Please refine your query or ask for a specific task/checklist.", 
          type: 'info' 
        };
      }
      
      // Detect self-summary phrases
      const selfSummaryPhrases = [
        'my operational summary', 'give me my operational summary', 'show my operational summary',
        'my work summary', 'my employee summary', 'my details', 'my summary', 'give me my summary', 'show my summary',
        'who am i', 'my profile', 'who am l', 'show my profile'
      ];
      const isSelfSummaryRequest = selfSummaryPhrases.some(phrase => message.includes(phrase));
      
      const workloadKeywords = [
        'highest workload', 'most workload', 'maximum workload', 'busiest employee', 
        'most assigned work', 'workload summary', 'employee workload summary', 'employee workload'
      ];

      // 2. Check for Admin-specific workload analytics
      if (isAdmin && (workloadKeywords.some(k => message.includes(k)) || message.includes('who has the most'))) {
        const q = `
          SELECT e.first_name, e.last_name, COUNT(*) as total_workload
          FROM employees e
          JOIN (
            -- Pending checklists
            SELECT doer_id FROM checklist WHERE status NOT IN ('Completed', 'Verified')
            UNION ALL
            -- Pending delegations
            SELECT doer_id FROM delegation WHERE status NOT ILIKE 'completed'
            UNION ALL
            -- Open help tickets (accountable or solver)
            SELECT pc_accountable as doer_id FROM help_tickets WHERE status = 'OPEN'
            UNION ALL
            SELECT problem_solver as doer_id FROM help_tickets WHERE status = 'OPEN'
          ) t ON e.user_id = t.doer_id
          GROUP BY e.user_id, e.first_name, e.last_name
          ORDER BY total_workload DESC
          LIMIT 1
        `;
        const res = await pool.query(q);
        if (res.rows.length > 0) {
          const top = res.rows[0];
          return { 
            message: chatbotFormatter.formatSection(
              'High Workload Alert', 
              `${top.first_name} ${top.last_name} has the highest workload with a total of ${top.total_workload} pending items across all modules.`
            ), 
            type: 'analytics' 
          };
        }
        return { message: "No pending workload found for any employee.", type: 'analytics' };
      }

      // 3. Check for Attendance Summary (Admin only)
      if (message.includes('attendance summary') || (message.includes('attendance') && (message.includes('summary') || message.includes('today')))) {
        if (!isAdmin) return { message: "I'm sorry, attendance summaries are only available to administrators.", type: 'auth-error' };
        
        // Use local date for the query
        const localDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        
        const q = `
          SELECT 
            COUNT(CASE WHEN status = 'Present' THEN 1 END) as total_present,
            COUNT(CASE WHEN status = 'Leave' OR status = 'On Leave' THEN 1 END) as on_leave
          FROM attendance 
          WHERE attendance_date = $1
        `;
        const res = await pool.query(q, [localDate]);
        const { total_present, on_leave } = res.rows[0];
        
        if (parseInt(total_present) === 0 && parseInt(on_leave) === 0) {
          return { message: "No attendance records found for today.", type: 'analytics' };
        }
        
        return { 
          message: chatbotFormatter.formatSection(
            `Attendance Summary (${localDate})`, 
            `${total_present} employees are present and ${on_leave} are on leave today.`
          ), 
          type: 'analytics' 
        };
      }

      // 4. Check for Employee List Request (Admin only)
      const employeeListKeywords = [
        'name of employees', 'names of employees', 'list employees', 
        'show employees', 'employee names', 'show employee names', 'details about employees'
      ];
      if (employeeListKeywords.some(k => message.includes(k))) {
        if (!isAdmin) return { message: "Employee list is only available to administrators.", type: 'auth-error' };

        const countRes = await pool.query(`SELECT COUNT(*) FROM employees`);
        const total = countRes.rows[0].count;

        const names = listRes.rows.map(r => `${r.first_name} ${r.last_name}`);
        return { 
          message: chatbotFormatter.formatSection(
            `Employee Directory (Showing 10 of ${total})`,
            names.map(n => `• ${n}`).join('\n')
          ), 
          type: 'analytics' 
        };
      }

      // 5. Check for Employee/Team Summary (Admin only)
      const teamKeywords = ['my employees', 'employee information', 'employee summary', 'team information', 'team summary', 'my team', 'team overview'];
      if (isAdmin && !isSelfSummaryRequest && teamKeywords.some(k => message.includes(k))) {
        const q = `
          SELECT 
            (SELECT COUNT(*) FROM employees) as total_employees,
            (SELECT COUNT(DISTINCT doer_id) FROM (
              SELECT doer_id FROM checklist WHERE status NOT IN ('Completed', 'Verified')
              UNION ALL
              SELECT doer_id FROM delegation WHERE status NOT ILIKE 'completed'
            ) t) as employees_with_workload,
            (SELECT COUNT(*) FROM checklist WHERE status NOT IN ('Completed', 'Verified')) as total_pending_checklists,
            (SELECT COUNT(*) FROM delegation WHERE status NOT ILIKE 'completed') as total_pending_delegations
        `;
        const res = await pool.query(q);
        const s = res.rows[0];
        const totalPending = parseInt(s.total_pending_checklists) + parseInt(s.total_pending_delegations);
        
        return { 
          message: chatbotFormatter.formatSummaryCount(
            'Operational Team Summary',
            [
              { label: 'Total Employees', count: s.total_employees },
              { label: 'Employees with Pending Workload', count: s.employees_with_workload },
              { label: 'Pending Checklists', count: s.total_pending_checklists },
              { label: 'Pending Delegations', count: s.total_pending_delegations }
            ]
          ),
          type: 'analytics' 
        };
      }

      if (!isAdmin && teamKeywords.some(k => message.includes(k))) {
        return { message: "I'm sorry, team summaries and company-wide employee data are only accessible to administrators.", type: 'auth-error' };
      }

      // 6. Resolve target user (Self or specified employee)
      let targetUserId = userId;
      let fullName = 'You';
      let extractedName = null;

      if (isSelfSummaryRequest) {
        // Force self-summary using authenticated userId
        targetUserId = userId;
      } else {
        const extraction = this.extractEmployeeName(message);
        if (extraction.isInvalid) {
          // If name is invalid (like "pending items"), check if it's a generic module query
          const moduleKeywords = ['task', 'item', 'checklist', 'chcklst', 'ticket', 'delegation', 'delegat', 'work'];
          const hasModuleKeyword = moduleKeywords.some(k => message.includes(k));
          
          if (hasModuleKeyword) {
            // Fallback to self-query
            targetUserId = userId;
            fullName = 'You';
          } else {
            return { message: "Please provide a valid employee name.", type: 'error' };
          }
        }
        extractedName = extraction.isInvalid ? null : extraction.name;

        if (extractedName && extractedName.toLowerCase() !== 'my' && extractedName.toLowerCase() !== 'me') {
          if (!isAdmin) {
            return { message: "I'm sorry, you can only query your own data. To see someone else's data, please contact an administrator.", type: 'auth-error' };
          }

          // Find employee by name
          const empQ = `SELECT User_Id, First_Name, Last_Name FROM employees WHERE First_Name ILIKE $1 OR Last_Name ILIKE $1 OR (First_Name || ' ' || Last_Name) ILIKE $1`;
          let empRes = await pool.query(empQ, [`%${extractedName}%`]);

          if (empRes.rows.length === 0) {
            // Try fuzzy match if no direct ILIKE match
            const allEmpRes = await pool.query(`SELECT User_Id, First_Name, Last_Name FROM employees`);
            let bestMatch = null;
            let minDistance = 3; // Max threshold for fuzzy match

            for (const emp of allEmpRes.rows) {
              const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
              const dist = this.getLevenshteinDistance(extractedName.toLowerCase(), fullName);
              const distFirst = this.getLevenshteinDistance(extractedName.toLowerCase(), emp.first_name.toLowerCase());
              const distLast = this.getLevenshteinDistance(extractedName.toLowerCase(), emp.last_name.toLowerCase());
              
              const finalDist = Math.min(dist, distFirst, distLast);
              if (finalDist < minDistance) {
                minDistance = finalDist;
                bestMatch = emp;
              }
            }

            if (bestMatch && minDistance <= 2) {
              targetUserId = bestMatch.user_id;
              fullName = `${bestMatch.first_name} ${bestMatch.last_name}`;
            } else {
              return { message: `I couldn't find any employee named "${extractedName}". Please provide a valid employee name.`, type: 'error' };
            }
          } else if (empRes.rows.length > 1) {
            const names = empRes.rows.map(r => `${r.first_name} ${r.last_name}`).join(', ');
            return { message: `I found multiple employees matching "${extractedName}": ${names}. Could you please be more specific and provide the full name?`, type: 'error' };
          } else {
            targetUserId = empRes.rows[0].user_id;
            fullName = `${empRes.rows[0].first_name} ${empRes.rows[0].last_name}`;
          }
        }
      }

      // Fetch user's name if we still have 'You' (for self or default queries)
      if (fullName === 'You') {
        const selfRes = await pool.query(`SELECT first_name, last_name FROM employees WHERE user_id = $1`, [targetUserId]);
        if (selfRes.rows.length > 0) {
          fullName = `${selfRes.rows[0].first_name} ${selfRes.rows[0].last_name}`;
        }
      }

      // 7. Entity detection
      let entity = contextEntity;
      // If it's a self-summary request, we bypass entity-specific detection to ensure overall summary
      if (!isSelfSummaryRequest) {
        if (message.includes('checklist') || message.includes('chcklst')) entity = 'checklist';
        else if (message.includes('delegation') || message.includes('delegat')) entity = 'delegation';
        else if (message.includes('ticket') || message.includes('tict')) entity = 'help_tickets';
        else if (message.includes('task') || message.includes('work') || message.includes('item')) entity = 'task';
      }

      // 8. Handle Individual Employee Summary (Overall)
      const isOverallSummary = !entity && (isSelfSummaryRequest || extractedName || (message.includes('summary') && message.includes('about')));

      if (isOverallSummary) {
        // Multi-module summary query
        const q = `
          SELECT 
            -- Employee Details
            e.first_name, e.last_name, e.designation, e.department,
            
            -- Checklists
            (SELECT COUNT(*) FROM checklist WHERE status NOT IN ('Completed', 'Verified') AND doer_id = $1) as pending_checklists,
            (SELECT COUNT(*) FROM checklist WHERE status IN ('Completed', 'Verified') AND doer_id = $1) as completed_checklists,
            (SELECT COUNT(*) FROM checklist WHERE status NOT IN ('Completed', 'Verified') AND due_date < CURRENT_TIMESTAMP AND doer_id = $1) as overdue_checklists,
            
            -- Delegations
            (SELECT COUNT(*) FROM delegation WHERE status NOT ILIKE 'completed' AND doer_id = $1) as pending_delegations,
            (SELECT COUNT(*) FROM delegation WHERE status ILIKE 'completed' AND doer_id = $1) as completed_delegations,
            (SELECT COUNT(*) FROM delegation WHERE status NOT ILIKE 'completed' AND due_date < CURRENT_TIMESTAMP AND doer_id = $1) as overdue_delegations,
            
            -- Help Tickets (Accountable or Solver)
            (SELECT COUNT(*) FROM help_tickets WHERE status = 'OPEN' AND (pc_accountable = $1 OR problem_solver = $1)) as open_tickets,
            
            -- Attendance (Today)
            (SELECT status FROM attendance WHERE user_id = $1 AND attendance_date = CURRENT_DATE LIMIT 1) as today_attendance
          FROM employees e
          WHERE e.user_id = $1
        `;
        const res = await pool.query(q, [targetUserId]);
        if (res.rows.length === 0) return { message: "Employee not found.", type: 'error' };
        
        const s = res.rows[0];
        
        const totalPending = parseInt(s.pending_checklists) + parseInt(s.pending_delegations);
        const totalCompleted = parseInt(s.completed_checklists) + parseInt(s.completed_delegations);
        const totalOverdue = parseInt(s.overdue_checklists) + parseInt(s.overdue_delegations);
        const attendanceStatus = s.today_attendance || "No record found";
        const designation = s.designation || "Not available";
        const department = s.department || "Not available";

        const response = chatbotFormatter.formatGuidance({
          title: `Employee Profile: ${s.first_name} ${s.last_name}`,
          intro: `Details for ${s.first_name} ${s.last_name} from the ${department} department:`,
          steps: [
            `Designation: **${designation}**`,
            `Department: **${department}**`,
            `Today's Attendance: **${attendanceStatus}**`
          ],
          notes: [
            `Pending Items: ${totalPending} (${s.pending_checklists} checklists, ${s.pending_delegations} delegations)`,
            `Completed Items: ${totalCompleted}`,
            `Overdue Items: ${totalOverdue}`,
            `Open Help Tickets: ${s.open_tickets}`
          ]
        });
        
        return { message: response, type: 'analytics', entity: 'employee_summary' };
      }

      if (!entity) return null;

      let response = '';
      // statusText is empty when user asks "all tasks/checklists" with no specific status
      let statusText;
      if (isAllStatuses) {
        statusText = '';
      } else if (isOverdue) {
        statusText = 'overdue';
      } else if (isCompleted) {
        statusText = 'completed';
      } else {
        statusText = 'pending';
      }

      if (entity === 'checklist') {
        // Build status filter: omit entirely when showing all statuses
        let statusFilter;
        if (isAllStatuses) {
          statusFilter = "1=1";
        } else if (isCompleted) {
          statusFilter = "status IN ('Completed', 'Verified')";
        } else {
          statusFilter = "status NOT IN ('Completed', 'Verified')";
        }
        let timeFilter = "";
        if (isOverdue) timeFilter = "AND due_date < CURRENT_TIMESTAMP";
        if (isToday) timeFilter = "AND created_at = CURRENT_DATE";

        // Label used in headers (with trailing space when non-empty)
        const statusLabel = statusText ? `${statusText} ` : '';

        if (isList) {
          const q = `SELECT question, status, due_date FROM checklist WHERE ${statusFilter} ${timeFilter} AND doer_id = $1 ${isAll ? '' : 'LIMIT 6'}`;
          const countQ = `SELECT COUNT(*) FROM checklist WHERE ${statusFilter} ${timeFilter} AND doer_id = $1`;
          
          const [res, countRes] = await Promise.all([
            pool.query(q, [targetUserId]),
            pool.query(countQ, [targetUserId])
          ]);
          
          const totalCount = parseInt(countRes.rows[0].count);

          if (res.rows.length === 0) {
            response = statusText
              ? `No ${statusText} checklists found.`
              : `No checklists found for ${fullName}.`;
          } else {
            const displayRows = isAll ? res.rows : res.rows.slice(0, 5);
            response = chatbotFormatter.formatChecklistList(
              displayRows, 
              isAll ? `All ${totalCount} ${statusLabel}checklists` : `Found ${totalCount} ${statusLabel}checklists`
            );
          }
        } else {
          if (isAllStatuses) {
            const q = `
              SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status NOT IN ('Completed', 'Verified') THEN 1 END) as pending,
                COUNT(CASE WHEN status IN ('Completed', 'Verified') THEN 1 END) as completed,
                COUNT(CASE WHEN status NOT IN ('Completed', 'Verified') AND due_date < CURRENT_TIMESTAMP THEN 1 END) as overdue
              FROM checklist WHERE doer_id = $1
            `;
            const res = await pool.query(q, [targetUserId]);
            const s = res.rows[0];
            response = chatbotFormatter.formatSummaryCount(`${fullName}'s Checklist Summary`, [
              { label: 'Total Checklists', count: s.total },
              { label: 'Pending', count: s.pending },
              { label: 'Completed', count: s.completed },
              { label: 'Overdue', count: s.overdue }
            ]);
          } else {
            const q = `SELECT COUNT(*) FROM checklist WHERE ${statusFilter} ${timeFilter} AND doer_id = $1`;
            const res = await pool.query(q, [targetUserId]);
            const count = res.rows[0].count;
            response = `${fullName} ${fullName === 'You' ? 'have' : 'has'} ${count} ${statusLabel}checklists${isToday ? ' for today' : ''}.`;
          }
        }
      } else if (entity === 'delegation') {
        // Build status filter: omit entirely when showing all statuses
        let statusFilter;
        if (isAllStatuses) {
          statusFilter = "1=1";
        } else if (isCompleted) {
          statusFilter = "status ILIKE 'completed'";
        } else {
          statusFilter = "status NOT ILIKE 'completed'";
        }
        let timeFilter = "";
        if (isOverdue) timeFilter = "AND due_date < CURRENT_TIMESTAMP";

        const statusLabel = statusText ? `${statusText} ` : '';

        if (isList) {
          const q = `SELECT delegation_name, status, due_date FROM delegation WHERE ${statusFilter} ${timeFilter} AND doer_id = $1 ${isAll ? '' : 'LIMIT 5'}`;
          const countQ = `SELECT COUNT(*) FROM delegation WHERE ${statusFilter} ${timeFilter} AND doer_id = $1`;

          const [res, countRes] = await Promise.all([
            pool.query(q, [targetUserId]),
            pool.query(countQ, [targetUserId])
          ]);

          const totalCount = parseInt(countRes.rows[0].count);

          if (res.rows.length === 0) {
            response = statusText
              ? `No ${statusText} delegations found for ${fullName}.`
              : `No delegations found for ${fullName}.`;
          } else {
            const displayRows = isAll ? res.rows : res.rows.slice(0, 5);
            response = chatbotFormatter.formatDelegationList(
              displayRows,
              isAll ? `All ${totalCount} ${statusLabel}delegations` : `Found ${totalCount} ${statusLabel}delegations`
            );
          }
        } else {
          if (isAllStatuses) {
            const q = `
              SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status ILIKE 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status NOT ILIKE 'completed' THEN 1 END) as pending,
                COUNT(CASE WHEN status NOT ILIKE 'completed' AND due_date < CURRENT_TIMESTAMP THEN 1 END) as overdue
              FROM delegation WHERE doer_id = $1
            `;
            const res = await pool.query(q, [targetUserId]);
            const s = res.rows[0];
            response = chatbotFormatter.formatSummaryCount(`${fullName}'s Delegation Summary`, [
              { label: 'Total Delegations', count: s.total },
              { label: 'Pending', count: s.pending },
              { label: 'Completed', count: s.completed },
              { label: 'Overdue', count: s.overdue }
            ]);
          } else {
            const q = `SELECT COUNT(*) FROM delegation WHERE ${statusFilter} ${timeFilter} AND doer_id = $1`;
            const res = await pool.query(q, [targetUserId]);
            const count = res.rows[0].count;
            response = `${fullName} ${fullName === 'You' ? 'have' : 'has'} ${count} ${statusLabel}delegations.`;
          }
        }
      } else if (entity === 'help_tickets') {
        let statusFilter = isCompleted ? "status = 'CLOSED'" : "status = 'OPEN'";
        
        if (isList) {
          const q = `SELECT help_ticket_no, issue_description FROM help_tickets WHERE ${statusFilter} AND (raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1) LIMIT 5`;
          const res = await pool.query(q, [targetUserId]);
          if (res.rows.length === 0) {
            response = `No ${isCompleted ? 'closed' : 'open'} help tickets found for ${fullName}.`;
          } else {
            const listData = res.rows.map(r => ({ name: r.issue_description, status: 'OPEN', id: r.help_ticket_no }));
            response = chatbotFormatter.formatList(listData, `Open Help Tickets for ${fullName}`, 'ticket');
          }
        } else {
          const q = `SELECT COUNT(*) FROM help_tickets WHERE ${statusFilter} AND (raised_by = $1 OR pc_accountable = $1 OR problem_solver = $1)`;
          const res = await pool.query(q, [targetUserId]);
          const count = res.rows[0].count;
          response = `${fullName} ${fullName === 'You' ? 'have' : 'has'} ${count} ${isCompleted ? 'closed' : 'open'} help tickets.`;
        }
      } else if (entity === 'task') {
        // Build status filters: omit entirely when showing all statuses
        let checklistStatus, delegationStatus;
        if (isAllStatuses) {
          checklistStatus = "1=1";
          delegationStatus = "1=1";
        } else if (isCompleted) {
          checklistStatus = "status IN ('Completed', 'Verified')";
          delegationStatus = "status ILIKE 'completed'";
        } else {
          checklistStatus = "status NOT IN ('Completed', 'Verified')";
          delegationStatus = "status NOT ILIKE 'completed'";
        }
        let timeFilter = isOverdue ? "AND due_date < CURRENT_TIMESTAMP" : "";

        const statusLabel = statusText ? `${statusText} ` : '';

        if (isList) {
          // Note: LIMIT must be applied after UNION ALL so we wrap it
          const innerQ = `
            SELECT 'Checklist' as type, question as name, status, due_date FROM checklist WHERE ${checklistStatus} ${timeFilter} AND doer_id = $1
            UNION ALL
            SELECT 'Delegation' as type, delegation_name as name, status, due_date FROM delegation WHERE ${delegationStatus} ${timeFilter} AND doer_id = $1
          `;
          const q = isAll ? innerQ : `${innerQ} LIMIT 6`;

          const countQ = `
            SELECT 
              (SELECT COUNT(*) FROM checklist WHERE ${checklistStatus} ${timeFilter} AND doer_id = $1) as checklist_count,
              (SELECT COUNT(*) FROM delegation WHERE ${delegationStatus} ${timeFilter} AND doer_id = $1) as delegation_count
          `;
          const [res, countRes] = await Promise.all([
            pool.query(q, [targetUserId]),
            pool.query(countQ, [targetUserId])
          ]);
          const totalCount = parseInt(countRes.rows[0].checklist_count) + parseInt(countRes.rows[0].delegation_count);

          if (res.rows.length === 0) {
            response = statusText
              ? `No ${statusText} tasks found.`
              : `No tasks found for ${fullName}.`;
          } else {
            const displayRows = isAll ? res.rows : res.rows.slice(0, 5);
            response = chatbotFormatter.formatTaskList(
              displayRows,
              isAll ? `All ${totalCount} ${statusLabel}tasks` : `Found ${totalCount} ${statusLabel}tasks`
            );
          }
        } else {
          if (isAllStatuses) {
            const q = `
              SELECT 
                (SELECT COUNT(*) FROM checklist WHERE doer_id = $1) as total_checklist,
                (SELECT COUNT(*) FROM delegation WHERE doer_id = $1) as total_delegation,
                (SELECT COUNT(*) FROM checklist WHERE status NOT IN ('Completed', 'Verified') AND doer_id = $1) as pending_checklist,
                (SELECT COUNT(*) FROM delegation WHERE status NOT ILIKE 'completed' AND doer_id = $1) as pending_delegation,
                (SELECT COUNT(*) FROM checklist WHERE status IN ('Completed', 'Verified') AND doer_id = $1) as completed_checklist,
                (SELECT COUNT(*) FROM delegation WHERE status ILIKE 'completed' AND doer_id = $1) as completed_delegation,
                (SELECT COUNT(*) FROM checklist WHERE status NOT IN ('Completed', 'Verified') AND due_date < CURRENT_TIMESTAMP AND doer_id = $1) as overdue_checklist,
                (SELECT COUNT(*) FROM delegation WHERE status NOT ILIKE 'completed' AND due_date < CURRENT_TIMESTAMP AND doer_id = $1) as overdue_delegation
            `;
            const res = await pool.query(q, [targetUserId]);
            const s = res.rows[0];
            
            const counts = [
              { label: 'Total Tasks', count: parseInt(s.total_checklist) + parseInt(s.total_delegation) },
              { label: 'Pending', count: parseInt(s.pending_checklist) + parseInt(s.pending_delegation) },
              { label: 'Completed', count: parseInt(s.completed_checklist) + parseInt(s.completed_delegation) },
              { label: 'Overdue', count: parseInt(s.overdue_checklist) + parseInt(s.overdue_delegation) }
            ];
            
            response = chatbotFormatter.formatSummaryCount(`${fullName}'s Work Overview`, counts);
          } else {
            // Count summary — use pending filters for summary unless status is explicitly set
            const summaryChecklistStatus = isAllStatuses ? "status NOT IN ('Completed', 'Verified')" : checklistStatus;
            const summaryDelegationStatus = isAllStatuses ? "status NOT ILIKE 'completed'" : delegationStatus;

            const q = `
              SELECT 
                (SELECT COUNT(*) FROM checklist WHERE ${summaryChecklistStatus} AND doer_id = $1) as pending_checklist,
                (SELECT COUNT(*) FROM delegation WHERE ${summaryDelegationStatus} AND doer_id = $1) as pending_delegation,
                (SELECT COUNT(*) FROM checklist WHERE ${summaryChecklistStatus} AND due_date < CURRENT_TIMESTAMP AND doer_id = $1) as overdue_checklist,
                (SELECT COUNT(*) FROM delegation WHERE ${summaryDelegationStatus} AND due_date < CURRENT_TIMESTAMP AND doer_id = $1) as overdue_delegation
            `;
            const res = await pool.query(q, [targetUserId]);
            const { pending_checklist, pending_delegation, overdue_checklist, overdue_delegation } = res.rows[0];
            
            const totalPending = parseInt(pending_checklist) + parseInt(pending_delegation);
            const totalOverdue = parseInt(overdue_checklist) + parseInt(overdue_delegation);
            
            const totalCount = isOverdue ? totalOverdue : (isCompleted ? totalCompleted : totalPending);
            const statusLabel = isOverdue ? 'overdue' : (isCompleted ? 'completed' : 'pending');
            
            const counts = [
              { label: 'Pending Checklists', count: pending_checklist },
              { label: 'Pending Delegations', count: pending_delegation }
            ];
            if (overdue_checklist > 0 || overdue_delegation > 0) {
              counts.push({ label: 'Overdue Items', count: parseInt(overdue_checklist) + parseInt(overdue_delegation) });
            }
            
            response = chatbotFormatter.formatSummaryCount(`${fullName}'s Work Summary`, counts);
            if (isOverdue) {
              response = chatbotFormatter.formatSummaryCount(`${fullName}'s Overdue Summary`, [
                { label: 'Overdue Checklists', count: overdue_checklist },
                { label: 'Overdue Delegations', count: overdue_delegation }
              ]);
            }
          }
        }
      }

      return response ? { 
        message: response, 
        type: 'data-query', 
        entity, 
        status: statusText,
        isList,
        isCount
      } : null;
    } catch (error) {
      console.error('Data query handling error:', error);
      return { message: chatbotFormatter.stripMarkdown("I'm sorry, I encountered an error while fetching the data. Please try again later."), type: 'error' };
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
    const response = responses[intent] || responses.unknown;

    if (typeof response === 'string') return response;

    // Handle structured response objects
    if (intent === 'clarification') {
      return chatbotFormatter.formatClarification(response.intro, response.options);
    }

    return chatbotFormatter.formatGuidance({
      title: response.title,
      intro: response.intro,
      steps: response.steps,
      closing: response.closing
    });
  }

  /**
   * Format knowledge base entry using the formatter
   * @param {Object} entry - Knowledge base entry
   * @param {Object} session - Active session context
   * @returns {string} Formatted response
   */
  formatKnowledgeResponse(entry, session = null) {
    if (!entry) return '';
    
    const content = entry.content;
    let title = entry.title;
    let intro = content.intro;
    let closing = content.closing;

    // Tailor for overdue context if confidence is high
    if (session && session.lastStatus === 'overdue' && (session.confidence || 0) > 0.7) {
      if (title.toLowerCase().includes('task') || title.toLowerCase().includes('checklist')) {
        title = `Guidance for Overdue ${session.lastEntity === 'task' ? 'Tasks' : 'Checklists'}`;
        if (typeof intro === 'string') {
          intro = `Regarding your overdue items, here is how to proceed: ${intro}`;
        }
      }
    }

    if (typeof content === 'string') {
      return chatbotFormatter.formatSection(title, this.sanitizeKnowledgeContent(content));
    }

    return chatbotFormatter.formatGuidance({
      title: title,
      intro: intro,
      steps: content.steps,
      notes: content.notes,
      closing: closing
    });
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
        message: this.getFallbackResponse()
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
        message: this.getFallbackResponse()
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
   * Check if query is ambiguous or just repeating keywords
   * @param {string} message - User message
   * @returns {boolean} True if ambiguous
   */
  isAmbiguousQuery(message) {
    if (!message) return true;
    const words = message.split(/\s+/).filter(w => w.length > 1);
    
    // Very short queries (1-2 words) that are just module names
    const moduleKeywords = ['task', 'tasks', 'checklist', 'checklists', 'ticket', 'delegation', 'attendance'];
    if (words.length <= 2 && words.every(w => moduleKeywords.includes(w))) return true;

    // Repetitive words (e.g., "task task task")
    if (words.length >= 3 && new Set(words).size === 1) return true;

    return false;
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
   * Calculate Levenshtein distance between two strings
   * @param {string} a 
   * @param {string} b 
   * @returns {number}
   */
  getLevenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
      }
    }
    return matrix[b.length][a.length];
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