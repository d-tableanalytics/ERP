const { randomUUID } = require('crypto');

const providerModule = require('../providers'); // late-bind: use providerModule.getProvider() so tests can patch
const { preprocess } = require('../nlp/preprocess');
const { extract: extractEntities } = require('../entities/extractors');
const sessionStore = require('../memory/SessionStore');
const { buildMessages } = require('../memory/ContextBuilder');
const { buildBaseSystemPrompt } = require('../prompts/system.base');
const { getExamples } = require('../prompts/system.examples');
const { definitionsForRole } = require('../tools/definitions');
const toolExecutor = require('./ToolExecutor');
const responsePlanner = require('../planners/responsePlanner');
const envelopeFmt = require('../formatters/envelope');
const logger = require('../utils/logger');
const { resolveUserId } = require('../validators/permissions');
const { ChatbotError, ErrorCode, FALLBACK_MESSAGES } = require('../constants/errors');
const { Role, ResponseType } = require('../constants/responseTypes');
const { inferIntent } = require('../constants/intents');

const MAX_TOOL_HOPS = parseInt(process.env.CHATBOT_MAX_HOPS, 10) || 4;
const HISTORY_WINDOW = parseInt(process.env.CHATBOT_MAX_HISTORY, 10) || 12;

/**
 * Main pipeline.
 *  - preprocess + load session
 *  - build LLM messages (system prompt + examples + history + current user)
 *  - run tool-call loop (max MAX_TOOL_HOPS)
 *  - plan + format envelope
 *  - persist all turns
 *
 * Two entry points:
 *   • run({ message, user, sessionId })            → JSON one-shot
 *   • runStream({ message, user, sessionId }, on*) → emits SSE events via callbacks
 */

