import express from 'express';
import { query, getClient } from '../config/db.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/ecommerce/checkout
// Receive order from WordPress, validate stock, initialize Paystack
// ─────────────────────────────────────────────────────────────────────────────
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const {
      wp_order_id,
      customer_email,
      customer_phone,
      customer_name,
      shipping_address,
      items,
      total_amount
    } = req.body;

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Validate required fields
    // ─────────────────────────────────────────────────────────────
    if (!customer_email || !items || items.length === 0 || !total_amount) {
      return res.status(400).json(
        errorResponse('Missing required fields: email, items, or total_amount', 'CHECKOUT_VALIDATION_ERROR', 400)
      );
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Validate stock availability (YOUR DATABASE)
    // ─────────────────────────────────────────────────────────────
    const stockErrors = [];
    for (const item of items) {
      const product = await query(
        'SELECT id, name, stock_level FROM products WHERE id = $1 AND is_active = true',
        [item.product_id]
      );

      if (product.rows.length === 0) {
        stockErrors.push(`Product ID ${item.product_id} not found or inactive`);
      } else if (product.rows[0].stock_level < item.quantity) {
        stockErrors.push(
          `Insufficient stock for "${product.rows[0].name}". Available: ${product.rows[0].stock_level}, Requested: ${item.quantity}`
        );
      }
    }

    if (stockErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Stock validation failed',
        stock_errors: stockErrors
      });
    }

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Create order in YOUR database
    // ─────────────────────────────────────────────────────────────
    const orderResult = await query(
      `INSERT INTO ecommerce_orders 
       (wp_order_id, customer_email, customer_phone, customer_name, shipping_address, items, total_amount, status, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_payment', 'paystack')
       RETURNING *`,
      [
        wp_order_id,
        customer_email,
        customer_phone,
        customer_name,
        JSON.stringify(shipping_address),
        JSON.stringify(items),
        total_amount
      ]
    );

    const order = orderResult.rows[0];

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Initialize Paystack payment
    // ─────────────────────────────────────────────────────────────
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: customer_email,
        amount: Math.round(total_amount * 100), // Convert NGN to kobo
        callback_url: `${process.env.WORDPRESS_URL}/wp-json/vonne/v1/payment-callback`,
        metadata: {
          order_id: order.id,
          wp_order_id: wp_order_id,
          customer_name,
          customer_phone
        }
      })
    });

    const paystackData = await paystackResponse.json();

    if (paystackData.status) {
      // Update order with Paystack reference
      await query(
        'UPDATE ecommerce_orders SET paystack_reference = $1 WHERE id = $2',
        [paystackData.data.reference, order.id]
      );

      // ─────────────────────────────────────────────────────────
      // STEP 5: Return Paystack payment URL to WordPress
      // ─────────────────────────────────────────────────────────
      res.json(
        successResponse({
          payment_url: paystackData.data.authorization_url,
          reference: paystackData.data.reference,
          order_id: order.id,
          wp_order_id: wp_order_id
        }, 'Payment initialized successfully')
      );
    } else {
      await query(
        "UPDATE ecommerce_orders SET status = 'failed' WHERE id = $1",
        [order.id]
      );
      res.status(400).json(
        errorResponse('Failed to initialize Paystack payment', 'PAYSTACK_INIT_ERROR', 400)
      );
    }

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json(
      errorResponse('Checkout failed. Please try again.', 'CHECKOUT_ERROR', 500)
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/ecommerce/order-status/:id
// Get order status (for WordPress to check)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/order-status/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, wp_order_id, customer_email, customer_name, total_amount, 
              status, payment_method, paystack_reference, paid_at, created_at
       FROM ecommerce_orders 
       WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(
        errorResponse('Order not found', 'ORDER_NOT_FOUND', 404)
      );
    }

    res.json(successResponse(result.rows[0], 'Order status retrieved'));
  } catch (error) {
    console.error('Get order status error:', error);
    res.status(500).json(errorResponse(error.message, 'ORDER_STATUS_ERROR', 500));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/ecommerce/order-by-reference/:reference
// Get order by Paystack reference
// ─────────────────────────────────────────────────────────────────────────────
router.get('/order-by-reference/:reference', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, wp_order_id, customer_email, customer_name, total_amount, 
              status, payment_method, paystack_reference, paid_at, created_at
       FROM ecommerce_orders 
       WHERE paystack_reference = $1`,
      [req.params.reference]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(
        errorResponse('Order not found', 'ORDER_NOT_FOUND', 404)
      );
    }

    res.json(successResponse(result.rows[0], 'Order retrieved'));
  } catch (error) {
    console.error('Get order by reference error:', error);
    res.status(500).json(errorResponse(error.message, 'ORDER_FETCH_ERROR', 500));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/ecommerce/orders
// List all ecommerce orders (admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/orders', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT * FROM ecommerce_orders WHERE 1=1`;
    const params = [];
    let idx = 1;

    if (status) {
      sql += ` AND status = $${idx++}`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(parseInt(limit), offset);

    const result = await query(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) FROM ecommerce_orders WHERE 1=1`;
    const countParams = [];
    let cIdx = 1;
    if (status) {
      countSql += ` AND status = $${cIdx++}`;
      countParams.push(status);
    }
    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json(successResponse({
      orders: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    }, 'Orders retrieved'));
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json(errorResponse(error.message, 'ORDERS_FETCH_ERROR', 500));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/v1/ecommerce/orders/:id/status
// Update order status (for manual updates)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/orders/:id/status', authenticate, async (req, res) => {
  try {
    const { status, payment_reference } = req.body;

    const result = await query(
      `UPDATE ecommerce_orders 
       SET status = $1, 
           paystack_reference = COALESCE($2, paystack_reference),
           paid_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE paid_at END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, payment_reference, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(
        errorResponse('Order not found', 'ORDER_NOT_FOUND', 404)
      );
    }

    res.json(successResponse(result.rows[0], 'Order status updated'));
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json(errorResponse(error.message, 'ORDER_UPDATE_ERROR', 500));
  }
});

export default router;
