// Fixed backend pos.js (fixed allowedStatusesForPOS, standardized customer_type, added items handling in /transaction for backward compatibility)
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendEmail, sendPOSTransactionEmail, sendPaymentConfirmation } from '../services/email.js';
import { getClient } from '../config/db.js';
import { query } from '../config/database.js';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse } from '../utils/apiResponse.js';
import { validateRequiredFields } from '../utils/validation.js';
import axios from 'axios';
const router = express.Router();
// Create POS transaction
router.post('/transaction', authenticate, authorize(['staff', 'manager', 'admin']), async (req, res) => {
  const client = await getClient();
 
  try {
    await client.query('BEGIN');
   
    const { 
      booking_number, 
      products = [], 
      items = [], 
      coupon_code, 
      staff_id,
      payment_method = 'cash',
      payment_status = 'completed',
      payment_reference
    } = req.body;
   
    // Validate required fields
    if (staff_id) {
      const staffValidation = validateRequiredFields({ staff_id }, ['staff_id']);
      if (!staffValidation.isValid) {
        await client.query('ROLLBACK');
        return res.status(400).json(validationErrorResponse(staffValidation.missingFields, 'Missing required fields'));
      }
    }
   
    // Validate items format if provided
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.type || !['product', 'service'].includes(item.type)) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Invalid item type. Must be "product" or "service"', 'INVALID_ITEM_TYPE', 400));
        }
        if (!item.quantity || item.quantity <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Item quantity must be greater than 0', 'INVALID_ITEM_QUANTITY', 400));
        }
        if (item.type === 'product' && !item.product_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Product items must have product_id', 'MISSING_PRODUCT_ID', 400));
        }
        if (item.type === 'service' && !item.service_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Service items must have service_id', 'MISSING_SERVICE_ID', 400));
        }
      }
    }
   
    // Validate legacy products format if provided
    if (products && products.length > 0) {
      for (const product of products) {
        if (!product.product_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Product must have product_id', 'MISSING_PRODUCT_ID', 400));
        }
        if (!product.quantity || product.quantity <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Product quantity must be greater than 0', 'INVALID_PRODUCT_QUANTITY', 400));
        }
      }
    }
   
    let booking = null;
    let service_amount = 0;
   
    // Get booking if provided
    if (booking_number) {
      const bookingResult = await client.query(
        `SELECT b.*, s.name as service_name, s.price as service_price
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         WHERE b.booking_number = $1`,
        [booking_number]
      );
     
      if (bookingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(notFoundResponse('Booking', booking_number));
      }
     
      booking = bookingResult.rows[0];
     
      // Validate booking status for POS transactions
      const allowedStatusesForPOS = ['scheduled', 'in-progress'];
      if (!allowedStatusesForPOS.includes(booking.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json(errorResponse(
          `Booking cannot be processed. Current status: ${booking.status}. Only bookings with status 'scheduled' or 'in-progress' can be processed through POS.`,
          'INVALID_BOOKING_STATUS',
          400
        ));
      }
     
      service_amount = booking.service_price;
    }
   
    // Calculate product total and update stock
    let product_amount = 0;
   
    // Handle new items array format (products and services)
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.type === 'product' && item.product_id) {
          const productResult = await client.query(
            'SELECT price, stock_level FROM products WHERE id = $1 FOR UPDATE',
            [item.product_id]
          );
         
          if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json(notFoundResponse('Product', item.product_id));
          }
         
          const product = productResult.rows[0];
         
          if (product.stock_level < item.quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json(errorResponse(
              `Insufficient stock for product ${item.product_id}`,
              'INSUFFICIENT_STOCK',
              400
            ));
          }
         
          product_amount += product.price * item.quantity;
         
          // Update stock
          await client.query(
            'UPDATE products SET stock_level = stock_level - $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        } else if (item.type === 'service' && item.service_id) {
          const serviceResult = await client.query(
            'SELECT name, price, duration FROM services WHERE id = $1',
            [item.service_id]
          );
         
          if (serviceResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json(notFoundResponse('Service', item.service_id));
          }
         
          const service = serviceResult.rows[0];
          service_amount += service.price * item.quantity;
        }
      }
    } else {
      // Handle legacy products array format for backward compatibility
      for (const item of products) {
        const productResult = await client.query(
          'SELECT price, stock_level FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id]
        );
       
        if (productResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json(notFoundResponse('Product', item.product_id));
        }
       
        const product = productResult.rows[0];
       
        if (product.stock_level < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse(
            `Insufficient stock for product ${item.product_id}`,
            'INSUFFICIENT_STOCK',
            400
          ));
        }
       
        product_amount += product.price * item.quantity;
       
        // Update stock
        await client.query(
          'UPDATE products SET stock_level = stock_level - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }
   
    let total_amount = service_amount + product_amount;
    let discount_amount = 0;
    let coupon_id = null;
   
    // Apply coupon if provided
    if (coupon_code) {
      const couponResult = await client.query(
        'SELECT * FROM coupons WHERE code = $1 FOR UPDATE',
        [coupon_code]
      );
     
      if (couponResult.rows.length > 0) {
        const coupon = couponResult.rows[0];
        coupon_id = coupon.id;
       
        if (coupon.expiry_date > new Date() && coupon.used_count < coupon.usage_limit) {
          if (coupon.discount_percentage) {
            discount_amount = total_amount * (coupon.discount_percentage / 100);
          } else if (coupon.fixed_amount) {
            discount_amount = coupon.fixed_amount;
          }
         
          total_amount -= discount_amount;
         
          // Update coupon usage
          await client.query(
            'UPDATE coupons SET used_count = used_count + 1 WHERE id = $1',
            [coupon.id]
          );
        }
      }
    }
   
    // Create transaction
    const transactionNumber = `TXN-${Date.now()}`;
    const transactionResult = await client.query(
      `INSERT INTO pos_transactions
       (transaction_number, customer_name, customer_email, customer_phone, subtotal, discount_amount, total_amount, payment_method, payment_status, payment_reference, coupon_id, created_by, booking_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        transactionNumber, 
        booking?.customer_name, 
        booking?.customer_email, 
        booking?.customer_phone, 
        total_amount, 
        discount_amount, 
        total_amount, 
        payment_method, 
        payment_status,
        payment_reference || null,
        coupon_id, 
        staff_id,
        booking?.id || null
      ]
    );
   
    const transaction = transactionResult.rows[0];
    
    // Log coupon usage if coupon was applied
    if (coupon_id && booking?.customer_email) {
      await client.query(
        'INSERT INTO coupon_usage (coupon_id, customer_email, used_at, transaction_id, discount_amount) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)',
        [coupon_id, booking.customer_email, transaction.id, discount_amount]
      );
    }
    
    // Insert transaction items (products and services)
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.type === 'product' && item.product_id) {
          // Get product details
          const productResult = await client.query(
            'SELECT name, price FROM products WHERE id = $1',
            [item.product_id]
          );
          const product = productResult.rows[0];
         
          await client.query(
            'INSERT INTO pos_transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
            [transaction.id, item.product_id, product.name, item.quantity, product.price, item.quantity * product.price]
          );
        } else if (item.type === 'service' && item.service_id) {
          // Get service details
          const serviceResult = await client.query(
            'SELECT name, price, duration FROM services WHERE id = $1',
            [item.service_id]
          );
          const service = serviceResult.rows[0];
         
          await client.query(
            'INSERT INTO pos_transaction_items (transaction_id, service_id, service_name, quantity, unit_price, total_price, service_duration) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [transaction.id, item.service_id, service.name, item.quantity, service.price, item.quantity * service.price, service.duration]
          );
        }
      }
    } else if (products.length > 0) {
      // Handle legacy products array format for backward compatibility
      for (const item of products) {
        // Get product details for name
        const productResult = await client.query(
          'SELECT name, price FROM products WHERE id = $1',
          [item.product_id]
        );
        const product = productResult.rows[0];
       
        await client.query(
          'INSERT INTO pos_transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
          [transaction.id, item.product_id, product.name, item.quantity, product.price, item.quantity * product.price]
        );
      }
    }
   
    await client.query('COMMIT');
   
    // Convert total_amount to number for formatting
    const formattedTotalAmount = Number(transaction.total_amount);
   
    // Update booking status to completed if this was a booking transaction
    if (booking) {
      await client.query(
        'UPDATE bookings SET status = $1, payment_status = $2, total_amount = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        ['completed', 'completed', total_amount, booking.id]
      );
     
      // Send completion notification using unified payment confirmation
      if (booking) {
        await sendPaymentConfirmation(
          booking.customer_email,
          {
            bookingNumber: booking.booking_number,
            customerName: booking.customer_name,
            amount: formattedTotalAmount,
            paymentMethod: 'POS transaction',
            source: 'pos'
          }
        );
      }
    }
   
    // Send receipt email using unified POS transaction function
    if (booking) {
      await sendPOSTransactionEmail(
        booking.customer_email,
        {
          customerName: booking.customer_name,
          transactionId: transaction.id,
          items: products.map(p => ({ name: p.name, amount: p.price * p.quantity })),
          totalAmount: formattedTotalAmount,
          paymentMethod: 'POS',
          bookingNumber: booking.booking_number,
          includeReceipt: true
        }
      );
    }
   
    res.status(201).json(successResponse({
      ...transaction,
      booking_updated: !!booking,
      new_booking_status: booking ? 'completed' : null
    }, 'POS transaction created successfully', 201));
   
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('POS transaction error:', error);
    res.status(400).json(errorResponse(error.message, 'POS_TRANSACTION_ERROR', 400));
  } finally {
    client.release();
  }
});
// Unified POS checkout endpoint to match frontend API_ENDPOINTS.POS_CHECKOUT
// Accepts mixed items (products/services), optional booking_number, coupon_code, and payment details
router.post('/checkout', authenticate, authorize(['staff', 'manager', 'admin']), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const {
      booking_number,
      items = [],
      products = [], // legacy support
      coupon_code,
      customer_info = {},
      staff_id, // Optional: can be overridden by authenticated user
      payment_method = 'cash',
      payment_status, // e.g., 'completed' | 'pending'
      payment_reference,
      tax = 0
    } = req.body;
   
    // Use authenticated user ID if staff_id not provided
    const processed_by = staff_id || req.user.id;
   
    // Validate required fields
    if (!processed_by) {
      await client.query('ROLLBACK');
      return res.status(400).json(errorResponse('Staff ID is required', 'MISSING_STAFF_ID', 400));
    }
   
    // Validate payment method
    const validPaymentMethods = ['cash', 'card', 'transfer', 'paystack', 'physical_pos', 'bank_transfer_pos'];
    if (!validPaymentMethods.includes(payment_method)) {
      await client.query('ROLLBACK');
      return res.status(400).json(errorResponse('Invalid payment method. Must be one of: cash, card, transfer, paystack, physical_pos, bank_transfer_pos', 'INVALID_PAYMENT_METHOD', 400));
    }
   
    // Validate payment status if provided
    if (payment_status && !['completed', 'pending'].includes(payment_status)) {
      await client.query('ROLLBACK');
      return res.status(400).json(errorResponse('Invalid payment status. Must be "completed" or "pending"', 'INVALID_PAYMENT_STATUS', 400));
    }
   
    // Validate items format if provided
    if (items && items.length > 0) {
      for (const item of items) {
        if (!item.type || !['product', 'service'].includes(item.type)) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Invalid item type. Must be "product" or "service"', 'INVALID_ITEM_TYPE', 400));
        }
        if (!item.quantity || item.quantity <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Item quantity must be greater than 0', 'INVALID_ITEM_QUANTITY', 400));
        }
        if (item.type === 'product' && !item.product_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Product items must have product_id', 'MISSING_PRODUCT_ID', 400));
        }
        if (item.type === 'service' && !item.service_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Service items must have service_id', 'MISSING_SERVICE_ID', 400));
        }
      }
    }
   
    // Validate legacy products format if provided
    if (products && products.length > 0) {
      for (const product of products) {
        if (!product.product_id) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Product must have product_id', 'MISSING_PRODUCT_ID', 400));
        }
        if (!product.quantity || product.quantity <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse('Product quantity must be greater than 0', 'INVALID_PRODUCT_QUANTITY', 400));
        }
      }
    }
   
    // Validate customer info if provided
    if (customer_info.email && !/^[\w\.-]+@[\w\.-]+\.\w+$/.test(customer_info.email)) {
      await client.query('ROLLBACK');
      return res.status(400).json(errorResponse('Invalid customer email format', 'INVALID_CUSTOMER_EMAIL', 400));
    }
   
    // Validate tax amount
    if (tax < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json(errorResponse('Tax amount cannot be negative', 'INVALID_TAX_AMOUNT', 400));
    }
    let booking = null;
    let service_amount = 0;
    // Get booking if provided
    if (booking_number) {
      const bookingResult = await client.query(
        `SELECT b.*, s.name as service_name, s.price as service_price
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         WHERE b.booking_number = $1`,
        [booking_number]
      );
      if (bookingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(notFoundResponse('Booking', booking_number));
      }
      booking = bookingResult.rows[0];
      // Align allowed statuses with frontend POS processing
      const allowedStatusesForPOS = ['scheduled', 'in-progress'];
      if (!allowedStatusesForPOS.includes(booking.status)) {
        await client.query('ROLLBACK');
        return res.status(400).json(errorResponse(
          `Booking cannot be processed. Current status: ${booking.status}. Only bookings with status 'scheduled' or 'in-progress' can be processed through POS.`,
          'INVALID_BOOKING_STATUS',
          400
        ));
      }
      service_amount = Number(booking.service_price || 0);
    }
    // Calculate product total and update stock
    let product_amount = 0;
    // Handle new items array format (products and services)
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.type === 'product' && item.product_id) {
          const productResult = await client.query(
            'SELECT name, price, stock_level FROM products WHERE id = $1 FOR UPDATE',
            [item.product_id]
          );
          if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json(notFoundResponse('Product', item.product_id));
          }
          const product = productResult.rows[0];
          if (product.stock_level < item.quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json(errorResponse(
              `Insufficient stock for product ${item.product_id}`,
              'INSUFFICIENT_STOCK',
              400
            ));
          }
          product_amount += Number(product.price) * Number(item.quantity);
         
          // Update stock
          await client.query(
            'UPDATE products SET stock_level = stock_level - $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        } else if (item.type === 'service' && item.service_id) {
          const serviceResult = await client.query(
            'SELECT name, price, duration FROM services WHERE id = $1',
            [item.service_id]
          );
         
          if (serviceResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json(notFoundResponse('Service', item.service_id));
          }
         
          const service = serviceResult.rows[0];
          service_amount += Number(service.price) * Number(item.quantity);
        }
      }
    } else if (products && products.length > 0) {
      // Legacy products array format for backward compatibility
      for (const item of products) {
        const productResult = await client.query(
          'SELECT name, price, stock_level FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id]
        );
       
        if (productResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json(notFoundResponse('Product', item.product_id));
        }
       
        const product = productResult.rows[0];
       
        if (product.stock_level < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json(errorResponse(
            `Insufficient stock for product ${item.product_id}`,
            'INSUFFICIENT_STOCK',
            400
          ));
        }
       
        product_amount += Number(product.price) * Number(item.quantity);
       
        await client.query(
          'UPDATE products SET stock_level = stock_level - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }
    // Compute amounts server-side
    let subtotal_amount = service_amount + product_amount;
    let discount_amount = 0;
    let coupon_id = null;
    // Apply coupon if provided
    if (coupon_code) {
      const couponResult = await client.query(
        'SELECT * FROM coupons WHERE code = $1 FOR UPDATE',
        [coupon_code]
      );
     
      if (couponResult.rows.length > 0) {
        const coupon = couponResult.rows[0];
        coupon_id = coupon.id;
       
        const now = new Date();
        if (coupon.expiry_date > now && coupon.used_count < coupon.usage_limit) {
          if (coupon.discount_percentage) {
            discount_amount = subtotal_amount * (coupon.discount_percentage / 100);
          } else if (coupon.fixed_amount) {
            discount_amount = Number(coupon.fixed_amount);
          }
         
          // Update coupon usage count (usage record inserted after transaction creation)
          await client.query(
            'UPDATE coupons SET used_count = used_count + 1 WHERE id = $1',
            [coupon.id]
          );
        }
      }
    }
    const computed_total = subtotal_amount - discount_amount + Number(tax || 0);
    // Create transaction
    const transactionNumber = `TXN-${Date.now()}`;
    const transactionResult = await client.query(
      `INSERT INTO pos_transactions
       (transaction_number, customer_name, customer_email, customer_phone, subtotal, discount_amount, total_amount, payment_method, coupon_id, created_by, booking_id, payment_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        transactionNumber,
        booking?.customer_name || customer_info.name || null,
        booking?.customer_email || customer_info.email || null,
        booking?.customer_phone || customer_info.phone || null,
        subtotal_amount,
        discount_amount,
        computed_total,
        payment_method,
        coupon_id,
        processed_by,
        booking?.id || null,
        payment_reference || null
      ]
    );
   
    const transaction = transactionResult.rows[0];
    
    // Log coupon usage if coupon was applied
    if (coupon_id && (booking?.customer_email || customer_info.email)) {
      const customerEmail = booking?.customer_email || customer_info.email;
      await client.query(
        'INSERT INTO coupon_usage (coupon_id, customer_email, used_at, transaction_id, discount_amount) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4)',
        [coupon_id, customerEmail, transaction.id, discount_amount]
      );
    }
    
    // Insert transaction items
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.type === 'product' && item.product_id) {
          const productResult = await client.query(
            'SELECT name, price FROM products WHERE id = $1',
            [item.product_id]
          );
          const product = productResult.rows[0];
         
          await client.query(
            'INSERT INTO pos_transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
            [transaction.id, item.product_id, product.name, item.quantity, product.price, Number(item.quantity) * Number(product.price)]
          );
        } else if (item.type === 'service' && item.service_id) {
          const serviceResult = await client.query(
            'SELECT name, price, duration FROM services WHERE id = $1',
            [item.service_id]
          );
          const service = serviceResult.rows[0];
         
          await client.query(
            'INSERT INTO pos_transaction_items (transaction_id, service_id, service_name, quantity, unit_price, total_price, service_duration) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [transaction.id, item.service_id, service.name, item.quantity, service.price, Number(item.quantity) * Number(service.price), service.duration]
          );
        }
      }
    } else if (products && products.length > 0) {
      for (const item of products) {
        const productResult = await client.query(
          'SELECT name, price FROM products WHERE id = $1',
          [item.product_id]
        );
        const product = productResult.rows[0];
       
        await client.query(
          'INSERT INTO pos_transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
          [transaction.id, item.product_id, product.name, item.quantity, product.price, Number(item.quantity) * Number(product.price)]
        );
      }
    }
    // Update transaction status based on payment_status
    // FIX: For Paystack, if payment_status is 'pending' (or not explicitly 'completed'), it should be 'pending'
    // The previous logic defaulted to 'completed' for 'paystack' which prevented webhook verification flow
    let effectivePaymentStatus = payment_status;
    if (!effectivePaymentStatus) {
      if (payment_method === 'bank_transfer') {
        effectivePaymentStatus = 'pending';
      } else if (payment_method === 'paystack') {
        effectivePaymentStatus = 'pending'; // Paystack starts as pending until webhook confirms
      } else {
        effectivePaymentStatus = 'completed'; // Cash/Card/POS defaults to completed
      }
    }
    
    const effectiveTransactionStatus = effectivePaymentStatus === 'completed' ? 'completed' : 'pending';
    
    await client.query(
      `UPDATE pos_transactions
       SET payment_status = $1, status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [effectivePaymentStatus, effectiveTransactionStatus, transaction.id]
    );
    await client.query('COMMIT');
    // If booking exists and payment completed, update booking payment/status
    if (booking && effectivePaymentStatus === 'completed') {
      await query(
        `UPDATE bookings
         SET status = $1, payment_status = $2, payment_method = $3, payment_reference = $4,
             payment_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        ['completed', 'completed', payment_method, payment_reference || null, booking.id]
      );
    }
    res.status(201).json(successResponse({
      ...transaction,
      booking_updated: !!booking,
      new_booking_status: booking ? (effectivePaymentStatus === 'completed' ? 'completed' : booking.status) : null
    }, 'POS checkout completed successfully', 201));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('POS checkout error:', error);
    res.status(400).json(errorResponse(error.message, 'POS_CHECKOUT_ERROR', 400));
  } finally {
    client.release();
  }
});
// Initialize Paystack payment
router.post('/payment/initialize', authenticate, async (req, res) => {
  const { email, amount, booking_number } = req.body;
 
  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Convert to kobo
        reference: `${booking_number}_${Date.now()}`,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
   
    res.json(response.data);
  } catch (error) {
    console.error('POS payment verification error:', error);
    res.status(400).json({ 
      success: false,
      error: 'Payment verification failed',
      message: error.message,
      details: {
        reference: reference,
        error_type: error.name,
        stack_trace: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});
// Verify Paystack payment
router.post('/payment/verify', authenticate, async (req, res) => {
  const { reference } = req.body;
 
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );
   
    if (response.data.data.status === 'success') {
      // Update transaction status
      const booking_number = reference.split('_')[0];
      await query(
        'UPDATE pos_transactions SET payment_method = $1, payment_reference = $2, status = $3 WHERE booking_id = (SELECT id FROM bookings WHERE booking_number = $4)',
        ['paystack', reference, 'completed', booking_number]
      );
     
      // Also update the booking payment status
      await query(
        'UPDATE bookings SET payment_status = $1, payment_method = $2, payment_reference = $3, payment_date = CURRENT_TIMESTAMP WHERE booking_number = $4',
        ['completed', 'card', reference, booking_number]
      );
    }
   
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// Paystack webhook endpoint for payment notifications
router.post('/payment/webhook', async (req, res) => {
  try {
    // Get the signature from the header
    const signature = req.headers['x-paystack-signature'];
   
    // Verify the webhook signature (for production security)
    if (process.env.PAYSTACK_SECRET_KEY && signature) {
      const crypto = require('crypto');
      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex');
     
      if (hash !== signature) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }
   
    const { event, data } = req.body;
   
    // Handle successful payment events
    if (event === 'charge.success') {
      const { reference, amount, customer } = data;
     
      // Extract booking number from reference
      const booking_number = reference.split('_')[0];
     
      // Update booking payment status
      const bookingResult = await query(
        `UPDATE bookings
         SET payment_status = $1,
             payment_method = $2,
             payment_reference = $3,
             payment_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_number = $4
         RETURNING id, customer_email, customer_name, total_amount, service_id`,
        ['completed', 'paystack', reference, booking_number]
      );
     
      if (bookingResult.rows.length > 0) {
        const booking = bookingResult.rows[0];
       
        // Get service name
        const serviceResult = await query(
          'SELECT name FROM services WHERE id = $1',
          [booking.service_id]
        );
        const serviceName = serviceResult.rows[0]?.name || 'Service';
       
        // Send payment confirmation email using unified function
        await sendPaymentConfirmation(
          booking.customer_email,
          {
            bookingNumber: booking_number,
            customerName: booking.customer_name,
            amount: amount / 100,
            paymentMethod: 'Card',
            source: 'booking'
          }
        );
       
        // Also update POS transaction if it exists
        await query(
          `UPDATE pos_transactions
           SET payment_method = $1,
               payment_reference = $2,
               status = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE booking_id = $4`,
          ['paystack', reference, 'completed', booking.id]
        );
       
        console.log(`Payment webhook processed successfully for booking ${booking_number}`);
      }
    }
   
    // Return 200 to acknowledge receipt
    res.status(200).json({ status: 'success' });
   
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
// Get all POS transactions
router.get('/transactions', authenticate, authorize(['staff', 'manager', 'admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20, start_date, end_date, staff_id } = req.query;
    const offset = (page - 1) * limit;
   
    let queryString = `
      SELECT pt.*, u.name as staff_name, u.email as staff_email,
             v.name as verified_by_name,
             c.code as coupon_code, c.name as coupon_name, c.discount_type, c.discount_value
      FROM pos_transactions pt
      LEFT JOIN users u ON pt.created_by = u.id
      LEFT JOIN users v ON pt.verified_by = v.id
      LEFT JOIN coupons c ON pt.coupon_id = c.id
      WHERE 1=1
    `;
   
    const params = [];
    let paramIndex = 1;
   
    if (start_date) {
      queryString += ` AND pt.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
   
    if (end_date) {
      queryString += ` AND pt.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
   
    if (staff_id) {
      queryString += ` AND pt.created_by = $${paramIndex}`;
      params.push(staff_id);
      paramIndex++;
    }
   
    queryString += ` ORDER BY pt.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
   
    const result = await query(queryString, params);
   
    // Get total count for pagination
    let countQueryString = `SELECT COUNT(*) FROM pos_transactions pt WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;
   
    if (start_date) {
      countQueryString += ` AND pt.created_at >= $${countParamIndex}`;
      countParams.push(start_date);
      countParamIndex++;
    }
   
    if (end_date) {
      countQueryString += ` AND pt.created_at <= $${countParamIndex}`;
      countParams.push(end_date);
      countParamIndex++;
    }
   
    if (staff_id) {
      countQueryString += ` AND pt.created_by = $${countParamIndex}`;
      countParams.push(staff_id);
    }
   
    const countResult = await query(countQueryString, countParams);
    const total = parseInt(countResult.rows[0].count);
   
    res.json({
      transactions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});
// Get transactions pending payment verification
router.get('/transactions/pending-verification', authenticate, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const result = await query(`
      SELECT pt.*, u.name as staff_name, u.email as staff_email,
             v.name as verified_by_name,
             b.booking_number, b.customer_name, b.customer_email
      FROM pos_transactions pt
      LEFT JOIN users u ON pt.created_by = u.id
      LEFT JOIN users v ON pt.verified_by = v.id
      LEFT JOIN bookings b ON pt.booking_id = b.id
      WHERE pt.payment_status = 'pending' OR (pt.status = 'pending' AND pt.payment_status IS NULL)
      ORDER BY pt.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    // Get total count
    const countResult = await query(`
      SELECT COUNT(*)
      FROM pos_transactions pt
      WHERE pt.payment_status = 'pending' OR (pt.status = 'pending' AND pt.payment_status IS NULL)
    `);
    const total = parseInt(countResult.rows[0].count);
    res.json({
      transactions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get pending verification transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});
// Get single POS transaction with items
router.get('/transactions/:id', authenticate, authorize(['staff', 'manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    // Validate UUID format to prevent accidental matches like 'pending-verification'
    if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid transaction id format' });
    }
   
    // Get transaction details
    const transactionResult = await query(`
      SELECT pt.*, u.name as staff_name, u.email as staff_email,
             v.name as verified_by_name,
             c.code as coupon_code, c.name as coupon_name, c.discount_percentage, c.fixed_amount
      FROM pos_transactions pt
      LEFT JOIN users u ON pt.created_by = u.id
      LEFT JOIN users v ON pt.verified_by = v.id
      LEFT JOIN coupons c ON pt.coupon_id = c.id
      WHERE pt.id = $1
    `, [id]);
   
    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
   
    const transaction = transactionResult.rows[0];
   
    // Get transaction items (both products and services)
    const itemsResult = await query(`
      SELECT pti.*, p.sku, p.category, s.duration as service_duration
      FROM pos_transaction_items pti
      LEFT JOIN products p ON pti.product_id = p.id
      LEFT JOIN services s ON pti.service_id = s.id
      WHERE pti.transaction_id = $1
    `, [id]);
   
    transaction.items = itemsResult.rows;
   
    res.json(transaction);
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: error.message });
  }
});
// Manual payment verification by manager/admin
router.post('/transactions/:id/verify-payment', authenticate, authorize(['manager', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_reference, payment_method = 'card', notes } = req.body;
    const verified_by = req.user.id;
    // Validate UUID format to prevent accidental matches
    if (!id || typeof id !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid transaction id format' });
    }
    // Get the transaction first
    const transactionResult = await query(`
      SELECT pt.*, u.name as staff_name
      FROM pos_transactions pt
      LEFT JOIN users u ON pt.created_by = u.id
      WHERE pt.id = $1
    `, [id]);
    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const transaction = transactionResult.rows[0];
    // Check if already verified
    if (transaction.status === 'completed' && transaction.payment_status === 'completed') {
      return res.status(400).json({ error: 'Transaction payment already verified' });
    }
    // Update transaction with manual verification
    const updateResult = await query(`
      UPDATE pos_transactions
      SET
        payment_status = 'completed',
        payment_method = $1,
        payment_reference = $2,
        status = 'completed',
        verified_by = $3,
        verification_notes = $4,
        verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [payment_method, payment_reference, verified_by, notes, id]);
    const updatedTransaction = updateResult.rows[0];
    // If this transaction has a booking, update the booking payment status too
    if (transaction.booking_id) {
      await query(
        `UPDATE bookings
         SET
           payment_status = 'completed',
           payment_method = $1,
           payment_reference = $2,
           payment_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [payment_method, payment_reference, transaction.booking_id]
      );
    }
    // Get the verifier's name for response
    const verifierResult = await query('SELECT name FROM users WHERE id = $1', [verified_by]);
    const verifier_name = verifierResult.rows[0]?.name || 'Unknown';
    // Log the verification action
    console.log(`Transaction ${id} payment verified manually by ${verifier_name}`);
    res.json({
      message: 'Payment verified successfully',
      transaction: {
        ...updatedTransaction,
        verified_by_name: verifier_name
      }
    });
  } catch (error) {
    console.error('Manual payment verification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Manual payment verification failed',
      message: error.message,
      details: {
        transaction_id: id,
        error_type: error.name,
        stack_trace: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});
// (Route moved above the dynamic :id route to prevent shadowing)
export default router;