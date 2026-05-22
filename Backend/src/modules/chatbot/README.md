# ERP Smart AI Chatbot

> Professional documentation for the existing ERP chatbot implementation.

The ERP Smart AI Chatbot is an intelligent assistant inside the DTable ERP system. It understands natural language, routes user requests through OpenAI tool calling, executes approved ERP tools, and returns structured responses such as text, cards, quick actions, and suggestions.

This document describes the current implementation only. It does not introduce new behavior, APIs, database schema, or business logic.

---

## 1. Project Overview

### Purpose

ERP Smart AI Chatbot helps users manage ERP work through conversation. Instead of navigating multiple ERP screens for common actions, users can ask the assistant to show tasks, create work items, update task details, manage checklists, check attendance, view dashboard summaries, and retrieve help guidance.

### Problem Being Solved

ERP users often need quick answers or small work updates while they are already in the middle of another workflow. Manual navigation can slow down simple actions such as:

- Showing pending tasks
- Creating a task from a natural sentence
- Updating task status
- Finding overdue items
- Creating checklist records
- Checking dashboard counts
- Asking how to use ERP modules

The chatbot reduces this friction by converting natural language into validated ERP tool calls.

### Why the Chatbot Exists

The chatbot exists to provide a conversational layer over ERP operations while preserving backend control. The OpenAI model interprets intent, but real ERP data is accessed only through registered backend tools. This keeps business actions inside existing services, validators, permissions, and database models.

---

## 2. Features

### Task Management

The chatbot exposes task operations through registered tools such as `getMyTasks`, `createTask`, `updateTaskStatus`, `updateTaskDueDate`, `updateTaskTitle`, `updateTaskAssignment`, `updateTaskLoopUsers`, `deleteTask`, `getTaskDetail`, `countTasks`, and `getOverdueItems`.

| Feature | Current Behavior |
|---|---|
| Create task | Creates a task using the existing `Task.create()` model. The chatbot can extract title, description, assignee, due date, priority, and in-loop users. |
| Update task | Supports updating status, due date, title, assignment, and in-loop users through separate tool handlers. |
| Delete task | Performs a delete/cancel style task action through the `deleteTask` tool when the user explicitly asks to delete, remove, or cancel a task. |
| Show pending tasks | Uses `getMyTasks` with status filtering. |
| Show overdue tasks | Uses `getOverdueItems` or status/date-aware task logic depending on the request. |
| Dashboard summary | Uses `getDashboardSummary` to return aggregate task, checklist, and ticket counts. |
| Task status tracking | Status updates are performed through `updateTaskStatus`. |
| Task detail | Uses exact ID or fuzzy task title matching through `getTaskDetail`. |
| Task count | Uses `countTasks` for questions such as "how many pending tasks do I have?" |

#### Priority Support

Task priority is supported with these values:

| Priority | Meaning |
|---|---|
| `High` | Important or urgent work |
| `Medium` | Default priority when no priority is provided |
| `Low` | Lower urgency work |

The task creation tool defaults priority to `Medium` when the user does not mention one.

#### Current Task Status Values

The current task tool schemas use these status values:

| Status | Usage |
|---|---|
| `Pending` | Default status for newly created chatbot tasks |
| `In Progress` | Work has started |
| `Completed` | Work is complete |
| `Hold` | Work is on hold |

When a user says "cancel" or "remove" in the context of deleting a task, the current implementation routes that intent to `deleteTask` instead of treating `Cancelled` as an update status value.

### Checklist Management

Checklist operations are handled through tools such as `createChecklist`, `getMyChecklists`, `getChecklistDetail`, and `deleteChecklist`.

| Feature | Current Behavior |
|---|---|
| Create checklist | Creates records in `checklist_master` and `checklist` using the existing checklist database structure. |
| Add checklist items | The `createChecklist` tool accepts a `checklistItems` array and preserves separate row/item text in the response summary. |
| Mark completed items | Checklist status/progress is read through checklist queries. The current chatbot toolset focuses on create, list, detail, overdue, and delete operations. |
| Track progress | Checklist list/detail tools return status and checklist metadata for user-facing progress tracking. |
| Frequency support | Supports `daily`, `weekly`, `monthly`, `quarterly`, `yearly`, and `custom` values in the tool schema. |
| Verification support | Can store verification-required data and verifier information during checklist creation. |
| Attachment support | Can store whether attachment/proof is required. |

