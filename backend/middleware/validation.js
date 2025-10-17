const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// User validation rules
const validateUserRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('first_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('last_name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number is required'),
  body('role')
    .isIn(['admin', 'staff', 'customer'])
    .withMessage('Valid role is required'),
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Service validation rules
const validateService = [
  body('name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Service name is required'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer (minutes)'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Category cannot be empty'),
  handleValidationErrors
];

// Product validation rules
const validateProduct = [
  body('name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Product name is required'),
  body('sku')
    .trim()
    .isLength({ min: 1 })
    .withMessage('SKU is required'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('stock_level')
    .isInt({ min: 0 })
    .withMessage('Stock level must be a non-negative integer'),
  body('low_stock_threshold')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Low stock threshold must be a non-negative integer'),
  handleValidationErrors
];

// Booking validation rules
const validateBooking = [
  body('service_id')
    .isUUID()
    .withMessage('Valid service ID is required'),
  body('staff_id')
    .isUUID()
    .withMessage('Valid staff ID is required'),
  body('start_time')
    .isISO8601()
    .withMessage('Valid start time is required'),
  body('end_time')
    .isISO8601()
    .withMessage('Valid end time is required'),
  body('customer_id')
    .optional()
    .isUUID()
    .withMessage('Valid customer ID is required'),
  handleValidationErrors
];

// Attendance validation rules
const validateAttendance = [
  body('staff_id')
    .isUUID()
    .withMessage('Valid staff ID is required'),
  body('date')
    .isDate()
    .withMessage('Valid date is required'),
  body('resumption_time')
    .optional()
    .isISO8601()
    .withMessage('Valid resumption time is required'),
  body('closing_time')
    .optional()
    .isISO8601()
    .withMessage('Valid closing time is required'),
  handleValidationErrors
];

// Transaction validation rules
const validateTransaction = [
  body('type')
    .isIn(['service', 'product', 'combined'])
    .withMessage('Valid transaction type is required'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('payment_method')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Payment method is required'),
  body('staff_id')
    .isUUID()
    .withMessage('Valid staff ID is required'),
  handleValidationErrors
];

// UUID parameter validation
const validateUUID = [
  param('id')
    .isUUID()
    .withMessage('Valid UUID is required'),
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateService,
  validateProduct,
  validateBooking,
  validateAttendance,
  validateTransaction,
  validateUUID,
  validatePagination
};