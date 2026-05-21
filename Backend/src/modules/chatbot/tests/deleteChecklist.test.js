const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../../../config/db.config');
const deleteChecklist = require('../tools/handlers/deleteChecklist');

test('deleteChecklist: does not delete weak one-word match for multi-word query', async () => {
  const originalQuery = db.query;
  const queries = [];

  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/SELECT id, question/i.test(sql)) {
      return { rows: [{ id: 1, question: 'Test' }] };
    }
    if (/DELETE FROM checklist/i.test(sql)) {
      throw new Error('delete should not run for weak match');
    }
    return { rows: [] };
  };

  try {
    const result = await deleteChecklist(
      { name: 'website testing' },
      { user_id: 5, name: 'Test User' }
    );

    assert.equal(result.ok, false);
    assert.equal(result.notFound, true);
    assert.equal(queries.some((query) => /DELETE FROM checklist/i.test(query.sql)), false);
  } finally {
    db.query = originalQuery;
  }
});

test('deleteChecklist: deletes strong checklist name match', async () => {
  const originalQuery = db.query;
  const queries = [];

  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/SELECT id, question/i.test(sql)) {
      return {
        rows: [
          { id: 1, question: 'Test' },
          { id: 2, question: 'Website Testing' },
        ],
      };
    }
    if (/DELETE FROM checklist/i.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  };

  try {
    const result = await deleteChecklist(
      { name: 'website testing' },
      { user_id: 5, name: 'Test User' }
    );

    assert.equal(result.ok, true);
    assert.equal(result.checklistId, 2);
    assert.equal(result.checklistName, 'Website Testing');
    const deleteQuery = queries.find((query) => /DELETE FROM checklist/i.test(query.sql));
    assert.ok(deleteQuery);
    assert.deepEqual(deleteQuery.params, [2, 5, 'test user']);
  } finally {
    db.query = originalQuery;
  }
});

test('deleteChecklist: admin can delete strong checklist match from all checklists', async () => {
  const originalQuery = db.query;
  const queries = [];

  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (/SELECT id, question/i.test(sql)) {
      assert.doesNotMatch(sql, /assignee_id = \$1 OR doer_id = \$1/);
      return {
        rows: [
          { id: 749, question: 'Website Testing' },
          { id: 1, question: 'Test' },
        ],
      };
    }
    if (/DELETE FROM checklist/i.test(sql)) {
      return { rows: [] };
    }
    return { rows: [] };
  };

  try {
    const result = await deleteChecklist(
      { name: 'website testing' },
      { user_id: 5, role: 'Admin', name: 'Bhumika Girhare' }
    );

    assert.equal(result.ok, true);
    assert.equal(result.checklistId, 749);
    assert.equal(result.checklistName, 'Website Testing');
    const deleteQuery = queries.find((query) => /DELETE FROM checklist/i.test(query.sql));
    assert.ok(deleteQuery);
    assert.deepEqual(deleteQuery.params, [749]);
  } finally {
    db.query = originalQuery;
  }
});
