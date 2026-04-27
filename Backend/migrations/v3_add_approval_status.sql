-- Migration: Add approval_status to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED'));
