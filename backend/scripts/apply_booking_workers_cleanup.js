// Applies migrations/cleanup_stale_booking_workers.sql — closes stale active
// booking_workers rows and frees workers stuck in 'busy' with no live booking.
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, getClient } from '../src/config/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(join(__dirname, '..', 'migrations', 'cleanup_stale_booking_workers.sql'), 'utf8')
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const before = await query(
    `SELECT
       (SELECT COUNT(*) FROM booking_workers bw JOIN bookings b ON b.id = bw.booking_id
         WHERE bw.status = 'active' AND b.status IN ('completed', 'cancelled')) AS stale_rows,
       (SELECT COUNT(*) FROM users u WHERE u.current_status = 'busy' AND u.role = 'staff'
         AND NOT EXISTS (SELECT 1 FROM booking_workers bw JOIN bookings b ON b.id = bw.booking_id
           WHERE bw.worker_id = u.id AND bw.status = 'active' AND b.status IN ('scheduled','in-progress'))) AS stuck_workers`
  );
  console.log('Before:', before.rows[0]);

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ cleanup_stale_booking_workers applied');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  const after = await query(
    `SELECT
       (SELECT COUNT(*) FROM booking_workers bw JOIN bookings b ON b.id = bw.booking_id
         WHERE bw.status = 'active' AND b.status IN ('completed', 'cancelled')) AS stale_rows,
       (SELECT COUNT(*) FROM users u WHERE u.current_status = 'busy' AND u.role = 'staff'
         AND NOT EXISTS (SELECT 1 FROM booking_workers bw JOIN bookings b ON b.id = bw.booking_id
           WHERE bw.worker_id = u.id AND bw.status = 'active' AND b.status IN ('scheduled','in-progress'))) AS stuck_workers`
  );
  console.log('After:', after.rows[0]);
  process.exit();
}

main().catch(error => {
  console.error('❌ Unexpected error:', error.message);
  process.exit(1);
});
