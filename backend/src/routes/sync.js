/**
 * Sync Routes — Batch endpoints for offline data sync
 * POST /api/sync/batch-transactions — Bulk create offline transactions
 * POST /api/sync/batch-expenses — Bulk create offline expenses
 * POST /api/sync/batch-bookings — Bulk create offline bookings
 * POST /api/sync/batch-inventory — Bulk create offline inventory adjustments
 * GET  /api/sync/status — Check server state for conflict detection
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { getClient } from '../config/db.js';
import { query } from '../config/database.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = express.Router();

/**
 * GET /api/sync/status — Check server health and get server timestamp
 * Used for conflict detection
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT NOW() as server_time');
    res.json(successResponse({
      serverTime: result.rows[0].server_time,
      status: 'online'
    }, 'Server status OK'));
  } catch (error) {
    res.status(503).json(errorResponse('Server unavailable', 'SERVER_UNAVAILABLE', 503));
  }
});

/**
 * POST /api/sync/batch-transactions — Bulk create offline transactions
 * Handles deduplication by temp receipt number and stock validation
 */
router.post('/batch-transactions', authenticate, authorize(['staff', 'manager', 'admin']), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { transactions } = req.body;

    if (!transactions || transactions.length === 0) {
      return res.status(400).json(errorResponse('No transactions provided', 'NO_DATA', 400));
    }

    const results = [];
    const conflicts = [];

    for (const txn of transactions) {
      try {
        // Check for duplicate by temp receipt number
        if (txn.transactionNumber && txn.transactionNumber.startsWith('LOCAL-TXN-')) {
          const dupCheck = await client.query(
            'SELECT id FROM pos_transactions WHERE payment_reference = $1',
            [txn.transactionNumber]
          );
          if (dupCheck.rows.length > 0) {
            results.push({
              localId: txn.localId,
              status: 'duplicate',
              serverTransactionNumber: dupCheck.rows[0].id
            });
            continue;
          }
        }

        // Validate and deduct stock for each item
        let productAmount = 0;
        let hasStockIssue = false;

        if (txn.items && txn.items.length > 0) {
          for (const item of txn.items) {
            if (item.type === 'product' && item.product_id) {
              const productResult = await client.query(
                'SELECT name, price, stock_level, stock_by_size FROM products WHERE id = $1 FOR UPDATE',
                [item.product_id]
              );

              if (productResult.rows.length === 0) {
                hasStockIssue = true;
                break;
              }

              const product = productResult.rows[0];
              if (item.size) {
                const stockBySize = product.stock_by_size || {};
                const sizeStock = Number(stockBySize[item.size]) || 0;
                if (sizeStock < item.quantity) {
                  hasStockIssue = true;
                  break;
                }
                stockBySize[item.size] = sizeStock - item.quantity;
                await client.query(
                  'UPDATE products SET stock_by_size = $1, stock_level = stock_level - $2 WHERE id = $3',
                  [stockBySize, item.quantity, item.product_id]
                );
              } else {
                if (product.stock_level < item.quantity) {
                  hasStockIssue = true;
                  break;
                }
                await client.query(
                  'UPDATE products SET stock_level = stock_level - $1 WHERE id = $2',
                  [item.quantity, item.product_id]
                );
              }
              productAmount += Number(product.price) * Number(item.quantity);
            } else if (item.type === 'service' && item.service_id) {
              const serviceResult = await client.query(
                'SELECT price FROM services WHERE id = $1',
                [item.service_id]
              );
              if (serviceResult.rows.length > 0) {
                const unitPrice = item.price !== undefined ? Number(item.price) : Number(serviceResult.rows[0].price);
                productAmount += unitPrice * Number(item.quantity);
              }
            }
          }
        }

        if (hasStockIssue) {
          conflicts.push({
            localId: txn.localId,
            transactionNumber: txn.transactionNumber,
            reason: 'Insufficient stock — flagged for manual review',
            items: txn.items
          });
          continue;
        }

        // Generate real transaction number
        const realTxnNumber = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        // Create transaction
        const txnResult = await client.query(
          `INSERT INTO pos_transactions
           (transaction_number, customer_name, customer_email, customer_phone,
            subtotal, discount_amount, total_amount, payment_method, payment_status,
            status, created_by, payment_reference, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id, transaction_number`,
          [
            realTxnNumber,
            txn.customerInfo?.name || null,
            txn.customerInfo?.email || null,
            txn.customerInfo?.phone || null,
            txn.subtotal || productAmount,
            txn.discountAmount || 0,
            txn.totalAmount || productAmount,
            txn.paymentMethod || 'cash',
            txn.paymentStatus || 'completed',
            'completed',
            req.user.id,
            txn.transactionNumber, // Store temp receipt as payment_reference for dedup
            txn.createdAt || new Date().toISOString()
          ]
        );

        const transactionId = txnResult.rows[0].id;

        // Insert transaction items
        if (txn.items && txn.items.length > 0) {
          for (const item of txn.items) {
            if (item.type === 'product' && item.product_id) {
              const prodResult = await client.query('SELECT name, price FROM products WHERE id = $1', [item.product_id]);
              const product = prodResult.rows[0];
              await client.query(
                'INSERT INTO pos_transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price, size) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [transactionId, item.product_id, product.name, item.quantity, product.price, Number(item.quantity) * Number(product.price), item.size || null]
              );
            } else if (item.type === 'service' && item.service_id) {
              const svcResult = await client.query('SELECT name, price FROM services WHERE id = $1', [item.service_id]);
              const service = svcResult.rows[0];
              const unitPrice = item.price !== undefined ? Number(item.price) : Number(service.price);
              await client.query(
                'INSERT INTO pos_transaction_items (transaction_id, service_id, service_name, quantity, unit_price, total_price) VALUES ($1, $2, $3, $4, $5, $6)',
                [transactionId, item.service_id, service.name, item.quantity, unitPrice, Number(item.quantity) * unitPrice]
              );
            }
          }
        }

        results.push({
          localId: txn.localId,
          status: 'synced',
          serverTransactionNumber: realTxnNumber,
          serverId: transactionId
        });

      } catch (itemError) {
        console.error('Error processing synced transaction:', itemError);
        results.push({
          localId: txn.localId,
          status: 'failed',
          error: itemError.message
        });
      }
    }

    await client.query('COMMIT');

    res.json(successResponse({
      results,
      conflicts,
      totalProcessed: results.length,
      totalConflicts: conflicts.length
    }, `Batch sync complete: ${results.filter(r => r.status === 'synced').length} synced, ${conflicts.length} conflicts`, 200));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch transactions sync error:', error);
    res.status(500).json(errorResponse(error.message, 'SYNC_ERROR', 500));
  } finally {
    client.release();
  }
});

