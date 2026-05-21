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
    userMessage: pre.normalized,
    requestId,
    sessionId: sid,
    logger: log,
  });
  await applyTaskToolFallback({
    loopResult,
    message: pre.normalized,
    user,
    requestId,
    sessionId: sid,
  });
  await applyCombinedCreateFallback({
    loopResult,
    message: pre.normalized,
    user,
    requestId,
    sessionId: sid,
  });
  loopResult.finalContent = formatDeterministicToolText(
    loopResult.toolCallsAll,
    loopResult.toolResults,
    loopResult.finalContent
  );
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
    suppressCards: shouldSuppressTaskCards(loopResult.toolCallsAll, loopResult.toolResults),
    responseType: plan.responseType,
    verbosity: plan.verbosity,
    sessionId: sid,
    messageId: assistantMsg?.id || null,
    timestamp: assistantMsg?.created_at || null,
    userMessageId: userMsg?.id || null,
    userTimestamp: userMsg?.created_at || null,
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

async function runToolLoop({ provider, messages, tools, user, slots, userMessage, requestId, sessionId, logger: log }) {
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

    const toolCalls = normalizeCreateToolCallsForMessage(resp.toolCalls || [], userMessage);

    if (toolCalls.length > 0) {
      // Push the assistant message that triggered tools (OpenAI requires this in thread)
      messageThread.push({
        role: 'assistant',
        content: resp.content || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
        })),
      });

      for (const call of toolCalls) {
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
    finalContent = formatDeterministicToolText(toolCallsAll, toolResults, resp.content || '');
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

function normalizeCreateToolCallsForMessage(toolCalls = [], message = '') {
  if (!Array.isArray(toolCalls) || !toolCalls.length) return [];
  const taskFieldUpdateArgs = extractTaskFieldUpdateArgs(message);
  if (taskFieldUpdateArgs) {
    return normalizeTaskFieldUpdateCalls(toolCalls, taskFieldUpdateArgs);
  }
  if (isTaskDueDateUpdateMessage(message)) {
    return normalizeTaskDueDateUpdateCalls(toolCalls, message);
  }
  if (isTaskTitleUpdateMessage(message)) {
    return normalizeTaskTitleUpdateCalls(toolCalls, message);
  }
  if (isChecklistDeleteMessage(message)) {
    return normalizeChecklistDeleteCalls(toolCalls, message);
  }
  if (isChecklistOnlyCreate(message)) {
    return normalizeChecklistOnlyCreateCalls(toolCalls, message);
  }

  const taskNormalizedCalls = normalizeFreshTaskCreateCalls(toolCalls, message);
  return taskNormalizedCalls;
}

function isTaskTitleUpdateMessage(message = '') {
  return !!extractTaskTitleUpdateArgs(message);
}

function isTaskDueDateUpdateMessage(message = '') {
  return !!extractTaskDueDateUpdateArgs(message);
}

function normalizeTaskFieldUpdateCalls(toolCalls = [], fieldArgs = {}) {
  const keptCalls = toolCalls.filter((call) => ![
    'updateTaskDueDate',
    'updateTaskStatus',
    'updateTaskTitle',
    'updateTaskAssignment',
    'updateTaskLoopUsers',
    'createTask',
  ].includes(call.name));

  const originalCall = toolCalls.find((call) => [
    'updateTaskDueDate',
    'updateTaskStatus',
    'updateTaskTitle',
    'updateTaskAssignment',
    'updateTaskLoopUsers',
    'createTask',
  ].includes(call.name));

  const calls = [];
  const base = fieldArgs.taskTitle ? { taskTitle: fieldArgs.taskTitle } : {};

  // Keep title changes last so due-date/status updates can still find the original title.
  if (fieldArgs.dueDate) {
    calls.push({
      id: `normalized_${randomUUID()}`,
      name: 'updateTaskDueDate',
      args: { ...base, dueDate: fieldArgs.dueDate },
    });
  }
  if (fieldArgs.status) {
    calls.push({
      id: `normalized_${randomUUID()}`,
      name: 'updateTaskStatus',
      args: { ...base, status: fieldArgs.status },
    });
  }
  if (fieldArgs.newTitle) {
    calls.push({
      id: originalCall?.id || `normalized_${randomUUID()}`,
      name: 'updateTaskTitle',
      args: { ...base, newTitle: fieldArgs.newTitle },
    });
  }

  return keptCalls.concat(calls);
}

function normalizeTaskDueDateUpdateCalls(toolCalls = [], message = '') {
  const dueDateArgs = extractTaskDueDateUpdateArgs(message);
  if (!dueDateArgs) return toolCalls;

  const keptCalls = toolCalls.filter((call) => !['updateTaskTitle', 'updateTaskAssignment', 'updateTaskLoopUsers', 'createTask'].includes(call.name));

  if (keptCalls.some((call) => call.name === 'updateTaskDueDate')) {
    return keptCalls.map((call) => {
      if (call.name !== 'updateTaskDueDate') return call;
      return { ...call, args: { ...dueDateArgs, ...(call.args || {}) } };
    });
  }

  const originalCall = toolCalls.find((call) => ['updateTaskTitle', 'updateTaskAssignment', 'updateTaskLoopUsers', 'createTask'].includes(call.name));
  return keptCalls.concat({
    id: originalCall?.id || `normalized_${randomUUID()}`,
    name: 'updateTaskDueDate',
    args: dueDateArgs,
  });
}

function normalizeTaskTitleUpdateCalls(toolCalls = [], message = '') {
  const titleArgs = extractTaskTitleUpdateArgs(message);
  if (!titleArgs) return toolCalls;

  const keptCalls = toolCalls.filter((call) => !['updateTaskAssignment', 'updateTaskLoopUsers', 'createTask'].includes(call.name));

  if (keptCalls.some((call) => call.name === 'updateTaskTitle')) {
    return keptCalls.map((call) => {
      if (call.name !== 'updateTaskTitle') return call;
      return { ...call, args: { ...titleArgs, ...(call.args || {}) } };
    });
  }

  const originalCall = toolCalls.find((call) => ['updateTaskAssignment', 'updateTaskLoopUsers', 'createTask'].includes(call.name));
  return keptCalls.concat({
    id: originalCall?.id || `normalized_${randomUUID()}`,
    name: 'updateTaskTitle',
    args: titleArgs,
  });
}

function normalizeChecklistDeleteCalls(toolCalls = [], message = '') {
  const deleteArgs = buildDeleteChecklistArgsFromMessage(message);
  const keptCalls = toolCalls.filter((call) => call.name !== 'deleteTask');

  if (keptCalls.some((call) => call.name === 'deleteChecklist')) {
    return keptCalls.map((call) => {
      if (call.name !== 'deleteChecklist') return call;
      return { ...call, args: { ...deleteArgs, ...(call.args || {}) } };
    });
  }

  const deleteTaskCall = toolCalls.find((call) => call.name === 'deleteTask');
  return keptCalls.concat({
    id: deleteTaskCall?.id || `normalized_${randomUUID()}`,
    name: 'deleteChecklist',
    args: deleteArgs,
  });
}

function isChecklistDeleteMessage(message = '') {
  const msg = String(message || '').toLowerCase();
  return /\b(delete|remove|cancel)\b/.test(msg) && /\bchecklists?\b/.test(msg);
}

function buildDeleteChecklistArgsFromMessage(message = '') {
  const name = String(message || '')
    .replace(/^\s*(i\s+want\s+to\s+)?(?:delete|remove|cancel)\s+/i, '')
    .replace(/\bchecklists?\b/ig, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name ? { name } : {};
}

function normalizeChecklistOnlyCreateCalls(toolCalls = [], message = '') {
  const extractedArgs = buildCreateChecklistArgsFromMessage(message);
  const keptCalls = toolCalls.filter((call) => call.name !== 'createTask');

  if (keptCalls.some((call) => call.name === 'createChecklist')) {
    return keptCalls.map((call) => {
      if (call.name !== 'createChecklist') return call;
      return {
        ...call,
        args: mergeCreateChecklistArgs(call.args || {}, extractedArgs),
      };
    });
  }

  const taskCall = toolCalls.find((call) => call.name === 'createTask');
  const taskArgs = buildChecklistCallFromTaskCall(taskCall, message)[0]?.args || {};
  const createArgs = mergeCreateChecklistArgs(taskArgs, extractedArgs);
  if (!createArgs?.question) return keptCalls;

  return keptCalls.concat({
    id: taskCall?.id || `normalized_${randomUUID()}`,
    name: 'createChecklist',
    args: createArgs,
  });
}

function mergeCreateChecklistArgs(primary = {}, fallback = {}) {
  const merged = { ...fallback, ...primary };
  const primaryQuestion = String(primary.question || '').trim();
  const fallbackQuestion = String(fallback.question || '').trim();
  const primaryLooksMessy = /\b(today\s+i\s+told|set\s+this\s+as|keep\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+in\s+(?:the\s+)?loop)\b/i.test(primaryQuestion);

  if (fallbackQuestion && (!primaryQuestion || primaryLooksMessy || /\bcreate\s+a\s+checklist\s*:/i.test(fallbackQuestion))) {
    merged.question = fallbackQuestion;
  }

  for (const key of ['question', 'assignee', 'doer', 'priority', 'frequency', 'fromDate', 'dueDate', 'checklistItems']) {
    const isMissing = !merged[key] || (Array.isArray(merged[key]) && merged[key].length === 0);
    if (isMissing && fallback[key]) merged[key] = fallback[key];
  }

  delete merged.doer;
  delete merged.inLoopUsers;

  Object.keys(merged).forEach((key) => {
    if (merged[key] == null || merged[key] === '' || (Array.isArray(merged[key]) && merged[key].length === 0)) delete merged[key];
  });
  return merged;
}

function normalizeFreshTaskCreateCalls(toolCalls = [], message = '') {
  if (!isFreshTaskCreationMessage(message)) return toolCalls;

  const updateToolNames = new Set(['updateTaskAssignment', 'updateTaskLoopUsers']);
  const keptCalls = toolCalls.filter((call) => !updateToolNames.has(call.name));
  const extractedArgs = buildCreateTaskArgsFromMessage(message);
  if (keptCalls.some((call) => call.name === 'createTask')) {
    return keptCalls.map((call) => {
      if (call.name !== 'createTask') return call;
      return {
        ...call,
        args: mergeCreateTaskArgs(call.args || {}, extractedArgs),
      };
    });
  }

  const updateCall = toolCalls.find((call) => updateToolNames.has(call.name));
  const createArgs = mergeCreateTaskArgs(updateCall?.args || {}, extractedArgs);
  if (!createArgs?.title) return keptCalls;

  return keptCalls.concat({
    id: updateCall?.id || `normalized_${randomUUID()}`,
    name: 'createTask',
    args: createArgs,
  });
}

function mergeCreateTaskArgs(primary = {}, fallback = {}) {
  const merged = { ...fallback, ...primary };
  for (const key of ['title', 'assignedTo', 'dueDate', 'priority']) {
    if (!merged[key] && fallback[key]) merged[key] = fallback[key];
  }
  if ((!Array.isArray(merged.loopUsers) || merged.loopUsers.length === 0) && Array.isArray(fallback.loopUsers)) {
    merged.loopUsers = fallback.loopUsers;
  }
  Object.keys(merged).forEach((key) => {
    if (merged[key] == null || merged[key] === '' || (Array.isArray(merged[key]) && merged[key].length === 0)) delete merged[key];
  });
  return merged;
}

function isFreshTaskCreationMessage(message = '') {
  const msg = String(message || '').toLowerCase();
  if (!msg) return false;
  if (/\b(update|change|edit|modify|mark|complete|completed|same task|this task|that task|existing task)\b/.test(msg)) return false;
  return /\b(i\s+told|told|asked|ask|reminded|remind|informed|inform|assigned|assign|delegate|delegated|give task|gave task|create task|new task)\b/.test(msg)
    && (
      /\b(to|for)\s+[a-z][a-z\s]*\b/.test(msg)
      || /\b(?:i\s+)?(?:told|asked|ask|reminded|remind|informed|inform|assigned)\s+[a-z][a-z\s]*\b/.test(msg)
    );
}

function buildCreateTaskArgsFromMessage(message = '', fallbackArgs = {}) {
  const text = String(message || '').trim();
  const args = {
    title: extractFreshTaskTitle(text) || fallbackArgs.title || fallbackArgs.taskTitle,
    assignedTo: extractFreshTaskAssignee(text) || fallbackArgs.assignedTo,
    dueDate: extractFreshTaskDueDate(text) || fallbackArgs.dueDate,
    priority: extractFreshTaskPriority(text) || fallbackArgs.priority,
    loopUsers: extractFreshTaskLoopUsers(text) || fallbackArgs.loopUsers,
  };

  Object.keys(args).forEach((key) => {
    if (args[key] == null || args[key] === '' || (Array.isArray(args[key]) && args[key].length === 0)) delete args[key];
  });
  return args;
}

function extractFreshTaskAssignee(message = '') {
  const match = message.match(/\b(?:i\s+)?(?:told|asked|ask|reminded|remind|informed|inform)\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)(?:\s+to\b|\s+that\b|\s+about\b|\s+for\b|\b)/)
    || message.match(/\b(?:i\s+)?assign(?:ed)?(?:\s+task)?\s+(?:to\s+)?([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)/)
    || message.match(/\b(?:delegate(?:d)?(?:\s+task)?\s+to|give(?:\s+task)?\s+to)\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)/);
  return match?.[1]?.trim() || null;
}

function extractFreshTaskLoopUsers(message = '') {
  const users = [];
  const patterns = [
    /\bkeep\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)\s+in\s+the\s+loop\b/gi,
    /\bkeep\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)\s+in\s+loop\b/gi,
    /\bcc\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)\b/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      users.push(match[1].trim());
    }
  }

  return [...new Set(users)];
}

