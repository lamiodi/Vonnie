import express from 'express';
import crypto from 'crypto';
import { query, getClient } from '../config/db.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/ecommerce/paystack
// Receive Paystack payment confirmation for ecommerce orders
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ecommerce/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Verify webhook signature
    // ─────────────────────────────────────────────────────────────
    const signature = req.headers['x-paystack-signature'];
    const expectedSignature = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(req.body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('Invalid Paystack signature for ecommerce webhook');
      return res.status(401).json(errorResponse('Invalid signature', 'INVALID_SIGNATURE', 401));
    }

    // Parse the event
    let event;
    if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString('utf8'));
    } else if (typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else {
      event = req.body;
    }

    console.log('Ecommerce Paystack webhook received:', event.event, event.data?.reference);

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Handle successful payment
    // ─────────────────────────────────────────────────────────────
    if (event.event === 'charge.success') {
      await handleEcommerceSuccess(event.data);
    }

    // ─────────────────────────────────────────────────────────────
    // Handle failed payment
    // ─────────────────────────────────────────────────────────────
    if (event.event === 'charge.failed') {
      await handleEcommerceFailure(event.data);
    }

    // Always return 200 to acknowledge webhook
    res.json(successResponse({ received: true }, 'Webhook processed'));

  } catch (error) {
    console.error('Ecommerce webhook error:', error);
    res.status(500).json(errorResponse('Webhook processing failed', 'WEBHOOK_ERROR', 500));
  }
});

/**
 * Handle successful ecommerce payment
 */
async function handleEcommerceSuccess(data) {
  const { reference, amount, customer, metadata } = data;
  const orderId = metadata?.order_id;
  const wpOrderId = metadata?.wp_order_id;

  if (!orderId) {
    console.error('Missing order_id in webhook metadata');
    return;
  }

  try {
    // ─────────────────────────────────────────────────────────────
    // STEP 1: Find and update order in YOUR database
    // ─────────────────────────────────────────────────────────────
    const orderResult = await query(
      `SELECT * FROM ecommerce_orders WHERE id = $1 AND status = 'pending_payment'`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      console.log(`Order ${orderId} not found or already processed`);
      return;
    }

    const order = orderResult.rows[0];

    // Update order status
    await query(
      `UPDATE ecommerce_orders 
       SET status = 'completed', 
           payment_reference = $1, 
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [reference, orderId]
    );

    console.log(`Order ${orderId} marked as completed`);

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Deduct stock in YOUR database
    // ─────────────────────────────────────────────────────────────
    const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

    for (const item of items) {
      await query(
        `UPDATE products 
         SET stock_level = stock_level - $1,
             updated_at = NOW()
         WHERE id = $2 AND stock_level >= $1`,
        [item.quantity, item.product_id]
      );
    }

    console.log(`Stock deducted for order ${orderId}`);

    // ─────────────────────────────────────────────────────────────
    // STEP 3: Send callback to WordPress
    // ─────────────────────────────────────────────────────────────
    await notifyWordPress(wpOrderId, {
      status: 'completed',
      payment_reference: reference,
      order_id: orderId,
      items: items
    });

    // ─────────────────────────────────────────────────────────────
    // STEP 4: Send new stock levels to WordPress
    // ─────────────────────────────────────────────────────────────
    await syncStockToWordPress(items);

    console.log(`Ecommerce order ${orderId} processed successfully`);

  } catch (error) {
    console.error('Error processing ecommerce success:', error);
  }
}

/**
 * Handle failed ecommerce payment
 */
async function handleEcommerceFailure(data) {
  const { reference, metadata } = data;
  const orderId = metadata?.order_id;
  const wpOrderId = metadata?.wp_order_id;

  if (!orderId) {
    console.error('Missing order_id in webhook metadata');
    return;
  }

  try {
    // Update order status
    await query(
      `UPDATE ecommerce_orders 
       SET status = 'failed', 
           updated_at = NOW()
       WHERE id = $1`,
      [orderId]
    );

    console.log(`Order ${orderId} marked as failed`);

    // Notify WordPress of failure
    await notifyWordPress(wpOrderId, {
      status: 'failed',
      payment_reference: null,
      order_id: orderId
    });

  } catch (error) {
    console.error('Error processing ecommerce failure:', error);
  }
}

/**
 * Send callback to WordPress
 */
async function notifyWordPress(wpOrderId, data) {
  if (!wpOrderId) {
    console.log('No wp_order_id to notify');
    return;
  }

  try {
    const response = await fetch(
      `${process.env.WORDPRESS_URL}/wp-json/vonne/v1/payment-callback`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WORDPRESS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          wp_order_id: wpOrderId,
          status: data.status,
          payment_reference: data.payment_reference,
          order_id: data.order_id,
          items: data.items
        })
      }
    );

    if (response.ok) {
      console.log(`WordPress notified for order ${wpOrderId}`);
    } else {
      const errorText = await response.text();
      console.error('WordPress notification failed:', errorText);
    }
  } catch (error) {
    console.error('Failed to notify WordPress:', error.message);
  }
}

/**
 * Sync new stock levels to WordPress
 */
async function syncStockToWordPress(items) {
  try {
    const stockUpdates = [];

    for (const item of items) {
      const result = await query(
        'SELECT id, stock_level FROM products WHERE id = $1',
        [item.product_id]
      );

      if (result.rows.length > 0) {
        stockUpdates.push({
          product_id: item.product_id,
          stock_quantity: result.rows[0].stock_level
        });
      }
    }

    if (stockUpdates.length === 0) {
      return;
    }

    const response = await fetch(
      `${process.env.WORDPRESS_URL}/wp-json/vonne/v1/stock-update`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WORDPRESS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stock_updates: stockUpdates })
      }
    );

    if (response.ok) {
      console.log('Stock synced to WordPress');
    } else {
      const errorText = await response.text();
      console.error('Stock sync failed:', errorText);
    }
  } catch (error) {
    console.error('Failed to sync stock:', error.message);
  }
}

export default router;