### Smart AI Features

| Feature | Description |
|---|---|
| Natural language understanding | User messages are passed through preprocessing, system prompts, examples, and OpenAI tool calling. |
| Story-based task extraction | Sentences like "I told Aashu to verify attendance before evening" can become structured task arguments. |
| Hidden intent detection | The model selects tools based on meaning, not only exact keywords. |
| Multi-intent support | The orchestrator can execute multiple tool calls in one turn, with a configured maximum tool-hop limit. |
| Context awareness | Session context stores useful slots such as last entity, last created task, last checklist, last filters, and last result IDs. |
| Conversation memory | Recent messages are loaded from saved chatbot history and sent into the prompt context. |
| Smart response generation | Responses are formatted as a standard envelope with text, cards, quick actions, and suggestions. |
| Personalized responses | Tool access is based on authenticated user identity and role. |
| ERP-aware responses | The assistant uses ERP-specific tools, models, knowledge base entries, and module guidance. |

### Date & Time Understanding

The current task and checklist handlers resolve common natural language date/time phrases.

| Example Phrase | Current Interpretation Pattern |
|---|---|
| `today` | Current date |
| `tomorrow` | Next day |
| `tomorrow morning` | Tomorrow with a morning time hint |
| `today evening` | Today with an evening time hint |
| `before 6 PM` / `6 pm` | Explicit time hint when extracted by the model/tool arguments |
| `next Monday` / `monday` | Next matching weekday |
| `next week` | Next Monday in task date logic |
| `in 3 days` | Current date plus three days |
| `21 June 2026` | Parsed as a calendar date when supported by JavaScript date parsing or handler-specific parsing |

### User Assignment Logic

The chatbot uses employee search adapters to resolve names to ERP employee IDs.

| User Input | Extracted Meaning |
|---|---|
| `"I told Aashu to verify attendance"` | `assignedTo = Aashu` |
| `"Keep Adarsh in the loop"` | `loopUsers = ["Adarsh"]` |
| `"Assign this task to Riya"` | Existing task reassignment through `updateTaskAssignment` |
| `"Add Adarsh in loop for same task"` | Existing task loop-user update through `updateTaskLoopUsers` |

For new task creation, the assignee becomes the task doer. In-loop users are stored separately and do not receive separate duplicate tasks.

### Priority Rules

| Natural Language | Stored Priority |
|---|---|
| high priority, urgent, important | `High` |
| medium priority, normal | `Medium` |
| low priority, not urgent | `Low` |
| no priority mentioned | `Medium` |

Priority is not treated as task status. For example, "show high priority tasks" filters by `priority = High`, not by status.

### Status Rules

Current task update status values are:

```text
Pending
In Progress
Completed
Hold
```

For delete/remove/cancel wording, the chatbot uses the current `deleteTask` tool.

---

## 3. Chatbot Architecture

### Main Components

| Layer | Responsibility |
|---|---|
| Frontend | React chatbot drawer, message input, session history, streaming UI, cards, suggestions, quick actions |
| Backend | Express routes, controllers, middleware, orchestrator, tool executor |
| Database | PostgreSQL tables for sessions, messages, knowledge, and existing ERP task/checklist data |
| OpenAI Integration | OpenAI-compatible provider with function/tool calling |
| APIs | JSON message endpoint, SSE streaming endpoint, session/history endpoints |
| Task Services | Existing task model/adapters used by chatbot task handlers |
| Checklist Services | Existing checklist tables and chatbot checklist handlers |

### Architecture Flow

