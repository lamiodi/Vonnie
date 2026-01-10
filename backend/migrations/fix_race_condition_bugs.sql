-- Fix bugs in race condition implementation
-- The previous implementation incorrectly assumed a worker could only have one active assignment globally,
-- preventing multiple future bookings.

-- 1. Drop the overly restrictive unique index
DROP INDEX IF EXISTS unique_active_worker_assignment;

-- 2. Drop the trigger that auto-cancels other active assignments
DROP TRIGGER IF EXISTS trigger_prevent_multiple_active_assignments ON booking_workers;
DROP FUNCTION IF EXISTS prevent_multiple_active_assignments() CASCADE;
