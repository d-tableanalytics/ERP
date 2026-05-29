# ERP Chatbot Documentation

## 1. Project Title

ERP Chatbot Documentation

---

## 2. Overview

The ERP Chatbot is a conversational assistant embedded inside your ERP system that helps users interact with task and checklist workflows using natural language. It bridges the React frontend and Node.js/Express backend to perform actions such as creating tasks, updating fields, tracking statuses, viewing overdue items, and generating summaries.

Why use it in ERP
- Reduces navigation overhead for frequent micro-tasks (create/update/track).
- Lets users issue commands conversationally, increasing productivity.
- Keeps all business logic, permissions, and auditing on the backend.

How it improves task management
- Convert natural language to validated actions and DB updates.
- Provide contextual summaries (pending, overdue, delegated).
- Preserve audit trails and permissions while providing quick answers.

---

## 3. Main Features

- Create task using natural language
- Update task title
- Update due date
- Update priority
- Update status
- Track assigned tasks (my tasks)
- Track delegated tasks (tasks I delegated)
- Track overdue tasks
- Show pending tasks
- Show completed tasks
- Show employee workload
- Checklist creation
- Checklist tracking and verification
- Admin task tracking (see all employees)
- Permission-based responses (clear ownership/visibility notes)
- Smart summary responses (totals by status)
- Chat history support (persist chats & messages)
- URL-based chat opening (optional deep links)

---

## 4. Chatbot User Roles

- Admin: Full visibility across all employee tasks and workload. Can perform admin-only actions.
- Employee / Normal user: Can see tasks they own, tasks assigned to them, and tasks they created or delegated.
- Assigned user (Assignee / Doer): The employee to whom a task is assigned.
- Task creator (Delegator): The user who created/delegated the task.
- In-loop user: Users included in the task `in_loop_ids` list for notifications and visibility.


---

## 5. Permission Rules

- Admin can see all tasks and manage them as allowed by admin flows.
- Employee can see:
  1. Tasks assigned to them (doer).
  2. Tasks they created (delegator).
  3. Tasks they assigned to others (delegated by them).
- Employee cannot see unrelated employees’ private tasks.
- If permission is denied, the chatbot returns a clear message like:
  - "You don't have permission to view that task." or
  - "This task is private to another employee."

The backend must always enforce permission checks (do not rely on frontend filtering).

---

## 6. Frontend Flow

1. User opens the chatbot UI (drawer, modal, or page).
2. User types a message and submits.
3. The message is appended locally to the chat window (optimistic UI).
4. Frontend sends the request to `POST /api/chatbot/message` with auth token and session context.
5. Backend authenticates the user, runs the orchestrator which may call one or more tools/handlers.
6. Backend returns a structured response (text + optional cards, lists, quick actions).
7. Frontend renders response using cards (TaskCard / ChecklistCard) and updates history.
8. Frontend supports loading state, error state, and streaming partial responses (SSE/WS) where supported.

UX notes
- Show the source/permission context on task cards ("Assigned to you", "Created by you", "Visible because you are admin").
- Provide quick actions (Mark Done, Reassign, Add remark) where permitted.

---

## 7. Frontend Folder Structure (example)

```
src/
  components/
    chatbot/
      ChatbotButton.jsx        # Floating button or launcher
      ChatbotWindow.jsx        # Chat container + message list
      ChatMessage.jsx          # Single message (user or bot)
      ChatInput.jsx            # Input box with suggestions
      ChatSuggestions.jsx      # Quick suggestion chips
      TaskCard.jsx             # UI card for a task (title/status/priority/due/owner)
      ChecklistCard.jsx        # UI card for checklists
  pages/
    ChatbotPage.jsx           # Optional full page for chatbot
  services/
    chatbotApi.js             # API wrappers (send message, history)
  hooks/
    useChatbot.js             # React hook for chat logic and state
  utils/
    formatChatTime.js        # Helper for formatting dates/times
```

File purposes
- `ChatbotWindow.jsx`: Manages message list, scrolling, and rendering cards.
- `ChatInput.jsx`: Sends messages, shows autocomplete / suggestions.
- `TaskCard.jsx`: Presents task details and quick actions (shows permission context).
- `chatbotApi.js`: Wraps `fetch`/`axios` calls, handles auth token header.
- `useChatbot.js`: Local state (messages, loading), replaying saved history, optimistic UI.

---

## 8. Backend Flow

1. `POST /api/chatbot/message` receives the user's message.
2. Auth middleware validates the JWT/session and attaches `user` object.
3. Chat orchestrator builds the prompt and context (session history, slots).
4. Intent detector chooses which tool(s) to call (e.g., `getMyTasks`, `createTask`).
5. The selected handler validates `args` and resolves names/dates.
6. Permissions validator checks user rights for the requested operation.
7. The handler calls adapter/model functions to read or write the DB.
8. The handler returns structured data to the orchestrator.
9. Response builder formats final text, cards, and quick actions.
10. Response is persisted to chatbot messages and returned to frontend.

