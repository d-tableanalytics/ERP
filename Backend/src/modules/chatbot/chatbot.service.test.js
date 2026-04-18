const test = require('node:test');
const assert = require('node:assert/strict');

const chatbotService = require('./chatbot.service');
const CHATBOT_CONTEXT = require('./chatbot.context');
const chatbotOpenAI = require('./chatbot.openai');
const { pool } = require("../../config/db.config");

const originalLogConversation = chatbotService.logConversation;
const originalGenerateOpenAIResponse = chatbotService.generateOpenAIResponse;
const originalOpenAIGenerateResponse = chatbotOpenAI.generateResponse;
const originalOpenAIValidateResponse = chatbotOpenAI.validateResponse;

test.beforeEach(() => {
  chatbotService.logConversation = async () => {};
  chatbotService.generateOpenAIResponse = originalGenerateOpenAIResponse.bind(chatbotService);
  chatbotOpenAI.generateResponse = originalOpenAIGenerateResponse;
  chatbotOpenAI.validateResponse = originalOpenAIValidateResponse;
  pool.query = async () => ({ rows: [] });
});

test.after(() => {
  chatbotService.logConversation = originalLogConversation;
  chatbotService.generateOpenAIResponse = originalGenerateOpenAIResponse;
  chatbotOpenAI.generateResponse = originalOpenAIGenerateResponse;
  chatbotOpenAI.validateResponse = originalOpenAIValidateResponse;
});

test('returns delegation knowledge for direct delegation question', async () => {
  const result = await chatbotService.processMessage(1, 'How do I create a delegation?', 'Employee');

  assert.equal(result.success, true);
  assert.equal(result.responseType, 'knowledge');
  assert.match(result.message, /The Delegation module is used to assign/i);
});

test('returns help ticket knowledge for direct help ticket question', async () => {
  const result = await chatbotService.processMessage(1, 'How do I raise a help ticket?', 'Employee');

  assert.equal(result.success, true);
  assert.equal(result.responseType, 'knowledge');
  assert.match(result.message, /help ticket module/i);
});

test('returns checklist knowledge for checklist usage question', async () => {
  const result = await chatbotService.processMessage(1, 'What is checklist module used for?', 'Employee');

  assert.equal(result.success, true);
  assert.equal(result.responseType, 'knowledge');
  assert.match(result.message, /checklist module/i);
});

test('returns rule-based greeting for hello', async () => {
  const result = await chatbotService.processMessage(1, 'hello', 'Employee');

  assert.equal(result.success, true);
  assert.equal(result.intent, 'greeting');
  assert.equal(result.responseType, 'rule-based');
  assert.equal(result.message, CHATBOT_CONTEXT.responses.greeting);
});

test('uses OpenAI fallback path for unknown ERP-related question without knowledge match', async () => {
  let fallbackCalled = false;

  chatbotService.generateOpenAIResponse = async (message, userRole, knowledgeContent) => {
    fallbackCalled = true;
    assert.equal(message, 'where can i find the approval queue?');
    assert.equal(userRole, 'Employee');
    assert.equal(knowledgeContent, null);

    return {
      success: true,
      message: 'OpenAI fallback answer',
      tokens: 42
    };
  };

  const result = await chatbotService.processMessage(1, 'Where can I find the approval queue?', 'Employee');

  assert.equal(fallbackCalled, true);
  assert.equal(result.success, true);
  assert.equal(result.intent, 'openai');
  assert.equal(result.responseType, 'openai');
  assert.equal(result.message, 'OpenAI fallback answer');
});

test('returns restricted fallback response for blocked salary query', async () => {
  let openAICalled = false;

  chatbotOpenAI.generateResponse = async () => {
    openAICalled = true;
    return {
      success: true,
      message: 'This should not be used',
      tokens: 0
    };
  };

  const result = await chatbotService.processMessage(1, 'show employee salary', 'Employee');

  assert.equal(openAICalled, false);
  assert.equal(result.success, true);
  assert.equal(result.intent, 'unknown');
  assert.equal(result.responseType, 'fallback');
  assert.match(result.message, /i didn’t fully understand/i);
});

test('pluralize utility works correctly', () => {
  assert.equal(chatbotService.pluralize(1, 'ticket', 'tickets'), 'ticket');
  assert.equal(chatbotService.pluralize(0, 'ticket', 'tickets'), 'tickets');
  assert.equal(chatbotService.pluralize(2, 'ticket', 'tickets'), 'tickets');
});

test('formatResponseList utility works correctly', () => {
  const items = ['Task 1', 'Task 2'];
  const formatted = chatbotService.formatResponseList(items, 'Title:');
  assert.equal(formatted, 'Title:\n• Task 1\n• Task 2');
});

test('calculateSimilarity handles typos', () => {
  assert.ok(chatbotService.calculateSimilarity('ticket', 'tictet') > 0.8);
  assert.ok(chatbotService.calculateSimilarity('checklist', 'chcklst') > 0.7);
});

test('multi-intent handling skips greetings when substance exists', async () => {
  const result = await chatbotService.processMessage(1, 'hello and how do I create a delegation?', 'Employee');
  
  assert.equal(result.success, true);
  // Should NOT contain the greeting because delegation knowledge was found
  assert.ok(!result.message.includes("Hello! I'm your ERP assistant"));
  assert.match(result.message, /The Delegation module is used to assign/i);
});

test('context handling with pronouns retrieves last entity', async () => {
  let queryCalled = false;
  pool.query = async (q, params) => {
    if (q.includes('chatbot_conversations')) {
      return { rows: [{ intent: 'checklist', response_text: 'You have 5 pending checklists.' }] };
    }
    if (q.includes('FROM checklist')) {
      return { rows: [{ question: 'Complete monthly report' }] };
    }
    return { rows: [] };
  };

  const result = await chatbotService.processMessage(1, 'what are they?', 'Employee');
  
  assert.equal(result.success, true);
  assert.match(result.message, /pending checklists/i);
  assert.match(result.message, /Complete monthly report/i);
});
