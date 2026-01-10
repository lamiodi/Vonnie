import { jest } from '@jest/globals';

// Define mocks
const mockQuery = jest.fn();
const mockAxiosGet = jest.fn();

// Mock dependencies
jest.unstable_mockModule('../src/config/db.js', () => ({
  query: mockQuery
}));

jest.unstable_mockModule('axios', () => ({
  default: {
    get: mockAxiosGet
  }
}));

// Import service after mocking
const { verifyPaymentWithFallbacks } = await import('../src/services/paymentService.js');

describe('PaymentService', () => {
  const REFERENCE = 'REF_123';
  const PAYSTACK_SECRET = 'secret';

  beforeAll(() => {
    process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should verify payment via Paystack API (Primary Method)', async () => {
    mockAxiosGet.mockResolvedValueOnce({
      data: {
        data: {
          status: 'success',
          reference: REFERENCE,
          amount: 500000
        }
      }
    });

    const result = await verifyPaymentWithFallbacks(REFERENCE);

    expect(result.success).toBe(true);
    expect(result.method).toBe('paystack_api');
    expect(mockAxiosGet).toHaveBeenCalledWith(
      expect.stringContaining(`/transaction/verify/${REFERENCE}`),
      expect.objectContaining({
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
      })
    );
  });

  it('should fallback to Webhook if Paystack API fails', async () => {
    // API fails
    mockAxiosGet.mockRejectedValueOnce(new Error('API Error'));

    // Webhook query returns success
    mockQuery.mockResolvedValueOnce({
      rows: [{
        event: 'charge.success',
        reference: REFERENCE,
        data: { status: 'success' }
      }]
    });

    const result = await verifyPaymentWithFallbacks(REFERENCE);

    expect(result.success).toBe(true);
    expect(result.method).toBe('webhook_fallback');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM payment_webhooks'),
      [REFERENCE]
    );
  });

  it('should fallback to Booking Status if Webhook fails', async () => {
    // API fails
    mockAxiosGet.mockRejectedValueOnce(new Error('API Error'));

    // Webhook query returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // Booking query returns success
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 1,
        booking_number: 'BK-123',
        payment_status: 'completed',
        payment_reference: REFERENCE
      }]
    });

    const result = await verifyPaymentWithFallbacks(REFERENCE);

    expect(result.success).toBe(true);
    expect(result.method).toBe('booking_status_fallback');
    expect(mockQuery).toHaveBeenCalledTimes(2); // Webhook + Booking
  });

  it('should return failure if all methods fail', async () => {
    // API fails
    mockAxiosGet.mockRejectedValueOnce(new Error('API Error'));
    // Webhook query returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // Booking query returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await verifyPaymentWithFallbacks(REFERENCE);

    expect(result.success).toBe(false);
    expect(result.method).toBe('all_methods_failed');
  });
});