async function run({ message, user, sessionId }) {
  const start = Date.now();
  const requestId = randomUUID();
  const userId = resolveUserId(user);
  if (!userId) throw new ChatbotError(ErrorCode.PERMISSION, 'Authentication required');

  const log = logger.child({ requestId, userId, scope: 'orchestrator' });
  const stages = {};
  const stage = (name, t) => { stages[name] = Date.now() - t; };

  // 1. Preprocess
  const tPre = Date.now();
  const pre = preprocess(message);
  if (pre.injection.blocked) {
    log.warn('Prompt-injection pattern detected', { reasons: pre.injection.reasons });
  }
  const entityHints = extractEntities(pre.normalized);
  stage('preprocess', tPre);
  log.debug('preprocess done', {
    ms: stages.preprocess,
    normalized: pre.normalized?.slice(0, 80),
    injection: pre.injection.blocked,
    entityHints,
  });

  // 2. Session
  const tSession = Date.now();
  const session = await sessionStore.getOrCreate(sessionId, userId);
  const sid = session.session_id;
  const slots = session.context_json || {};
  stage('loadSession', tSession);
  log.debug('session loaded', {
    ms: stages.loadSession,
    sessionId: sid,
    slotKeys: Object.keys(slots),
  });

  // 3. Build messages
  const tBuild = Date.now();
  const history = await sessionStore.loadHistory(sid, HISTORY_WINDOW);
  const systemPrompts = [
    { role: 'system', content: buildBaseSystemPrompt({ user, currentDate: new Date(), slots, history }) },
    ...getExamples(),
  ];
  const initialMessages = buildMessages({
    systemPrompts,
    historyRows: history,
    currentUserText: pre.sanitized,
  });
  stage('buildMessages', tBuild);
  log.debug('messages built', {
    ms: stages.buildMessages,
    historyRows: history.length,
    promptMessages: initialMessages.length,
  });

  // 4. Run tool-call loop
  const provider = providerModule.getProvider();
  if (!provider.isAvailable()) {
    log.warn('LLM provider not available — OPENAI_API_KEY missing?');
  }
  const tools = definitionsForRole(user.role);
  log.debug('starting tool loop', { provider: provider.name, toolCount: tools.length });
  const llmStart = Date.now();
  const loopResult = await runToolLoop({
    provider,
    messages: initialMessages,
    tools,
    user,
    slots,
    requestId,
    sessionId: sid,
    logger: log,
  });
  const llmLatency = Date.now() - llmStart;
  stages.llmLoop = llmLatency;

  // 5. Persist turns
  const tPersist = Date.now();
  const userMsg = await sessionStore.logTurn({
    sessionId: sid,
    userId,
    role: Role.USER,
    content: pre.original,
    intent: inferIntent(loopResult.toolCallsAll),
  });

  for (const tr of loopResult.toolResults) {
    await sessionStore.logTurn({
      sessionId: sid,
      userId,
      role: Role.TOOL,
      content: null,
      toolName: tr.name,
      toolResult: tr.result,
      latencyMs: tr.latencyMs,
    });
  }

  const assistantMsg = await sessionStore.logTurn({
    sessionId: sid,
    userId,
    role: Role.ASSISTANT,
    content: loopResult.finalContent || '',
    toolCalls: loopResult.toolCallsAll,
    intent: inferIntent(loopResult.toolCallsAll),
    confidence: loopResult.toolCallsAll.length ? 0.95 : 0.75,
    tokensIn: loopResult.usage.prompt_tokens || null,
    tokensOut: loopResult.usage.completion_tokens || null,
    latencyMs: llmLatency,
  });
  stage('persist', tPersist);

  // 6. Update slots from tool results (last write wins)
  const slotPatch = {};
  for (const tr of loopResult.toolResults) {
    if (tr.result && tr.result.slot) Object.assign(slotPatch, tr.result.slot);
  }
  // Track entity hint if no tool fired (e.g., greeting / refusal)
  if (Object.keys(slotPatch).length === 0 && entityHints.entity) {
    slotPatch.lastEntity = entityHints.entity;
  }
  if (Object.keys(slotPatch).length > 0) {
    await sessionStore.mergeSlots(sid, slotPatch);
  }

  // 7. Plan + envelope
  const tFormat = Date.now();
  const plan = responsePlanner.plan({
    userMessage: pre.normalized,
    toolsInvoked: loopResult.toolCallsAll.map((c) => c.name),
    result: loopResult.toolResults[0]?.result,
  });

  const envelope = envelopeFmt.build({
    text: loopResult.finalContent || (pre.injection.blocked ? FALLBACK_MESSAGES[ErrorCode.INJECTION_BLOCKED] : ''),
    toolCalls: loopResult.toolCallsAll,
    toolResults: loopResult.toolResults,
    responseType: plan.responseType,
    verbosity: plan.verbosity,
    sessionId: sid,
    messageId: assistantMsg?.id || null,
    suggestions: envelopeFmt.suggestFollowUps({
      toolCalls: loopResult.toolCallsAll,
      toolResults: loopResult.toolResults,
      slots: { ...slots, ...slotPatch },
    }),
    quickActions: envelopeFmt.suggestQuickActions({
      toolCalls: loopResult.toolCallsAll,
      toolResults: loopResult.toolResults,
    }),
  });
  stage('format', tFormat);

  // 8. Log + mirror to legacy table for analytics continuity
  log.info('Turn complete', {
    totalMs: Date.now() - start,
    stages,
    llmMs: llmLatency,
    hops: loopResult.hops,
    tools: loopResult.toolCallsAll.map((t) => t.name),
    intent: envelope.intent,
    responseType: envelope.responseType,
    cards: envelope.cards.length,
    tokensIn: loopResult.usage.prompt_tokens,
    tokensOut: loopResult.usage.completion_tokens,
  });
  await mirrorToLegacy({
    userId, message: pre.original, response: envelope.text,
    intent: envelope.intent, tokens: loopResult.usage.total_tokens || 0,
    confidence: envelope.confidence,
  }).catch((e) => log.warn('Legacy mirror failed', { error: e.message }));

  return envelope;
}

