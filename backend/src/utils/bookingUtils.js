/**
 * Booking utility functions for generating unique booking numbers
 * Replaces frontend localStorage dependency with server-side generation
 */

/**
 * Generate a unique booking number with format: VN{timestamp}{random}
 * Format: VN + 8-digit timestamp (last 8 chars) + 2-digit random
 * Example: VN1234567890
 * 
 * @returns {string} Unique booking number
 */
export const generateBookingNumber = () => {
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2-digit random
  return `VN${timestamp}${random}`;
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