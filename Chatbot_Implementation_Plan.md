# Chatbot Implementation Plan for DTA_RACPL

## 1. Overall Architecture Overview

The chatbot will be implemented as a **fully modular and isolated feature** that integrates minimally with the existing ERP system. It will follow these principles:

- **Modularity**: All chatbot code resides in dedicated `chatbot/` folders in both frontend and backend
- **Isolation**: No tight coupling with existing modules; uses existing infrastructure (auth, database) but doesn't modify it
- **Scalability**: Designed for easy upgrades from rule-based to AI-powered responses using OpenAI API
- **Security**: Leverages existing JWT auth and role-based access; adds specific privacy controls; OpenAI API key stored securely in backend only
- **Maintainability**: Clear separation of concerns with dedicated routes, controllers, services, and UI components

**High-Level Integration Points:**
- Frontend: Light integration into `MainLayout.jsx` (add floating widget component)
- Backend: New `/api/chatbot` routes registered in `Index.js`
- Database: New dedicated tables with foreign keys to existing `employees` table
- State: New Redux slice for chat state, independent of existing slices
- OpenAI: Backend-only integration with secure API key management and response safeguards

## 2. Frontend Implementation Plan

### Folder Structure
```
DTA_ERP/src/
├── features/chatbot/                    # Dedicated chatbot module
│   ├── components/
│   │   ├── ChatbotWidget.jsx           # Main floating widget component
│   │   ├── ChatMessage.jsx             # Individual message component
│   │   ├── ChatInput.jsx               # Input field with send button
│   │   └── ChatHistory.jsx             # Scrollable message list
│   ├── store/
│   │   └── chatbotSlice.js             # Redux slice for chat state
│   ├── services/
│   │   └── chatbotService.js           # API service layer
│   ├── utils/
│   │   └── intentParser.js             # Client-side intent helpers (optional)
│   └── index.js                        # Module exports
```

### Key Components

**ChatbotWidget.jsx** (Main Component):
- Floating bubble (64px circle) positioned bottom-right
- Expands to 400px modal on click
- Manages open/close state, message history display
- Integrates with Redux for state management

**Redux Slice (chatbotSlice.js)**:
- State: `{ messages: [], isOpen: false, isTyping: false }`
- Actions: `sendMessage`, `receiveMessage`, `toggleWidget`, `clearHistory`
- Async thunks: `sendMessageThunk` (calls API, updates state)

**Service Layer (chatbotService.js)**:
- `sendMessage(message)`: POST to `/api/chatbot/message`
- `getHistory()`: GET to `/api/chatbot/history`
- Error handling with user-friendly messages

### Integration Points (Minimal Changes)
- **MainLayout.jsx**: Add `<ChatbotWidget />` component at the end of the layout (no other modifications)
- **store/store.js**: Import and add `chatbotSlice` to the store configuration
- **No changes** to existing components, routes, or state slices

## 3. Backend Implementation Plan

### Folder Structure
```
Backend/src/
├── modules/chatbot/                     # Dedicated chatbot module
│   ├── chatbot.routes.js                # Route definitions
│   ├── chatbot.controller.js            # Business logic
│   ├── chatbot.service.js               # Core chatbot logic
│   ├── chatbot.utils.js                 # Helper functions
│   └── index.js                         # Module exports
```

### Module Components

**chatbot.routes.js**:
- `POST /message`: Handle incoming messages
- `GET /history`: Retrieve conversation history
- Uses existing auth middleware for JWT verification
- Optional: Add rate limiting middleware (express-rate-limit)

**chatbot.controller.js**:
- `handleMessage(req, res)`: Validate input, call service, log conversation, return response
- `getHistory(req, res)`: Fetch user's conversation history with pagination
- Error handling: Return structured error responses
- Role-based filtering: Ensure users only access their own data

**chatbot.service.js** (Core Logic):
- `processMessage(userId, message, userRole)`: Main processing function
- Intent detection: Rule-based keyword matching with optional OpenAI fallback
- Response generation: Template-based with user context, or OpenAI-generated with safeguards
- Data fetching: Safe queries with user filtering
- Fallback handling: Default responses for unknown intents, graceful OpenAI failure handling
- OpenAI integration: Secure API calls with prompt engineering for company-specific responses