```text
User
  |
  v
React Chatbot Drawer
  |
  v
/api/chatbot/stream or /api/chatbot/message
  |
  v
Auth + Request Context + Rate Limit Middleware
  |
  v
Chatbot Controller
  |
  v
ChatOrchestrator
  |
  +--> NLP Preprocess + Injection Guard
  |
  +--> Session Memory + Recent History
  |
  +--> System Prompt + Examples + User Message
  |
  +--> OpenAI Tool Calling
  |
  +--> ToolExecutor
          |
          +--> Task Adapter / Checklist Handler / Dashboard Adapter / Helpdesk Adapter
          |
          v
       Existing ERP Models + PostgreSQL
  |
  v
Response Planner
  |
  v
Envelope Formatter
  |
  v
Frontend Text + Cards + Quick Actions + Suggestions
```

### Tool-Calling Workflow

```text
User message
  |
  v
preprocess(message)
  |
  v
load session + context slots
  |
  v
build system prompt + examples + history
  |
  v
send tool definitions filtered by role
  |
  v
OpenAI selects tool(s)
  |
  v
validate arguments
  |
  v
execute handler
  |
  v
persist user/tool/assistant messages
  |
  v
return response envelope
```

---

## 4. Folder Structure

### Backend Chatbot Module

```text
Backend/src/modules/chatbot/
├── adapters/
│   ├── attendanceAdapter.js
│   ├── checklistAdapter.js
│   ├── dashboardAdapter.js
│   ├── employeeAdapter.js
│   ├── helpdeskAdapter.js
│   └── taskAdapter.js
├── constants/
│   ├── errors.js
│   ├── intents.js
│   └── responseTypes.js
├── controllers/
│   ├── chat.controller.js
│   ├── history.controller.js
│   └── stream.controller.js
├── entities/
│   └── extractors.js
├── formatters/
│   ├── cards.js
│   ├── envelope.js
│   └── markdown.js
├── memory/
│   ├── ContextBuilder.js
│   └── SessionStore.js
├── middleware/
│   ├── rateLimit.js
│   └── requestContext.js
├── nlp/
│   ├── corrections.js
│   └── preprocess.js
├── planners/
│   └── responsePlanner.js
├── prompts/
│   ├── system.base.js
│   └── system.examples.js
├── providers/
│   ├── BaseProvider.js
│   ├── OpenAIProvider.js
│   └── index.js
├── repositories/
│   ├── kbRepository.js
│   ├── messageRepository.js
│   └── sessionRepository.js
├── routes/
│   └── chatbot.routes.js
├── services/
│   ├── ChatOrchestrator.js
│   └── ToolExecutor.js
├── tests/
│   ├── conversational.fixtures.json
│   ├── createChecklist.test.js
│   ├── deleteChecklist.test.js
│   ├── fuzzy.test.js
│   ├── nlp.test.js
│   ├── orchestrator.test.js
│   ├── permissions.test.js
│   ├── planner.test.js
│   ├── toolArgs.test.js
│   └── toolExecutor.test.js
├── tools/
│   ├── definitions.js
│   ├── permissions.js
│   ├── registry.js
│   └── handlers/
│       ├── createChecklist.js
│       ├── createTask.js
│       ├── countTasks.js
│       ├── deleteChecklist.js
│       ├── deleteTask.js
│       ├── getAttendanceStatus.js
│       ├── getChatSummary.js
│       ├── getChecklistDetail.js
│       ├── getDashboardSummary.js
│       ├── getHelpGuidance.js
│       ├── getMyChecklists.js
│       ├── getMyHelpTickets.js
│       ├── getMyTasks.js
│       ├── getOverdueItems.js
│       ├── getTaskDetail.js
│       ├── getTeamWorkload.js
│       ├── listEmployees.js
│       ├── searchEmployees.js
│       ├── updateTaskAssignment.js
│       ├── updateTaskDueDate.js
│       ├── updateTaskLoopUsers.js
│       ├── updateTaskStatus.js
│       └── updateTaskTitle.js
├── utils/
│   ├── fuzzy.js
│   ├── logger.js
│   └── time.js
├── validators/
│   ├── permissions.js
│   └── toolArgs.js
├── index.js
└── README.md
```

### Frontend Chatbot Feature