function extractFreshTaskDueDate(message = '') {
  const beforeTimeToday = message.match(/\bbefore\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+today\b/i);
  if (beforeTimeToday?.[1]) return `today ${beforeTimeToday[1]}`;
  const match = message.match(/\b(?:before|by|due(?:\s+by)?)\s+(.+?)(?:[.!?]|$)/i);
  if (match?.[1]) return match[1].replace(/\bkeep\b.+$/i, '').trim();
  if (/\btoday\s+evening\b/i.test(message)) return 'today evening';
  if (/\btomorrow\s+morning\b/i.test(message)) return 'tomorrow morning';
  return null;
}

function extractFreshTaskPriority(message = '') {
  if (/\bhigh\s+priority\b|\bmake\s+it\s+high\b/i.test(message)) return 'High';
  if (/\bmedium\s+priority\b|\bmake\s+it\s+medium\b/i.test(message)) return 'Medium';
  if (/\blow\s+priority\b|\bmake\s+it\s+low\b/i.test(message)) return 'Low';
  return null;
}

function extractFreshTaskTitle(message = '') {
  const toldMatch = message.match(/\b(?:i\s+)?(?:told|asked|ask)\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+to\s+(.+?)(?:\s+(?:before|by|due)\b|[.!?]|$)/i);
  const remindedPendingMatch = message.match(/\b(?:i\s+)?(?:reminded|remind|informed|inform)\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+that\s+(.+?)\s+is\s+pending(?:\s+(?:before|by|due)\b|[.!?]|$)/i);
  const remindedNeedMatch = message.match(/\b(?:i\s+)?(?:reminded|remind|informed|inform)\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+that\s+.+?\bwe\s+need\s+to\s+(.+?)(?:\s+(?:before|by|due)\b|[.!?]|$)/i);
  const assignMatch = message.match(/\b(?:assign(?:ed)?(?:\s+task)?\s+to|delegate(?:d)?(?:\s+task)?\s+to|give(?:\s+task)?\s+to)\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+(.+?)(?:\s+(?:before|by|due)\b|[.!?]|$)/i);
  const rawTitle = (toldMatch?.[1] || remindedPendingMatch?.[1] || remindedNeedMatch?.[1] || assignMatch?.[1] || '').trim();
  if (!rawTitle) return null;

  return rawTitle
    .replace(/^\s*(?:we\s+need\s+to|need\s+to)\s+/i, '')
    .replace(/\band\s+make\s+it\s+(?:high|medium|low)(?:\s+priority)?\b/ig, '')
    .replace(/\bkeep\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+in\s+(?:the\s+)?loop\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isChecklistOnlyCreate(message) {
  const msg = String(message || '').toLowerCase();
  const hasChecklistItems = isChecklistItemListMessage(message);
  const asksChecklist = /\b(create|add|make)\b.*\bchecklists?\b/.test(msg)
    || /\bchecklists?\b.*\b(create|add|make)\b/.test(msg)
    || hasChecklistItems;
  if (!asksChecklist) return false;
  const asksSeparateTask = /\bcreate\b.*\btask\b.*\b(create|add|make)\b.*\bchecklists?\b/.test(msg)
    || /\b(create|add|make)\b.*\bchecklists?\b.*\bcreate\b.*\btask\b/.test(msg);
  return !asksSeparateTask;
}

function isChecklistItemListMessage(message = '') {
  const text = String(message || '');
  return /\b(things?|items?|tasks?)\s+to\s+(?:complete|check|verify|test|review)\s*:/i.test(text)
    || /\b(?:complete|check|verify|test|review)\s+these\s*:/i.test(text)
    || /(?:^|\s)[-*]\s+.+?(?:\s+[-*]\s+.+|$)/s.test(text)
    || /\r?\n\s*(?:[-*]|\d+[.)]|\u25a1)\s+/.test(text);
}

function buildChecklistCallFromTaskCall(taskCall, message) {
  if (!taskCall) return [];
  return [{
    ...taskCall,
    name: 'createChecklist',
    args: {
      question: taskCall.args?.title || taskCall.args?.description || extractChecklistQuestion(message),
      assignee: taskCall.args?.assignedTo,
      doer: taskCall.args?.assignedTo,
      priority: taskCall.args?.priority ? String(taskCall.args.priority).toLowerCase() : undefined,
      fromDate: taskCall.args?.dueDate,
      dueDate: taskCall.args?.dueDate,
      frequency: 'daily',
    },
  }];
}

async function applyTaskToolFallback({ loopResult, message, user, requestId, sessionId }) {
  if (!loopResult || loopResult.toolCallsAll.length > 0) return;
  const fallbackResult = await runTaskToolFallback({ message, user, requestId, sessionId });
  if (!fallbackResult) return;
  loopResult.toolCallsAll.push(fallbackResult.toolCall);
  loopResult.toolResults.push(fallbackResult.toolResult);
}

async function applyCombinedCreateFallback({ loopResult, message, user, requestId, sessionId }) {
  if (!loopResult) return;
  const tools = loopResult.toolCallsAll.map((call) => call.name);
  if (!tools.includes('createChecklist') || tools.includes('createTask')) return;

  const createTaskCall = buildCreateTaskFromCombinedPrompt(message);
  if (!createTaskCall) return;

  const execRes = await toolExecutor.execute({
    name: createTaskCall.name,
    args: createTaskCall.args,
    user,
    ctx: { slots: {} },
    requestId,
    sessionId,
  });
  const id = `fallback_${randomUUID()}`;
  loopResult.toolCallsAll.unshift({ id, name: createTaskCall.name, args: createTaskCall.args });
  loopResult.toolResults.unshift({ id, name: createTaskCall.name, result: execRes, latencyMs: execRes.latencyMs });
}

async function runTaskToolFallback({ message, user, requestId, sessionId }) {
  const fallbackCall = buildTaskFallbackCall(message);
  if (!fallbackCall) return null;
  const execRes = await toolExecutor.execute({
    name: fallbackCall.name,
    args: fallbackCall.args,
    user,
    ctx: { slots: {} },
    requestId,
    sessionId,
  });
  const id = `fallback_${randomUUID()}`;
  return {
    toolCall: { id, name: fallbackCall.name, args: fallbackCall.args },
    toolResult: { id, name: fallbackCall.name, result: execRes, latencyMs: execRes.latencyMs },
  };
}

function buildTaskFallbackCall(message) {
  const msg = String(message || '').toLowerCase();
  if (!msg) return null;
  const chatSummaryFallback = buildChatSummaryFallbackCall(message);
  if (chatSummaryFallback) return chatSummaryFallback;
  if (/\bhow many|count|number of|detail|details|explain|dashboard\b/.test(msg)) return null;
  if (isEmployeeListRequest(msg)) {
    return { name: 'listEmployees', args: { limit: 100 } };
  }
  const checklistFallback = buildChecklistFallbackCall(message);
  if (checklistFallback) return checklistFallback;
  if (isChecklistDeleteMessage(message)) {
    return { name: 'deleteChecklist', args: buildDeleteChecklistArgsFromMessage(message) };
  }
  if (/\b(delete|remove|cancel)\b/.test(msg)) {
    const taskTitle = extractDeleteTaskTitle(message);
    return { name: 'deleteTask', args: taskTitle ? { taskTitle } : {} };
  }
  const fieldUpdateArgs = extractTaskFieldUpdateArgs(message);
  if (fieldUpdateArgs?.dueDate) {
    return { name: 'updateTaskDueDate', args: { taskTitle: fieldUpdateArgs.taskTitle, dueDate: fieldUpdateArgs.dueDate } };
  }
  const dueDateUpdateArgs = extractTaskDueDateUpdateArgs(message);
  if (dueDateUpdateArgs) {
    return { name: 'updateTaskDueDate', args: dueDateUpdateArgs };
  }
  const titleUpdateArgs = extractTaskTitleUpdateArgs(message);
  if (titleUpdateArgs) {
    return { name: 'updateTaskTitle', args: titleUpdateArgs };
  }
  if (isFreshTaskCreationMessage(message)) {
    const args = buildCreateTaskArgsFromMessage(message);
    if (args?.title) return { name: 'createTask', args };
  }
  if (/\bcreate|add|new|another|assign|delegate|give task|keep .*loop|in loop\b/.test(msg)) return null;

  const mentionsTask = /\btask|tasks|delegation|delegations\b/.test(msg);
  const asksList = /\bshow|list|give me|what are|which one|pending|overdue|priority|today|tomorrow\b/.test(msg);
  if (!asksList) return null;
  if (!mentionsTask && !/\bpending|overdue|priority|today|tomorrow\b/.test(msg)) return null;

  if (/\boverdue\b/.test(msg)) {
    return { name: 'getOverdueItems', args: { entityType: 'task' } };
  }

  const args = {};
  if (/\bpending\b/.test(msg)) args.status = 'Pending';
  if (/\bhigh\b|\burgent\b|\bcritical\b/.test(msg)) args.priority = 'High';
  if (/\blow\b/.test(msg)) args.priority = 'Low';
  if (/\bmedium\b|\bnormal\b/.test(msg)) args.priority = 'Medium';
  if (/\btoday\b/.test(msg)) args.period = 'today';
  if (/\btomorrow\b/.test(msg)) args.period = 'tomorrow';

  if (mentionsTask || Object.keys(args).length > 0) {
    return { name: 'getMyTasks', args };
  }

  return null;
}

function buildChatSummaryFallbackCall(message = '') {
  const text = String(message || '').trim();
  const msg = text.toLowerCase();
  const mentionsChat = /\b(chat|conversation|messages?|discussion)\b/.test(msg);
  const asksSummary = /\b(summary|summarize|recap|what did we discuss)\b/.test(msg);
  if (!mentionsChat || !asksSummary) return null;

  const date = extractChatSummaryDate(text);
  const period = /\byesterday\b/i.test(text) ? 'yesterday' : (/\btoday|this date\b/i.test(text) ? 'today' : undefined);
  return {
    name: 'getChatSummary',
    args: {
      ...(date ? { date } : {}),
      ...(period ? { period } : {}),
    },
  };
}

function extractChatSummaryDate(message = '') {
  const text = String(message || '');
  const ymd = text.match(/\b\d{4}-\d{1,2}-\d{1,2}\b/);
  if (ymd) return ymd[0];
  const dmy = text.match(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/);
  if (dmy) return dmy[0];
  const named = text.match(/\b\d{1,2}\s+(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)(?:\s+\d{2,4})?\b/i);
  if (named) return named[0];
  if (/\byesterday\b/i.test(text)) return 'yesterday';
  if (/\btoday|this date\b/i.test(text)) return 'today';
  return null;
}

function extractTaskTitleUpdateArgs(message = '') {
  const text = String(message || '').trim();
  if (!/\b(change|update|edit|rename)\b/i.test(text) || !/\b(task|title|name)\b/i.test(text)) return null;

  const patterns = [
    /\b(?:change|update|edit)\s+(?:my\s+)?task\s+(?:title|name)\s+(.+?)\s+(?:into|to|as)\s+(.+)$/i,
    /\brename\s+(?:the\s+)?task\s+(.+?)\s+(?:to|as)\s+(.+)$/i,
    /\b(?:change|update|edit)\s+(?:the\s+)?title\s+of\s+(?:task\s+)?(.+?)\s+(?:to|as|into)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const taskTitle = cleanTitleUpdatePart(match[1]);
    const newTitle = cleanTitleUpdatePart(match[2]);
    if (newTitle) return taskTitle ? { taskTitle, newTitle } : { newTitle };
  }

  return null;
}

function extractTaskFieldUpdateArgs(message = '') {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text || !/\b(change|update|edit|set|move)\b/i.test(text)) return null;

  const taskTitle = cleanTaskFieldPart(
    text.match(/^(.+?)\s+this\s+is\s+the\s+current\s+title\s+of\s+task\b/i)?.[1]
      || text.match(/\b(?:current|old)\s+task\s+title\s+(?:is|:)\s+(.+?)(?=\s+\b(?:now|and|also|change|update|set)\b|$)/i)?.[1]
      || text.match(/\btask\s+title\s+is\s+(.+?)(?=\s+\b(?:into|to|also|and|status|due\s*date)\b|$)/i)?.[1]
  );

  const newTitle = cleanTaskFieldPart(
    text.match(/\b(?:change|update|edit|rename)\s+(?:it|its|ites|title|task\s+title|name)\s+(?:into|to|as)\s+(.+?)(?=\s+(?:also\s+)?(?:change|update|set|move)\s+(?:the\s+)?(?:status|due\s*date|deadline|end\s*date)\b|\s+(?:also\s+)?(?:status|due\s*date|deadline|end\s*date)\b|$)/i)?.[1]
  );

  const status = normalizeTaskStatus(
    text.match(/\bstatus\s+(?:into|to|as|is)\s+(complete|completed|pending|in progress|hold|on hold)\b/i)?.[1]
      || text.match(/\bmark\s+(?:it|task|this\s+task)?\s*(?:as)?\s*(complete|completed|pending|in progress|hold|on hold)\b/i)?.[1]
  );

  const dueDate = cleanTaskDueDatePart(
    text.match(/\b(?:our\s+)?(?:due\s*date|deadline|end\s*date)\s*(?:is|into|to|as)?\s+(.+?)(?=\s+\b(?:fixed|fix|please|also\s+change|change\s+status|status\s+into|show\s+my|what'?s|show\s+dashboard)\b|$)/i)?.[1]
  );

  if (!taskTitle && !newTitle && !status && !dueDate) return null;
  if (!newTitle && !status && !dueDate) return null;

  return { taskTitle, newTitle, status, dueDate };
}

function extractTaskDueDateUpdateArgs(message = '') {
  const text = String(message || '').trim();
  if (!/\b(change|update|edit|set|move)\b/i.test(text) || !/\b(task|due date|deadline|end date)\b/i.test(text)) return null;
  if (!/\b(due\s*date|deadline|end\s*date)\b/i.test(text)) return null;

  const patterns = [
    /\b(?:change|update|edit|set|move)\s+(?:my\s+)?task\s+(?:due\s*date|deadline|end\s*date)\s+(?:task\s+title\s+is\s+)?(.+?)\s+(?:into|to|as)\s+(.+)$/i,
    /\b(?:change|update|edit|set|move)\s+(?:the\s+)?(?:due\s*date|deadline|end\s*date)\s+of\s+(?:task\s+)?(.+?)\s+(?:into|to|as)\s+(.+)$/i,
    /\b(?:task\s+title\s+is\s+)(.+?)\s+(?:due\s*date|deadline|end\s*date)\s+(?:into|to|as)\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const taskTitle = cleanTaskDueDatePart(match[1]);
    const dueDate = cleanTaskDueDatePart(match[2]);
    if (dueDate) return taskTitle ? { taskTitle, dueDate } : { dueDate };
  }

  return null;
}

function cleanTaskDueDatePart(value = '') {
  return String(value || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\b(?:fixed|fix|ites|its)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanTaskFieldPart(value = '') {
  return String(value || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\b(?:also|and)\s+(?:change|update|set)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTaskStatus(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'complete' || text === 'completed') return 'Completed';
  if (text === 'pending') return 'Pending';
  if (text === 'in progress') return 'In Progress';
  if (text === 'hold' || text === 'on hold') return 'Hold';
  return null;
}

function cleanTitleUpdatePart(value = '') {
  return String(value || '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isEmployeeListRequest(message = '') {
  const msg = String(message || '').toLowerCase();
  const asksAll = /\ball|list|show|tell me|names?|members?|team|registered|register\b/.test(msg);
  const employeeWords = /\bemployees?\b|\bemploye+ss?\b|\busers?\b|\bmembers?\b|\bteam\b/.test(msg);
  const sensitive = /\bsalary|password|secret|private\b/.test(msg);
  return asksAll && employeeWords && !sensitive;
}

function buildCreateTaskFromCombinedPrompt(message) {
  const text = String(message || '').trim();
  const msg = text.toLowerCase();
  if (!/\bcreate\b.*\btask\b/.test(msg) || !/\bcreate\b.*\bchecklist\b/.test(msg)) return null;

  const titleMatch = text.match(/\btask\s+(?:called|named|titled)?\s*"([^"]+)"/i)
    || text.match(/\btask\s+(?:called|named|titled)?\s+(.+?)(?:\s+for\s+|\s+assign(?:ed)?\s+to\s+|\s+due\s+|\s+and\s+also\s+create\s+a\s+checklist|$)/i);
  const title = titleMatch?.[1]?.trim();
  if (!title) return null;

  const beforeChecklist = text.split(/\band\s+also\s+create\s+a\s+checklist\b/i)[0];
  const assigneeMatch = beforeChecklist.match(/\b(?:for|assign(?:ed)?\s+to)\s+([A-Za-z][A-Za-z\s]*?)(?:\s+due\b|\s+high\b|\s+medium\b|\s+low\b|$)/i);
  const dueMatch = beforeChecklist.match(/\bdue\s+(.+)$/i);

  const args = { title };
  if (assigneeMatch?.[1]) args.assignedTo = assigneeMatch[1].trim();
  if (dueMatch?.[1]) args.dueDate = dueMatch[1].trim();
  if (/\bhigh\b/i.test(beforeChecklist)) args.priority = 'High';
  else if (/\blow\b/i.test(beforeChecklist)) args.priority = 'Low';
  else if (/\bmedium\b/i.test(beforeChecklist)) args.priority = 'Medium';

  return { name: 'createTask', args };
}

function buildChecklistFallbackCall(message) {
  const original = String(message || '').trim();
  const msg = original.toLowerCase();
  const isChecklistCreate =
    /\b(create|add|make)\b.*\bchecklist\b/.test(msg) ||
    isChecklistItemListMessage(original) ||
    /\bremind me\b.*\b(check|test|verify)\b/.test(msg) ||
    /\bneed to\b.*\b(test|check|verify)\b.*\b(including|include)\b/.test(msg);

  if (!isChecklistCreate) return null;
  if (/\b(show|list|get|view|display)\b.*\bchecklists?\b/.test(msg)) return null;

  const args = buildCreateChecklistArgsFromMessage(original);

  return { name: 'createChecklist', args };
}

function buildCreateChecklistArgsFromMessage(message = '') {
  const original = String(message || '').trim();
  const msg = original.toLowerCase();
  const assignee = extractChecklistAssignee(original);
  const checklistItems = extractChecklistItems(original);
  const dueDate = extractChecklistDueDate(original);
  const args = {
    question: extractChecklistTitle(original, checklistItems) || extractStructuredChecklistQuestion(original) || extractChecklistQuestion(original),
    assignee,
    checklistItems,
    priority: extractPriority(msg),
  };

  if (dueDate) {
    args.fromDate = dueDate;
    args.dueDate = dueDate;
  }

  Object.keys(args).forEach((key) => {
    if (args[key] == null || args[key] === '' || (Array.isArray(args[key]) && args[key].length === 0)) delete args[key];
  });
  return args;
}

function extractChecklistAssignee(message = '') {
  const toldMatch = message.match(/\b(?:i\s+told|told|asked|ask)\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)\s+to\b/);
  if (toldMatch?.[1]) return toldMatch[1].trim();

  const forMatch = message.match(/\b(?:for|assign(?:ed)?\s+to|give\s+to)\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)\b/);
  if (forMatch?.[1] && !/^(him|her|them)$/i.test(forMatch[1])) return forMatch[1].trim();

  return null;
}

function extractChecklistLoopUsers(message = '') {
  const users = [];
  const patterns = [
    /\bkeep\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)\s+in\s+the\s+loop\b/gi,
    /\bkeep\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)\s+in\s+loop\b/gi,
    /\bcc\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?)\b/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(message)) !== null) {
      users.push(match[1].trim());
    }
  }

  return [...new Set(users)];
}

