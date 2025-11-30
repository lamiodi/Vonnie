import express from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = express.Router();

// Sales report
router.get('/sales', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date, period = 'daily' } = req.query;
    
    let sql = `
      SELECT 
        t.id,
        t.total_amount,
        t.created_at,
        tii.quantity,
        tii.unit_price,
        tii.total_price,
        p.name as product_name,
        p.category as product_category
      FROM pos_transactions t
      LEFT JOIN pos_transaction_items tii ON t.id = tii.transaction_id
      LEFT JOIN products p ON tii.product_id = p.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (start_date) {
      paramCount++;
      sql += ` AND t.created_at >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      sql += ` AND t.created_at <= $${paramCount}`;
      params.push(end_date);
    }
    
    sql += ` ORDER BY t.created_at DESC`;
    
    const result = await query(sql, params);
    const data = result.rows;
    
    // Group by period
    const groupedData = data.reduce((acc, transaction) => {
      const date = new Date(transaction.created_at);
      let key;
      
      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else if (period === 'yearly') {
        key = date.getFullYear().toString();
      }
      
      if (!acc[key]) {
        acc[key] = {
          period: key,
          total_sales: 0,
          transaction_count: 0,
          items_sold: 0
        };
      }
      
      acc[key].total_sales += parseFloat(transaction.total_amount || 0);
      acc[key].transaction_count += 1;
      acc[key].items_sold += parseInt(transaction.quantity || 0);
      
      return acc;
    }, {});
    
    res.json(successResponse(Object.values(groupedData), 'Sales report generated successfully'));
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(400).json(errorResponse(error.message, 'SALES_REPORT_ERROR', 400));
  }
});

// Inventory report
router.get('/inventory', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY name');
    const data = result.rows;
    
    const report = {
      total_products: data.length,
      low_stock_items: data.filter(p => p.stock_level < 5).length,
      out_of_stock_items: data.filter(p => p.stock_level === 0).length,
      total_value: data.reduce((sum, p) => sum + (parseFloat(p.price || 0) * parseInt(p.stock_level || 0)), 0),
      products: data.map(p => ({
        ...p,
        stock_status: p.stock_level === 0 ? 'out_of_stock' : 
                     p.stock_level < 5 ? 'low_stock' : 'in_stock'
      }))
    };
    
    res.json(successResponse(report, 'Inventory report generated successfully'));
  } catch (error) {
    console.error('Inventory report error:', error);
    res.status(400).json(errorResponse(error.message, 'INVENTORY_REPORT_ERROR', 400));
  }
});

// Booking report
router.get('/bookings', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let sql = `
      SELECT 
        b.*,
        (svc.service_names)[1] AS service_name,
        svc.service_names AS service_names,
        COALESCE(svc.service_price, 0) AS service_price,
        u.name as user_name,
        u.email as user_email
      FROM bookings b
      LEFT JOIN LATERAL (
        SELECT 
          array_agg(s.name ORDER BY s.name) AS service_names,
          SUM(bs.total_price) AS service_price
        FROM booking_services bs
        JOIN services s ON bs.service_id = s.id
        WHERE bs.booking_id = b.id
      ) svc ON true
      LEFT JOIN users u ON b.worker_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (start_date) {
      paramCount++;
      sql += ` AND b.scheduled_time >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      sql += ` AND b.scheduled_time <= $${paramCount}`;
      params.push(end_date);
    }
    
    sql += ` ORDER BY b.scheduled_time DESC`;
    
    const result = await query(sql, params);
    const data = result.rows;
    
    const report = {
      total_bookings: data.length,
      scheduled_bookings: data.filter(b => b.status === 'scheduled').length,
      pending_confirmation_bookings: data.filter(b => b.status === 'pending_confirmation').length,
      cancelled_bookings: data.filter(b => b.status === 'cancelled').length,
      completed_bookings: data.filter(b => b.status === 'completed').length,
      total_revenue: data
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + parseFloat(b.service_price || 0), 0),
      bookings_by_service: data.reduce((acc, booking) => {
        const serviceNames = Array.isArray(booking.service_names)
          ? booking.service_names
          : (booking.service_name ? [booking.service_name] : []);
        const names = serviceNames.length > 0 ? serviceNames : ['Unknown Service'];
        names.forEach(serviceName => {
          if (!acc[serviceName]) {
            acc[serviceName] = { count: 0, revenue: 0 };
          }
          acc[serviceName].count += 1;
          if (booking.status === 'completed') {
            // Split revenue evenly across services if multiple exist
            const share = parseFloat(booking.service_price || 0) / names.length;
            acc[serviceName].revenue += share;
          }
        });
        return acc;
      }, {})
    };
    
    res.json(successResponse(report, 'Booking report generated successfully'));
  } catch (error) {
    console.error('Booking report error:', error);
    res.status(400).json(errorResponse(error.message, 'BOOKING_REPORT_ERROR', 400));
  }
});