```text
DTA_ERP/src/features/chatbot/
├── components/
│   ├── ChatbotDrawer.jsx
│   ├── ChatInput.jsx
│   ├── ChatMessage.jsx
│   ├── ChecklistCard.jsx
│   ├── DashboardCard.jsx
│   ├── EmployeeCard.jsx
│   ├── MarkdownLite.jsx
│   ├── QuickActionBar.jsx
│   ├── SuggestionChips.jsx
│   ├── TaskCard.jsx
│   ├── TicketCard.jsx
│   └── TypingIndicator.jsx
├── services/
│   └── chatbotApi.js
├── store/
│   └── chatbotSlice.js
└── index.js
```

---

## 5. AI Intelligence Logic

### Intent Detection

Intent is inferred from selected tool calls. The model receives role-filtered tool definitions and chooses tools such as:

- `createTask`
- `getMyTasks`
- `updateTaskStatus`
- `createChecklist`
- `getDashboardSummary`
- `getAttendanceStatus`
- `getHelpGuidance`

The response envelope includes the detected intent and confidence value.

### Entity Extraction

The chatbot uses two layers of extraction:

1. Lightweight backend entity hints from `entities/extractors.js`
2. OpenAI tool-call argument extraction based on tool schemas

Extracted entities may include:

- Task title
- Checklist question
- Employee names
- Priority
- Status
- Date/time phrases
- Period filters
- Relative task references such as latest, task index, all pending, or all overdue

### Story Prompt Handling

Story-like sentences are converted into structured ERP actions.

Example:

```text
I told Aashu to verify attendance before evening and keep Adarsh informed.
```

Expected extracted meaning:

```text
Tool: createTask
Title: Verify Attendance
Assigned To: Aashu
In Loop: Adarsh
Due Date: today evening / before evening
Priority: Medium
Status: Pending
```

### Semantic Matching

The chatbot uses fuzzy matching for existing tasks and employee names. This allows users to refer to records with partial names or imperfect wording.

Examples:

- `"complete attendance task"` can match a task with a similar title.
- `"Aashu"` can resolve to the closest employee result.
- `"same task"` can use the last created or selected task stored in session context.

### Multi-Intent Processing

The orchestrator supports a tool-call loop with a maximum configured hop count. This allows a single message to trigger more than one backend operation when the model selects multiple tools.

Examples:

- Create a task and include in-loop users.
- Update multiple tasks by indexes from the last shown list.
- Ask for overdue items across both tasks and checklists.

### Context Handling

Session context is stored in `chatbot_sessions.context_json`. The chatbot uses this context for follow-up requests.

Examples of stored context:

| Slot | Purpose |
|---|---|
| `lastEntity` | Remembers whether the last topic was task, checklist, etc. |
| `lastCreatedTaskId` | Enables follow-ups like "delete it" or "change its due date" |
| `lastCreatedTaskTitle` | Keeps readable reference to the last task |
| `lastFilters` | Stores filters from the last task list |
| `lastResultIds` | Enables "update task 2" after a displayed list |
| `selectedChecklistId` | Enables checklist follow-up context |
| `selectedChecklistName` | Stores current checklist reference |

---

## 6. Example User Prompts

### 1. Create a Task with Assignee and Loop User

**Input**

```text
I told Aashu to verify attendance before evening and keep Adarsh informed.
```

**Expected Output**

```text
Task Title: Verify Attendance
Assigned To: Aashu
In Loop: Adarsh
Priority: Medium
Status: Pending
```

### 2. Create a High Priority Task

**Input**

```text
Create high priority task for Riya to check salary report tomorrow morning.
```

**Expected Output**

```text
Task Title: Check Salary Report
Assigned To: Riya
Due Date: Tomorrow Morning
Priority: High
Status: Pending
```

### 3. Create a Self Task

**Input**

```text
Remind me to update the MIS report tomorrow.
```

**Expected Output**

```text
Task Title: Update MIS Report
Assigned To: Current User
Priority: Medium
Status: Pending
```

### 4. Show Pending Tasks

**Input**

```text
Show my pending tasks.
```

**Expected Output**

