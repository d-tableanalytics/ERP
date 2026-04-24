-- Migration: Remove legacy columns after architectural split

-- 1. Remove record_source column from delegation table
-- This column is no longer needed as tasks and delegations are now in separate tables.
ALTER TABLE delegation DROP COLUMN IF EXISTS record_source;

-- 2. Optional: Clean up any other legacy columns if identified
-- (Based on current audit, only record_source in delegation was found)

-- 3. Verify constraints
-- Ensure that delegation_status_check and delegation_priority_check remain intact (they should).