// Coupon usage report
router.get('/coupons', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get all coupons with usage statistics
    const couponsResult = await query('SELECT * FROM coupons ORDER BY created_at DESC');
    const coupons = couponsResult.rows;
    
    // Get detailed usage data from coupon_usage table
    let usageQuery = `
      SELECT 
        cu.coupon_id,
        COUNT(cu.id) as actual_usage_count,
        SUM(cu.discount_amount) as total_discount_given,
        COUNT(DISTINCT cu.customer_email) as unique_customers
      FROM coupon_usage cu
      WHERE 1=1
    `;
    
    const usageParams = [];
    let paramIndex = 1;
    
    if (start_date) {
      usageQuery += ` AND cu.used_at >= $${paramIndex}`;
      usageParams.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      usageQuery += ` AND cu.used_at <= $${paramIndex}`;
      usageParams.push(end_date);
    }
    
    usageQuery += ` GROUP BY cu.coupon_id`;
    
    const usageResult = await query(usageQuery, usageParams);
    const usageData = usageResult.rows.reduce((acc, row) => {
      acc[row.coupon_id] = row;
      return acc;
    }, {});
    
    const report = {
      total_coupons: coupons.length,
      active_coupons: coupons.filter(c => c.is_active).length,
      expired_coupons: coupons.filter(c => new Date(c.expires_at) < new Date()).length,
      total_usage: coupons.reduce((sum, c) => sum + c.used_count, 0),
      total_actual_usage: Object.values(usageData).reduce((sum, data) => sum + parseInt(data.actual_usage_count || 0), 0),
      total_discount_given: Object.values(usageData).reduce((sum, data) => sum + parseFloat(data.total_discount_given || 0), 0),
      unique_customers_reached: Object.values(usageData).reduce((sum, data) => sum + parseInt(data.unique_customers || 0), 0),
      coupons: coupons.map(c => {
        const usage = usageData[c.id] || { actual_usage_count: 0, total_discount_given: 0, unique_customers: 0 };
        return {
          ...c,
          usage_rate: c.usage_limit ? (c.used_count / c.usage_limit * 100).toFixed(2) : 'Unlimited',
          actual_usage_count: parseInt(usage.actual_usage_count),
          total_discount_given: parseFloat(usage.total_discount_given),
          unique_customers: parseInt(usage.unique_customers),
          status: !c.is_active ? 'inactive' :
                  new Date(c.expires_at) < new Date() ? 'expired' :
                  c.usage_limit && c.used_count >= c.usage_limit ? 'exhausted' : 'active'
        };
      })
    };
    
    res.json(successResponse(report, 'Coupon usage report generated successfully'));
  } catch (error) {
    console.error('Coupon report error:', error);
    res.status(400).json(errorResponse(error.message, 'COUPON_REPORT_ERROR', 400));
  }
});

// Worker service performance report
router.get('/worker-performance', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date, worker_id } = req.query;
    
    let sql = `
      SELECT 
        u.id as worker_id,
        u.name as worker_name,
        u.email as worker_email,
        COUNT(bs.id) as total_services_performed,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'completed') as completed_services,
        COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'scheduled') as scheduled_bookings,
        SUM(bs.total_price) as total_service_revenue,
        AVG(bs.total_price) as average_service_value,
        s.name as most_performed_service,
        COUNT(bs.id) as service_frequency
      FROM users u
      LEFT JOIN bookings b ON u.id = b.worker_id
      LEFT JOIN booking_services bs ON bs.booking_id = b.id
      LEFT JOIN services s ON bs.service_id = s.id
      WHERE u.role IN ('staff', 'manager') AND u.is_active = true
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (worker_id) {
      paramCount++;
      sql += ` AND u.id = $${paramCount}`;
      params.push(worker_id);
    }
    
    if (start_date) {
      paramCount++;
      sql += ` AND b.scheduled_time >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      sql += ` AND b.scheduled_time <= $${paramCount}`;
      params.push(end_date);
    }
    
    sql += ` GROUP BY u.id, u.name, u.email, s.name ORDER BY total_service_revenue DESC`;
    
    const result = await query(sql, params);
    
    res.json(successResponse(result.rows, 'Worker performance report generated successfully'));
  } catch (error) {
    console.error('Worker performance report error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_PERFORMANCE_REPORT_ERROR', 400));
  }
});

// Customer report (NEW)
router.get('/customers', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Aggregate customer data from bookings and pos_transactions
    let sql = `
      WITH customer_stats AS (
        SELECT 
          COALESCE(customer_email, customer_phone, customer_name) as customer_id,
          MAX(customer_name) as customer_name,
          MAX(customer_email) as customer_email,
          MAX(customer_phone) as customer_phone,
          COUNT(DISTINCT id) as total_transactions,
          SUM(total_amount) as total_spent,
          MIN(created_at) as first_seen,
          MAX(created_at) as last_seen
        FROM (
          SELECT id, customer_name, customer_email, customer_phone, total_amount, created_at FROM bookings WHERE status = 'completed'
          UNION ALL
          SELECT id, customer_name, customer_email, customer_phone, total_amount, created_at FROM pos_transactions WHERE status = 'completed'
        ) all_tx
        WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;
    
    if (start_date) {
      paramCount++;
      sql += ` AND created_at >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      sql += ` AND created_at <= $${paramCount}`;
      params.push(end_date);
    }
    
    sql += `
        GROUP BY COALESCE(customer_email, customer_phone, customer_name)
      )
      SELECT * FROM customer_stats ORDER BY total_spent DESC
    `;
    
    const result = await query(sql, params);
    const customers = result.rows;
    
    const report = {
      total_unique_customers: customers.length,
      new_customers: customers.filter(c => {
        const firstSeen = new Date(c.first_seen);
        const start = start_date ? new Date(start_date) : new Date(0);
        return firstSeen >= start;
      }).length,
      returning_customers: customers.filter(c => parseInt(c.total_transactions) > 1).length,
      average_spend_per_customer: customers.length > 0 
        ? (customers.reduce((sum, c) => sum + parseFloat(c.total_spent), 0) / customers.length) 
        : 0,
      top_customers: customers.slice(0, 10)
    };
    
    res.json(successResponse(report, 'Customer report generated successfully'));
  } catch (error) {
    console.error('Customer report error:', error);
    res.status(400).json(errorResponse(error.message, 'CUSTOMER_REPORT_ERROR', 400));
  }
});

export default router;