Important: the orchestrator may call multiple tools in sequence for complex requests.

---

## 9. Backend Folder Structure (example)

```
Backend/src/modules/chatbot/
  controllers/
    chatbot.controller.js         # Express endpoint handlers
  routes/
    chatbot.routes.js             # Routes mapping
  services/
    ChatOrchestrator.js          # Main orchestrator and tool executor
    intentDetector.js            # Infer intent & entities
    responseBuilder.js           # Format responses and cards
  tools/
    tasks/
      createTask.js
      updateTaskTitle.js
      updateTaskPriority.js
      updateTaskStatus.js
      updateTaskDueDate.js
      getTasks.js
      getDelegatedTasks.js
      getOverdueTasks.js
    checklist/
      createChecklist.js
      updateChecklist.js
      getChecklist.js
    employees/
      listEmployees.js
      getEmployeeWorkload.js
  validators/
    permissions.js               # Permission rules
    toolArgs.js                  # Input validation for tools
  formatters/
    cards.js                     # Card builders for tasks/checklists
    summaryFormatter.js          # Summary text builders
  adapters/
    taskAdapter.js               # SQL + transform for tasks
    checklistAdapter.js
    todoAdapter.js
  tests/
    orchestrator.test.js
    taskCreate.test.js
    taskUpdate.test.js
    permission.test.js
```

Folder purposes
- `controllers`: Express routes that call the orchestrator.
- `services`: Orchestrator & response-building logic.
- `tools`: Small handler files that correspond to business actions; each is authoritative for a single tool.
- `validators`: Validate inputs & check permissions.
- `formatters`: Turn data into UI-friendly cards/text.
- `adapters`: Query DB via models & adapt rows into chatbot objects.
- `tests`: Unit and integration tests for the chatbot logic.

---

## 10. API Documentation (examples)

### POST /api/chatbot/message

Request

```json
{
  "message": "Show me all tasks assigned by me to Adarsh",
  "chatId": "optional-session-id"
}
```

Response (success)

```json
{
  "success": true,
  "reply": "Here are the tasks assigned by you to Adarsh...",
  "data": [ /* array of task objects or card payloads */ ]
}
```

Other endpoints
- `GET /api/chatbot/history?chatId=...` — returns message history for a chat session.
- `POST /api/chatbot/create` — create a new chat session.
- `GET /api/chatbot/open/:chatId` — open chat by id (returns messages/meta).
- `DELETE /api/chatbot/:chatId` — delete chat session (if allowed).

Security
- All endpoints require auth. Use JWT or session cookie.
- Always run permission checks in the tools, not only in controllers.

---

## 11. Database Tables (recommended schema highlights)

### users
- id (PK)
- user_id (ERP id)
- name
- email
- role (admin|employee)
- created_at

### tasks
- id (PK)
- task_title
- description
- delegator_id (user id who created)
- delegator_name
- doer_id (assigned user id)
- doer_name
- due_date (timestamp)
- priority (High|Medium|Low)
- status (Pending|In Progress|Completed|Hold)
- in_loop_ids (integer[])
- created_at
- completed_at
- deleted_at (soft delete)

### checklist_tasks
- id (PK)
- name
- frequency
- created_by
- assignee_id
- due_date
- status

### checklist_items
- id
- checklist_id
- text
- status
- verifier_id

### chatbot_chats
- id
- chat_id (UUID)
- user_id
- title
- created_at

### chatbot_messages
- id
- chat_id (FK)
- sender (user|bot)
- message_text
- payload (json optional card data)
- created_at

---

## 12. Chatbot Intent Examples

| User Message | Detected Intent | Backend Tool | Expected Result |
|---|---:|---|---|
| "Create a task for Adarsh to check attendance tomorrow" | create_task | `createTask` | Task created for Adarsh with due date = tomorrow |
| "Update task ID 20 priority to High" | update_task_priority | `updateTaskPriority` | Task ID 20 updated to priority = High |
| "Show pending tasks assigned by me to Adarsh" | list_tasks | `getTasks` | List of pending tasks where delegator = me and doer = Adarsh |
| "Show my overdue tasks" | list_overdue | `getOverdueTasks` | List of tasks assigned to me and overdue |
| "Show workload of all employees" | workload | `getEmployeeWorkload` | Aggregated workload per employee (admin only) |
| "Create checklist for ERP validation" | create_checklist | `createChecklist` | Checklist created with default frequency |
| "What tasks has Adarsh completed that I assigned?" | report | `getTasks` | List of completed tasks where delegator = me and doer = Adarsh |

---

## 13. Natural Language Rules

- "high priority" → priority = `High`
- "low priority" → priority = `Low`
- "completed" → status = `Completed`
- "pending" → status = `Pending`
- "tomorrow morning" → due date = tomorrow (morning default time)
- "today evening" → due date = today (evening default time)
- "assigned by me" → use logged-in user id as `delegator_id`
- "my tasks" → use logged-in user id as `doer_id` or `delegator_id` depending on intent