async function runToolLoop({ provider, messages, tools, user, slots, requestId, sessionId, logger: log }) {
  const toolCallsAll = [];
  const toolResults = [];
  const messageThread = messages.slice();
  let usage = {};
  let finalContent = '';
  let hops = 0;

  while (hops < MAX_TOOL_HOPS) {
    let resp;
    const tHop = Date.now();
    try {
      resp = await provider.chat({ messages: messageThread, tools, toolChoice: 'auto' });
    } catch (err) {
      if (err instanceof ChatbotError && err.code === ErrorCode.PROVIDER_UNAVAILABLE) {
        log.warn('LLM unavailable — sending fallback response');
        finalContent = FALLBACK_MESSAGES[ErrorCode.PROVIDER_UNAVAILABLE];
        break;
      }
      log.error('LLM call failed', { hop: hops, error: err.message, stack: err.stack });
      finalContent = FALLBACK_MESSAGES[ErrorCode.PROVIDER_FAILED];
      break;
    }
    log.debug('LLM responded', {
      hop: hops,
      ms: Date.now() - tHop,
      hasContent: !!resp.content,
      toolCalls: (resp.toolCalls || []).map((t) => t.name),
      finishReason: resp.finishReason,
    });

    usage = mergeUsage(usage, resp.usage);

    if (resp.toolCalls && resp.toolCalls.length > 0) {
      // Push the assistant message that triggered tools (OpenAI requires this in thread)
      messageThread.push({
        role: 'assistant',
        content: resp.content || null,
        tool_calls: resp.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
        })),
      });

      for (const call of resp.toolCalls) {
        const execRes = await toolExecutor.execute({
          name: call.name,
          args: call.args,
          user,
          ctx: { slots },
          requestId,
          sessionId,
        });
        toolCallsAll.push({ id: call.id, name: call.name, args: call.args });
        toolResults.push({ id: call.id, name: call.name, result: execRes, latencyMs: execRes.latencyMs });

        // Push tool result so the LLM can see it
        messageThread.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(safeForLLM(execRes)),
        });
      }
      hops += 1;
      continue;
    }

    // No tool calls — model produced final text. Done.
    finalContent = resp.content || '';
    break;
  }

  if (hops >= MAX_TOOL_HOPS && !finalContent) {
    finalContent = "I gathered some information but couldn't compose the final answer. Please try rephrasing.";
  }

  return { toolCallsAll, toolResults, finalContent, usage, hops };
}

function mergeUsage(a, b) {
  const out = { ...(a || {}) };
  for (const k of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    if (b && typeof b[k] === 'number') {
      out[k] = (out[k] || 0) + b[k];
    }
  }
  return out;
}

/**
 * Trim tool results sent back to the LLM to keep token usage bounded.
 * Drops `slot` (orchestrator-only metadata) and limits arrays to 15 items.
 */
function safeForLLM(result) {
  if (!result || typeof result !== 'object') return result;
  const { slot, latencyMs, ...rest } = result;
  const trimmed = {};
  for (const [k, v] of Object.entries(rest)) {
    if (Array.isArray(v) && v.length > 15) {
      trimmed[k] = v.slice(0, 15);
      trimmed[`${k}_truncated`] = true;
      trimmed[`${k}_totalCount`] = v.length;
    } else {
      trimmed[k] = v;
    }
  }
  return trimmed;
}

