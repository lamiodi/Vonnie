import { pool } from '../config/database.js';

class PaymentConfirmationValidator {
  static async validateBookingForPaymentConfirmation(bookingId) {
    try {
      const bookingQuery = `
        SELECT 
          b.booking_id,
          b.booking_number,
          b.payment_status,
          b.customer_id,
          b.service_id,
          s.name as service_name,
          s.price as service_price,
          c.name as customer_name,
          c.email as customer_email,
          c.phone as customer_phone
        FROM bookings b
        JOIN services s ON b.service_id = s.service_id
        JOIN customers c ON b.customer_id = c.customer_id
        WHERE b.booking_id = $1
      `;
      
      const result = await pool.query(bookingQuery, [bookingId]);
      
      if (result.rows.length === 0) {
        return {
          isValid: false,
          error: 'Booking not found',
          errorCode: 'BOOKING_NOT_FOUND'
        };
      }

      const booking = result.rows[0];
      
      // Check if payment is already confirmed
      if (booking.payment_status === 'PREPAID_CONFIRMED' || booking.payment_status === 'WALKIN_PAID') {
        return {
          isValid: false,
          error: 'Payment has already been confirmed for this booking',
          errorCode: 'PAYMENT_ALREADY_CONFIRMED',
          currentStatus: booking.payment_status
        };
      }

      // Check if payment failed or was refunded
      if (booking.payment_status === 'failed' || booking.payment_status === 'refunded') {
        return {
          isValid: false,
          error: `Cannot confirm payment for booking with status: ${booking.payment_status}`,
          errorCode: 'INVALID_PAYMENT_STATUS',
          currentStatus: booking.payment_status
        };
      }

      return {
        isValid: true,
        booking: booking
      };
    } catch (error) {
      console.error('Error validating booking for payment confirmation:', error);
      return {
        isValid: false,
        error: 'Database error during validation',
        errorCode: 'DATABASE_ERROR'
      };
    }
  }