function extractChecklistDueDate(message = '') {
  const text = String(message || '');
  const lower = text.toLowerCase();
  const explicitRelativeTime = lower.match(/\b(today|tomorrow)\s+(morning|evening|afternoon|night)\b/);
  if (explicitRelativeTime) return `${explicitRelativeTime[1]} ${explicitRelativeTime[2]}`;

  const beforeToday = lower.match(/\bbefore\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+today\b/);
  if (beforeToday) return `today ${beforeToday[1]}`;

  const relativeBefore = lower.match(/\b(?:before|by|due(?:\s+by)?)\s+(.+?)(?:\bkeep\s+[a-z]|\bin\s+(?:the\s+)?loop\b|[.!?]|$)/i);
  if (relativeBefore?.[1]) return relativeBefore[1].trim();

  if (/\btomorrow\b/.test(lower)) return 'tomorrow';
  if (/\btoday\b/.test(lower)) return 'today';
  return null;
}

function extractChecklistItems(message = '') {
  const text = String(message || '').trim();
  const bulletItems = text
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:[-*]|\d+[.)]|\u25a1)\s+/.test(line))
    .map((item) => cleanChecklistItem(item))
    .filter(Boolean);
  if (bulletItems.length) return [...new Set(bulletItems)];

  const inlineBulletItems = [...text.matchAll(/(?:^|\s)[-*]\s+(.+?)(?=\s+[-*]\s+|$)/g)]
    .map((match) => cleanChecklistItem(match[1]))
    .filter(Boolean);
  if (inlineBulletItems.length) return [...new Set(inlineBulletItems)];

  const afterColon = text.match(/\b(?:checklist|items?)\b[^:\n]*:\s*([\s\S]+)$/i)?.[1] || '';
  const source = afterColon || text;
  const stopCleaned = source
    .replace(/\bkeep\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+in\s+(?:the\s+)?loop\b[\s\S]*$/i, '')
    .replace(/\b(?:before|by|due(?:\s+by)?)\s+.+$/i, '')
    .trim();

  const splitItems = stopCleaned
    .split(/\r?\n|;|\u2022|,(?=\s*(?:and\s+)?[A-Za-z])/)
    .map((item) => cleanChecklistItem(item))
    .filter(Boolean);

  if (splitItems.length > 1) return [...new Set(splitItems)];
  return [];
}

