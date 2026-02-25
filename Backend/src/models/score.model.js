const db = require('../config/db.config');

const createScoreTable = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        total_tasks INTEGER DEFAULT 0,
        pending_score NUMERIC(5,2),
        late_score NUMERIC(5,2),
        completed_score NUMERIC(5,2),
        red_count INTEGER DEFAULT 0,
        yellow_count INTEGER DEFAULT 0,
        green_count INTEGER DEFAULT 0,
        calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    `;
    try {
        await db.query(query);
        console.log('Scores table ensured in database');
    } catch (err) {
        console.error('Error creating scores table:', err);
        throw err;
    }
};

const saveScore = async (scoreData) => {
    const query = `
        INSERT INTO scores (user_id, total_tasks, pending_score, late_score, completed_score, red_count, yellow_count, green_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
    const values = [
        scoreData.userId,
        scoreData.totalTasks,
        scoreData.pendingScore,
        scoreData.lateScore,
        scoreData.completedScore,
        scoreData.redCount,
        scoreData.yellowCount,
        scoreData.greenCount
    ];
    const result = await db.query(query, values);
    return result.rows[0];
};

const getConsolidatedTasks = async (userId, role) => {
    let delegationQuery = 'SELECT id, delegation_name, doer_name, due_date, status, completed_at, created_at, revision_count, \'delegation\' as source FROM delegation';
    let checklistQuery = 'SELECT id, question as delegation_name, doer_name, due_date, status, completed_at, created_at, revision_count, \'checklist\' as source FROM checklist';
    
    let params = [];
    if (role !== 'Admin' && role !== 'SuperAdmin') {
        delegationQuery += ' WHERE doer_id = $1 OR delegator_id = $1';
        checklistQuery += ' WHERE doer_id = $1 OR assignee_id = $1 OR verifier_id = $1';
        params = [userId];
    }

    const [delegations, checklists] = await Promise.all([
        db.query(delegationQuery, params),
        db.query(checklistQuery, params)
    ]);

    return [...delegations.rows, ...checklists.rows];
};

module.exports = {
    createScoreTable,
    saveScore,
    getConsolidatedTasks
};