/**
 * POST /api/sync/batch-expenses — Bulk create offline expenses
 */
router.post('/batch-expenses', authenticate, authorize(['staff', 'manager', 'admin']), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { expenses } = req.body;

    if (!expenses || expenses.length === 0) {
      return res.status(400).json(errorResponse('No expenses provided', 'NO_DATA', 400));
    }

    const results = [];

    for (const exp of expenses) {
      try {
        const result = await client.query(
          `INSERT INTO expenses
           (date, amount, category, payment_method, supplier, description, receipt_reference, recorded_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            exp.date || new Date().toISOString().split('T')[0],
            exp.amount,
            exp.category,
            exp.paymentMethod || exp.payment_method || 'cash',
            exp.supplier || null,
            exp.description || null,
            exp.receiptReference || exp.receipt_reference || null,
            req.user.id,
            exp.createdAt || new Date().toISOString()
          ]
        );
        results.push({ localId: exp.localId, status: 'synced', serverId: result.rows[0].id });
      } catch (itemError) {
        console.error('Error processing synced expense:', itemError);
        results.push({ localId: exp.localId, status: 'failed', error: itemError.message });
      }
    }

    await client.query('COMMIT');

    res.json(successResponse({
      results,
      totalProcessed: results.filter(r => r.status === 'synced').length
    }, `Synced ${results.filter(r => r.status === 'synced').length} expense(s)`, 200));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch expenses sync error:', error);
    res.status(500).json(errorResponse(error.message, 'SYNC_ERROR', 500));
  } finally {
    client.release();
  }
});

/**
 * POST /api/sync/batch-bookings — Bulk create offline bookings
 */
router.post('/batch-bookings', authenticate, authorize(['manager', 'admin']), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { bookings } = req.body;

    if (!bookings || bookings.length === 0) {
      return res.status(400).json(errorResponse('No bookings provided', 'NO_DATA', 400));
    }

    const results = [];

    for (const booking of bookings) {
      try {
        // Check for scheduling conflicts
        const conflictCheck = await client.query(
          `SELECT id FROM bookings
           WHERE scheduled_time = $1
           AND status NOT IN ('cancelled', 'completed')
           AND worker_id = $2`,
          [booking.scheduledTime, booking.workerId]
        );

        const bookingNumber = `BK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

        const result = await client.query(
          `INSERT INTO bookings
           (booking_number, customer_name, customer_email, customer_phone,
            service_id, scheduled_time, status, total_amount, notes, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, booking_number`,
          [
            bookingNumber,
            booking.customerName || booking.customer_name,
            booking.customerEmail || booking.customer_email || null,
            booking.customerPhone || booking.customer_phone || null,
            booking.serviceId || booking.service_id,
            booking.scheduledTime || booking.scheduled_time,
            booking.status || 'scheduled',
            booking.totalAmount || booking.total_amount || 0,
            booking.notes || null,
            req.user.id,
            booking.createdAt || new Date().toISOString()
          ]
        );

        results.push({
          localId: booking.localId,
          status: 'synced',
          serverId: result.rows[0].id,
          bookingNumber: result.rows[0].booking_number,
          hasConflict: conflictCheck.rows.length > 0
        });

      } catch (itemError) {
        console.error('Error processing synced booking:', itemError);
        results.push({ localId: booking.localId, status: 'failed', error: itemError.message });
      }
    }

    await client.query('COMMIT');

    res.json(successResponse({
      results,
      totalProcessed: results.filter(r => r.status === 'synced').length
    }, `Synced ${results.filter(r => r.status === 'synced').length} booking(s)`, 200));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch bookings sync error:', error);
    res.status(500).json(errorResponse(error.message, 'SYNC_ERROR', 500));
  } finally {
    client.release();
  }
});