**chatbot.openai.js** (OpenAI Service Wrapper):
- `callOpenAI(prompt, context)`: Secure OpenAI API calls using environment variable API key
- Prompt structuring: System instructions limiting responses to project/company topics
- Response validation: Filter out inappropriate content, enforce data privacy
- Cost optimization: Token usage monitoring, conversation length limits
- Error handling: Fallback to rule-based responses if OpenAI fails

**chatbot.utils.js**:
- `parseIntent(message)`: Extract keywords and map to intents
- `buildResponse(intent, context)`: Generate response text
- `sanitizeInput(message)`: Basic input validation and sanitization

### Integration Points (Minimal Changes)
- **Index.js**: Add `app.use('/api/chatbot', chatbotRoutes)` after existing route registrations
- **No changes** to existing controllers, routes, or middleware

## 4. Database Implementation Plan

### New Tables (Dedicated Schema)
```sql
-- Conversation logging table
CREATE TABLE chatbot_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    intent VARCHAR(50),
    confidence DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_intent (intent)
);

-- Optional: FAQ knowledge base (for future AI upgrades)
CREATE TABLE chatbot_faq (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_active (is_active)
);
```

### Model File
- **chatbot.model.js**: Table creation SQL (added to existing model pattern)
- Placed in `Backend/src/models/chatbot.model.js`
- Called during app startup alongside existing models

### Data Flow
- Conversations logged automatically on each message
- User context (role, department) used for filtering responses
- No modifications to existing tables or relationships

## 5. Chatbot Logic Implementation Plan

### Intent Detection (Rule-Based)
**Intent Categories:**
- `navigation`: "How do I...", "Where can I..."
- `status`: "How many...", "What's my..."
- `faq`: "What is...", "Policy on..."
- `help`: "Help me...", "Guide for..."
- `unknown`: Fallback

**Keyword Mapping:**
```javascript
const INTENT_MAP = {
  navigation: ['how do i', 'where can i', 'how to'],
  status: ['how many', 'what\'s my', 'show me', 'pending'],
  faq: ['what is', 'policy', 'company', 'business hours'],
  help: ['help', 'guide', 'steps', 'create']
};
```

### Response Generation
**Template System:**
- Responses use placeholders: `{user_name}`, `{count}`, `{module_name}`
- Context-aware: Pull user-specific data (delegations count, ticket status)
- Role-filtered: Admin sees different responses than Employee

**Safe Data Fetching:**
- All queries include `WHERE user_id = ?` or role-appropriate filters
- Aggregate functions only (COUNT, SUM) to avoid exposing sensitive data
- No direct table access; use existing controller patterns

### Fallback Strategy
- Unknown intents: "I'm not sure about that. Try asking about delegations, help tickets, or company policies."
- Suggest escalation: "For complex issues, please create a help ticket."
- Log unknown queries for future FAQ additions

## 5.1 OpenAI Integration Details

### API Key Management
- **Environment Variable**: Store `OPENAI_API_KEY` in backend `.env` file (never in frontend or version control)
- **Secure Loading**: Use `process.env.OPENAI_API_KEY` in backend only
- **No Frontend Exposure**: API key never sent to client-side code

### Backend Service Wrapper
**chatbot.openai.js**:
- Singleton service class for OpenAI API calls
- Configurable model (GPT-4 for quality, GPT-3.5-turbo for cost optimization)
- Request/response logging for debugging and cost tracking
- Timeout handling (30-second limit per request)
- Retry logic with exponential backoff for transient failures

### Prompt Engineering for Company-Specific Responses
**System Prompt Structure**:
```
You are a helpful assistant for DTA_RACPL ERP system employees.
You can only answer questions about:
- Company policies and procedures
- ERP system usage and navigation
- Employee tasks and workflows
- General company information

You CANNOT:
- Access or discuss sensitive employee data
- Provide financial information
- Answer questions outside company/ERP context
- Engage in inappropriate conversations

If asked about restricted topics, politely decline and redirect to appropriate channels.
Always be professional, helpful, and concise.
```