  static async validateManagerCredentials(managerId, password) {
    try {
      const managerQuery = `
        SELECT 
          user_id,
          password_hash,
          role,
          is_active,
          failed_login_attempts,
          locked_until
        FROM users 
        WHERE user_id = $1 AND role IN ('manager', 'admin')
      `;
      
      const result = await pool.query(managerQuery, [managerId]);
      
      if (result.rows.length === 0) {
        return {
          isValid: false,
          error: 'Manager not found or insufficient permissions',
          errorCode: 'MANAGER_NOT_FOUND'
        };
      }

      const manager = result.rows[0];
      
      // Check if account is locked
      if (manager.locked_until && new Date() < new Date(manager.locked_until)) {
        return {
          isValid: false,
          error: 'Manager account is temporarily locked due to failed login attempts',
          errorCode: 'ACCOUNT_LOCKED',
          lockedUntil: manager.locked_until
        };
      }

      // Check if account is active
      if (!manager.is_active) {
        return {
          isValid: false,
          error: 'Manager account is inactive',
          errorCode: 'ACCOUNT_INACTIVE'
        };
      }

      // Verify password using bcrypt
      const bcrypt = require('bcrypt');
      const isPasswordValid = await bcrypt.compare(password, manager.password_hash);
      
      if (!isPasswordValid) {
        // Increment failed login attempts
        await pool.query(
          'UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE user_id = $1',
          [managerId]
        );

        // Lock account after 5 failed attempts
        if (manager.failed_login_attempts >= 4) {
          const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          await pool.query(
            'UPDATE users SET locked_until = $1 WHERE user_id = $2',
            [lockUntil, managerId]
          );
          
          return {
            isValid: false,
            error: 'Too many failed attempts. Account locked for 30 minutes.',
            errorCode: 'ACCOUNT_LOCKED',
            lockedUntil: lockUntil
          };
        }

        return {
          isValid: false,
          error: 'Invalid manager password',
          errorCode: 'INVALID_PASSWORD',
          remainingAttempts: 5 - manager.failed_login_attempts - 1
        };
      }

      // Reset failed login attempts on successful authentication
      await pool.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE user_id = $1',
        [managerId]
      );

      return {
        isValid: true,
        manager: {
          userId: manager.user_id,
          role: manager.role
        }
      };
    } catch (error) {
      console.error('Error validating manager credentials:', error);
      return {
        isValid: false,
        error: 'Database error during manager validation',
        errorCode: 'DATABASE_ERROR'
      };
    }
  }

  static validatePaymentMethod(paymentMethod) {
    const validMethods = ['cash', 'bank_transfer', 'pos_terminal', 'company_account'];
    
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return {
        isValid: false,
        error: 'Invalid payment method. Must be one of: ' + validMethods.join(', '),
        errorCode: 'INVALID_PAYMENT_METHOD',
        validMethods: validMethods
      };
    }

    return { isValid: true };
  }

  static validateCustomerType(customerType) {
    const validTypes = ['pre_booked', 'walk_in'];
    
    if (!customerType || !validTypes.includes(customerType)) {
      return {
        isValid: false,
        error: 'Invalid customer type. Must be one of: ' + validTypes.join(', '),
        errorCode: 'INVALID_CUSTOMER_TYPE',
        validTypes: validTypes
      };
    }

    return { isValid: true };
  }

  static validatePaymentReference(paymentMethod, paymentReference) {
    // Payment reference is required for bank transfers
    if (paymentMethod === 'bank_transfer' && (!paymentReference || paymentReference.trim() === '')) {
      return {
        isValid: false,
        error: 'Payment reference is required for bank transfer payments',
        errorCode: 'MISSING_PAYMENT_REFERENCE'
      };
    }

    // Validate reference format for bank transfers (should be alphanumeric and reasonable length)
    if (paymentMethod === 'bank_transfer' && paymentReference) {
      const referencePattern = /^[A-Za-z0-9\-]{6,50}$/;
      if (!referencePattern.test(paymentReference.trim())) {
        return {
          isValid: false,
          error: 'Payment reference must be 6-50 characters and contain only letters, numbers, and hyphens',
          errorCode: 'INVALID_PAYMENT_REFERENCE_FORMAT'
        };
      }
    }

    return { isValid: true };
  }

  static validateConfirmationNotes(notes) {
    if (notes && notes.length > 500) {
      return {
        isValid: false,
        error: 'Confirmation notes cannot exceed 500 characters',
        errorCode: 'NOTES_TOO_LONG'
      };
    }

    return { isValid: true };
  }

  static async validateInventoryAvailability(bookingId) {
    try {
      // Get all products associated with this booking's service
      const productsQuery = `
        SELECT 
          p.product_id,
          p.name as product_name,
          p.current_stock,
          si.quantity as required_quantity
        FROM bookings b
        JOIN service_items si ON b.service_id = si.service_id
        JOIN products p ON si.product_id = p.product_id
        WHERE b.booking_id = $1
      `;
      
      const result = await pool.query(productsQuery, [bookingId]);
      
      if (result.rows.length === 0) {
        return {
          isValid: true,
          message: 'No products required for this service'
        };
      }

      const insufficientStock = [];
      
      for (const product of result.rows) {
        if (product.current_stock < product.required_quantity) {
          insufficientStock.push({
            productId: product.product_id,
            productName: product.product_name,
            currentStock: product.current_stock,
            requiredQuantity: product.required_quantity
          });
        }
      }

      if (insufficientStock.length > 0) {
        return {
          isValid: false,
          error: 'Insufficient inventory for payment confirmation',
          errorCode: 'INSUFFICIENT_INVENTORY',
          insufficientProducts: insufficientStock
        };
      }

      return {
        isValid: true,
        requiredProducts: result.rows
      };
    } catch (error) {
      console.error('Error validating inventory availability:', error);
      return {
        isValid: false,
        error: 'Database error during inventory validation',
        errorCode: 'DATABASE_ERROR'
      };
    }
  }

  static async validateCompletePaymentConfirmation(bookingId, managerId, password, paymentMethod, customerType, paymentReference, notes) {
    const validationResults = [];

    // Validate booking
    const bookingValidation = await this.validateBookingForPaymentConfirmation(bookingId);
    validationResults.push({ type: 'booking', result: bookingValidation });
    
    if (!bookingValidation.isValid) {
      return this.formatValidationResults(validationResults);
    }

    // Validate manager credentials
    const managerValidation = await this.validateManagerCredentials(managerId, password);
    validationResults.push({ type: 'manager', result: managerValidation });
    
    if (!managerValidation.isValid) {
      return this.formatValidationResults(validationResults);
    }

    // Validate payment method
    const paymentMethodValidation = this.validatePaymentMethod(paymentMethod);
    validationResults.push({ type: 'payment_method', result: paymentMethodValidation });

    // Validate customer type
    const customerTypeValidation = this.validateCustomerType(customerType);
    validationResults.push({ type: 'customer_type', result: customerTypeValidation });

    // Validate payment reference
    const referenceValidation = this.validatePaymentReference(paymentMethod, paymentReference);
    validationResults.push({ type: 'payment_reference', result: referenceValidation });

    // Validate confirmation notes
    const notesValidation = this.validateConfirmationNotes(notes);
    validationResults.push({ type: 'confirmation_notes', result: notesValidation });

    // Validate inventory availability
    const inventoryValidation = await this.validateInventoryAvailability(bookingId);
    validationResults.push({ type: 'inventory', result: inventoryValidation });

    return this.formatValidationResults(validationResults);
  }

  static formatValidationResults(validationResults) {
    const failedValidations = validationResults.filter(v => !v.result.isValid);
    
    if (failedValidations.length === 0) {
      return {
        isValid: true,
        allResults: validationResults
      };
    }

    return {
      isValid: false,
      errors: failedValidations.map(v => ({
        field: v.type,
        message: v.result.error,
        code: v.result.errorCode,
        details: v.result
      })),
      allResults: validationResults
    };
  }
}

export default PaymentConfirmationValidator;