/**
 * POST /api/sync/batch-inventory — Bulk create offline inventory adjustments
 */
router.post('/batch-inventory', authenticate, authorize(['manager', 'admin']), async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { adjustments } = req.body;

    if (!adjustments || adjustments.length === 0) {
      return res.status(400).json(errorResponse('No adjustments provided', 'NO_DATA', 400));
    }

    const results = [];

    for (const adj of adjustments) {
      try {
        // Update stock
        if (adj.adjustmentType === 'restock' || adj.adjustmentType === 'adjustment') {
          await client.query(
            'UPDATE products SET stock_level = stock_level + $1, updated_at = NOW() WHERE id = $2',
            [adj.quantityChange, adj.productId]
          );
        } else if (adj.adjustmentType === 'correction') {
          await client.query(
            'UPDATE products SET stock_level = $1, updated_at = NOW() WHERE id = $2',
            [adj.newStock, adj.productId]
          );
        }

        // Log the movement
        await client.query(
          `INSERT INTO inventory_movements (product_id, movement_type, quantity, size, note, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            adj.productId,
            adj.adjustmentType,
            adj.quantityChange || 0,
            adj.size || null,
            adj.note || 'Offline adjustment',
            req.user.id
          ]
        );

        results.push({ localId: adj.localId, status: 'synced' });
      } catch (itemError) {
        console.error('Error processing synced inventory adjustment:', itemError);
        results.push({ localId: adj.localId, status: 'failed', error: itemError.message });
      }
    }

    await client.query('COMMIT');

    res.json(successResponse({
      results,
      totalProcessed: results.filter(r => r.status === 'synced').length
    }, `Synced ${results.filter(r => r.status === 'synced').length} adjustment(s)`, 200));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Batch inventory sync error:', error);
    res.status(500).json(errorResponse(error.message, 'SYNC_ERROR', 500));
  } finally {
    client.release();
  }
});

export default router;
