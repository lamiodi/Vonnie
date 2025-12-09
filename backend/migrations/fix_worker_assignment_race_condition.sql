-- Fix race condition in worker assignment system
-- This migration adds critical constraints to prevent double-booking

-- 1. Add unique constraint to prevent active double-bookings
-- This ensures a worker can only have one active assignment
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_worker_assignment 
ON booking_workers (worker_id) 
WHERE status = 'active';

-- 2. Add composite index for efficient conflict detection
-- This improves performance of availability checks
CREATE INDEX IF NOT EXISTS idx_booking_workers_worker_status_active
ON booking_workers (worker_id, status) 
WHERE status = 'active';

-- 3. Add index for time-based conflict queries
-- This helps with the validateBookingTimeConflict function
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_time_status
ON bookings (scheduled_time, status)
WHERE status IN ('scheduled', 'in-progress', 'confirmed');

-- 4. Add partial index for active bookings by worker
-- This optimizes worker availability queries
CREATE INDEX IF NOT EXISTS idx_booking_workers_active_bookings
ON booking_workers (worker_id, booking_id, status)
WHERE status = 'active';

-- 5. Add constraint to ensure data integrity
-- This prevents invalid status transitions
ALTER TABLE booking_workers 
ADD CONSTRAINT check_valid_status 
CHECK (status IN ('active', 'cancelled', 'completed'));

-- 6. Add trigger to automatically cancel previous assignments
-- This ensures only one active assignment per worker
CREATE OR REPLACE FUNCTION prevent_multiple_active_assignments()
RETURNS TRIGGER AS $func$
BEGIN
  -- If inserting an active assignment, cancel any existing active ones
  IF NEW.status = 'active' THEN
    UPDATE booking_workers 
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE worker_id = NEW.worker_id 
      AND status = 'active' 
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Create trigger for the function
DROP TRIGGER IF EXISTS trigger_prevent_multiple_active_assignments ON booking_workers;
CREATE TRIGGER trigger_prevent_multiple_active_assignments
  BEFORE INSERT OR UPDATE ON booking_workers
  FOR EACH ROW
  EXECUTE FUNCTION prevent_multiple_active_assignments();

-- 7. Add index for worker current_status updates
-- This helps when updating worker status to 'busy'
CREATE INDEX IF NOT EXISTS idx_users_current_status
ON users (current_status, is_active)
WHERE role = 'staff' AND is_active = true;