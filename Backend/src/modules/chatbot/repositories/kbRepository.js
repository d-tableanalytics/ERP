const db = require('../../../config/db.config');
const logger = require('../utils/logger');

/**
 * Knowledge-base repository. Backs the `getHelpGuidance` tool.
 * - tsvector full-text search ranks topic > question > answer.
 * - Idempotent seeder mirrors the static knowledge into the DB at boot.
 */

async function search(query, { limit = 3 } = {}) {
  if (!query) return [];
  const { rows } = await db.query(
    `SELECT id, topic, module, question, answer, keywords,
            ts_rank(search_vec, websearch_to_tsquery('english', $1)) AS rank
       FROM chatbot_knowledge
      WHERE search_vec @@ websearch_to_tsquery('english', $1)
      ORDER BY rank DESC
      LIMIT $2`,
    [query, limit]
  );
  return rows;
}

async function upsert({ topic, module = null, question, answer, keywords = [] }) {
  await db.query(
    `INSERT INTO chatbot_knowledge (topic, module, question, answer, keywords)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (topic) DO UPDATE
       SET module = EXCLUDED.module,
           question = EXCLUDED.question,
           answer = EXCLUDED.answer,
           keywords = EXCLUDED.keywords`,
    [topic, module, question, answer, keywords]
  );
}

/**
 * Seed the KB from the legacy static array (chatbot.knowledge.js).
 * Safe to run multiple times — uses UPSERT by topic.
 */
async function seedFromLegacy() {
  let legacy;
  try {
    legacy = require('../chatbot.knowledge');
  } catch (err) {
    logger.warn('Legacy KB not found; skipping seed', { err: err.message });
    return;
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return;

  for (const entry of legacy) {
    const topic = String(entry.title || '').slice(0, 128);
    if (!topic) continue;
    const moduleName = inferModule(entry.keywords || []);
    const question = (entry.keywords && entry.keywords[0]) || topic;
    const answer = flattenContent(entry.content);
    try {
      await upsert({ topic, module: moduleName, question, answer, keywords: entry.keywords || [] });
    } catch (err) {
      logger.warn('KB seed entry failed', { topic, err: err.message });
    }
  }
  logger.info('Chatbot KB seeded', { entries: legacy.length });
}

function inferModule(keywords) {
  const k = (keywords || []).join(' ').toLowerCase();
  if (k.includes('checklist')) return 'checklist';
  if (k.includes('delegation') || k.includes('delegate')) return 'delegation';
  if (k.includes('task')) return 'task';
  if (k.includes('attendance')) return 'attendance';
  if (k.includes('ticket')) return 'help_ticket';
  if (k.includes('dashboard')) return 'dashboard';
  return null;
}

function flattenContent(content) {
  if (!content) return '';
  const parts = [];
  if (content.intro) parts.push(content.intro);
  if (Array.isArray(content.steps)) {
    content.steps.forEach((s, i) => parts.push(`${i + 1}. ${s}`));
  } else if (typeof content.steps === 'string') {
    parts.push(content.steps);
  }
  if (Array.isArray(content.notes)) {
    parts.push('Notes:');
    content.notes.forEach((n) => parts.push(`• ${n}`));
  }
  if (content.closing) parts.push(content.closing);
  return parts.join('\n');
}

module.exports = { search, upsert, seedFromLegacy };
