/**
 * Chatbot Context - Centralized configuration for chatbot behavior
 * Stores intents, responses, and system instructions
 * Designed to be easily extensible for OpenAI integration in the future
 */

const CHATBOT_CONTEXT = {
  // System instructions for the chatbot
  systemPrompt: `You are the ERP Assistant for DTA_RACPL.
You help employees understand and use the ERP system.
You provide guidance on module usage, workflows, and company policies.
You are professional, helpful, and concise.`,

  // Enhanced system prompt for OpenAI integration
  openaiSystemPrompt: `You are the ERP Assistant for DTA_RACPL, a professional AI assistant designed to help employees with the company's ERP system.

Your role:
- Help employees understand and use ERP modules
- Provide guidance on workflows, delegations, help tickets, attendance, checklists
- Answer questions about company processes and policies
- Be professional, helpful, and concise in all responses

Important restrictions:
- Only answer questions related to DTA_RACPL ERP system and company processes
- Do not provide general knowledge or unrelated information
- Never discuss sensitive employee data, salaries, passwords, or confidential information
- Do not claim access to databases or perform actions you cannot do
- If asked about restricted topics, politely refuse and redirect to allowed topics
- Keep responses focused on ERP functionality and company workflows

Allowed topics:
- ERP modules (delegation, help tickets, attendance, checklists, dashboard)
- General workflow guidance
- Company process explanations
- Module usage instructions
- Best practices for using the system

If you cannot answer a question safely or it's outside your scope, respond with: "I'm sorry, I can only assist with questions about the DTA_RACPL ERP system and related workflows. Please ask about delegations, help tickets, attendance, checklists, or dashboard features."`,

  // Instruction for using company knowledge in OpenAI prompts
  knowledgeInstruction: `Use the following company knowledge to answer the user's question. Answer using the ERP context, be accurate, concise, and do not hallucinate beyond the provided knowledge. If the question is outside the knowledge scope, say you can only assist with ERP-related workflows and modules.`,

  // Topics allowed for OpenAI responses
  allowedTopics: [
    'delegation', 'task', 'assign', 'workflow', 'delegate',
    'help ticket', 'support ticket', 'issue', 'problem', 'complaint',
    'attendance', 'punch', 'time', 'clock', 'leave',
    'checklist', 'daily', 'tasks', 'todo', 'list',
    'dashboard', 'summary', 'overview', 'stats', 'report',
    'erp', 'system', 'module', 'feature', 'guide', 'help',
    'process', 'procedure', 'policy', 'guidance',
    'total', 'count', 'number', 'how many', 'pending', 'completed',
    'statu', 'chcklst', 'workload', 'busiest', 'most work'
  ],

  // Topics blocked for OpenAI responses
  blockedTopics: [
    'password', 'secret', 'token', 'key', 'security',
    'salary', 'personal', 'confidential', 'private',
    'admin', 'administrator', 'database', 'server',
    'finance', 'financial', 'budget', 'cost',
    'general knowledge', 'weather', 'news', 'politics'
  ],

  // Intent keywords mapping
  intents: {
    employee_list: ['name of employees', 'names of employees', 'list employees', 'show employees', 'employee names', 'show employee names', 'details about employees'],
    greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
    help_ticket: ['ticket', 'issue', 'problem', 'complaint', 'support ticket', 'help ticket', 'raise ticket', 'create ticket', 'submit ticket', 'helpdesk', 'log issue', 'report issue'],
    delegation: ['delegation', 'task', 'assign', 'delegate', 'workflow', 'delegation module', 'create delegation', 'task assignment', 'assign work', 'delegate job'],
    attendance: ['attendance', 'punch', 'time', 'clock in', 'clock out', 'leave', 'attendance module'],
    checklist: ['checklist', 'daily', 'tasks', 'todo', 'list', 'checklist module', 'what is checklist used for', 'purpose of checklist'],
    dashboard: ['dashboard', 'summary', 'overview', 'stats', 'report', 'dashboard module'],
    help: ['help', 'assist', 'support', 'guide'],
    employee_summary: ['my employees', 'employee information', 'employee summary', 'team information', 'team summary', 'my team', 'team overview', 'summary of', 'details about', 'about', 'operational summary', 'summary about', 'my operational summary', 'my work summary', 'my employee summary', 'my details', 'my summary', 'give me my summary', 'show my summary', 'show my operational summary', 'give me my operational summary', 'who is', 'who am i', 'profile of', 'employee profile of', 'tell me about', 'my profile']
  },

  // Response templates for each intent
  responses: {
    greeting: "Hello! I'm your ERP assistant. I can help you with delegations, help tickets, attendance, checklists, and more. What would you like to know about?",

    help: "I can help you with various ERP modules. Try asking about:\n• Delegations and task management\n• Help tickets and support\n• Attendance tracking\n• Daily checklists\n• Dashboard overview\n\nWhat specific area interests you?",

    delegation: "The Delegation module helps you manage and assign tasks. You can create delegations, upload files, add remarks, and track progress. Access it from the sidebar menu under 'Delegation'. Need help with a specific delegation feature?",

    help_ticket: "For support issues, use the Help Ticket module. You can raise tickets for technical problems, feature requests, or general inquiries. Each ticket has priority levels and TAT tracking. Find it in the 'Help Ticket' section of the sidebar.",

    attendance: "The Attendance module tracks your work hours. You can punch in/out, view your attendance history, and request leaves. It's available under 'Attendance' in the sidebar. Make sure to punch in at the start of your workday!",

    checklist: "Daily checklists help you track routine tasks. Create, complete, and monitor checklists for your daily responsibilities. Access it through the 'Checklist' menu. Regular completion helps maintain productivity standards.",

    dashboard: "The Dashboard provides an overview of your key metrics including pending tasks, recent activities, and system status. It's your main landing page after login, showing summaries from all modules.",

    unknown: "I'm not sure about that specific topic. I can help with delegations, help tickets, attendance, checklists, dashboard, or general ERP guidance. Try rephrasing your question or ask about a specific module."
  },

  // Configuration for input validation
  validation: {
    maxMessageLength: 500,
    minMessageLength: 1
  },

  // Configuration for rate limiting and performance
  performance: {
    conversationLogBatchSize: 10,
    cacheResponseMs: 300000 // 5 minutes
  }
};

module.exports = CHATBOT_CONTEXT;