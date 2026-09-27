-- One-time cleanup: close out booking_workers rows left 'active' forever by
-- completed/cancelled bookings. These stale rows made workers appear busy to
-- availability checks that count any active assignment.

-- 1. Close assignments belonging to finished bookings
UPDATE booking_workers bw
SET status = b.status
FROM bookings b
WHERE b.id = bw.booking_id
  AND bw.status = 'active'
  AND b.status IN ('completed', 'cancelled');

-- 2. Free workers still marked 'busy' who have no live booking left
UPDATE users u
SET current_status = 'available',
    updated_at = CURRENT_TIMESTAMP
WHERE u.current_status = 'busy'
  AND u.role = 'staff'
  AND NOT EXISTS (
    SELECT 1
    FROM booking_workers bw
    JOIN bookings b ON b.id = bw.booking_id
    WHERE bw.worker_id = u.id
      AND bw.status = 'active'
      AND b.status IN ('scheduled', 'in-progress')
  );
