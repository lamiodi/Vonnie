import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

// Define mocks
const mockQuery = jest.fn();
const mockSendWebhookAlert = jest.fn();

// Mock dependencies
jest.unstable_mockModule('../src/config/db.js', () => ({
  query: mockQuery
}));

jest.unstable_mockModule('../src/services/email.js', () => ({
  sendWebhookAlert: mockSendWebhookAlert
}));

// Import the router after mocking
const { default: paymentWebhooks } = await import('../src/routes/payment-webhooks.js');

const app = express();
app.use('/api/webhooks', paymentWebhooks);

describe('Payment Webhooks', () => {
  const SECRET = 'test_secret_key';
  
  beforeAll(() => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a fallback transaction when no booking or transaction matches', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        reference: 'REF_123456',
        amount: 500000, // 5000.00
        customer: {
          email: 'customer@example.com'
        },
        metadata: {}
      }
    };

    const signature = crypto
      .createHmac('sha512', SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Mock query responses
    // 1. Log webhook
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // 2. Update pos_transactions (returns 0 rows -> not found)
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    // 3. Update bookings (returns 0 rows -> not found)
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    // 4. Insert fallback transaction
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const response = await request(app)
      .post('/api/webhooks/paystack-webhook')
      .set('x-paystack-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);

    // Verify fallback transaction creation
    const calls = mockQuery.mock.calls;
    const insertCall = calls.find(call => call[0].includes('INSERT INTO pos_transactions'));
    
    expect(insertCall).toBeDefined();
    expect(insertCall[1]).toContain('paystack');
    expect(insertCall[1]).toContain('completed');
    expect(insertCall[1]).toContain('REF_123456');
    expect(insertCall[1]).toContain(5000); // 500000 / 100
  });
});
