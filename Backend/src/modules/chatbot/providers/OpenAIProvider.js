const OpenAI = require('openai');
const BaseProvider = require('./BaseProvider');
const logger = require('../utils/logger');
const { ChatbotError, ErrorCode } = require('../constants/errors');

/**
 * OpenAI adapter using the official SDK.
 *
 * - Default model: gpt-4o-mini (function-calling native, fast, cheap).
 * - chat()  returns { content, toolCalls, usage } for non-streaming flows.
 * - stream() async-yields { type: 'delta'|'tool_call'|'done', ... } events
 *   so the SSE controller can forward them to the client.
 */

class OpenAIProvider extends BaseProvider {
  constructor() {
    super();
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.defaultMaxTokens = parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 800;
    this.defaultTemperature = process.env.OPENAI_TEMPERATURE != null
      ? parseFloat(process.env.OPENAI_TEMPERATURE)
      : 0.3;
    const apiKey = process.env.OPENAI_API_KEY;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    if (!apiKey) {
      logger.warn('OPENAI_API_KEY not set — chatbot will use safe-fallback responses');
    }
  }

  isAvailable() { return this.client !== null; }
  get name() { return 'openai'; }

  async chat({ messages, tools = null, toolChoice = 'auto', temperature, maxTokens }) {
    if (!this.client) throw new ChatbotError(ErrorCode.PROVIDER_UNAVAILABLE, 'OpenAI client not configured');
    const params = {
      model: this.model,
      messages,
      temperature: temperature ?? this.defaultTemperature,
      max_tokens: maxTokens ?? this.defaultMaxTokens,
    };
    if (tools && tools.length) {
      params.tools = tools;
      params.tool_choice = toolChoice;
    }
    let completion;
    try {
      completion = await this.client.chat.completions.create(params);
    } catch (err) {
      logger.error('OpenAI chat failed', { error: err.message });
      throw new ChatbotError(ErrorCode.PROVIDER_FAILED, err.message);
    }
    const choice = completion.choices && completion.choices[0];
    const msg = choice && choice.message;
    return {
      content: (msg && msg.content) || '',
      toolCalls: msg && msg.tool_calls ? msg.tool_calls.map(this._normalizeToolCall) : [],
      finishReason: choice && choice.finish_reason,
      usage: completion.usage || {},
      raw: completion,
    };
  }

  async *stream({ messages, tools = null, toolChoice = 'auto', temperature, maxTokens }) {
    if (!this.client) throw new ChatbotError(ErrorCode.PROVIDER_UNAVAILABLE, 'OpenAI client not configured');
    const params = {
      model: this.model,
      messages,
      temperature: temperature ?? this.defaultTemperature,
      max_tokens: maxTokens ?? this.defaultMaxTokens,
      stream: true,
    };
    if (tools && tools.length) {
      params.tools = tools;
      params.tool_choice = toolChoice;
    }
    let resp;
    try {
      resp = await this.client.chat.completions.create(params);
    } catch (err) {
      logger.error('OpenAI stream failed', { error: err.message });
      throw new ChatbotError(ErrorCode.PROVIDER_FAILED, err.message);
    }

    // Accumulators for the streamed response
    const toolBuffers = new Map(); // index -> { id, name, argsStr }
    let contentBuffer = '';
    let finishReason = null;

    for await (const chunk of resp) {
      const choice = chunk.choices && chunk.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};

      if (typeof delta.content === 'string' && delta.content.length) {
        contentBuffer += delta.content;
        yield { type: 'delta', text: delta.content };
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const buf = toolBuffers.get(idx) || { id: null, name: '', argsStr: '' };
          if (tc.id) buf.id = tc.id;
          if (tc.function?.name) buf.name = tc.function.name;
          if (tc.function?.arguments) buf.argsStr += tc.function.arguments;
          toolBuffers.set(idx, buf);
        }
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    const toolCalls = [];
    for (const [, buf] of toolBuffers) {
      let args = {};
      try { args = buf.argsStr ? JSON.parse(buf.argsStr) : {}; } catch (_) { args = { _raw: buf.argsStr }; }
      toolCalls.push({ id: buf.id, name: buf.name, args });
    }

    yield {
      type: 'done',
      content: contentBuffer,
      toolCalls,
      finishReason,
    };
  }

  _normalizeToolCall(tc) {
    let args = {};
    try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; }
    catch (_) { args = { _raw: tc.function?.arguments }; }
    return { id: tc.id, name: tc.function?.name, args };
  }
}

module.exports = OpenAIProvider;
