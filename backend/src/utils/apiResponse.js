/**
 * Standardized API Response Format
 * Ensures consistent response structure across all endpoints
 */

/**
 * Success response format
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Standardized success response
 */
export const successResponse = (data, message = 'Operation successful', statusCode = 200) => ({
  success: true,
  data,
  message,
  status: statusCode,
  timestamp: new Date().toISOString()
});

/**
 * Error response format
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {number} statusCode - HTTP status code
 * @param {Array} errors - Detailed error information
 * @param {string} field - Field name for validation errors
 * @returns {Object} Standardized error response
 */
export const errorResponse = (message, code = 'SERVER_ERROR', statusCode = 500, errors = [], field = null) => ({
  success: false,
  error: {
    code,
    message,
    ...(field && { field }),
    ...(errors.length > 0 && { details: errors })
  },
  status: statusCode,
  timestamp: new Date().toISOString()
});

/**
 * Validation error response
 * @param {Array} validationErrors - Array of validation errors
 * @returns {Object} Standardized validation error response
 */
export const validationErrorResponse = (validationErrors) => ({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    details: validationErrors.map(error => ({
      field: error.field,
      message: error.message,
      value: error.value
    }))
  },
  status: 400,
  timestamp: new Date().toISOString()
});

/**
 * Payment-specific error responses
 */
export const paymentErrorResponse = (message, code = 'PAYMENT_ERROR', details = {}) => ({
  success: false,
  error: {
    code,
    message,
    ...details
  },
  status: 402,
  timestamp: new Date().toISOString()
});

/**
 * Database error response
 */
export const databaseErrorResponse = (message, originalError = null) => ({
  success: false,
  error: {
    code: 'DATABASE_ERROR',
    message,
    ...(originalError && { originalError: originalError.message })
  },
  status: 500,
  timestamp: new Date().toISOString()
});

/**
 * Not found error response
 * @param {string} resource - Resource name
 * @param {string} id - Resource ID
 * @returns {Object} Standardized not found error response
 */
export const notFoundResponse = (resource, id = null) => ({
  success: false,
  error: {
    code: 'NOT_FOUND',
    message: id ? `${resource} with ID ${id} not found` : `${resource} not found`
  },
  status: 404,
  timestamp: new Date().toISOString()
});

/**
 * Unauthorized error response
 * @param {string} message - Error message
 * @returns {Object} Standardized unauthorized error response
 */
export const unauthorizedResponse = (message = 'Unauthorized access') => ({
  success: false,
  error: {
    code: 'UNAUTHORIZED',
    message
  },
  status: 401,
  timestamp: new Date().toISOString()
});

/**
 * Forbidden error response
 * @param {string} message - Error message
 * @returns {Object} Standardized forbidden error response
 */
export const forbiddenResponse = (message = 'Access forbidden') => ({
  success: false,
  error: {
    code: 'FORBIDDEN',
    message
  },
  status: 403,
  timestamp: new Date().toISOString()
});

/**
 * Conflict error response
 * @param {string} message - Error message
 * @param {string} resource - Resource name
 * @returns {Object} Standardized conflict error response
 */
export const conflictResponse = (message, resource = null) => ({
  success: false,
  error: {
    code: 'CONFLICT',
    message: resource ? `${resource} already exists` : message
  },
  status: 409,
  timestamp: new Date().toISOString()
});

/**
 * Rate limit error response
 * @param {string} message - Error message
 * @returns {Object} Standardized rate limit error response
 */
export const rateLimitResponse = (message = 'Too many requests') => ({
  success: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message
  },
  status: 429,
  timestamp: new Date().toISOString()
});