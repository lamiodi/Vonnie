import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import request from 'supertest';
import { query, getClient } from '../src/config/database.js';
import posRouter from '../src/routes/pos.js';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());

// Mock user middleware for req.user
app.use((req, res, next) => {
  // We'll set a default user, but the auth middleware in pos.js will override this 
  // if it verifies the token.
  // However, pos.js uses `authenticate` middleware which we imported.
  // If we can't easily mock `authenticate` (it's imported in pos.js),
  // we must provide a valid token in the request.
  next();
});

app.use('/api/pos', posRouter);

async function runTest() {
  console.log('Starting POS Fix Verification Test...');
  let client;
  let bookingId;
  let serviceId;
  let staffId;
  let transactionId;

  try {
    client = await getClient();
    
    // 1. Get a staff user
    const userRes = await query("SELECT id FROM users WHERE role IN ('manager', 'admin') LIMIT 1");
    if (userRes.rows.length === 0) {
      throw new Error('No manager/admin found to test with.');
    }
    staffId = userRes.rows[0].id;
    console.log(`Using staff ID: ${staffId}`);

    // 2. Create a test service
    const serviceRes = await query("INSERT INTO services (name, price, duration, is_active) VALUES ('Test POS Fix Service', 5000, 60, true) RETURNING id");
    serviceId = serviceRes.rows[0].id;

    // 3. Create a test booking with 'completed' status
    const testBookingNumber = `TEST-POS-${Date.now()}`;
    const bookingRes = await query(`
      INSERT INTO bookings (
        booking_number, customer_name, customer_email, customer_phone, 
        customer_type, scheduled_time, worker_id, 
        status, payment_status, total_amount, created_at, updated_at
      ) VALUES (
        $1, 'Test Customer', 'test@example.com', '1234567890',
        'walk_in', NOW(), $2,
        'completed', 'pending', 5000, NOW(), NOW()
      ) RETURNING *
    `, [testBookingNumber, staffId]);
    
    const booking = bookingRes.rows[0];
    bookingId = booking.id;
    
    // Link service
    await query(`
      INSERT INTO booking_services (booking_id, service_id, quantity, unit_price, total_price)
      VALUES ($1, $2, 1, 5000, 5000)
    `, [bookingId, serviceId]);
    
    console.log(`Created test booking: ${booking.booking_number} with status: ${booking.status}`);

    // 4. Generate valid token
    const token = jwt.sign({ id: staffId, role: 'manager' }, process.env.JWT_SECRET || 'test_secret');

    // 5. Send POS checkout request
    console.log('Sending POS checkout request...');
    const res = await request(app)
      .post('/api/pos/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({
        booking_number: testBookingNumber,
        staff_id: staffId,
        payment_method: 'bank_transfer_pos',
        payment_status: 'completed',
        items: [],
        customer_info: {
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '1234567890'
        }
      });

    console.log('Response status:', res.status);
    
    if (res.status === 201) {
      console.log('✅ TEST PASSED: POS checkout successful for completed booking.');
      console.log('Response:', JSON.stringify(res.body, null, 2));
      if (res.body.data && res.body.data.id) {
        transactionId = res.body.data.id;
      }
    } else {
      console.error('❌ TEST FAILED: POS checkout failed.');
      console.error('Error Response:', JSON.stringify(res.body, null, 2));
    }

  } catch (error) {
    console.error('Test execution error:', error);
  } finally {
    // Cleanup
    try {
      if (transactionId) {
        await query('DELETE FROM pos_transactions WHERE id = $1', [transactionId]);
      }
      if (bookingId) {
         // booking_services should cascade delete
         await query('DELETE FROM bookings WHERE id = $1', [bookingId]);
      }
      if (serviceId) {
        await query('DELETE FROM services WHERE id = $1', [serviceId]);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    if (client) client.release();
    process.exit(0);
  }
}

runTest();
