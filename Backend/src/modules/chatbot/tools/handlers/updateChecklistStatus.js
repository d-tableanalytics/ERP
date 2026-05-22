const db = require('../../../../config/db.config');
const { validate } = require('../../validators/toolArgs');
const { resolveUserId } = require('../../validators/permissions');
const { bestMatch } = require('../../utils/fuzzy');

const schema = {
  checklistId: { type: 'integer', min: 1 },
  name: { type: 'string' },
  status: { type: 'string', enum: ['Pending', 'In Progress', 'Completed', 'Hold'] },
};

module.exports = async function updateChecklistStatus(args, user) {
  const normalizedArgs = {
    ...(args || {}),
    status: normalizeChecklistStatus(args?.status),
  };
  const v = validate(normalizedArgs, schema);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };

  const userId = resolveUserId(user);
  if (!userId) return { ok: false, error: 'Authentication required.' };

  const { checklistId, name, status } = v.value;
  if (!status) return { ok: false, error: 'Status is required.' };

  const target = await findChecklist({ userId, checklistId, name });
  if (!target) {
    return {
      ok: true,
      notFound: true,
      message: 'Checklist not found. Please mention the exact checklist name.',
    };
  }

  const previousStatus = target.status || 'Pending';
  const completedAt = status === 'Completed' ? new Date() : null;
  const { rows } = await db.query(
    `UPDATE checklist
        SET status = $1,
            completed_at = $2
      WHERE id = $3
      RETURNING id, question, status`,
    [status, completedAt, target.id]
  );

  const updated = rows[0] || target;
  return {
    ok: true,
    checklistId: updated.id,
    checklistName: updated.question || target.question,
    previousStatus,
    newStatus: status,
    slot: {
      pendingAction: null,
      targetType: null,
      targetId: null,
      targetName: null,
      previousStatus: null,
      lastEntity: 'checklist',
      selectedChecklistId: updated.id,
      selectedChecklistName: updated.question || target.question,
      lastStatus: status,
    },
  };
};

function normalizeChecklistStatus(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'complete' || text === 'completed') return 'Completed';
  if (text === 'pending') return 'Pending';
  if (text === 'in progress') return 'In Progress';
  if (text === 'hold' || text === 'on hold') return 'Hold';
  return value;
}

async function findChecklist({ userId, checklistId, name }) {
  if (checklistId) {
    const { rows } = await db.query(
      `SELECT id, question, status
         FROM checklist
        WHERE id = $1
          AND (assignee_id = $2 OR doer_id = $2 OR verifier_id = $2)`,
      [checklistId, userId]
    );
    return rows[0] || null;
  }

  if (!name) return null;

  const { rows } = await db.query(
    `SELECT id, question, status
       FROM checklist
      WHERE assignee_id = $1 OR doer_id = $1 OR verifier_id = $1
      ORDER BY id DESC
      LIMIT 100`,
    [userId]
  );
  const match = bestMatch(name, rows, (row) => row.question || '');
  return match?.item || null;
}
