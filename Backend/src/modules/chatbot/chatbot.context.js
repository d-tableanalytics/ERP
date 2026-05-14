/**
 * Chatbot Context - Centralized configuration for chatbot behavior
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

Important formatting rules:
- USE PLAIN TEXT ONLY.
- DO NOT use Markdown syntax (no ###, no **bold**, no *italic*, no ---).
- Use spacing, indentation, and simple bullet points (•) for structure.
- Ensure your response is readable in a plain text chat bubble.

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

If you cannot answer a question safely or it's outside your scope, respond with a professional fallback message.`,

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
    guidance: ['how to', 'how i can', 'how do i', 'guide me', 'steps to', 'process of', 'instructions for', 'how can i', 'show me how', 'help me create', 'guide me to'],
    employee_list: ['name of employees', 'names of employees', 'list employees', 'show employees', 'employee names', 'show employee names', 'details about employees'],
    greeting: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
    help_ticket: ['ticket', 'issue', 'problem', 'complaint', 'support ticket', 'help ticket', 'raise ticket', 'create ticket', 'submit ticket', 'helpdesk', 'log issue', 'report issue'],
    delegation: ['delegation', 'assign', 'delegate', 'workflow', 'delegation module', 'create delegation', 'assign work', 'delegate job'],
    attendance: ['attendance', 'punch', 'time', 'clock in', 'clock out', 'leave', 'attendance module'],
    checklist: ['checklist', 'checklists', 'checklist module', 'what is checklist used for', 'purpose of checklist'],
    dashboard: ['dashboard', 'summary', 'overview', 'stats', 'report', 'dashboard module'],
    help: ['help', 'assist', 'support', 'guide'],
    employee_summary: ['my employees', 'employee information', 'employee summary', 'team information', 'team summary', 'my team', 'team overview', 'summary of', 'details about', 'about', 'operational summary', 'summary about', 'my operational summary', 'my work summary', 'my employee summary', 'my details', 'my summary', 'give me my summary', 'show my summary', 'show my operational summary', 'give me my operational summary', 'who is', 'who am i', 'profile of', 'employee profile of', 'tell me about', 'my profile']
  },

  // Response templates for each intent
  responses: {
    greeting: {
      title: 'Welcome to ERP Assistant',
      intro: "Hello! I'm your professional ERP assistant for DTA_RACPL.",
      steps: [
        'Manage **Delegations** and tasks',
        'Track **Daily Checklists**',
        'Raise and monitor **Help Tickets**',
        'View **Attendance** and workload summaries'
      ],
      closing: 'How can I assist you today?'
    },

    help: {
      title: 'How I Can Help',
      intro: 'I can assist you with various modules and workflows within the ERP system:',
      steps: [
        '**Delegations**: Assign tasks, track progress, and update statuses.',
        '**Help Tickets**: Report technical issues or request support.',
        '**Attendance**: Check punch records and leave status.',
        '**Checklists**: Manage routine tasks and recurring lists.',
        '**Dashboard**: View operational summaries and metrics.'
      ],
      closing: 'Try asking "Show my pending tasks" or "How to create a checklist".'
    },

    guidance: {
      title: 'Guidance & Tutorials',
      intro: 'I can provide step-by-step instructions for common ERP tasks:',
      steps: [
        'How to create a delegation',
        'How to raise a help ticket',
        'How to complete a task',
        'How to manage recurring checklists'
      ],
      closing: 'What specific workflow would you like to learn about?'
    },

    delegation: {
      title: 'Delegation Module',
      intro: 'The Delegation module helps you manage and assign tasks efficiently.',
      steps: [
        'Create new delegations for your team.',
        'Upload supporting documents and files.',
        'Add remarks and track status updates.',
        'Monitor completion deadlines.'
      ],
      closing: 'Access it from the sidebar menu under "Delegation".'
    },

    help_ticket: {
      title: 'Help Ticket Module',
      intro: 'Use this module for technical support and issue tracking:',
      steps: [
        'Raise tickets for system problems.',
        'Track resolution progress and TAT.',
        'Communicate with the support team through remarks.'
      ],
      closing: 'Find it in the "Help Ticket" section of the sidebar.'
    },

    attendance: {
      title: 'Attendance Module',
      intro: 'Track your work hours and manage leaves:',
      steps: [
        'Punch In/Out to record daily work hours.',
        'View historical attendance logs.',
        'Request and track leave applications.'
      ],
      closing: 'Make sure to punch in at the start of your workday!'
    },

    checklist: {
      title: 'Checklist Module',
      intro: 'Stay organized with daily and recurring checklists:',
      steps: [
        'Create lists for routine operations.',
        'Mark items as completed in real-time.',
        'Set up recurring lists for daily tasks.'
      ],
      closing: 'Access it through the "Checklist" menu in the sidebar.'
    },

    dashboard: {
      title: 'ERP Dashboard',
      intro: 'Your central hub for operational metrics:',
      steps: [
        'View pending task and checklist counts.',
        'Monitor recent activities and ticket statuses.',
        'Check today\'s attendance summary.'
      ],
      closing: 'The dashboard is your main landing page after login.'
    },

    clarification: {
      intro: "I noticed you're asking about tasks or checklists. To help you better, please specify what you'd like to do:",
      options: [
        'Show my pending tasks',
        'Show my overdue checklists',
        'How to complete a task',
        'How to create a checklist'
      ]
    },

    unknown: "I'm sorry, I can only assist with questions about the DTA_RACPL ERP system and related workflows. Please ask about delegations, help tickets, attendance, checklists, or dashboard features."
  }
};

module.exports = CHATBOT_CONTEXT;