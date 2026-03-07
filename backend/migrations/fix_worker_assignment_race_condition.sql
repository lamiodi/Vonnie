-- Fix worker assignment logic: Allow multiple future bookings, prevent overlaps only
-- Replaces the restrictive 'one active assignment' rule with a time-overlap check

-- 1. Drop the incorrect constraints and triggers if they exist
DROP TRIGGER IF EXISTS trigger_prevent_multiple_active_assignments ON booking_workers;
DROP FUNCTION IF EXISTS prevent_multiple_active_assignments();
DROP INDEX IF EXISTS unique_active_worker_assignment;

-- 2. Create function to check for time overlaps
CREATE OR REPLACE FUNCTION check_worker_booking_overlap()
RETURNS TRIGGER AS $func$
DECLARE
  new_booking_start TIMESTAMP;
  new_booking_duration INTEGER;
  new_booking_end TIMESTAMP;
  conflict_count INTEGER;
BEGIN
  -- Only check for active assignments
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Get time details for the booking being assigned
  SELECT scheduled_time, duration 
  INTO new_booking_start, new_booking_duration
  FROM bookings 
  WHERE id = NEW.booking_id;

  -- If booking doesn't exist (orphan), skip check (FK will handle it if strict)
  IF new_booking_start IS NULL THEN
    RETURN NEW;
  END IF;

  new_booking_end := new_booking_start + (new_booking_duration || ' minutes')::INTERVAL;

  -- Check for any OTHER active assignment for this worker that overlaps
  SELECT COUNT(*)
  INTO conflict_count
  FROM booking_workers bw
  JOIN bookings b ON bw.booking_id = b.id
  WHERE bw.worker_id = NEW.worker_id
    AND bw.status = 'active'
    AND bw.id != NEW.id -- Exclude self if updating
    AND bw.booking_id != NEW.booking_id -- Exclude same booking (redundant but safe)
    AND b.status IN ('scheduled', 'in-progress', 'confirmed') -- Only count valid bookings
    AND (
      (b.scheduled_time, b.scheduled_time + (b.duration || ' minutes')::INTERVAL) 
      OVERLAPS 
      (new_booking_start, new_booking_end)
    );

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Worker is already assigned to another booking during this time slot'
      USING ERRCODE = '23505'; -- Unique violation code used to signal conflict
  END IF;

  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- 3. Create trigger to enforce overlap check
DROP TRIGGER IF EXISTS trigger_check_worker_booking_overlap ON booking_workers;
CREATE TRIGGER trigger_check_worker_booking_overlap
  BEFORE INSERT OR UPDATE ON booking_workers
  FOR EACH ROW
  EXECUTE FUNCTION check_worker_booking_overlap();

-- 4. Keep the useful performance indexes (re-create if missing)
CREATE INDEX IF NOT EXISTS idx_booking_workers_worker_status_active
ON booking_workers (worker_id, status) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_time_status
ON bookings (scheduled_time, status)
WHERE status IN ('scheduled', 'in-progress', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_booking_workers_active_bookings
ON booking_workers (worker_id, booking_id, status)
WHERE status = 'active';

-- 5. Keep the valid status check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_valid_status'
  ) THEN
    ALTER TABLE booking_workers 
    ADD CONSTRAINT check_valid_status 
    CHECK (status IN ('active', 'cancelled', 'completed'));
  END IF;
END $$;