**User Context Injection**:
- Include user role, department, and relevant task counts in prompts
- Filter responses based on user permissions
- Maintain conversation context for multi-turn discussions

### Response Validation & Safeguards
- **Content Filtering**: Check for inappropriate language or off-topic responses
- **Data Privacy**: Ensure no sensitive information is leaked in AI responses
- **Fallback Mechanism**: If OpenAI response fails validation, use rule-based fallback
- **Confidence Scoring**: Log AI confidence levels for quality monitoring

### Cost Control & Token Optimization
- **Token Limits**: Maximum 1000 tokens per conversation turn
- **Conversation Length**: Limit to 10 exchanges per session
- **Caching**: Cache common FAQ responses to reduce API calls
- **Usage Monitoring**: Track monthly token consumption and costs
- **Rate Limiting**: 5 OpenAI calls per minute per user to control costs

### Fallback Behavior
- **OpenAI Failure**: Automatic fallback to rule-based responses
- **Network Issues**: Retry with backoff, then fallback
- **Rate Limits**: Queue requests or fallback to cached responses
- **Invalid Responses**: Validation failures trigger rule-based backup
- **User Notification**: Transparent messaging about fallback usage

### Logging & Error Handling
- **Request Logging**: Log all OpenAI API calls with user ID, prompt, response, tokens used
- **Error Tracking**: Separate logs for OpenAI failures vs. application errors
- **Performance Metrics**: Response time, success rate, token usage per conversation
- **Audit Trail**: Maintain conversation history for compliance and debugging

---

## 6. Step-by-Step Execution Plan

**Recommended Starting Approach**: Begin with **pure rule-based MVP first, then add OpenAI as a hybrid enhancement**. This approach minimizes risks, allows quick deployment, and provides a safety net for OpenAI failures.

### Phase 1: Basic Rule-Based Chatbot MVP (2-3 weeks)
1. **Database Setup**:
   - Create `chatbot_conversations` table
   - Add model file and register in startup

2. **Backend Scaffold**:
   - Create `modules/chatbot/` folder structure
   - Implement basic routes and controller
   - Add hardcoded responses for 5-7 intents
   - Register routes in `Index.js`

3. **Frontend Scaffold**:
   - Create `features/chatbot/` folder structure
   - Build basic ChatbotWidget component
   - Add Redux slice and integrate into store
   - Add widget to MainLayout (minimal integration)

4. **Basic Logic**:
   - Implement keyword-based intent detection
   - Add template responses for navigation and status queries
   - Test end-to-end message flow

5. **Testing**: Unit tests for intent detection, API endpoints, component rendering

### Phase 2: Enhanced Chatbot with Context (4-6 weeks)
1. **Context-Aware Responses**:
   - Add database queries for user-specific data (delegation counts, ticket status)
   - Implement role-based response variations
   - Add conversation memory (last 10 messages)

2. **Improved UI**:
   - Add typing indicators, message timestamps
   - Implement conversation history persistence
   - Add quick action buttons (e.g., "View Delegations")

3. **FAQ System**:
   - Create `chatbot_faq` table
   - Add admin endpoints for FAQ management
   - Integrate FAQ lookup into response generation

4. **Error Handling**:
   - Add comprehensive error responses
   - Implement rate limiting (10 messages/minute per user)
   - Add conversation quality metrics

5. **Testing**: Integration tests, user acceptance testing

### Phase 3: Hybrid AI-Enhanced Chatbot (6-8 weeks)
1. **OpenAI Integration Setup**:
   - Add OpenAI service wrapper (`chatbot.openai.js`)
   - Configure environment variables for API key
   - Implement prompt engineering with company-specific restrictions
   - Add response validation and safeguards

2. **Hybrid Logic Implementation**:
   - Extend `chatbot.service.js` to attempt OpenAI for unknown intents
   - Implement fallback chain: Rule-based → OpenAI → Default response
   - Add conversation context passing to OpenAI for better responses
   - Integrate user context (role, department) into prompts

