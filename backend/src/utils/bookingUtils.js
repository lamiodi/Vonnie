/**
 * Booking utility functions for generating unique booking numbers
 * Replaces frontend localStorage dependency with server-side generation
 */

/**
 * Get the next sequential number for a given name prefix
 * @param {string} prefix - Name prefix (e.g., 'JOHN', 'MARY')
 * @returns {Promise<number>} Next sequential number
 */
const getNextSequenceNumber = async (prefix) => {
  try {
    const { query } = await import('../config/db.js');
    
    // Get the highest existing number for this prefix
    const result = await query(
      `SELECT booking_number FROM bookings 
       WHERE booking_number LIKE $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [`${prefix}-%`]
    );
    
    if (result.rows.length === 0) {
      return 1; // First booking for this prefix
    }
    
    // Extract number from existing booking (format: PREFIX-###)
    const lastBookingNumber = result.rows[0].booking_number;
    const numberMatch = lastBookingNumber.match(/-(\d+)$/);
    
    if (numberMatch) {
      const lastNumber = parseInt(numberMatch[1]);
      return lastNumber + 1;
    }
    
    return 1; // Fallback if pattern doesn't match
  } catch (error) {
    console.error('Error getting next sequence number:', error);
    return 1; // Fallback to 1 on error
  }
};

/**
 * Generate a unique booking number with format: NamePrefix-Increment
 * Format: [CustomerNamePrefix]-[SequentialNumber]
 * Example: JOHN-001, MARY-002, etc.
 * 
 * @param {string} customerName - Customer name to extract prefix from
 * @returns {string} Unique booking number
 */
export const generateBookingNumberWithName = async (customerName) => {
  // Extract first 3-4 characters from customer name (uppercase, alphanumeric only)
  const namePrefix = customerName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(3, 'X'); // Ensure at least 3 characters
  
  // Get the next sequential number for this prefix
  const nextNumber = await getNextSequenceNumber(namePrefix);
  
  return `${namePrefix}-${nextNumber.toString().padStart(3, '0')}`;
};

/**
 * Generate a booking number with specific prefix for different booking types
 * @param {string} type - Booking type ('walk-in', 'pre-booked', 'online')
 * @returns {string} Unique booking number with type prefix
 */
export const generateTypedBookingNumber = (type) => {
  const timestamp = Date.now().toString().slice(-6); // Last 6 digits for shorter timestamp
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // 3-digit random
  
  const prefixMap = {
    'walk-in': 'VW',
    'pre-booked': 'VP',
    'online': 'VO'
  };
  
  const prefix = prefixMap[type] || 'VN';
  return `${prefix}${timestamp}${random}`;
};

/**
 * Validate booking number format
 * @param {string} bookingNumber - Booking number to validate
 * @returns {boolean} True if valid format
 */
export const isValidBookingNumber = (bookingNumber) => {
  if (!bookingNumber || typeof bookingNumber !== 'string') {
    return false;
  }
  
  // Check for standard format: VN + 8 digits + 2 digits
  const standardFormat = /^VN\d{8}\d{2}$/;
  
  // Check for typed format: V[WPON] + 6 digits + 3 digits
  const typedFormat = /^V[WPON]\d{6}\d{3}$/;
  
  return standardFormat.test(bookingNumber) || typedFormat.test(bookingNumber);
};

/**
 * Check if booking number already exists in database
 * @param {string} bookingNumber - Booking number to check
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
export const bookingNumberExists = async (bookingNumber) => {
  try {
    const { query } = await import('../config/db.js');
    const result = await query(
      'SELECT COUNT(*) as count FROM bookings WHERE booking_number = $1',
      [bookingNumber]
    );
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error('Error checking booking number existence:', error);
    return false; // Assume doesn't exist on error
  }
};

/**
 * Generate a unique booking number that doesn't exist in database
 * @param {string} type - Optional booking type for typed generation
 * @returns {Promise<string>} Unique booking number
 */
export const generateUniqueBookingNumber = async (type = null) => {
  let bookingNumber;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    bookingNumber = type ? generateTypedBookingNumber(type) : generateBookingNumber();
    attempts++;
    
    // Check if it exists
    const exists = await bookingNumberExists(bookingNumber);
    if (!exists) {
      return bookingNumber;
    }
    
    // Add small delay to ensure different timestamp on rapid retries
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  } while (attempts < maxAttempts);
  
  // Fallback: generate with extended timestamp if all attempts failed
  const fallbackTimestamp = Date.now().toString();
  const fallbackRandom = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `VN${fallbackTimestamp.slice(-10)}${fallbackRandom}`;
};