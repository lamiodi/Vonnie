import express from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = express.Router();

// Get audit logs with filters
router.get('/', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { entity_type, entity_id, user_id, action, start_date, end_date, limit = 50, offset = 0 } = req.query;
    
    let sql = `
      SELECT al.*, u.name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (entity_type) {
      paramCount++;
      sql += ` AND al.entity_type = $${paramCount}`;
      params.push(entity_type);
    }
    
    if (entity_id) {
      paramCount++;
      sql += ` AND al.entity_id = $${paramCount}`;
      params.push(entity_id);
    }
    
    if (user_id) {
      paramCount++;
      sql += ` AND al.user_id = $${paramCount}`;
      params.push(user_id);
    }
    
    if (action) {
      paramCount++;
      sql += ` AND al.action = $${paramCount}`;
      params.push(action);
    }
    
    if (start_date) {
      paramCount++;
      sql += ` AND al.created_at >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      sql += ` AND al.created_at <= $${paramCount}`;
      params.push(end_date);
    }
    
    sql += ` ORDER BY al.created_at DESC`;
    
    paramCount++;
    sql += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));
    
    const result = await query(sql, params);
    
    res.json(successResponse({
      logs: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    }, 'Audit logs retrieved successfully'));
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(400).json(errorResponse(error.message, 'AUDIT_LOGS_ERROR', 400));
  }
});

// Get fraud alerts (suspicious activity)
router.get('/fraud-alerts', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const alerts = [];
    
    // Check for duplicate payment references
    const duplicateRefs = await query(`
      SELECT payment_reference, COUNT(*) as count
      FROM pos_transactions
      WHERE payment_reference IS NOT NULL
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY payment_reference
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateRefs.rows.length > 0) {
      alerts.push({
        type: 'duplicate_payment_reference',
        severity: 'high',
        message: `${duplicateRefs.rows.length} duplicate payment reference(s) detected`,
        data: duplicateRefs.rows
      });
    }
    
    // Check for high-value cash expenses without receipt
    const highCashExpenses = await query(`
      SELECT e.*, u.name as recorded_by_name
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by = u.id
      WHERE e.payment_method = 'cash'
      AND e.amount > 50000
      AND (e.receipt_reference IS NULL OR e.receipt_reference = '')
      AND e.date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY e.amount DESC
    `);
    
    if (highCashExpenses.rows.length > 0) {
      alerts.push({
        type: 'high_cash_expense_no_receipt',
        severity: 'medium',
        message: `${highCashExpenses.rows.length} high-value cash expense(s) without receipt`,
        data: highCashExpenses.rows
      });
    }
    
    // Check for unusually high expense entries (above category average)
    const unusualExpenses = await query(`
      WITH category_avg AS (
        SELECT category, AVG(amount) as avg_amount, STDDEV(amount) as stddev_amount
        FROM expenses
        WHERE date >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY category
      )
      SELECT e.*, u.name as recorded_by_name, ca.avg_amount
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by = u.id
      JOIN category_avg ca ON e.category = ca.category
      WHERE e.amount > ca.avg_amount + (2 * COALESCE(ca.stddev_amount, 0))
      AND e.date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY e.amount DESC
    `);
    
    if (unusualExpenses.rows.length > 0) {
      alerts.push({
        type: 'unusual_expense_amount',
        severity: 'medium',
        message: `${unusualExpenses.rows.length} expense(s) significantly above category average`,
        data: unusualExpenses.rows
      });
    }
    
    // Check for frequent voids/cancellations by same user
    const frequentCancellations = await query(`
      SELECT created_by, COUNT(*) as cancel_count
      FROM pos_transactions
      WHERE status = 'cancelled'
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      AND created_by IS NOT NULL
      GROUP BY created_by
      HAVING COUNT(*) > 3
      ORDER BY cancel_count DESC
    `);
    
    if (frequentCancellations.rows.length > 0) {
      alerts.push({
        type: 'frequent_cancellations',
        severity: 'high',
        message: `${frequentCancellations.rows.length} user(s) with frequent cancellations`,
        data: frequentCancellations.rows
      });
    }
    
    // Check for refunds after already refunded
    const doubleRefunds = await query(`
      SELECT id, transaction_number, payment_status, created_at, updated_at
      FROM pos_transactions
      WHERE payment_status = 'refunded'
      AND updated_at > created_at + INTERVAL '1 day'
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);
    
    if (doubleRefunds.rows.length > 0) {
      alerts.push({
        type: 'potential_double_refund',
        severity: 'high',
        message: `${doubleRefunds.rows.length} transaction(s) with potential double refund`,
        data: doubleRefunds.rows
      });
    }
    
    res.json(successResponse({
      alerts,
      totalAlerts: alerts.length,
      highSeverity: alerts.filter(a => a.severity === 'high').length,
      mediumSeverity: alerts.filter(a => a.severity === 'medium').length
    }, 'Fraud alerts retrieved successfully'));
  } catch (error) {
    console.error('Fraud alerts error:', error);
    res.status(400).json(errorResponse(error.message, 'FRAUD_ALERTS_ERROR', 400));
  }
});

export default router;