3. **Advanced Features**:
   - Multi-turn conversations with context memory
   - Proactive suggestions based on user behavior
   - Sentiment analysis for escalation detection
   - FAQ semantic search using OpenAI embeddings

4. **Cost & Performance Optimization**:
   - Implement token usage monitoring and limits
   - Add response caching for common queries
   - Rate limiting for OpenAI API calls
   - Performance metrics and cost tracking

5. **Testing & Monitoring**:
   - OpenAI-specific error handling tests
   - Response validation testing
   - Cost monitoring dashboard
   - User feedback collection for AI response quality

## 7. Risk Mitigation Plan

### Data Privacy & Security
- **Role-Based Filtering**: All data queries include user_id and role checks
- **Input Sanitization**: Strip HTML, limit message length (500 chars)
- **Audit Logging**: All conversations logged with timestamps for compliance
- **No Sensitive Data**: Never expose salaries, personal info, or other users' data

### OpenAI-Specific Risks
- **API Key Security**: Never log or expose API key; use environment variables only
- **Cost Overruns**: Implement strict token limits and usage monitoring; set monthly budgets
- **Response Hallucinations**: Validate all AI responses against known facts and privacy rules
- **API Reliability**: Robust fallback to rule-based responses; handle rate limits gracefully
- **Data Privacy**: Sanitize all prompts and responses; never include sensitive user data in OpenAI calls
- **Model Bias/Errors**: Human oversight for AI responses; logging for continuous improvement
- **Vendor Lock-in**: Design wrapper to allow switching to other AI providers if needed

### Performance Optimization
- **Database Indexing**: Add indexes on user_id, created_at for fast queries
- **Caching**: Cache FAQ data and common responses in memory; cache OpenAI responses for repeated queries
- **Rate Limiting**: 10 messages/minute per user; separate limits for OpenAI calls (5/minute)
- **Async Processing**: Non-blocking message processing; queue OpenAI requests during high load
- **Token Optimization**: Truncate conversation history; use efficient prompt structures

### Error Handling & Reliability
- **Graceful Degradation**: If chatbot fails, show user-friendly error message
- **Fallback Responses**: Always provide a response, never crash
- **Monitoring**: Log errors and performance metrics
- **Rollback Plan**: Feature flag to disable chatbot if issues arise

### Scalability Considerations
- **Modular Design**: Easy to add new intents without touching existing code
- **Database Growth**: Archive old conversations after 90 days
- **API Design**: RESTful endpoints allow future mobile/web extensions
- **AI Upgrade Path**: Service layer designed for easy AI integration

## 8. Testing and Deployment Plan

### Testing Strategy
- **Unit Tests**: Intent detection, response generation, API validation, OpenAI wrapper testing
- **Integration Tests**: End-to-end message flows, database operations, OpenAI API mocking
- **OpenAI-Specific Tests**: Prompt validation, response filtering, fallback behavior, cost monitoring
- **User Acceptance**: Beta testing with select users; A/B testing rule-based vs. AI responses
- **Performance Tests**: Load testing with concurrent users; OpenAI API latency testing
- **Security Tests**: API key protection, prompt injection prevention, response sanitization

### Deployment Approach
- **Feature Flag**: Deploy behind a feature flag for gradual rollout; separate flag for OpenAI features
- **Staged Rollout**: Rule-based only first, then enable OpenAI for 10% of users, monitor closely
- **Monitoring**: Track usage metrics, error rates, user satisfaction, OpenAI costs and performance
- **Rollback**: Ability to disable OpenAI instantly if issues occur; fallback to rule-based only
- **Documentation**: Update API documentation with new endpoints; document OpenAI integration for maintenance

### Maintenance Plan
- **Regular Updates**: Monitor unknown intents to add new FAQs
- **Performance Monitoring**: Track response times and database load
- **Security Audits**: Regular reviews of data access patterns
- **User Feedback**: Collect feedback for continuous improvement

This implementation plan ensures the chatbot is a clean, maintainable addition to the DTA_RACPL system while preserving all existing functionality and architecture patterns. The hybrid approach (rule-based foundation with OpenAI enhancement) provides the best balance of reliability, cost control, and advanced capabilities.