```text
Tool: getMyTasks
Filter: status = Pending
Response: List of pending task cards
```

### 5. Show High Priority Tasks

**Input**

```text
Which tasks are high priority?
```

**Expected Output**

```text
Tool: getMyTasks
Filter: priority = High
Response: List of matching task cards
```

### 6. Show Today's Tasks

**Input**

```text
Show today's tasks.
```

**Expected Output**

```text
Tool: getMyTasks
Filter: period = today
Response: List of tasks due today
```

### 7. Show Tomorrow's Tasks

**Input**

```text
Show tomorrow tasks.
```

**Expected Output**

```text
Tool: getMyTasks
Filter: period = tomorrow
Response: List of tasks due tomorrow
```

### 8. Show Overdue Work

**Input**

```text
What's overdue?
```

**Expected Output**

```text
Tool: getOverdueItems
Entity Type: all
Response: Overdue tasks and/or checklists
```

### 9. Update Task Status by Title

**Input**

```text
Mark attendance verification as completed.
```

**Expected Output**

```text
Tool: updateTaskStatus
Task Title: Attendance Verification
New Status: Completed
```

### 10. Update Task Status by List Index

**Input**

```text
Mark task 2 as in progress.
```

**Expected Output**

```text
Tool: updateTaskStatus
Task Index: 2
New Status: In Progress
```

### 11. Change Due Date

**Input**

```text
Change salary report task due date to next Monday.
```

**Expected Output**

```text
Tool: updateTaskDueDate
Task Title: Salary Report
Due Date: Next Monday
```

### 12. Rename Task

**Input**

```text
Rename attendance check task to verify monthly attendance.
```

**Expected Output**

```text
Tool: updateTaskTitle
Old Title: Attendance Check
New Title: Verify Monthly Attendance
```

### 13. Reassign Existing Task

**Input**

```text
Assign this task to Aashu.
```

**Expected Output**

```text
Tool: updateTaskAssignment
Assigned To: Aashu
Target: Last selected or referenced task
```

### 14. Add In-Loop User to Existing Task

**Input**

```text
Keep Adarsh in loop for the same task.
```

**Expected Output**

```text
Tool: updateTaskLoopUsers
In Loop: Adarsh
Target: Last selected or referenced task
```

### 15. Delete Task

**Input**

```text
Delete this task.
```

**Expected Output**

```text
Tool: deleteTask
Target: Last created or referenced task
```

### 16. Create Checklist

**Input**

```text
Create a daily checklist for office opening verification from tomorrow morning.
```

**Expected Output**

```text
Tool: createChecklist
Question: Office Opening Verification
Frequency: daily
From Date: Tomorrow Morning
Priority: medium
Status: Pending
```

### 17. Create Checklist with Verifier

**Input**

```text
Create checklist for backup verification and make Adarsh the verifier.
```

**Expected Output**

```text
Tool: createChecklist
Question: Backup Verification
Verification Required: true
Verifier: Adarsh
```

### 18. Show Checklists

**Input**

```text
Show my pending checklists.
```

**Expected Output**

```text
Tool: getMyChecklists
Filter: status = Pending
Response: List of checklist cards
```

### 19. Dashboard Summary

**Input**

```text
Show my dashboard summary.
```

**Expected Output**

```text
Tool: getDashboardSummary
Response: Aggregated dashboard counts
```

### 20. ERP Help Guidance

**Input**

```text
How do I see completed checklist history?
```

**Expected Output**

```text
Tool: getHelpGuidance
Topic: completed checklist history
Response: ERP guidance from the knowledge base
```

---

## 7. Future Improvements

These are documentation-level future ideas and are not part of the current implementation described above.

| Improvement | Description |
|---|---|
| Voice commands | Allow users to speak commands instead of typing them. |
| Multiple assignees | Support assigning one task to multiple users if business rules allow it. |
| Notification system | Send reminders or updates after chatbot-created actions. |
| Email integration | Create or update ERP work from email conversations. |
| Analytics dashboard | Track chatbot usage, task automation metrics, and success rates. |
| Reminder system | Schedule reminders based on natural language due dates. |
| Smart recommendations | Suggest actions based on overdue work, workload, or recent patterns. |

