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
    
    sql += ` GROUP BY u.id, u.name, u.email, s.name ORDER BY total_services_performed DESC`;
    
    const result = await query(sql, params);
    
    // Get detailed service breakdown per worker
    let serviceBreakdownSql = `
      SELECT 
        u.id as worker_id,
        u.name as worker_name,
        s.name as service_name,
        s.price as service_price,
        COUNT(bs.id) as service_count,
        SUM(bs.total_price) as service_revenue
      FROM users u
      LEFT JOIN bookings b ON u.id = b.worker_id
      LEFT JOIN booking_services bs ON bs.booking_id = b.id
      LEFT JOIN services s ON bs.service_id = s.id
      WHERE u.role IN ('staff', 'manager') AND u.is_active = true
      AND b.status = 'completed'
    `;
    
    const serviceBreakdownParams = [];
    let serviceParamCount = 0;
    
    if (worker_id) {
      serviceParamCount++;
      serviceBreakdownSql += ` AND u.id = $${serviceParamCount}`;
      serviceBreakdownParams.push(worker_id);
    }
    
    if (start_date) {
      serviceParamCount++;
      serviceBreakdownSql += ` AND b.scheduled_time >= $${serviceParamCount}`;
      serviceBreakdownParams.push(start_date);
    }
    
    if (end_date) {
      serviceParamCount++;
      serviceBreakdownSql += ` AND b.scheduled_time <= $${serviceParamCount}`;
      serviceBreakdownParams.push(end_date);
    }
    
    serviceBreakdownSql += ` GROUP BY u.id, u.name, s.name, s.price ORDER BY u.name, service_count DESC`;
    
    const serviceBreakdownResult = await query(serviceBreakdownSql, serviceBreakdownParams);
    
    res.json(successResponse({
      worker_performance: result.rows,
      service_breakdown: serviceBreakdownResult.rows,
      summary: {
        total_workers: result.rows.length,
        total_services_performed: result.rows.reduce((sum, row) => sum + parseInt(row.total_services_performed || 0), 0),
        total_service_revenue: result.rows.reduce((sum, row) => sum + parseFloat(row.total_service_revenue || 0), 0),
        average_services_per_worker: result.rows.length > 0 ? result.rows.reduce((sum, row) => sum + parseInt(row.total_services_performed || 0), 0) / result.rows.length : 0
      }
    }, 'Worker performance report generated successfully'));
    
  } catch (error) {
    console.error('Worker performance report error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_PERFORMANCE_REPORT_ERROR', 400));
  }
});

