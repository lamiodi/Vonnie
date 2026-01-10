import { jest } from '@jest/globals';

// Define mocks before imports
const mockQuery = jest.fn();
const mockGetClient = jest.fn();
const mockSendEmail = jest.fn();
const mockGenerateUniqueBookingNumber = jest.fn().mockResolvedValue('BK-12345');
const mockGenerateBookingNumberWithName = jest.fn().mockResolvedValue('TEST-12345');

jest.unstable_mockModule('../src/config/db.js', () => ({
  query: mockQuery,
  getClient: mockGetClient
}));

jest.unstable_mockModule('../src/services/email.js', () => ({
  sendEmail: mockSendEmail
}));

jest.unstable_mockModule('../src/utils/bookingUtils.js', () => ({
  generateUniqueBookingNumber: mockGenerateUniqueBookingNumber,
  generateBookingNumberWithName: mockGenerateBookingNumberWithName
}));

// Dynamic import after mocking
const { createBooking } = await import('../src/services/bookingService.js');

describe('BookingService', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock client for transactions
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    mockGetClient.mockResolvedValue(mockClient);
  });

  describe('createBooking', () => {
    const validBookingData = {
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      customer_phone: '1234567890',
      customer_type: 'walk_in',
      scheduled_time: '2025-01-01T10:00:00Z',
      service_ids: [1, 2],
      notes: 'Test notes'
    };

    it('should successfully create a walk-in booking', async () => {
      // Mock services query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Service 1', price: 1000, duration: 60 },
          { id: 2, name: 'Service 2', price: 2000, duration: 30 }
        ]
      });

      // Mock transaction queries
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ // INSERT booking
          rows: [{
            id: 1,
            booking_number: 'TEST-12345',
            customer_name: 'Test Customer',
            status: 'pending_confirmation',
            total_amount: 3000
          }]
        })
        .mockResolvedValueOnce() // INSERT service 1
        .mockResolvedValueOnce() // INSERT service 2
        .mockResolvedValueOnce(); // COMMIT

      const result = await createBooking(validBookingData);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, name, price, duration FROM services'),
        [[1, 2]]
      );

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      
      expect(result).toHaveProperty('id', 1);
      expect(result.total_amount).toBe(3000);
      expect(mockSendEmail).toHaveBeenCalled();
    });

    it('should throw error if required fields are missing', async () => {
      const invalidData = { ...validBookingData };
      delete invalidData.customer_name;

      await expect(createBooking(invalidData)).rejects.toHaveProperty('status', 400);
    });

    it('should throw error if services are invalid', async () => {
      // Mock services query returning fewer services than requested
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Service 1', price: 1000, duration: 60 }
        ]
      });

      await expect(createBooking(validBookingData)).rejects.toHaveProperty('message', 'One or more services not found or inactive');
    });

    it('should rollback transaction on error', async () => {
      // Mock services query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Service 1', price: 1000, duration: 60 },
          { id: 2, name: 'Service 2', price: 2000, duration: 30 }
        ]
      });

      // Mock transaction error
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT booking fails

      await expect(createBooking(validBookingData)).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