Date parsing and timezone
- The backend should use a consistent timezone (IST for this project). Convert all natural language date phrases into DB timestamps before querying.

---

## 14. Response Format Rules

- Use card layout for tasks: show `title`, `status`, `priority`, `due date`, `assigned to`, `assigned by`, brief `description`.
- For summary queries show totals first, then a short breakdown:
  - Total, Completed, Pending, Overdue
- For tracking queries group by status: Completed / Pending / Overdue / In Progress.
- Avoid duplicate tasks (dedupe by `id`).
- Always surface permission context on the card (e.g., "Assigned to you", "Created by you", "Visible to admin").

---

## 15. Test Cases

### Task Creation
- Create a task with title, assignee, priority, due date. Expect DB insert and returned summary card.
- Create a task without priority. Expect default priority `Medium`.
- Create a task with in-loop user. Expect `in_loop_ids` populated.
- Create a task from a natural sentence.

### Task Update
- Update title by task ID: assert DB update and response contains new title.
- Update priority by task ID.
- Update due date by task ID.
- Update status by task ID.
- Try updating task without permission: expect permission denied response and no DB change.

### Task Tracking
- Show my tasks: returns only tasks I can see.
- Show my pending tasks.
- Show my completed tasks.
- Show my overdue tasks.
- Show tasks assigned by me to Adarsh.
- Show completed tasks assigned by me to Adarsh.
- Show overdue tasks assigned by me to Adarsh.

### Admin
- Admin can see all tasks.
- Admin can see employee workload.
- Admin can track specific employee tasks.
- Admin can list employees.

### Employee Permission
- Employee cannot see unrelated employee tasks.
- Employee can see tasks created by them.
- Employee can see tasks assigned to them.
- Employee can see tasks assigned by them.

### Checklist
- Create checklist from natural language.
- Show checklist items.
- Update checklist item status.
- Track pending checklist.
- Track completed checklist.

### Chat History
- Create new chat.
- Save user message.
- Save bot response.
- Open chat by chatId.
- Only logged-in user can access their own chat.

---

## 16. Example Chatbot Conversations

**Example 1**

User: "Show me all tasks assigned by me to Adarsh."

Bot:
```
Here is the summary of tasks assigned by you to Adarsh:
- Total Tasks: 12
- Completed: 6
- Pending: 4
- Overdue: 2
(Then list top 5 tasks as TaskCards)
```

**Example 2**

User: "Create a task for Adarsh to check attendance tomorrow morning"

Bot:
```
I have created the task for Adarsh — Due: 30/05/2026 9:00 AM — Priority: Medium.
Would you like to add a description or add someone in loop?
```

---

## 17. Error Handling

- Database error: log the DB error and return `"Internal server error"` to user with a friendly message.
- Invalid task ID: return `"Task not found"` or `"Invalid task ID"` (do not expose stack traces).
- Missing assignee: ask the user to clarify or return `"Assignee not found"`.
- Multiple employee name matches: ask user to choose from matches.
- Permission denied: return `"You don't have permission to view or edit this task."`.
- Empty chatbot message: return `"Please type a message"`.
- API failure / Network error: return a friendly retry message.

---

## 18. Security Rules

- Always verify logged-in user via auth middleware (JWT/session).
- Never trust `userId` from frontend; derive user from token.
- Use role-based permission checks in `validators/permissions.js`.
- Sanitize user input before using in SQL.
- Validate tool arguments strictly using `toolArgs` validators.
- Return generic errors to frontend; keep detailed logs server-side.
- Do not include private task data in responses unless permission checks pass.

---

## 19. How to Run Project

### Frontend

```bash
cd DTA_ERP
npm install
npm run dev
```

### Backend

```bash
cd ERP/Backend
npm install
npm run dev
```

Example `.env` values

```
PORT=5000
DATABASE_URL=postgres://user:pass@localhost:5432/erp
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
```

---

## 20. How to Add a New Chatbot Feature

1. Add the intent pattern / examples to your intent detector and system prompts.
2. Add a new tool handler in `tools/` implementing argument validation and permission checks.
3. Add adapter code if DB queries are needed.
4. Add response formatter for cards or summary.
5. Add frontend card/component if the result needs a visual card.
6. Add unit and integration tests under `tests/`.
7. Deploy and monitor logs for errors.

---

## 21. Future Improvements

- Voice input + speech-to-text for hands-free usage.
- Integrate external task sources (GitHub issues, JIRA) for cross-platform tracking.
- Improve AI task summarization and reasoning.
- Reminder and notification system for overdue/pending tasks.
- Analytics dashboard for chat usage and task action metrics.
- Token usage and cost tracking for OpenAI/tool calls.

---

## 22. Final Notes

This README aims to provide a complete, beginner-friendly guide to the ERP chatbot implementation, its flows, and how to extend it. If you want this saved as `README.md` at a different location, tell me where and I'll move it.

---

*Generated on 2026-05-29*
