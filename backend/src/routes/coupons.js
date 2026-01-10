import express from 'express';
import { query, getClient } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse } from '../utils/apiResponse.js';
import { validateRequiredFields } from '../utils/validation.js';

const router = express.Router();

// Create coupon
router.post('/', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { 
    code, 
    name, 
    description, 
    discount_type, 
    discount_value, 
    min_order_amount, 
    max_discount_amount, 
    usage_limit, 
    valid_from, 
    valid_until 
  } = req.body;
  
  // Validate required fields
  const requiredFields = ['code', 'name', 'discount_type', 'discount_value'];
  const validation = validateRequiredFields(req.body, requiredFields);
  
  if (!validation.isValid) {
    return res.status(400).json(validationErrorResponse(validation.missingFields, validation.error));
  }
  
  // Validate data types and formats
  if (typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json(errorResponse('Coupon code must be a non-empty string', 'INVALID_COUPON_CODE', 400));
  }
  
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json(errorResponse('Coupon name must be a non-empty string', 'INVALID_COUPON_NAME', 400));
  }
  
  if (!['percentage', 'fixed'].includes(discount_type)) {
    return res.status(400).json(errorResponse('Discount type must be either "percentage" or "fixed"', 'INVALID_DISCOUNT_TYPE', 400));
  }
  
  if (typeof discount_value !== 'number' || discount_value <= 0) {
    return res.status(400).json(errorResponse('Discount value must be a positive number', 'INVALID_DISCOUNT_VALUE', 400));
  }
  
  if (discount_type === 'percentage' && discount_value > 100) {
    return res.status(400).json(errorResponse('Percentage discount cannot exceed 100%', 'INVALID_PERCENTAGE_DISCOUNT', 400));
  }
  
  if (min_order_amount !== undefined && min_order_amount !== null && (typeof min_order_amount !== 'number' || min_order_amount < 0)) {
    return res.status(400).json(errorResponse('Minimum order amount must be a non-negative number', 'INVALID_MIN_ORDER_AMOUNT', 400));
  }
  
  if (max_discount_amount !== undefined && max_discount_amount !== null && (typeof max_discount_amount !== 'number' || max_discount_amount < 0)) {
    return res.status(400).json(errorResponse('Maximum discount amount must be a non-negative number', 'INVALID_MAX_DISCOUNT_AMOUNT', 400));
  }
  
  if (usage_limit !== undefined && usage_limit !== null && (typeof usage_limit !== 'number' || usage_limit <= 0 || !Number.isInteger(usage_limit))) {
    return res.status(400).json(errorResponse('Usage limit must be a positive integer', 'INVALID_USAGE_LIMIT', 400));
  }
  
  // Validate date formats
  if (valid_from) {
    const fromDate = new Date(valid_from);
    if (isNaN(fromDate.getTime())) {
      return res.status(400).json(errorResponse('Invalid valid_from date format', 'INVALID_VALID_FROM_DATE', 400));
    }
  }
  
  if (valid_until) {
    const untilDate = new Date(valid_until);
    if (isNaN(untilDate.getTime())) {
      return res.status(400).json(errorResponse('Invalid valid_until date format', 'INVALID_VALID_UNTIL_DATE', 400));
    }
    
    if (valid_from && new Date(valid_from) >= untilDate) {
      return res.status(400).json(errorResponse('valid_until must be after valid_from', 'INVALID_DATE_RANGE', 400));
    }
  }
  
  try {
    // Check if coupon code already exists
    const existingCoupon = await query(
      'SELECT id FROM coupons WHERE code = $1',
      [code.toUpperCase()]
    );
    
    if (existingCoupon.rows.length > 0) {
      return res.status(409).json(errorResponse('Coupon code already exists', 'DUPLICATE_COUPON_CODE', 409));
    }
    
    const result = await query(
      `INSERT INTO coupons (
        code, name, description, discount_type, discount_value, 
        min_order_amount, max_discount_amount, usage_limit, 
        valid_from, valid_until, is_active, created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        code.toUpperCase(), 
        name, 
        description, 
        discount_type, 
        discount_value, 
        min_order_amount || 0, 
        max_discount_amount, 
        usage_limit, 
        valid_from, 
        valid_until, 
        true,
        req.user.id
      ]
    );
    
    res.status(201).json(successResponse(result.rows[0], 'Coupon created successfully', 201));
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(400).json(errorResponse(error.message, 'COUPON_CREATE_ERROR', 400));
  }
});

// Get all coupons
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM coupons ORDER BY created_at DESC'
    );
    res.json(successResponse(result.rows, 'Coupons retrieved successfully'));
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(400).json(errorResponse(error.message, 'COUPON_FETCH_ERROR', 400));
  }
});

// Update coupon
router.put('/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { 
    code, 
    name, 
    description, 
    discount_type, 
    discount_value, 
    min_order_amount, 
    max_discount_amount, 
    usage_limit, 
    valid_from, 
    valid_until 
  } = req.body;
  
  try {
    // Check if coupon code already exists (excluding current coupon)
    const existingCoupon = await query(
      'SELECT id FROM coupons WHERE code = $1 AND id != $2',
      [code.toUpperCase(), id]
    );
    
    if (existingCoupon.rows.length > 0) {
      return res.status(409).json(errorResponse('Coupon code already exists', 'DUPLICATE_COUPON_CODE', 409));
    }
    
    const result = await query(
      `UPDATE coupons SET 
        code = $1, 
        name = $2, 
        description = $3, 
        discount_type = $4, 
        discount_value = $5, 
        min_order_amount = $6, 
        max_discount_amount = $7, 
        usage_limit = $8, 
        valid_from = $9, 
        valid_until = $10,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 
       RETURNING *`,
      [
        code.toUpperCase(), 
        name, 
        description, 
        discount_type, 
        discount_value, 
        min_order_amount || 0, 
        max_discount_amount, 
        usage_limit, 
        valid_from, 
        valid_until, 
        id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Coupon', id));
    }
    
    res.json(successResponse(result.rows[0], 'Coupon updated successfully'));
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(400).json(errorResponse(error.message, 'COUPON_UPDATE_ERROR', 400));
  }
});

// Validate coupon
router.post('/validate', authenticate, async (req, res) => {
  const { code, order_amount } = req.body;
  
  try {
    const result = await query(
      `SELECT * FROM coupons 
       WHERE code = $1 
       AND is_active = true 
       AND valid_from <= CURRENT_TIMESTAMP 
       AND valid_until >= CURRENT_TIMESTAMP`,
      [code.toUpperCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse('Invalid or expired coupon', 'INVALID_COUPON', 404));
    }
    
    const coupon = result.rows[0];
    
    // Check minimum order amount
    if (order_amount < coupon.min_order_amount) {
      return res.status(400).json(errorResponse(
        `Minimum order amount of ${coupon.min_order_amount} required`,
        'MIN_ORDER_AMOUNT_NOT_MET',
        400
      ));
    }
    
    // Check usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json(errorResponse('Coupon usage limit exceeded', 'COUPON_USAGE_LIMIT_EXCEEDED', 400));
    }
    
    // Calculate discount
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (order_amount * coupon.discount_value) / 100;
      if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
        discount = coupon.max_discount_amount;
      }
    } else {
      discount = coupon.discount_value;
    }
    
    res.json(successResponse({
      valid: true,
      coupon,
      discount: Math.min(discount, order_amount)
    }, 'Coupon validated successfully'));
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(400).json(errorResponse(error.message, 'COUPON_VALIDATION_ERROR', 400));
  }
});

// Use coupon (increment usage count and log usage)
router.post('/use', authenticate, async (req, res) => {
  const { code, customer_email, discount_amount = 0 } = req.body;
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get coupon and lock for update
    const couponResult = await client.query(
      `SELECT * FROM coupons 
       WHERE code = $1 
       AND is_active = true 
       AND valid_from <= CURRENT_TIMESTAMP 
       AND valid_until >= CURRENT_TIMESTAMP
       FOR UPDATE`,
      [code.toUpperCase()]
    );
    
    if (couponResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(errorResponse('Invalid or expired coupon', 'INVALID_COUPON', 404));
    }
    
    const coupon = couponResult.rows[0];
    
    // Check usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      await client.query('ROLLBACK');
      return res.status(400).json(errorResponse('Coupon usage limit exceeded', 'COUPON_USAGE_LIMIT_EXCEEDED', 400));
    }
    
    // Update usage count
    await client.query(
      `UPDATE coupons 
       SET used_count = used_count + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [coupon.id]
    );
    
    // Log coupon usage in coupon_usage table if customer email is provided
    if (customer_email) {
      await client.query(
        `INSERT INTO coupon_usage (coupon_id, customer_email, used_at, discount_amount) 
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
        [coupon.id, customer_email, discount_amount]
      );
    }
    
    await client.query('COMMIT');
    
    res.json(successResponse({ 
      message: 'Coupon used successfully', 
      coupon,
      usage_logged: !!customer_email
    }, 'Coupon used successfully'));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Use coupon error:', error);
    res.status(400).json(errorResponse(error.message, 'COUPON_USE_ERROR', 400));
  } finally {
    client.release();
  }
});

// Deactivate coupon
router.patch('/:id/deactivate', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await query(
      'UPDATE coupons SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Coupon', id));
    }
    
    res.json(successResponse(result.rows[0], 'Coupon deactivated successfully'));
  } catch (error) {
    console.error('Deactivate coupon error:', error);
    res.status(400).json(errorResponse(error.message, 'COUPON_DEACTIVATE_ERROR', 400));
  }
});



// Get coupon usage history
router.get('/usage-history', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { coupon_id, customer_email, start_date, end_date, limit = 50, offset = 0 } = req.query;
  
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (coupon_id) {
      whereClause += ` AND cu.coupon_id = $${paramIndex}`;
      params.push(coupon_id);
      paramIndex++;
    }
    
    if (customer_email) {
      whereClause += ` AND cu.customer_email ILIKE $${paramIndex}`;
      params.push(`%${customer_email}%`);
      paramIndex++;
    }
    
    if (start_date) {
      whereClause += ` AND cu.used_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      whereClause += ` AND cu.used_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    params.push(limit, offset);
    
    const result = await query(
      `SELECT cu.*, c.code as coupon_code, c.name as coupon_name
       FROM coupon_usage cu
       JOIN coupons c ON cu.coupon_id = c.id
       ${whereClause}
       ORDER BY cu.used_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );
    
    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM coupon_usage cu
       JOIN coupons c ON cu.coupon_id = c.id
       ${whereClause}`,
      params.slice(0, -2) // Remove limit and offset from count query
    );
    
    res.json(successResponse({
      usage_history: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    }, 'Coupon usage history retrieved successfully'));
  } catch (error) {
    console.error('Get coupon usage history error:', error);
    res.status(400).json(errorResponse(error.message, 'COUPON_HISTORY_ERROR', 400));
  }
});

export default router;