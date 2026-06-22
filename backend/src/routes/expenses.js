import express from 'express';
import { query, getClient } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse } from '../utils/apiResponse.js';
import { validateRequiredFields } from '../utils/validation.js';

const router = express.Router();

// Get all expenses with filters
router.get('/', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date, category, payment_method, recorded_by, limit = 100, offset = 0 } = req.query;
    
    let sql = `
      SELECT e.*, u.name as recorded_by_name
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (start_date) {
      paramCount++;
      sql += ` AND e.date >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      sql += ` AND e.date <= $${paramCount}`;
      params.push(end_date);
    }
    
    if (category) {
      paramCount++;
      sql += ` AND e.category = $${paramCount}`;
      params.push(category);
    }
    
    if (payment_method) {
      paramCount++;
      sql += ` AND e.payment_method = $${paramCount}`;
      params.push(payment_method);
    }
    
    if (recorded_by) {
      paramCount++;
      sql += ` AND e.recorded_by = $${paramCount}`;
      params.push(recorded_by);
    }
    
    sql += ` ORDER BY e.date DESC, e.created_at DESC`;
    
    // Add pagination
    paramCount++;
    sql += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    sql += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));
    
    const result = await query(sql, params);
    
    // Get total count for pagination
    let countSql = `SELECT COUNT(*) FROM expenses e WHERE 1=1`;
    const countParams = [];
    let countParamCount = 0;
    
    if (start_date) {
      countParamCount++;
      countSql += ` AND e.date >= $${countParamCount}`;
      countParams.push(start_date);
    }
    if (end_date) {
      countParamCount++;
      countSql += ` AND e.date <= $${countParamCount}`;
      countParams.push(end_date);
    }
    if (category) {
      countParamCount++;
      countSql += ` AND e.category = $${countParamCount}`;
      countParams.push(category);
    }
    if (payment_method) {
      countParamCount++;
      countSql += ` AND e.payment_method = $${countParamCount}`;
      countParams.push(payment_method);
    }
    if (recorded_by) {
      countParamCount++;
      countSql += ` AND e.recorded_by = $${countParamCount}`;
      countParams.push(recorded_by);
    }
    
    const countResult = await query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    res.json(successResponse({
      expenses: result.rows,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + result.rows.length < totalCount
      }
    }, 'Expenses retrieved successfully'));
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(400).json(errorResponse(error.message, 'EXPENSES_FETCH_ERROR', 400));
  }
});

// Get expense summary (totals by period)
router.get('/summary', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let dateFilter = '';
    const params = [];
    let paramCount = 0;
    
    if (start_date) {
      paramCount++;
      dateFilter += ` AND date >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      dateFilter += ` AND date <= $${paramCount}`;
      params.push(end_date);
    }
    
    // Default to current month if no dates provided
    if (!start_date && !end_date) {
      dateFilter = ` AND date >= date_trunc('month', CURRENT_DATE) AND date <= date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day'`;
    }
    
    const totalResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE 1=1 ${dateFilter}`,
      params
    );
    
    const byCategoryResult = await query(
      `SELECT category, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE 1=1 ${dateFilter} GROUP BY category ORDER BY total DESC`,
      params
    );
    
    const byPaymentResult = await query(
      `SELECT payment_method, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE 1=1 ${dateFilter} GROUP BY payment_method ORDER BY total DESC`,
      params
    );
    
    const byDayResult = await query(
      `SELECT date, COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE 1=1 ${dateFilter} GROUP BY date ORDER BY date DESC LIMIT 30`,
      params
    );
    
    res.json(successResponse({
      total: parseFloat(totalResult.rows[0].total),
      count: parseInt(totalResult.rows[0].count),
      byCategory: byCategoryResult.rows,
      byPaymentMethod: byPaymentResult.rows,
      byDay: byDayResult.rows
    }, 'Expense summary retrieved successfully'));
  } catch (error) {
    console.error('Expense summary error:', error);
    res.status(400).json(errorResponse(error.message, 'EXPENSE_SUMMARY_ERROR', 400));
  }
});

// Get today's expenses
router.get('/today', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, u.name as recorded_by_name
       FROM expenses e
       LEFT JOIN users u ON e.recorded_by = u.id
       WHERE e.date = CURRENT_DATE
       ORDER BY e.created_at DESC`
    );
    
    const total = result.rows.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    res.json(successResponse({
      expenses: result.rows,
      total,
      count: result.rows.length
    }, 'Today\'s expenses retrieved successfully'));
  } catch (error) {
    console.error('Today expenses error:', error);
    res.status(400).json(errorResponse(error.message, 'TODAY_EXPENSES_ERROR', 400));
  }
});

// Get this week's expenses
router.get('/this-week', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query(
      `SELECT e.*, u.name as recorded_by_name
       FROM expenses e
       LEFT JOIN users u ON e.recorded_by = u.id
       WHERE e.date >= date_trunc('week', CURRENT_DATE)
       AND e.date <= date_trunc('week', CURRENT_DATE) + interval '6 days'
       ORDER BY e.date DESC, e.created_at DESC`
    );
    
    const total = result.rows.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    
    res.json(successResponse({
      expenses: result.rows,
      total,
      count: result.rows.length
    }, 'This week\'s expenses retrieved successfully'));
  } catch (error) {
    console.error('This week expenses error:', error);
    res.status(400).json(errorResponse(error.message, 'WEEK_EXPENSES_ERROR', 400));
  }
});