function cleanChecklistItem(item = '') {
  return String(item || '')
    .replace(/^\s*(?:[-*]|\d+[.)]|□)\s*/, '')
    .replace(/\b(?:create|add|make)\s+(?:a\s+)?checklists?\b/ig, '')
    .replace(/\b(?:please|complete|can\s+you)\b/ig, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim();
}

function extractChecklistTitle(message = '', checklistItems = []) {
  const text = String(message || '').trim();
  const asked = text.match(/\b(?:i\s+asked|asked|i\s+told|told|ask)\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+to\s+(.+?)(?:\b(?:before|by|due|today|tomorrow|keep|create\s+(?:a\s+)?checklist|checklist|items?)\b|[.!?]|$)/i)?.[1];
  const pendingContext = text.match(/\bmentioned\s+that\s+([A-Za-z][A-Za-z\s]{2,80}?)\s+is\s+still\s+pending(?:\s+before\b|\s+for\b|[.!?]|$)/i)?.[1]
    || text.match(/\b([A-Za-z][A-Za-z\s]{2,80}?)\s+is\s+still\s+pending(?:\s+before\b|\s+for\b|[.!?]|$)/i)?.[1];
  const quoted = text.match(/"([^"]+)"/)?.[1];
  const raw = pendingContext || asked || quoted || (checklistItems.length ? checklistItems[0] : null);
  if (!raw) return null;

  const cleaned = cleanChecklistTitle(raw);
  return cleaned || null;
}

