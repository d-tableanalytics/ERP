-- Migration: Add actioned_by tracking to tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS actioned_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS actioned_at TIMESTAMP;