// Get single expense
router.get('/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT e.*, u.name as recorded_by_name
       FROM expenses e
       LEFT JOIN users u ON e.recorded_by = u.id
       WHERE e.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Expense', id));
    }
    
    res.json(successResponse(result.rows[0], 'Expense retrieved successfully'));
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(400).json(errorResponse(error.message, 'EXPENSE_FETCH_ERROR', 400));
  }
});

// Add new expense
router.post('/', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { date, amount, category, payment_method, supplier, description, receipt_reference } = req.body;
  
  // Validate required fields
  const validation = validateRequiredFields(req.body, ['date', 'amount', 'category', 'payment_method']);
  if (!validation.isValid) {
    return res.status(400).json(validationErrorResponse(validation.missingFields, validation.error));
  }
  
  // Validate amount
  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return res.status(400).json(errorResponse('Amount must be a positive number', 'INVALID_AMOUNT', 400));
  }
  
  // Validate category
  const validCategories = [
    'rent', 'electricity', 'diesel', 'fuel', 'internet', 'product_purchase',
    'maintenance', 'logistics', 'marketing', 'petty_cash', 'staff_welfare',
    'refund_or_loss', 'miscellaneous'
  ];
  if (!validCategories.includes(category)) {
    return res.status(400).json(errorResponse('Invalid expense category', 'INVALID_CATEGORY', 400));
  }
  
  // Validate payment method
  const validPaymentMethods = ['cash', 'card', 'transfer', 'bank_transfer', 'paystack'];
  if (!validPaymentMethods.includes(payment_method)) {
    return res.status(400).json(errorResponse('Invalid payment method', 'INVALID_PAYMENT_METHOD', 400));
  }
  
  try {
    const result = await query(
      `INSERT INTO expenses (date, amount, category, payment_method, supplier, description, receipt_reference, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [date, numericAmount, category, payment_method, supplier || null, description || null, receipt_reference || null, req.user.id]
    );
    
    // Log audit (gracefully handle if audit_logs table doesn't exist)
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
         VALUES ($1, 'create', 'expense', $2, $3, CURRENT_TIMESTAMP)`,
        [req.user.id, result.rows[0].id, JSON.stringify({ amount: numericAmount, category })]
      );
    } catch (auditError) {
      console.warn('Audit log failed (table may not exist):', auditError.message);
    }
    
    res.status(201).json(successResponse(result.rows[0], 'Expense created successfully', 201));
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(400).json(errorResponse(error.message, 'EXPENSE_CREATE_ERROR', 400));
  }
});

// Update expense
router.put('/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { date, amount, category, payment_method, supplier, description, receipt_reference } = req.body;
  
  try {
    // Get old values for audit
    const oldResult = await query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Expense', id));
    }
    
    const oldExpense = oldResult.rows[0];
    
    const result = await query(
      `UPDATE expenses 
       SET date = COALESCE($1, date),
           amount = COALESCE($2, amount),
           category = COALESCE($3, category),
           payment_method = COALESCE($4, payment_method),
           supplier = COALESCE($5, supplier),
           description = COALESCE($6, description),
           receipt_reference = COALESCE($7, receipt_reference),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [date, amount, category, payment_method, supplier, description, receipt_reference, id]
    );
    
    // Log audit (gracefully handle if audit_logs table doesn't exist)
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
         VALUES ($1, 'update', 'expense', $2, $3, CURRENT_TIMESTAMP)`,
        [req.user.id, id, JSON.stringify({ old: oldExpense, new: result.rows[0] })]
      );
    } catch (auditError) {
      console.warn('Audit log failed (table may not exist):', auditError.message);
    }
    
    res.json(successResponse(result.rows[0], 'Expense updated successfully'));
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(400).json(errorResponse(error.message, 'EXPENSE_UPDATE_ERROR', 400));
  }
});

// Delete expense (admin only, soft delete)
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get old values for audit
    const oldResult = await query('SELECT * FROM expenses WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Expense', id));
    }
    
    const result = await query(
      'DELETE FROM expenses WHERE id = $1 RETURNING *',
      [id]
    );
    
    // Log audit (gracefully handle if audit_logs table doesn't exist)
    try {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at)
         VALUES ($1, 'delete', 'expense', $2, $3, CURRENT_TIMESTAMP)`,
        [req.user.id, id, JSON.stringify(oldResult.rows[0])]
      );
    } catch (auditError) {
      console.warn('Audit log failed (table may not exist):', auditError.message);
    }
    
    res.json(successResponse(result.rows[0], 'Expense deleted successfully'));
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(400).json(errorResponse(error.message, 'EXPENSE_DELETE_ERROR', 400));
  }
});

// Get expense categories
router.get('/meta/categories', authenticate, async (req, res) => {
  const categories = [
    { value: 'rent', label: 'Rent' },
    { value: 'electricity', label: 'Electricity' },
    { value: 'diesel', label: 'Diesel/Fuel' },
    { value: 'internet', label: 'Internet' },
    { value: 'product_purchase', label: 'Product Purchase' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'logistics', label: 'Logistics' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'petty_cash', label: 'Petty Cash' },
    { value: 'staff_welfare', label: 'Staff Welfare' },
    { value: 'refund_or_loss', label: 'Refund/Loss' },
    { value: 'miscellaneous', label: 'Miscellaneous' }
  ];
  
  res.json(successResponse(categories, 'Categories retrieved'));
});

export default router;
