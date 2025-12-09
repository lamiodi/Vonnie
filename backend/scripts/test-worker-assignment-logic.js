
import { query } from '../src/config/db.js';
import { validateWorkerAvailabilityWithLocking } from '../src/services/validationService.js';

async function runTests() {
  console.log('🚀 Starting Worker Assignment Logic Tests...');
  
  let workerId;
  let booking1Id;
  let booking2Id;
  
  try {
    // 1. Setup: Get a worker (Amaka)
    const workerRes = await query(`SELECT id, name FROM users WHERE name LIKE 'Amaka%' LIMIT 1`);
    if (workerRes.rows.length === 0) {
      console.error('❌ Worker Amaka not found');
      process.exit(1);
    }
    workerId = workerRes.rows[0].id;
    console.log(`👷 Testing with worker: ${workerRes.rows[0].name}`);

    // 2. Create Booking 1 (Today 10:00 - 11:00)
    const b1 = await query(`
      INSERT INTO bookings (
        customer_name, customer_email, customer_phone, total_amount, status, booking_number, 
        scheduled_time, duration, payment_status, customer_type
      ) VALUES (
        'Test 1', 't1@example.com', '000', 1000, 'scheduled', $1, 
        NOW() + INTERVAL '1 hour', 60, 'pending', 'pre_booked'
      ) RETURNING id, scheduled_time, duration
    `, ['TEST-1-' + Date.now()]);
    booking1Id = b1.rows[0].id;
    console.log(`📅 Created Booking 1: ${b1.rows[0].scheduled_time} (60 mins)`);

    // 3. Assign Worker to Booking 1
    // We simulate the assignment by inserting into booking_workers
    await query(`
      INSERT INTO booking_workers (booking_id, worker_id, status, role)
      VALUES ($1, $2, 'active', 'primary')
    `, [booking1Id, workerId]);
    console.log('✅ Assigned worker to Booking 1');

    // 4. Test Case A: Assign to Booking 2 (Non-overlapping, Today 12:00 - 13:00)
    // This should SUCCEED
    console.log('\n🧪 Test Case A: Non-overlapping booking (Should SUCCEED)');
    const b2 = await query(`
      INSERT INTO bookings (
        customer_name, customer_email, customer_phone, total_amount, status, booking_number, 
        scheduled_time, duration, payment_status, customer_type
      ) VALUES (
        'Test 2', 't2@example.com', '000', 1000, 'scheduled', $1, 
        NOW() + INTERVAL '3 hours', 60, 'pending', 'pre_booked'
      ) RETURNING id, scheduled_time, duration
    `, ['TEST-2-' + Date.now()]);
    booking2Id = b2.rows[0].id;
    
    const resultA = await validateWorkerAvailabilityWithLocking(
      [workerId],
      b2.rows[0].scheduled_time,
      60,
      booking2Id,
      null
    );

    if (resultA.isValid) {
      console.log('✅ PASSED: Non-overlapping assignment is valid.');
    } else {
      console.error('❌ FAILED: Non-overlapping assignment was rejected!', resultA);
    }

    // 5. Test Case B: Assign to Booking 3 (Overlapping with Booking 1, Today 10:30 - 11:30)
    // This should FAIL
    console.log('\n🧪 Test Case B: Overlapping booking (Should FAIL)');
    const b3Time = new Date(new Date(b1.rows[0].scheduled_time).getTime() + 30 * 60000); // +30 mins
    
    const resultB = await validateWorkerAvailabilityWithLocking(
      [workerId],
      b3Time,
      60,
      null, // New booking
      null
    );

    if (!resultB.isValid) {
      console.log('✅ PASSED: Overlapping assignment was rejected.');
    } else {
      console.error('❌ FAILED: Overlapping assignment was accepted!', resultB);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    if (booking1Id) await query('DELETE FROM bookings WHERE id = $1', [booking1Id]);
    if (booking2Id) await query('DELETE FROM bookings WHERE id = $1', [booking2Id]);
    process.exit(0);
  }
}

runTests();