// Worker sales performance (POS transactions)
router.get('/worker-sales', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date, worker_id } = req.query;
    
    let sql = `
      SELECT 
        u.id as worker_id,
        u.name as worker_name,
        COUNT(t.id) as total_transactions,
        SUM(t.total_amount) as total_sales_revenue,
        AVG(t.total_amount) as average_transaction_value,
        SUM(ti.quantity) as total_items_sold
      FROM users u
      LEFT JOIN pos_transactions t ON u.id = t.created_by
      LEFT JOIN pos_transaction_items ti ON t.id = ti.transaction_id
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
      sql += ` AND t.created_at >= $${paramCount}`;
      params.push(start_date);
    }
    
    if (end_date) {
      paramCount++;
      sql += ` AND t.created_at <= $${paramCount}`;
      params.push(end_date);
    }
    
    sql += ` GROUP BY u.id, u.name ORDER BY total_sales_revenue DESC`;
    
    console.log('Worker sales SQL query:', sql);
    console.log('Worker sales params:', params);
    
    const result = await query(sql, params);
    
    res.json(successResponse({
      worker_sales: result.rows,
      summary: {
        total_workers_with_sales: result.rows.length,
        total_sales_revenue: result.rows.reduce((sum, row) => sum + parseFloat(row.total_sales_revenue || 0), 0),
        total_transactions: result.rows.reduce((sum, row) => sum + parseInt(row.total_transactions || 0), 0),
        average_sales_per_worker: result.rows.length > 0 ? result.rows.reduce((sum, row) => sum + parseFloat(row.total_sales_revenue || 0), 0) / result.rows.length : 0
      }
    }, 'Worker sales report generated successfully'));
    
  } catch (error) {
    console.error('Worker sales report error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_SALES_REPORT_ERROR', 400));
  }
});

// Combined worker performance (services + sales)
router.get('/worker-analytics', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get service performance
    const serviceSql = `
      SELECT 
        u.id as worker_id,
        u.name as worker_name,
        COUNT(b.id) as services_performed,
        SUM(b.total_amount) as service_revenue
      FROM users u
      LEFT JOIN bookings b ON u.id = b.worker_id
      WHERE u.role IN ('staff', 'manager') AND u.is_active = true
      AND b.status = 'completed'
    `;
    
    const salesSql = `
      SELECT 
        u.id as worker_id,
        u.name as worker_name,
        COUNT(t.id) as sales_transactions,
        SUM(t.total_amount) as sales_revenue
      FROM users u
      LEFT JOIN pos_transactions t ON u.id = t.created_by
      WHERE u.role IN ('staff', 'manager') AND u.is_active = true
    `;
    
    // Build service query parameters
    const serviceParams = [];
    let serviceParamCount = 0;
    
    let dateFilters = '';
    if (start_date) {
      serviceParamCount++;
      dateFilters += ` AND b.scheduled_time >= $${serviceParamCount}`;
      serviceParams.push(start_date);
    }
    if (end_date) {
      serviceParamCount++;
      dateFilters += ` AND b.scheduled_time <= $${serviceParamCount}`;
      serviceParams.push(end_date);
    }
    
    // Build sales query parameters
    const salesParams = [];
    let salesParamCount = 0;
    
    let salesDateFilters = '';
    if (start_date) {
      salesParamCount++;
      salesDateFilters += ` AND t.created_at >= $${salesParamCount}`;
      salesParams.push(start_date);
    }
    if (end_date) {
      salesParamCount++;
      salesDateFilters += ` AND t.created_at <= $${salesParamCount}`;
      salesParams.push(end_date);
    }
    
    // Add date filters to both queries
    const serviceQuery = serviceSql + dateFilters + ` GROUP BY u.id, u.name`;
    const salesQuery = salesSql + salesDateFilters + ` GROUP BY u.id, u.name`;
    
    console.log('Service query:', serviceQuery);
    console.log('Service params:', serviceParams);
    console.log('Sales query:', salesQuery);
    console.log('Sales params:', salesParams);
    
    const [serviceResult, salesResult] = await Promise.all([
      query(serviceQuery, serviceParams),
      query(salesQuery, salesParams)
    ]);
    
    // Combine the results
    const combinedAnalytics = serviceResult.rows.map(serviceRow => {
      const salesRow = salesResult.rows.find(s => s.worker_id === serviceRow.worker_id) || { sales_transactions: 0, sales_revenue: 0 };
      
      return {
        worker_id: serviceRow.worker_id,
        worker_name: serviceRow.worker_name,
        services_performed: parseInt(serviceRow.services_performed || 0),
        service_revenue: parseFloat(serviceRow.service_revenue || 0),
        sales_transactions: parseInt(salesRow.sales_transactions || 0),
        sales_revenue: parseFloat(salesRow.sales_revenue || 0),
        total_revenue: parseFloat(serviceRow.service_revenue || 0) + parseFloat(salesRow.sales_revenue || 0),
        total_transactions: parseInt(serviceRow.services_performed || 0) + parseInt(salesRow.sales_transactions || 0)
      };
    });
    
    res.json(successResponse({
      worker_analytics: combinedAnalytics,
      summary: {
        total_workers: combinedAnalytics.length,
        total_service_revenue: combinedAnalytics.reduce((sum, row) => sum + row.service_revenue, 0),
        total_sales_revenue: combinedAnalytics.reduce((sum, row) => sum + row.sales_revenue, 0),
        total_revenue: combinedAnalytics.reduce((sum, row) => sum + row.total_revenue, 0),
        total_services_performed: combinedAnalytics.reduce((sum, row) => sum + row.services_performed, 0),
        total_sales_transactions: combinedAnalytics.reduce((sum, row) => sum + row.sales_transactions, 0)
      }
    }, 'Worker analytics report generated successfully'));
    
  } catch (error) {
    console.error('Worker analytics error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_ANALYTICS_ERROR', 400));
  }
});

export default router;