async function mirrorToLegacy({ userId, message, response, intent, tokens, confidence }) {
  const db = require('../../../config/db.config');
  await db.query(
    `INSERT INTO chatbot_conversations (user_id, message_text, response_text, intent, response_type, openai_tokens, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, message, response || '', intent || null, 'llm-tool-use', tokens || 0, confidence || 0]
  );
}

/**
 * Streaming variant. Emits via the provided callbacks so the controller
 * can forward them as SSE events. Returns the final envelope (also passed
 * to onDone). Tool-call loop is the same — we just stream the *final*
 * assistant message after all tools have resolved.
 */
async function runStream({ message, user, sessionId }, callbacks) {
  const { onStart, onDelta, onToolCall, onToolResult, onCard, onDone, onError } = callbacks || {};
  const start = Date.now();
  const requestId = randomUUID();
  const log = logger.child({ requestId, scope: 'orchestrator.stream' });
  const stages = {};
  const stage = (name, t) => { stages[name] = Date.now() - t; };

  try {
    onStart && onStart();
    const userId = resolveUserId(user);
    if (!userId) throw new ChatbotError(ErrorCode.PERMISSION, 'Authentication required');

    log.info('runStream entry', { userId, sessionIdProvided: !!sessionId });

    const tPre = Date.now();
    const pre = preprocess(message);
    if (pre.injection.blocked) {
      log.warn('Prompt-injection detected', { reasons: pre.injection.reasons });
    }
    stage('preprocess', tPre);

    const tSession = Date.now();
    const session = await sessionStore.getOrCreate(sessionId, userId);
    const sid = session.session_id;
    const slots = session.context_json || {};
    stage('loadSession', tSession);
    log.debug('session loaded', { sessionId: sid, slotKeys: Object.keys(slots) });

    const tBuild = Date.now();
    const history = await sessionStore.loadHistory(sid, HISTORY_WINDOW);

    const systemPrompts = [
      { role: 'system', content: buildBaseSystemPrompt({ user, currentDate: new Date(), slots, history }) },
      ...getExamples(),
    ];
    const messageThread = buildMessages({ systemPrompts, historyRows: history, currentUserText: pre.sanitized });
    stage('buildMessages', tBuild);
    log.debug('messages built', { historyRows: history.length, promptMessages: messageThread.length });

    const provider = providerModule.getProvider();
    if (!provider.isAvailable()) {
      log.warn('LLM provider not available — OPENAI_API_KEY missing? Returning safe fallback.');
      throw new ChatbotError(ErrorCode.PROVIDER_UNAVAILABLE, 'OpenAI client not configured');
    }
    const tools = definitionsForRole(user.role);

    const toolCallsAll = [];
    const toolResults = [];
    let usage = {};
    let finalContent = '';
    let hops = 0;
    const tLoop = Date.now();

    while (hops < MAX_TOOL_HOPS) {
      const tHop = Date.now();
      const resp = await provider.chat({ messages: messageThread, tools, toolChoice: 'auto' });
      log.debug('LLM responded', {
        hop: hops,
        ms: Date.now() - tHop,
        hasContent: !!resp.content,
        toolCalls: (resp.toolCalls || []).map((t) => t.name),
        finishReason: resp.finishReason,
      });
      usage = mergeUsage(usage, resp.usage);

      if (resp.toolCalls && resp.toolCalls.length > 0) {
        messageThread.push({
          role: 'assistant',
          content: resp.content || null,
          tool_calls: resp.toolCalls.map((tc) => ({
            id: tc.id, type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
          })),
        });
        for (const call of resp.toolCalls) {
          onToolCall && onToolCall({ id: call.id, name: call.name, args: call.args });
          const execRes = await toolExecutor.execute({
            name: call.name, args: call.args, user, ctx: { slots },
            requestId, sessionId: sid,
          });
          toolCallsAll.push({ id: call.id, name: call.name, args: call.args });
          toolResults.push({ id: call.id, name: call.name, result: execRes, latencyMs: execRes.latencyMs });
          onToolResult && onToolResult({ id: call.id, name: call.name, ok: !!execRes.ok, latencyMs: execRes.latencyMs });
          messageThread.push({
            role: 'tool', tool_call_id: call.id,
            content: JSON.stringify(safeForLLM(execRes)),
          });
        }
        hops += 1;
        continue;
      }

      // No tool calls — the model already produced the final text in this
      // call. Emit it as a stream of word-sized deltas so the client renders
      // progressively, WITHOUT a wasteful second LLM round-trip.
      finalContent = resp.content || '';
      log.info('emitting cached completion as deltas', {
        contentLength: finalContent.length,
        preview: finalContent.slice(0, 80),
        hasOnDelta: typeof onDelta === 'function',
      });
      if (finalContent && onDelta) {
        // Chunk by ~3 words at a time so the client sees a typing effect.
        const tokens = finalContent.match(/\S+\s*|\s+/g) || [finalContent];
        const stride = 3;
        let chunks = 0;
        for (let i = 0; i < tokens.length; i += stride) {
          onDelta(tokens.slice(i, i + stride).join(''));
          chunks += 1;
        }
        log.info('delta emission done', { chunks });
      } else if (!finalContent) {
        log.warn('model returned empty content with no tool calls', { finishReason: resp.finishReason });
      }
      break;
    }
    stage('llmLoop', tLoop);

    if (hops >= MAX_TOOL_HOPS && !finalContent) {
      log.warn('max tool hops reached without final content', { hops });
      finalContent = "I gathered the information but couldn't compose the final answer.";
      onDelta && onDelta(finalContent);
    }

    // Persist
    const tPersist = Date.now();
    await sessionStore.logTurn({
      sessionId: sid, userId, role: Role.USER, content: pre.original, intent: inferIntent(toolCallsAll),
    });
    for (const tr of toolResults) {
      await sessionStore.logTurn({
        sessionId: sid, userId, role: Role.TOOL, content: null,
        toolName: tr.name, toolResult: tr.result, latencyMs: tr.latencyMs,
      });
    }
    const assistantMsg = await sessionStore.logTurn({
      sessionId: sid, userId, role: Role.ASSISTANT, content: finalContent || '',
      toolCalls: toolCallsAll, intent: inferIntent(toolCallsAll),
      confidence: toolCallsAll.length ? 0.95 : 0.75,
      tokensIn: usage.prompt_tokens, tokensOut: usage.completion_tokens,
      latencyMs: Date.now() - start,
    });
    stage('persist', tPersist);

    const slotPatch = {};
    for (const tr of toolResults) if (tr.result?.slot) Object.assign(slotPatch, tr.result.slot);
    if (Object.keys(slotPatch).length > 0) await sessionStore.mergeSlots(sid, slotPatch);

    const tFormat = Date.now();
    const plan = responsePlanner.plan({
      userMessage: pre.normalized,
      toolsInvoked: toolCallsAll.map((c) => c.name),
      result: toolResults[0]?.result,
    });

    const envelope = envelopeFmt.build({
      text: finalContent,
      toolCalls: toolCallsAll,
      toolResults,
      responseType: plan.responseType,
      verbosity: plan.verbosity,
      sessionId: sid,
      messageId: assistantMsg?.id || null,
      suggestions: envelopeFmt.suggestFollowUps({ toolCalls: toolCallsAll, toolResults, slots: { ...slots, ...slotPatch } }),
      quickActions: envelopeFmt.suggestQuickActions({ toolCalls: toolCallsAll, toolResults }),
    });
    stage('format', tFormat);

    // Emit cards lazily so the client can render them as they arrive
    for (const card of envelope.cards) onCard && onCard(card);

    log.info('Stream turn complete', {
      hops,
      stages,
      tools: toolCallsAll.map((t) => t.name),
      intent: envelope.intent,
      responseType: envelope.responseType,
      cards: envelope.cards.length,
      tokensIn: usage.prompt_tokens,
      tokensOut: usage.completion_tokens,
      totalMs: Date.now() - start,
    });
    await mirrorToLegacy({
      userId, message: pre.original, response: envelope.text,
      intent: envelope.intent, tokens: usage.total_tokens || 0, confidence: envelope.confidence,
    }).catch((e) => log.warn('Legacy mirror failed', { error: e.message }));

    onDone && onDone(envelope);
    return envelope;
  } catch (err) {
    log.error('Stream pipeline failed', {
      error: err.message,
      code: err.code,
      stage: lastStageReached(stages),
      totalMs: Date.now() - start,
      stack: err.stack,
    });
    const env = envelopeFmt.build({
      text: FALLBACK_MESSAGES[err.code] || FALLBACK_MESSAGES[ErrorCode.INTERNAL],
      responseType: ResponseType.ERROR,
      verbosity: 'concise',
      sessionId: sessionId || null,
      error: { code: err.code || ErrorCode.INTERNAL, message: err.message },
    });
    onError && onError(env);
    return env;
  }
}

function lastStageReached(stages) {
  const order = ['preprocess', 'loadSession', 'buildMessages', 'llmLoop', 'persist', 'format'];
  return order.filter((s) => stages[s] != null).pop() || 'none';
}

async function streamFinal({ provider, messages, onDelta }) {
  let buf = '';
  for await (const evt of provider.stream({ messages })) {
    if (evt.type === 'delta' && evt.text) {
      buf += evt.text;
      onDelta && onDelta(evt.text);
    } else if (evt.type === 'done') {
      if (evt.content && !buf) buf = evt.content;
    }
  }
  return buf;
}

module.exports = { run, runStream };
