const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../../../config/db.config');
const employeeAdapter = require('../adapters/employeeAdapter');
const createChecklist = require('../tools/handlers/createChecklist');

test('createChecklist: duplicate title for current doer is not inserted', async () => {
  const originalQuery = db.query;
  const originalSearch = employeeAdapter.search;
  const originalFindById = employeeAdapter.findById;
  const originalPool = db.pool;
  let insertAttempted = false;

  db.query = async (sql) => {
    assert.match(sql, /FROM checklist/i);
    return {
      rows: [{
        id: 42,
        question: 'ERP Validation Work',
        assignee_name: 'Aashu Yadav',
        doer_name: 'Bhumika Girhare',
        priority: 'medium',
        frequency: 'daily',
        due_date: '2026-05-21 18:00:00',
        status: 'Pending',
      }],
    };
  };
  db.pool = {
    connect: async () => {
      insertAttempted = true;
      throw new Error('insert should not be attempted for duplicate checklist');
    },
  };
  employeeAdapter.search = async (name) => [{ id: 7, name: name === 'Aashu' ? 'Aashu Yadav' : name }];
  employeeAdapter.findById = async () => ({ id: 5, name: 'Bhumika Girhare' });

  try {
    const result = await createChecklist(
      { question: 'ERP Validation Work', assignee: 'Aashu', dueDate: 'today 6 pm' },
      { user_id: 5, name: 'Bhumika Girhare' }
    );

    assert.equal(result.ok, true);
    assert.equal(result.duplicate, true);
    assert.equal(result.message, 'Checklist already exists. Please make a new checklist.');
    assert.equal(insertAttempted, false);
  } finally {
    db.query = originalQuery;
    db.pool = originalPool;
    employeeAdapter.search = originalSearch;
    employeeAdapter.findById = originalFindById;
  }
});
