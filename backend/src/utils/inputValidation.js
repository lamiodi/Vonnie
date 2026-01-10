/**
 * General Input Validation Utilities
 * Provides common validation functions for API endpoints
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return {
      isValid: false,
      message: 'Invalid email format'
    };
  }
  return {
    isValid: true,
    message: 'Email format is valid'
  };
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {Object} Validation result
 */
export function validatePhone(phone) {
  const phoneRegex = /^[\d\s\-\(\)\+]{10,}$/;
  if (!phone || !phoneRegex.test(phone)) {
    return {
      isValid: false,
      message: 'Invalid phone number format (minimum 10 digits required)'
    };
  }
  return {
    isValid: true,
    message: 'Phone number format is valid'
  };
}

/**
 * Validate price format
 * @param {number} price - Price to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validatePrice(price, options = {}) {
  const {
    min = 0,
    max = 10000,
    allowZero = false,
    allowNegative = false
  } = options;

  if (price === null || price === undefined || isNaN(price)) {
    return {
      isValid: false,
      message: 'Price must be a valid number'
    };
  }

  if (!allowNegative && price < 0) {
    return {
      isValid: false,
      message: 'Price cannot be negative'
    };
  }

  if (!allowZero && price === 0) {
    return {
      isValid: false,
      message: 'Price cannot be zero'
    };
  }

  if (price < min) {
    return {
      isValid: false,
      message: `Price must be at least ${min}`
    };
  }

  if (price > max) {
    return {
      isValid: false,
      message: `Price cannot exceed ${max}`
    };
  }

  // Check for reasonable decimal places (max 2)
  if (price.toString().split('.')[1]?.length > 2) {
    return {
      isValid: false,
      message: 'Price cannot have more than 2 decimal places'
    };
  }

  return {
    isValid: true,
    message: 'Price is valid'
  };
}

/**
 * Validate duration format
 * @param {number} duration - Duration in minutes to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateDuration(duration, options = {}) {
  const {
    min = 15, // Minimum 15 minutes
    max = 480, // Maximum 8 hours
    allowZero = false
  } = options;

  if (duration === null || duration === undefined || isNaN(duration)) {
    return {
      isValid: false,
      message: 'Duration must be a valid number'
    };
  }

  if (!Number.isInteger(duration)) {
    return {
      isValid: false,
      message: 'Duration must be a whole number'
    };
  }

  if (!allowZero && duration <= 0) {
    return {
      isValid: false,
      message: 'Duration must be positive'
    };
  }

  if (duration < min) {
    return {
      isValid: false,
      message: `Duration must be at least ${min} minutes`
    };
  }

  if (duration > max) {
    return {
      isValid: false,
      message: `Duration cannot exceed ${max} minutes (8 hours)`
    };
  }

  // Check for reasonable increments (5-minute intervals)
  if (duration % 5 !== 0) {
    return {
      isValid: false,
      message: 'Duration must be in 5-minute increments'
    };
  }

  return {
    isValid: true,
    message: 'Duration is valid'
  };
}

/**
 * Validate string length
 * @param {string} str - String to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateStringLength(str, options = {}) {
  const {
    min = 1,
    max = 255,
    allowEmpty = false,
    trim = true
  } = options;

  // Handle null/undefined
  if (str === null || str === undefined) {
    return {
      isValid: false,
      message: 'String cannot be null or undefined'
    };
  }

  // Convert to string if not already
  const stringValue = String(str);
  
  // Trim if requested
  const trimmedValue = trim ? stringValue.trim() : stringValue;

  // Check empty string
  if (!allowEmpty && trimmedValue.length === 0) {
    return {
      isValid: false,
      message: 'String cannot be empty'
    };
  }

  // Check minimum length
  if (trimmedValue.length < min) {
    return {
      isValid: false,
      message: `String must be at least ${min} characters long`
    };
  }

  // Check maximum length
  if (trimmedValue.length > max) {
    return {
      isValid: false,
      message: `String cannot exceed ${max} characters`
    };
  }

  return {
    isValid: true,
    message: 'String length is valid'
  };
}