---

## 8. Tech Stack

| Area | Current Technology |
|---|---|
| Frontend | React, Redux Toolkit, JavaScript |
| Backend | Node.js, Express.js |
| AI Provider | OpenAI API through the `openai` package |
| Database | PostgreSQL through the `pg` package |
| Authentication | JWT-based auth middleware |
| Streaming | Server-Sent Events over `fetch` + `ReadableStream` |
| Scheduling/Utilities | Existing ERP backend packages such as `node-cron`, `nodemailer`, and related services |

---

## 9. API Endpoints

All chatbot endpoints require:

```http
Authorization: Bearer <token>
```

### Endpoint Summary

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/chatbot/message` | One-shot JSON chatbot response |
| `POST` | `/api/chatbot/stream` | Streaming chatbot response using SSE-style events |
| `GET` | `/api/chatbot/sessions` | List current user's chat sessions |
| `GET` | `/api/chatbot/history` | Get recent chatbot history |
| `GET` | `/api/chatbot/history/:sessionId` | Get message history for one session |
| `DELETE` | `/api/chatbot/sessions/:sessionId` | Clear/delete a chat session |

### POST `/api/chatbot/message`

**Request**

```json
{
  "message": "Show my pending tasks",
  "sessionId": "optional-session-uuid"
}
```

**Response**

```json
{
  "success": true,
  "sessionId": "session-uuid",
  "messageId": 123,
  "intent": "task_list",
  "confidence": 0.95,
  "responseType": "list",
  "verbosity": "medium",
  "text": "Here are your pending tasks.",
  "cards": [],
  "quickActions": [],
  "suggestions": [],
  "toolsInvoked": ["getMyTasks"],
  "error": null,
  "timestamp": "2026-05-22T10:00:00.000Z"
}
```

### POST `/api/chatbot/stream`

**Request**

```json
{
  "message": "Create task for Aashu to verify attendance tomorrow morning",
  "sessionId": "optional-session-uuid"
}
```

**Stream Events**

```text
event: start
data: {"sessionId":"session-uuid"}

event: tool_call
data: {"name":"createTask","args":{"title":"Verify Attendance","assignedTo":"Aashu","dueDate":"tomorrow morning"}}

event: tool_result
data: {"name":"createTask","ok":true}

event: delta
data: {"text":"Task created successfully."}

