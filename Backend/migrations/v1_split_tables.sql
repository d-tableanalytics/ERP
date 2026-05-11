-- Migration: Split Task and Delegation tables

-- 1. Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    task_title VARCHAR(255) NOT NULL,
    description TEXT,
    delegator_id INTEGER,
    delegator_name VARCHAR(255),
    doer_id INTEGER,
    doer_name VARCHAR(255),
    department VARCHAR(100),
    priority VARCHAR(50) CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent', 'low', 'medium', 'high', 'urgent')),
    category VARCHAR(100),
    tags JSONB DEFAULT '[]',
    checklist JSONB DEFAULT '[]',
    status VARCHAR(50) CHECK (status IN ('Pending', 'pending', 'NEED CLARITY', 'need clarity', 'APPROVAL WAITING', 'approval waiting', 'COMPLETED', 'Completed', 'completed', 'NEED REVISION', 'need revision', 'HOLD', 'Hold', 'hold', 'In Progress', 'in progress', 'Overdue', 'overdue')) DEFAULT 'Pending',
    due_date TIMESTAMPTZ NOT NULL,
    voice_note_url TEXT,
    reference_docs TEXT[],
    evidence_url TEXT,
    evidence_required BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    remarks TEXT[] DEFAULT '{}',
    revision_count INTEGER DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    deleted_by VARCHAR(255),
    subscribed_by INTEGER[] DEFAULT '{}',
    in_loop_ids INTEGER[] DEFAULT '{}',
    group_id INTEGER,
    parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    repeat_settings JSONB DEFAULT '{}'
);

-- 2. Create task_remarks table
CREATE TABLE IF NOT EXISTS task_remarks (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER,
    username VARCHAR(100),
    remark TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create task_revision_history table
CREATE TABLE IF NOT EXISTS task_revision_history (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    old_due_date TIMESTAMPTZ,
    new_due_date TIMESTAMPTZ,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    reason TEXT,
    changed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create task_reminders table (pointing to tasks)
CREATE TABLE IF NOT EXISTS task_reminders_new (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    time_value INTEGER NOT NULL,
    time_unit VARCHAR(50) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    reminder_time TIMESTAMPTZ NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Migrate data from delegation to tasks
INSERT INTO tasks (
    id, task_title, description, delegator_id, delegator_name,
    doer_id, doer_name, department, priority, category,
    tags, checklist, status, due_date, voice_note_url,
    reference_docs, evidence_url, evidence_required, created_at,
    completed_at, remarks, revision_count, deleted_at,
    deleted_by, subscribed_by, in_loop_ids, group_id, repeat_settings
)
SELECT 
    id, delegation_name, description, delegator_id, delegator_name,
    doer_id, doer_name, department, priority, category,
    tags, checklist, status, due_date, voice_note_url,
    reference_docs, evidence_url, evidence_required, created_at,
    completed_at, remarks, revision_count, deleted_at,
    deleted_by, subscribed_by, in_loop_ids, group_id, repeat_settings
FROM delegation
WHERE record_source = 'task';

-- Reset serial sequence for tasks table
SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));

-- 6. Migrate remarks
INSERT INTO task_remarks (task_id, user_id, username, remark, created_at)
SELECT delegation_id, user_id, username, remark, created_at
FROM remark
WHERE delegation_id IN (SELECT id FROM tasks);

-- 7. Migrate revision history
INSERT INTO task_revision_history (task_id, old_due_date, new_due_date, old_status, new_status, reason, changed_by, created_at)
SELECT delegation_id, old_due_date, new_due_date, old_status, new_status, reason, changed_by, created_at
FROM revision_history
WHERE delegation_id IN (SELECT id FROM tasks);

-- 8. Migrate reminders
INSERT INTO task_reminders_new (task_id, type, time_value, time_unit, trigger_type, reminder_time, is_sent, created_at, updated_at)
SELECT delegation_id, type, time_value, time_unit, trigger_type, reminder_time, is_sent, created_at, updated_at
FROM task_reminders
WHERE delegation_id IN (SELECT id FROM tasks);

-- 9. Cleanup legacy table
DELETE FROM remark WHERE delegation_id IN (SELECT id FROM tasks);
DELETE FROM revision_history WHERE delegation_id IN (SELECT id FROM tasks);
DELETE FROM task_reminders WHERE delegation_id IN (SELECT id FROM tasks);
DELETE FROM delegation WHERE record_source = 'task';

-- 10. Finalize reminders table name
-- We can either drop the old task_reminders and rename task_reminders_new
-- OR just keep task_reminders pointing to delegation for delegations.
-- For strict separation, let's keep task_reminders for delegations (renaming it maybe?) 
-- and use task_reminders_new for tasks.
-- Actually, the name task_reminders is more suitable for tasks.
-- Let's rename existing task_reminders to delegation_reminders
ALTER TABLE task_reminders RENAME TO delegation_reminders;
ALTER TABLE task_reminders_new RENAME TO task_reminders;

-- 11. Rename revision_history to delegation_revision_history
ALTER TABLE revision_history RENAME TO delegation_revision_history;

-- 12. Rename remark to delegation_remarks
ALTER TABLE remark RENAME TO delegation_remarks;
