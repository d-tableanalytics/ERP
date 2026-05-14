const { pool } = require("../config/db.config");

/**
 * Create chatbot conversations table (legacy log) + the v2 tables:
 *   - chatbot_sessions   : one row per conversation thread (slot context in JSONB)
 *   - chatbot_messages   : turn-by-turn log (user/assistant/tool)
 *   - chatbot_knowledge  : structured KB with tsvector for full-text search
 *
 * All statements are idempotent — safe to re-run on every boot.
 */
const createChatbotConversationsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
        message_text TEXT NOT NULL,
        response_text TEXT NOT NULL,
        intent VARCHAR(50),
        response_type VARCHAR(20) DEFAULT 'rule-based',
        openai_tokens INTEGER DEFAULT 0,
        confidence DECIMAL(3,2) DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_user_created ON chatbot_conversations (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_intent ON chatbot_conversations (intent);
      CREATE INDEX IF NOT EXISTS idx_response_type ON chatbot_conversations (response_type);
    `);

    // v2: ensure pgcrypto so gen_random_uuid() is available
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    // v2: sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_sessions (
        session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       INTEGER NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
        title         TEXT,
        context_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
        last_activity TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_user
        ON chatbot_sessions (user_id, last_activity DESC);
    `);

    // v2: messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_messages (
        id           SERIAL PRIMARY KEY,
        session_id   UUID NOT NULL REFERENCES chatbot_sessions(session_id) ON DELETE CASCADE,
        user_id      INTEGER NOT NULL,
        role         VARCHAR(16) NOT NULL,
        content      TEXT,
        tool_calls   JSONB,
        tool_name    VARCHAR(64),
        tool_result  JSONB,
        intent       VARCHAR(64),
        confidence   NUMERIC(3,2),
        tokens_in    INTEGER,
        tokens_out   INTEGER,
        latency_ms   INTEGER,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session
        ON chatbot_messages (session_id, created_at);
    `);

    // v2: knowledge base with generated tsvector column
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_knowledge (
        id         SERIAL PRIMARY KEY,
        topic      VARCHAR(128) NOT NULL UNIQUE,
        module     VARCHAR(64),
        question   TEXT NOT NULL,
        answer     TEXT NOT NULL,
        keywords   TEXT[],
        search_vec TSVECTOR
                  GENERATED ALWAYS AS (
                    setweight(to_tsvector('english', coalesce(topic,'')), 'A') ||
                    setweight(to_tsvector('english', coalesce(question,'')), 'B') ||
                    setweight(to_tsvector('english', coalesce(answer,'')), 'C')
                  ) STORED,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chatbot_knowledge_search
        ON chatbot_knowledge USING GIN (search_vec);
    `);

    console.log("✅ Chatbot v2 tables ready (conversations, sessions, messages, knowledge)");

    // Seed the KB from the legacy static knowledge (idempotent).
    try {
      const kbRepo = require("../modules/chatbot/repositories/kbRepository");
      await kbRepo.seedFromLegacy();
    } catch (seedErr) {
      console.warn("⚠️  Chatbot KB seed skipped:", seedErr.message);
    }
  } catch (error) {
    console.error("❌ Error creating chatbot tables:", error);
  }
};

module.exports = { createChatbotConversationsTable };