event: done
data: {"success":true,"sessionId":"session-uuid","toolsInvoked":["createTask"]}
```

### GET `/api/chatbot/sessions`

**Request**

```http
GET /api/chatbot/sessions?limit=20
Authorization: Bearer <token>
```

**Response**

```json
{
  "success": true,
  "sessions": [
    {
      "session_id": "session-uuid",
      "title": null,
      "last_activity": "2026-05-22T10:00:00.000Z",
      "created_at": "2026-05-22T09:30:00.000Z"
    }
  ]
}
```

### GET `/api/chatbot/history/:sessionId`

**Request**

```http
GET /api/chatbot/history/session-uuid?limit=50
Authorization: Bearer <token>
```

**Response**

```json
{
  "success": true,
  "sessionId": "session-uuid",
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "Show my pending tasks",
      "created_at": "2026-05-22T10:00:00.000Z"
    },
    {
      "id": 2,
      "role": "assistant",
      "content": "Here are your pending tasks.",
      "intent": "task_list",
      "created_at": "2026-05-22T10:00:01.000Z"
    }
  ]
}
```

### DELETE `/api/chatbot/sessions/:sessionId`

**Request**

```http
DELETE /api/chatbot/sessions/session-uuid
Authorization: Bearer <token>
```

**Response**

```json
{
  "success": true
}
```

---

## 10. Installation Steps

### 1. Clone Repository

```bash
git clone <repository-url>
cd ERP
```

### 2. Install Backend Dependencies

```bash
cd Backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../DTA_ERP
npm install
```

### 4. Configure Environment Variables

Create a backend `.env` file based on the existing project configuration.

Common chatbot-related variables:

```env
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=800
OPENAI_TEMPERATURE=0.3
LLM_PROVIDER=openai
CHATBOT_MAX_HISTORY=12
CHATBOT_MAX_HOPS=4
CHATBOT_RATE_LIMIT=0.5:30
CHATBOT_LOG_LEVEL=info
CHATBOT_LOG_FORMAT=json
```

Database and JWT variables should match the existing ERP backend configuration.

### 5. Start Backend

```bash
cd Backend
npm start
```

For development:

```bash
npm run dev
```

### 6. Start Frontend

```bash
cd DTA_ERP
npm run dev
```

### 7. Run Backend Tests

```bash
cd Backend
npm test
```

---

## Current Database Tables Used by Chatbot

The chatbot model creates and uses these PostgreSQL tables:

| Table | Purpose |
|---|---|
| `chatbot_conversations` | Legacy conversation analytics log |
| `chatbot_sessions` | Conversation sessions and context slots |
| `chatbot_messages` | User, assistant, and tool turn history |
| `chatbot_knowledge` | ERP knowledge base entries with full-text search |

The chatbot also uses existing ERP tables/models for tasks, checklists, employees, attendance, help tickets, and dashboard data.

---

## Current Registered Tools

| Tool | Purpose |
|---|---|
| `getMyTasks` | List current user's tasks with filters |
| `getTaskDetail` | Show one task in detail |
| `countTasks` | Count tasks by role/status |
| `getMyChecklists` | List current user's checklists |
| `getChecklistDetail` | Show one checklist in detail |
| `getOverdueItems` | Show overdue tasks/checklists |
| `getAttendanceStatus` | Show attendance by date or period |
| `getMyHelpTickets` | Show help tickets |
| `getDashboardSummary` | Show dashboard summary |
| `getChatSummary` | Summarize saved chatbot conversation by date |
| `listEmployees` | Admin/SuperAdmin employee list |
| `searchEmployees` | Admin/SuperAdmin employee search |
| `getTeamWorkload` | Admin/SuperAdmin workload summary |
| `getHelpGuidance` | ERP help/knowledge guidance |
| `createTask` | Create a task |
| `createChecklist` | Create a checklist |
| `updateTaskStatus` | Update task status |
| `updateTaskDueDate` | Update task due date |
| `updateTaskTitle` | Rename task |
| `updateTaskLoopUsers` | Add users to existing task loop/watchers |
| `updateTaskAssignment` | Reassign existing task |
| `deleteTask` | Delete/remove/cancel task |
| `deleteChecklist` | Delete checklist |

---

## Security and Controls

| Control | Current Implementation |
|---|---|
| Authentication | All chatbot routes use JWT verification middleware. |
| Request context | Request IDs and user context are attached through middleware. |
| Rate limiting | Token-bucket style rate limiting is applied per user. |
| Role-filtered tools | Admin-only tools are exposed only to Admin/SuperAdmin roles. |
| Tool validation | Tool arguments are validated before handler execution. |
| Prompt injection guard | Suspicious prompt-injection patterns are detected during preprocessing. |
| Database access | Real ERP data is accessed through tools, adapters, repositories, and existing models. |

---

## Response Envelope Format

The chatbot returns a consistent response envelope.

```json
{
  "success": true,
  "sessionId": "uuid",
  "messageId": 123,
  "intent": "task_list",
  "confidence": 0.95,
  "responseType": "list",
  "verbosity": "medium",
  "text": "Here are your tasks.",
  "cards": [],
  "quickActions": [],
  "suggestions": [],
  "toolsInvoked": ["getMyTasks"],
  "error": null,
  "timestamp": "2026-05-22T10:00:00.000Z"
}
```

---

## Summary

ERP Smart AI Chatbot is a tool-calling ERP assistant built with React, Node.js, Express.js, OpenAI, and PostgreSQL. It understands natural language, preserves conversation context, uses existing ERP models and business rules, and returns structured responses for task, checklist, dashboard, attendance, helpdesk, employee, and guidance workflows.
