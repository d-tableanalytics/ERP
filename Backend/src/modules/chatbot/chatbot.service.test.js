const test = require('node:test');
const assert = require('node:assert/strict');

const chatbotService = require('./chatbot.service');
const CHATBOT_CONTEXT = require('./chatbot.context');
const chatbotOpenAI = require('./chatbot.openai');

const originalLogConversation = chatbotService.logConversation;
const originalGenerateOpenAIResponse = chatbotService.generateOpenAIResponse;
const originalOpenAIGenerateResponse = chatbotOpenAI.generateResponse;
const originalOpenAIValidateResponse = chatbotOpenAI.validateResponse;

test.beforeEach(() => {
  chatbotService.logConversation = async () => {};
  chatbotService.generateOpenAIResponse = originalGenerateOpenAIResponse.bind(chatbotService);
  chatbotOpenAI.generateResponse = originalOpenAIGenerateResponse;
  chatbotOpenAI.validateResponse = originalOpenAIValidateResponse;
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
  assert.equal(result.responseType, 'standard'); // Standardized
  assert.match(result.message, /### Delegation Workflow/i);
  assert.match(result.message, /to delegate a task/i);
});

test('returns help ticket knowledge for direct help ticket question', async () => {
  const result = await chatbotService.processMessage(1, 'How do I raise a help ticket?', 'Employee');

  assert.equal(result.success, true);
  assert.equal(result.responseType, 'standard'); // Standardized
  assert.match(result.message, /### Help Ticket Process/i);
});

test('returns checklist knowledge for checklist usage question', async () => {
  const result = await chatbotService.processMessage(1, 'What is checklist module used for?', 'Employee');

  assert.equal(result.success, true);
  assert.equal(result.responseType, 'standard'); // Updated to standard
  assert.match(result.message, /### Checklist Module Overview/i);
});

test('returns rule-based greeting for hello', async () => {
  const result = await chatbotService.processMessage(1, 'hello', 'Employee');

  assert.equal(result.success, true);
  assert.equal(result.intent, 'greeting');
  assert.equal(result.responseType, 'standard'); // Updated to standard
  assert.match(result.message, /### Welcome to ERP Assistant/i);
  assert.match(result.message, /Manage \*\*Delegations\*\*/i);
});

test('uses OpenAI fallback path for unknown ERP-related question without knowledge match', async () => {
  let fallbackCalled = false;

  chatbotService.generateOpenAIResponse = async (message, userRole, knowledgeContent) => {
    fallbackCalled = true;
    assert.equal(message, 'where can i find the approval queue?');
    assert.equal(userRole, 'Employee');

    return {
      success: true,
      message: 'OpenAI fallback answer',
      tokens: 42
    };
  };

  const result = await chatbotService.processMessage(1, 'Where can I find the approval queue?', 'Employee');

  assert.equal(fallbackCalled, true);
  assert.equal(result.success, true);
  assert.equal(result.intent, 'unknown');
  assert.equal(result.responseType, 'standard');
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
  // intent might be data_query because of 'show' keyword
  assert.equal(result.responseType, 'standard');
  assert.match(result.message, /i can only assist with questions about the dta_racpl erp system/i);
});
