# Chatbot Module — ADA v2

**ADA** is the AI assistant for the DTable ERP. The v2 architecture replaces keyword matching with an LLM tool-calling pipeline: the model understands natural language, the backend exposes typed tools, and tools are the **only** path to real ERP data.

## High-level flow

```
client → routes → middleware (auth, requestId, rate-limit)
                  → controller (JSON or SSE)
                  → ChatOrchestrator
                       ├─ nlp/preprocess   (typo fix, injection guard)
                       ├─ memory.load      (session slots + last 12 turns)
                       ├─ prompts.build    (system + few-shot + history)
                       ├─ provider.chat    (OpenAI gpt-4o-mini, function-calling)
                       │     ↳ tool loop (≤ 4 hops): ToolExecutor → adapters
                       ├─ planner.plan     (verbosity / responseType)
                       ├─ formatter.build  (text + cards + quickActions + suggestions)
                       └─ memory.persist   (user/tool/assistant turns)
```

## Directory layout

```
chatbot/
├── routes/             HTTP routes (chatbot.routes.js mounts everything)
├── controllers/        chat (JSON), stream (SSE), history
├── services/           ChatOrchestrator + ToolExecutor
├── nlp/                preprocess + corrections
├── entities/           heuristic extractor (entity, status, priority, period)
├── memory/             Postgres-backed SessionStore + ContextBuilder
├── planners/           responsePlanner (verbosity heuristic)
├── formatters/         envelope, cards, markdown
├── providers/          BaseProvider, OpenAIProvider, factory
├── prompts/            system.base, system.examples
├── adapters/           one per ERP module (task, checklist, attendance, helpdesk, dashboard, employee)
├── tools/              definitions, registry, permissions, handlers/*
├── repositories/       direct SQL for chatbot tables (sessions, messages, kb)
├── validators/         permissions + tool-arg validator
├── middleware/         requestContext + rateLimit
├── utils/              logger, fuzzy, time
├── constants/          intents, responseTypes, errors
└── tests/              unit + orchestrator-mocked integration + fixtures
```

Legacy v1 files (`chatbot.service.js`, `chatbot.controller.js`, `chatbot.context.js`, `chatbot.knowledge.js`, `chatbot.formatter.js`, `chatbot.openai.js`, `chatbot.service.test.js`) are left in place untouched for back-compat; only `chatbot.routes.js` was rewired to delegate to v2.

## API

All endpoints require JWT (`Authorization: Bearer <token>`).

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/chatbot/message` | One-shot JSON; body `{ message, sessionId? }` → envelope |
| POST | `/api/chatbot/stream` | SSE stream — events: `start`, `tool_call`, `tool_result`, `delta`, `card`, `done`, `error` |
| GET  | `/api/chatbot/sessions` | List the user's sessions |
| GET  | `/api/chatbot/history/:sessionId?` | Get message history |
| DELETE | `/api/chatbot/sessions/:sessionId` | Clear a session |

### Response envelope

```jsonc
{
  "success": true,
  "sessionId": "uuid",
  "messageId": 123,
  "intent": "task_list",
  "confidence": 0.95,
  "responseType": "list",           // text|list|detail|count|clarify|guidance|greeting|error
  "verbosity": "medium",            // concise|medium|detailed
  "text": "Here are your 4 pending tasks…",
  "cards": [ /* task / checklist / ticket / dashboard / employee */ ],
  "quickActions": [ { "label": "High priority only", "prompt": "..." } ],
  "suggestions": [ "Which one is high priority?", "What's overdue?" ],
  "toolsInvoked": ["getMyTasks"],
  "error": null,
  "timestamp": "..."
}
```

For SSE, the same envelope is emitted as the final `done` event after streaming deltas.

## Adding a new tool

Three steps:

1. **Implement the adapter** (or reuse one). Adapters live in `adapters/` and wrap existing ERP services. They must not contain raw SQL when an existing service / model already exposes the needed call.
2. **Implement the handler** in `tools/handlers/yourTool.js`. Signature: `async (args, user, ctx) => result`. Always validate args with `validators/toolArgs.js` and check role with `validators/permissions.js`.
3. **Register** the tool:
   - Add it to `tools/registry.js` (handler map)
   - Add its definition to `tools/definitions.js` (JSON Schema)
   - Add its role to `tools/permissions.js`

The tool will appear in the LLM's available tools the next request — no restart needed.

## Environment variables (optional)

| Var | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Required for the orchestrator to call the LLM. Without it, the chatbot returns a safe fallback. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model id |
| `OPENAI_MAX_TOKENS` | `800` | Per-turn cap |
| `OPENAI_TEMPERATURE` | `0.3` | Lower = more deterministic |
| `LLM_PROVIDER` | `openai` | Provider factory key |
| `CHATBOT_MAX_HISTORY` | `12` | Turns of history sent to the LLM |
| `CHATBOT_MAX_HOPS` | `4` | Max tool-call iterations per turn |
| `CHATBOT_RATE_LIMIT` | `0.5:30` | Token-bucket `rate/sec:capacity` per user |
| `CHATBOT_LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `CHATBOT_LOG_FORMAT` | `json` | `json` or `plain` |

## Database

Three new tables (idempotent CREATEs in `Backend/src/models/chatbot.model.js`):

* `chatbot_sessions` — conversation threads (UUID id, slot context as JSONB)
* `chatbot_messages` — turn-by-turn log (user/assistant/tool)
* `chatbot_knowledge` — KB with tsvector full-text search, seeded from legacy `chatbot.knowledge.js` on boot

The legacy `chatbot_conversations` table is preserved and mirrored (write-through) for analytics continuity.

## Security

* **RBAC** is enforced inside every tool handler via `validators/permissions.js`. The LLM cannot bypass this — it only receives data tools return.
* **Prompt injection** is detected by `nlp/preprocess.js` and the suspicious input is quoted before reaching the LLM (so the model treats it as content, not instructions).
* **Tool args** validated against a lightweight schema before any DB call.
* **Rate limiting** via token bucket per user (in-process; swap to Redis for multi-instance).
* **Role-filtered tool catalog**: an Employee never even sees admin tools in the LLM's tool list.

## Observability

Every request emits structured JSON logs (one line per event):

```
{ ts, level, scope, requestId, sessionId, userId, role, message, intent?, toolsInvoked?, latencyMs?, tokensIn?, tokensOut? }
```

The orchestrator also persists tool calls, tool results, and token counts per turn in `chatbot_messages` for replay and analytics.

## Testing

```bash
cd Backend && npm test
```

Tests are colocated in `tests/`. Pure unit tests (NLP, fuzzy, planner, permissions, toolArgs) need no DB. The orchestrator integration test uses a mocked provider and monkey-patched session store — no network, no DB. The conversational fixtures (`conversational.fixtures.json`) document expected tool selection for 15 multi-turn scenarios and can be used for manual QA or future replay tests.
