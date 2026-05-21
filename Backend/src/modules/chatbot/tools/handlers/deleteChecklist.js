const db = require('../../../../config/db.config');
const { validate } = require('../../validators/toolArgs');
const { isAdmin, resolveUserId } = require('../../validators/permissions');

const schema = {
  checklistId: { type: 'integer', min: 1 },
  name: { type: 'string', max: 200 },
};

module.exports = async function deleteChecklist(args, user, ctx = {}) {
  const v = validate(args || {}, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };
  const admin = isAdmin(user);
  const currentUserName = normalizePersonName(userName(user));

  const checklistId = v.value.checklistId || ctx?.slots?.selectedChecklistId || null;
  const name = cleanChecklistDeleteName(v.value.name);
  let target = null;
  let suggestions = [];

  if (checklistId) {
    const { rows } = admin
      ? await db.query(
        `SELECT id, question
           FROM checklist
          WHERE id = $1`,
        [checklistId]
      )
      : await db.query(
        `SELECT id, question
           FROM checklist
          WHERE id = $1
            AND (assignee_id = $2 OR doer_id = $2 OR verifier_id = $2
              OR lower(trim(COALESCE(assignee_name, ''))) = $3
              OR lower(trim(COALESCE(doer_name, ''))) = $3
              OR lower(trim(COALESCE(verifier_name, ''))) = $3)`,
        [checklistId, userId, currentUserName]
      );
    target = rows[0] || null;
  }

  if (!target && name) {
    const { rows } = admin
      ? await db.query(
        `SELECT id, question
           FROM checklist
          ORDER BY id DESC
          LIMIT 500`
      )
      : await db.query(
        `SELECT id, question
           FROM checklist
          WHERE assignee_id = $1 OR doer_id = $1 OR verifier_id = $1
             OR lower(trim(COALESCE(assignee_name, ''))) = $2
             OR lower(trim(COALESCE(doer_name, ''))) = $2
             OR lower(trim(COALESCE(verifier_name, ''))) = $2
          ORDER BY id DESC
          LIMIT 500`,
        [userId, currentUserName]
      );
    target = findStrongChecklistMatch(name, rows);
    if (target) {
      // matched strongly enough to delete
    }
    else suggestions = suggestChecklistNames(name, rows);
  }

  if (!target) {
    return {
      ok: false,
      notFound: true,
      message: name
        ? `Checklist not found. Please mention the exact checklist name.`
        : `No target checklist context found to delete. Please mention the checklist name.`,
      suggestions,
    };
  }

  if (admin) {
    await db.query(`DELETE FROM checklist WHERE id = $1`, [target.id]);
  } else {
    await db.query(
      `DELETE FROM checklist
        WHERE id = $1
          AND (assignee_id = $2 OR doer_id = $2 OR verifier_id = $2
            OR lower(trim(COALESCE(assignee_name, ''))) = $3
            OR lower(trim(COALESCE(doer_name, ''))) = $3
            OR lower(trim(COALESCE(verifier_name, ''))) = $3)`,
      [target.id, userId, currentUserName]
    );
  }

  return {
    ok: true,
    checklistId: target.id,
    checklistName: target.question,
    message: 'Checklist deleted successfully.',
    slot: {
      lastEntity: 'checklist',
      selectedChecklistId: null,
      selectedChecklistName: null,
    },
  };
};

function cleanChecklistDeleteName(name = '') {
  return String(name || '')
    .replace(/^\s*(i\s+want\s+to\s+)?(?:delete|remove|cancel)\s+/i, '')
    .replace(/\bchecklists?\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function suggestChecklistNames(query, rows, limit = 3) {
  const queryTokens = new Set(normalize(query).split(' ').filter((token) => token.length > 2));
  if (!queryTokens.size) return [];

  return (rows || [])
    .map((row) => {
      const name = row.question || '';
      const titleTokens = new Set(normalize(name).split(' ').filter((token) => token.length > 2));
      const overlap = [...queryTokens].filter((token) => titleTokens.has(token)).length;
      return { name, score: overlap / Math.max(1, queryTokens.size) };
    })
    .filter((item) => item.name && item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((item) => item.name);
}

function findStrongChecklistMatch(query, rows = []) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return null;

  const exact = rows.find((row) => normalize(row.question || '') === normalizedQuery);
  if (exact) return exact;

  const queryTokens = tokens(normalizedQuery);
  if (!queryTokens.length) return null;

  const candidates = rows
    .map((row) => {
      const normalizedTitle = normalize(row.question || '');
      const titleTokens = tokens(normalizedTitle);
      const shared = queryTokens.filter((token) => titleTokens.includes(token));
      const allQueryTokensMatch = shared.length === queryTokens.length;
      const coverage = shared.length / queryTokens.length;
      const extraTokens = titleTokens.filter((token) => !queryTokens.includes(token)).length;
      return { row, normalizedTitle, titleTokens, allQueryTokensMatch, coverage, extraTokens };
    })
    .filter((item) => {
      if (!item.normalizedTitle) return false;
      if (item.normalizedTitle.includes(normalizedQuery) && queryTokens.length >= 2) return true;
      return item.allQueryTokensMatch && queryTokens.length >= 2;
    })
    .sort((a, b) => b.coverage - a.coverage || a.extraTokens - b.extraTokens);

  return candidates[0]?.row || null;
}

function tokens(value = '') {
  return normalize(value).split(' ').filter((token) => token.length > 2);
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(checklist|the|a|an|please|delete|remove|cancel|called|named|title|name|is)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function userName(user) {
  const parts = [
    user?.first_name || user?.firstName || user?.First_Name || user?.name || user?.email,
    user?.last_name || user?.lastName || user?.Last_Name,
  ].filter(Boolean);
  return parts.join(' ').trim() || '';
}

function normalizePersonName(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}