function cleanChecklistTitle(title = '') {
  const cleaned = String(title || '')
    .replace(/\b(?:create|add|make)\s+(?:a\s+)?checklists?\b/ig, '')
    .replace(/\b(?:i\s+asked|asked|can\s+you)\b/ig, '')
    .replace(/\b(?:please|complete)\b/ig, '')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim();

  return toTitleCase(cleaned);
}

function toTitleCase(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function extractStructuredChecklistQuestion(message = '') {
  const text = String(message || '').trim();
  const mainTask = text.match(/\b(?:i\s+told|told|asked|ask)\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+to\s+(.+?)(?:\.\s*|\bcreate\s+a\s+checklist\b|$)/i)?.[1]
    ?.replace(/\s+/g, ' ')
    .trim();
  const checklistBody = text.match(/\bcreate\s+a\s+checklist(?:\s+for\s+(?:him|her|them|[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?))?\s*:?\s*([\s\S]*?)(?:\bset\s+this\b|\bkeep\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+in\s+(?:the\s+)?loop\b|$)/i)?.[1] || '';
  const subtasks = checklistBody
    .split(/\r?\n|;|\u2022/)
    .map((item) => item.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);

  if (!mainTask && subtasks.length === 0) return null;

  const title = mainTask
    ? mainTask.charAt(0).toUpperCase() + mainTask.slice(1)
    : 'Checklist';
  return cleanChecklistTitle(title);
}

function extractChecklistQuestion(message) {
  const text = String(message || '').trim();
  const quoted = text.match(/"([^"]+)"/);
  if (quoted) return quoted[1].trim();

  const includesMatch = text.match(/\bincluding\s+(.+)$/i);
  if (includesMatch) {
    return `Test ERP system including ${includesMatch[1].replace(/[.!?]+$/, '').trim()}`;
  }

  const cleaned = text
    .replace(/^\s*(today|tomorrow)\s+/i, '')
    .replace(/^\s*i\s+need\s+to\s+/i, '')
    .replace(/^\s*remind\s+me\s+(to\s+)?/i, '')
    .replace(/\bkeep\s+[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)?\s+in\s+(?:the\s+)?loop\b[\s\S]*$/i, '')
    .replace(/\b(?:before|by|due(?:\s+by)?)\s+.+$/i, '')
    .replace(/[.!?]+$/, '')
    .trim();
  return cleanChecklistTitle(cleaned);
}

function extractPriority(message) {
  if (/\b(high|urgent|critical)\b/.test(message)) return 'High';
  if (/\blow\b/.test(message)) return 'Low';
  if (/\bmedium\b/.test(message)) return 'Medium';
  return 'Medium';
}

function extractDeleteTaskTitle(message) {
  const title = String(message || '')
    .replace(/^\s*(i\s+want\s+to\s+)?(delete|remove|cancel)\s+/i, '')
    .replace(/^\s*(the\s+)?task\s+(name\s+is\s+|called\s+|titled\s+)?/i, '')
    .replace(/\s+task\s*$/i, '')
    .trim();
  if (!title || /^(it|this|that|last|latest)$/i.test(title)) return null;
  return title;
}

function formatDeterministicToolText(toolCalls = [], toolResults = [], fallback = '') {
  const tools = toolCalls.map((call) => call.name);
  if (tools.includes('createTask') && tools.includes('createChecklist')) {
    return formatCombinedCreateText(toolResults);
  }
  if (tools.includes('getMyTasks')) {
    const taskResult = (toolResults || []).find((tr) => tr.name === 'getMyTasks')?.result;
    if (taskResult?.ok && Array.isArray(taskResult.tasks)) {
      return formatTaskListText(taskResult.tasks, taskResult.slot?.lastFilters);
    }
  }
  if (tools.includes('getOverdueItems')) {
    const overdueCall = (toolCalls || []).find((call) => call.name === 'getOverdueItems');
    const overdueResult = (toolResults || []).find((tr) => tr.name === 'getOverdueItems')?.result;
    const taskOnly = overdueCall?.args?.entityType === 'task' || !Array.isArray(overdueResult?.checklists);
    if (taskOnly && overdueResult?.ok && Array.isArray(overdueResult.tasks)) {
      return formatTaskListText(overdueResult.tasks, { status: 'Overdue' });
    }
  }
  if (tools.includes('getTaskDetail')) {
    const detailResult = (toolResults || []).find((tr) => tr.name === 'getTaskDetail')?.result;
    if (detailResult?.ok && detailResult.found && detailResult.task) {
      return formatTaskBlock(detailResult.task);
    }
  }
  if (tools.includes('getChatSummary')) {
    const chatResult = (toolResults || []).find((tr) => tr.name === 'getChatSummary')?.result;
    if (chatResult) return formatChatSummaryText(chatResult);
  }
  if (tools.includes('listEmployees')) {
    const employeeResult = (toolResults || []).find((tr) => tr.name === 'listEmployees')?.result;
    if (employeeResult?.ok && Array.isArray(employeeResult.employees)) {
      return formatEmployeeListText(employeeResult.employees);
    }
  }
  if (tools.includes('deleteTask')) {
    const deleteResult = (toolResults || []).find((tr) => tr.name === 'deleteTask')?.result;
    if (deleteResult) return formatDeleteTaskText(deleteResult);
  }
  if (tools.includes('deleteChecklist')) {
    const deleteResult = (toolResults || []).find((tr) => tr.name === 'deleteChecklist')?.result;
    if (deleteResult) return formatDeleteChecklistText(deleteResult);
  }
  if (tools.filter((name) => ['updateTaskDueDate', 'updateTaskStatus', 'updateTaskTitle'].includes(name)).length > 1) {
    return formatCombinedTaskUpdateText(toolResults);
  }
  if (tools.includes('updateTaskStatus')) {
    const updateResult = (toolResults || []).find((tr) => tr.name === 'updateTaskStatus')?.result;
    if (updateResult) return formatUpdateTaskStatusText(updateResult);
  }
  if (tools.includes('updateTaskTitle')) {
    const updateResult = (toolResults || []).find((tr) => tr.name === 'updateTaskTitle')?.result;
    if (updateResult) return formatUpdateTaskTitleText(updateResult);
  }
  if (tools.includes('updateTaskDueDate')) {
    const updateResult = (toolResults || []).find((tr) => tr.name === 'updateTaskDueDate')?.result;
    if (updateResult) return formatUpdateTaskDueDateText(updateResult);
  }
  if (tools.includes('createTask')) {
    const taskResults = (toolResults || []).filter((tr) => tr.name === 'createTask').map((tr) => tr.result).filter(Boolean);
    if (taskResults.length) return formatCreateTaskText(taskResults);
  }
  if (tools.includes('createChecklist')) {
    const checklistResult = (toolResults || []).find((tr) => tr.name === 'createChecklist')?.result;
    if (checklistResult) return formatCreateChecklistText(checklistResult);
  }
  return fallback || '';
}

function formatCombinedCreateText(toolResults = []) {
  const taskResults = (toolResults || []).filter((tr) => tr.name === 'createTask').map((tr) => tr.result).filter(Boolean);
  const checklistResult = (toolResults || []).find((tr) => tr.name === 'createChecklist')?.result;
  const parts = [];

  for (const task of taskResults) {
    if (!task.ok) {
      parts.push(task.error || 'Task could not be created.');
      continue;
    }
    if (task.duplicate) {
      parts.push(formatDuplicateTaskText(task));
      continue;
    }
    const s = task.summary || {};
    parts.push([
      'Task Created',
      `**Task Title:** ${valueOrNA(s.title)}`,
      `**Assigned To:** ${valueOrNA(s.assignedTo)}`,
      `**Assigned By:** ${valueOrNA(s.assignedBy)}`,
      `**In Loop:** ${valueOrNA(s.inLoop)}`,
      `**Due Date:** ${valueOrNA(s.dueDate)}`,
      `**Priority:** ${valueOrNA(s.priority)}`,
      `**Status:** ${valueOrNA(s.status)}`,
    ].join('\n'));
  }

  if (checklistResult) parts.push(formatCreateChecklistText(checklistResult));
  return parts.join('\n\n');
}

function formatEmployeeListText(employees = []) {
  if (!employees.length) return 'No registered employees found.';
  const lines = employees.map((employee) => {
    const parts = [
      `#${valueOrNA(employee.id)}`,
      valueOrNA(employee.name),
      employee.role ? `(${employee.role})` : null,
      employee.email || null,
    ].filter(Boolean);
    return `• ${parts.join(' - ')}`;
  });
  return [`Registered Employees (${employees.length})`, ...lines].join('\n');
}

function formatChatSummaryText(result = {}) {
  if (!result.ok) return result.message || result.error || 'Chat summary could not be fetched.';
  const s = result.summary || {};
  if (!result.count) {
    return `No chat messages found for ${valueOrNA(s.date || result.date)}.`;
  }

  const lines = [
    valueOrNA(s.title || `Chat Summary - ${result.date}`),
    `**Total Messages:** ${valueOrNA(s.totalMessages)}`,
    `**User Messages:** ${valueOrNA(s.userMessages)}`,
    `**Assistant Messages:** ${valueOrNA(s.assistantMessages)}`,
  ];

  if (Array.isArray(s.highlights) && s.highlights.length) {
    lines.push('', '**Highlights:**');
    for (const item of s.highlights.slice(0, 6)) {
      lines.push(`• ${item}`);
    }
  }

  if (Array.isArray(s.turns) && s.turns.length) {
    lines.push('', '**Recent Turns:**');
    s.turns.slice(0, 5).forEach((turn, index) => {
      if (turn.user) lines.push(`${index + 1}. **You:** ${truncateText(turn.user, 120)}`);
      if (turn.assistant) lines.push(`   **ADA:** ${truncateText(turn.assistant, 140)}`);
    });
  }

  return lines.join('\n');
}

function truncateText(value = '', max = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function formatCreateTaskText(taskResults = []) {
  const parts = [];
  for (const task of taskResults) {
    if (!task.ok) {
      parts.push(task.error || 'Task could not be created.');
      continue;
    }
    if (task.duplicate) {
      parts.push(formatDuplicateTaskText(task));
      continue;
    }
    const s = task.summary || {};
    parts.push([
      'Task Created',
      `**Task Title:** ${valueOrNA(s.title)}`,
      `**Assigned To:** ${valueOrNA(s.assignedTo)}`,
      `**Assigned By:** ${valueOrNA(s.assignedBy)}`,
      `**In Loop:** ${valueOrNA(s.inLoop)}`,
      `**Due Date:** ${valueOrNA(s.dueDate)}`,
      `**Priority:** ${valueOrNA(s.priority)}`,
      `**Status:** ${valueOrNA(s.status)}`,
    ].join('\n'));
  }
  return parts.join('\n\n');
}

function formatDuplicateTaskText(result = {}) {
  const s = result.summary || {};
  return [
    'A similar task already exists.',
    `**Task Title:** ${valueOrNA(s.title)}`,
    `**Assigned To:** ${valueOrNA(s.assignedTo)}`,
    `**In Loop:** ${valueOrNA(s.inLoop)}`,
    `**Due Date:** ${valueOrNA(s.dueDate)}`,
    `**Due Time:** ${valueOrNA(s.dueTime)}`,
    `**Priority:** ${valueOrNA(s.priority)}`,
    `**Status:** ${valueOrNA(s.status)}`,
    'No duplicate task was created.',
  ].join('\n');
}

function formatCreateChecklistText(result = {}) {
  if (!result.ok) return result.error || 'Checklist could not be created.';
  if (result.duplicate) {
    const title = result.summary?.question;
    return title
      ? `Checklist already exists: ${title}. Please make a new checklist.`
      : 'Checklist already exists. Please make a new checklist.';
  }
  const s = result.summary || {};
  const lines = ['Checklist Created Successfully'];
  addLineIfValue(lines, 'Checklist Title', s.question);
  addLineIfValue(lines, 'Assignee', s.assignee);
  addLineIfValue(lines, 'Doer', s.doer);
  addLineIfValue(lines, 'Priority', formatChecklistPriority(s.priority));
  addLineIfValue(lines, 'Due Date', s.dueDateFormatted || s.dueDate);
  addLineIfValue(lines, 'Status', s.status || 'Pending');

  if (Array.isArray(s.checklistItems) && s.checklistItems.length) {
    lines.push('');
    lines.push('Checklist Items:');
    for (const item of s.checklistItems) {
      if (item) lines.push(`□ ${item}`);
    }
  }

  return lines.join('\n').replace(/\u00e2\u2013\u00a1/g, '\u25a1');
}

function addLineIfValue(lines, label, value) {
  if (!hasDisplayValue(value)) return;
  lines.push(`${label}: ${value}`);
}

function hasDisplayValue(value) {
  if (value == null) return false;
  const text = String(value).trim();
  if (/^(no|false)$/i.test(text)) return false;
  return text && !/^(n\/a|not available|null|undefined|—|-|custom)$/i.test(text);
}

function formatChecklistPriority(priority) {
  const text = String(priority || '').trim().toLowerCase();
  if (text === 'high') return 'High';
  if (text === 'medium') return 'Medium';
  if (text === 'low') return 'Low';
  return priority;
}

function formatDeleteTaskText(result = {}) {
  if (result.ok) {
    return `Task "${valueOrNA(result.taskTitle)}" deleted successfully.`;
  }
  if (Array.isArray(result.suggestions) && result.suggestions.length) {
    return `Task not found. Did you mean: ${result.suggestions.map((title) => `"${title}"`).join(', ')}?`;
  }
  return result.message || result.error || 'Task not found. Please mention the exact task name.';
}

function formatDeleteChecklistText(result = {}) {
  if (result.ok) {
    return `Checklist "${valueOrNA(result.checklistName)}" deleted successfully.`;
  }
  if (Array.isArray(result.suggestions) && result.suggestions.length) {
    return `Checklist not found. Did you mean: ${result.suggestions.map((name) => `"${name}"`).join(', ')}?`;
  }
  return result.message || result.error || 'Checklist not found. Please mention the exact checklist name.';
}

function formatUpdateTaskTitleText(result = {}) {
  if (!result.ok) return result.message || result.error || 'Task title could not be updated.';
  const s = result.summary || {};
  return [
    'Task Title Updated',
    `**Old Task Title:** ${valueOrNA(s.oldTitle)}`,
    `**New Task Title:** ${valueOrNA(s.title)}`,
    `**Assigned To:** ${valueOrNA(s.assignedTo)}`,
    `**Assigned By:** ${valueOrNA(s.assignedBy)}`,
    `**Due Date:** ${valueOrNA(s.dueDate)}`,
    `**Priority:** ${valueOrNA(s.priority)}`,
    `**Status:** ${valueOrNA(s.status)}`,
  ].join('\n');
}

function formatUpdateTaskDueDateText(result = {}) {
  if (!result.ok) return result.message || result.error || 'Task due date could not be updated.';
  const s = result.summary || {};
  return [
    'Task Due Date Updated',
    `**Task Title:** ${valueOrNA(s.title)}`,
    `**Old Due Date:** ${valueOrNA(s.oldDueDate)}`,
    `**New Due Date:** ${valueOrNA(s.dueDate)}`,
    `**Assigned To:** ${valueOrNA(s.assignedTo)}`,
    `**Assigned By:** ${valueOrNA(s.assignedBy)}`,
    `**Priority:** ${valueOrNA(s.priority)}`,
    `**Status:** ${valueOrNA(s.status)}`,
  ].join('\n');
}

function formatUpdateTaskStatusText(result = {}) {
  if (!result.ok) return result.message || result.error || 'Task status could not be updated.';
  const title = Array.isArray(result.titles) && result.titles.length ? result.titles.join(', ') : 'Task';
  return [
    'Task Status Updated',
    `**Task Title:** ${valueOrNA(title)}`,
    `**New Status:** ${valueOrNA(result.newStatus)}`,
  ].join('\n');
}

function formatCombinedTaskUpdateText(toolResults = []) {
  const titleResult = toolResults.find((tr) => tr.name === 'updateTaskTitle')?.result;
  const dueDateResult = toolResults.find((tr) => tr.name === 'updateTaskDueDate')?.result;
  const statusResult = toolResults.find((tr) => tr.name === 'updateTaskStatus')?.result;
  const failed = [dueDateResult, statusResult, titleResult].find((result) => result && !result.ok);
  if (failed) return failed.message || failed.error || 'Task could not be fully updated.';

  const titleSummary = titleResult?.summary || {};
  const dueSummary = dueDateResult?.summary || {};
  return [
    'Task Updated',
    `**Old Task Title:** ${valueOrNA(titleSummary.oldTitle || dueSummary.title)}`,
    `**New Task Title:** ${valueOrNA(titleSummary.title || dueSummary.title)}`,
    `**New Due Date:** ${valueOrNA(dueSummary.dueDate || titleSummary.dueDate)}`,
    `**New Status:** ${valueOrNA(statusResult?.newStatus || titleSummary.status || dueSummary.status)}`,
    `**Assigned To:** ${valueOrNA(titleSummary.assignedTo || dueSummary.assignedTo)}`,
    `**Assigned By:** ${valueOrNA(titleSummary.assignedBy || dueSummary.assignedBy)}`,
    `**Priority:** ${valueOrNA(titleSummary.priority || dueSummary.priority)}`,
  ].join('\n');
}

function formatTaskListText(tasks = [], filters = {}) {
  if (!tasks.length) return 'I could not find any matching tasks.';

  const status = filters?.status ? String(filters.status).toLowerCase() : '';
  const header = status ? `Here are your ${status} tasks:` : 'Here are your tasks:';
  const blocks = tasks.map((task) => formatTaskBlock(task));

  return `${header}\n\n${blocks.join('\n\n')}`;
}

function formatTaskBlock(task = {}) {
  return [
    `**Task Title:** ${valueOrNA(task.title)}`,
    `**Status:** ${task.overdue ? 'Overdue' : valueOrNA(task.status)}`,
    `**Priority:** ${valueOrNA(task.priority)}`,
    `**Due Date:** ${valueOrNA(task.dueDateFormatted)}`,
    `**Assigned To:** ${valueOrNA(task.assignedTo)}`,
    `**Assigned By:** ${valueOrNA(task.assignedBy)}`,
    `**In Loop:** ${valueOrNA(task.inLoop)}`,
    `**Description:** ${valueOrNA(task.description)}`,
  ].join('\n');
}

function valueOrNA(value) {
  if (value == null) return 'Not Available';
  const text = String(value).trim();
  return text ? text : 'Not Available';
}

function shouldSuppressTaskCards(toolCalls = [], toolResults = []) {
  const hasFormattedTaskTool = (toolCalls || []).some((call) => (
    call.name === 'getMyTasks' ||
    call.name === 'getOverdueItems' ||
    call.name === 'getTaskDetail'
  ));
  if (!hasFormattedTaskTool) return false;
  return (toolResults || []).some((tr) => (
    (tr.name === 'getMyTasks' && tr.result?.ok && Array.isArray(tr.result.tasks)) ||
    (tr.name === 'getOverdueItems' && tr.result?.ok && Array.isArray(tr.result.tasks) && !Array.isArray(tr.result.checklists)) ||
    (tr.name === 'getTaskDetail' && tr.result?.ok && tr.result.found && tr.result.task)
  ));
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

      const toolCalls = normalizeCreateToolCallsForMessage(resp.toolCalls || [], pre.normalized);

      if (toolCalls.length > 0) {
        messageThread.push({
          role: 'assistant',
          content: resp.content || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id, type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
          })),
        });
        for (const call of toolCalls) {
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
      finalContent = formatDeterministicToolText(toolCallsAll, toolResults, resp.content || '');
      if (toolCallsAll.length === 0) {
        const fallbackResult = await runTaskToolFallback({
          message: pre.normalized,
          user,
          requestId,
          sessionId: sid,
        });
        if (fallbackResult) {
          toolCallsAll.push(fallbackResult.toolCall);
          toolResults.push(fallbackResult.toolResult);
          finalContent = formatDeterministicToolText(toolCallsAll, toolResults, finalContent);
        }
      } else {
        await applyCombinedCreateFallback({
          loopResult: { toolCallsAll, toolResults },
          message: pre.normalized,
          user,
          requestId,
          sessionId: sid,
        });
        finalContent = formatDeterministicToolText(toolCallsAll, toolResults, finalContent);
      }
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
    const userMsg = await sessionStore.logTurn({
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
      suppressCards: shouldSuppressTaskCards(toolCallsAll, toolResults),
      responseType: plan.responseType,
      verbosity: plan.verbosity,
      sessionId: sid,
      messageId: assistantMsg?.id || null,
      timestamp: assistantMsg?.created_at || null,
      userMessageId: userMsg?.id || null,
      userTimestamp: userMsg?.created_at || null,
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
