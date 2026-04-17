const { pool } = require("../config/db.config");

/**
 * Create chatbot conversations table
 * This table stores all chatbot interactions for analytics and debugging
 */
const createChatbotConversationsTable = async () => {
  try {
    const query = `
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
    `;

    await pool.query(query);
    console.log("✅ Chatbot conversations table created successfully");
  } catch (error) {
    console.error("❌ Error creating chatbot conversations table:", error);
  }
};

module.exports = { createChatbotConversationsTable };