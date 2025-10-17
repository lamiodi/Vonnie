const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

const router = express.Router();

// Get dashboard overview statistics
router.get('/dashboard', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);
    
    // Base date filters
    const dateFrom = date_from || `${thisMonth}-01`;
    const dateTo = date_to || today;

    // Get transactions data
    let transactionQuery = supabase
      .from('transactions')
      .select('*')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`);

    // Role-based filtering
    if (req.user.role === 'staff') {
      transactionQuery = transactionQuery.eq('staff_id', req.user.id);
    }

    const { data: transactions, error: transactionError } = await transactionQuery;

    if (transactionError) {
      return res.status(400).json({ 
        error: 'Failed to fetch transaction data', 
        message: transactionError.message 
      });
    }

    // Get bookings data
    let bookingQuery = supabase
      .from('bookings')
      .select('*')
      .gte('booking_date', dateFrom)
      .lte('booking_date', dateTo);

    if (req.user.role === 'staff') {
      bookingQuery = bookingQuery.eq('staff_id', req.user.id);
    }

    const { data: bookings, error: bookingError } = await bookingQuery;

    if (bookingError) {
      return res.status(400).json({ 
        error: 'Failed to fetch booking data', 
        message: bookingError.message 
      });
    }

    // Get products data (Admin only)
    let productsData = [];
    if (req.user.role === 'admin') {
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (!productError) {
        productsData = products;
      }
    }

    // Calculate statistics
    const stats = {
      // Revenue metrics
      totalRevenue: transactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.total_amount, 0),
      
      // Transaction metrics
      totalTransactions: transactions.length,
      completedTransactions: transactions.filter(t => t.status === 'completed').length,
      pendingTransactions: transactions.filter(t => t.status === 'pending').length,
      
      // Booking metrics
      totalBookings: bookings.length,
      confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
      pendingBookings: bookings.filter(b => b.status === 'pending').length,
      completedBookings: bookings.filter(b => b.status === 'completed').length,
      
      // Inventory metrics (Admin only)
      totalProducts: productsData.length,
      lowStockProducts: productsData.filter(p => p.stock_quantity <= p.low_stock_threshold).length,
      outOfStockProducts: productsData.filter(p => p.stock_quantity === 0).length,
      
      // Average metrics
      averageTransactionValue: 0,
      averageDailyRevenue: 0
    };

    // Calculate averages
    if (stats.completedTransactions > 0) {
      stats.averageTransactionValue = stats.totalRevenue / stats.completedTransactions;
    }

    // Calculate daily revenue average
    const daysDiff = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > 0) {
      stats.averageDailyRevenue = stats.totalRevenue / daysDiff;
    }

    // Get recent transactions
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    // Get upcoming bookings
    const upcomingBookings = bookings
      .filter(b => new Date(b.booking_date) >= new Date() && b.status === 'confirmed')
      .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date))
      .slice(0, 5);

    res.json({
      stats,
      recentTransactions,
      upcomingBookings,
      dateRange: { from: dateFrom, to: dateTo }
    });
  } catch (error) {
    console.error('Dashboard report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get revenue analytics
router.get('/revenue', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { period = 'monthly', date_from, date_to } = req.query;
    const today = new Date();
    let dateFrom, dateTo;

    // Set default date ranges based on period
    switch (period) {
      case 'daily':
        dateFrom = date_from || new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dateTo = date_to || today.toISOString().split('T')[0];
        break;
      case 'weekly':
        dateFrom = date_from || new Date(today.getTime() - 12 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dateTo = date_to || today.toISOString().split('T')[0];
        break;
      case 'monthly':
      default:
        dateFrom = date_from || new Date(today.getFullYear() - 1, today.getMonth(), 1).toISOString().split('T')[0];
        dateTo = date_to || today.toISOString().split('T')[0];
        break;
    }

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('status', 'completed')
      .gte('created_at', `${dateFrom}T00:00:00`)
      .lte('created_at', `${dateTo}T23:59:59`)
      .order('created_at', { ascending: true });

    // Role-based filtering
    if (req.user.role === 'staff') {
      query = query.eq('staff_id', req.user.id);
    }

    const { data: transactions, error } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch revenue data', 
        message: error.message 
      });
    }

    // Group data by period
    const revenueData = {};
    const transactionCounts = {};

    transactions.forEach(transaction => {
      const date = new Date(transaction.created_at);
      let key;

      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      revenueData[key] = (revenueData[key] || 0) + transaction.total_amount;
      transactionCounts[key] = (transactionCounts[key] || 0) + 1;
    });

    // Convert to array format for charts
    const chartData = Object.keys(revenueData)
      .sort()
      .map(key => ({
        period: key,
        revenue: revenueData[key],
        transactions: transactionCounts[key],
        averageValue: revenueData[key] / transactionCounts[key]
      }));

    // Calculate growth rates
    const growthData = chartData.map((current, index) => {
      if (index === 0) {
        return { ...current, growthRate: 0 };
      }
      const previous = chartData[index - 1];
      const growthRate = previous.revenue > 0 
        ? ((current.revenue - previous.revenue) / previous.revenue) * 100 
        : 0;
      return { ...current, growthRate };
    });

    res.json({
      period,
      dateRange: { from: dateFrom, to: dateTo },
      data: growthData,
      summary: {
        totalRevenue: Object.values(revenueData).reduce((sum, val) => sum + val, 0),
        totalTransactions: Object.values(transactionCounts).reduce((sum, val) => sum + val, 0),
        averagePeriodRevenue: Object.values(revenueData).reduce((sum, val) => sum + val, 0) / Object.keys(revenueData).length,
        bestPeriod: chartData.reduce((best, current) => 
          current.revenue > (best?.revenue || 0) ? current : best, null
        )
      }
    });
  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get service performance analytics
router.get('/services', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);
    
    const dateFrom = date_from || `${thisMonth}-01`;
    const dateTo = date_to || today;

    // Get transaction items for services
    let query = supabase
      .from('transaction_items')
      .select(`
        *,
        service:services(*),
        transaction:transactions!inner(
          status,
          created_at,
          staff_id,
          total_amount
        )
      `)
      .eq('item_type', 'service')
      .eq('transaction.status', 'completed')
      .gte('transaction.created_at', `${dateFrom}T00:00:00`)
      .lte('transaction.created_at', `${dateTo}T23:59:59`);

    // Role-based filtering
    if (req.user.role === 'staff') {
      query = query.eq('transaction.staff_id', req.user.id);
    }

    const { data: serviceItems, error } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch service data', 
        message: error.message 
      });
    }

    // Analyze service performance
    const serviceStats = {};
    const categoryStats = {};

    serviceItems.forEach(item => {
      const service = item.service;
      const serviceName = service.name;
      const category = service.category;

      // Service-level stats
      if (!serviceStats[serviceName]) {
        serviceStats[serviceName] = {
          name: serviceName,
          category: category,
          totalBookings: 0,
          totalRevenue: 0,
          averagePrice: 0
        };
      }

      serviceStats[serviceName].totalBookings += item.quantity;
      serviceStats[serviceName].totalRevenue += item.total_price;
      serviceStats[serviceName].averagePrice = serviceStats[serviceName].totalRevenue / serviceStats[serviceName].totalBookings;

      // Category-level stats
      if (!categoryStats[category]) {
        categoryStats[category] = {
          category: category,
          totalBookings: 0,
          totalRevenue: 0,
          serviceCount: new Set()
        };
      }

      categoryStats[category].totalBookings += item.quantity;
      categoryStats[category].totalRevenue += item.total_price;
      categoryStats[category].serviceCount.add(serviceName);
    });

    // Convert to arrays and sort
    const topServices = Object.values(serviceStats)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const categoryPerformance = Object.values(categoryStats)
      .map(cat => ({
        ...cat,
        serviceCount: cat.serviceCount.size,
        averageRevenuePerService: cat.totalRevenue / cat.serviceCount.size
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({
      dateRange: { from: dateFrom, to: dateTo },
      topServices,
      categoryPerformance,
      summary: {
        totalServiceRevenue: Object.values(serviceStats).reduce((sum, s) => sum + s.totalRevenue, 0),
        totalServiceBookings: Object.values(serviceStats).reduce((sum, s) => sum + s.totalBookings, 0),
        uniqueServices: Object.keys(serviceStats).length,
        uniqueCategories: Object.keys(categoryStats).length
      }
    });
  } catch (error) {
    console.error('Service analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get inventory analytics (Admin only)
router.get('/inventory', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { category, low_stock_only } = req.query;

    let query = supabase
      .from('products')
      .select(`
        *,
        inventory_history(
          change_type,
          quantity_changed,
          created_at
        )
      `)
      .eq('is_active', true);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: products, error } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch inventory data', 
        message: error.message 
      });
    }

    // Analyze inventory
    const inventoryStats = {
      totalProducts: products.length,
      totalValue: 0,
      lowStockProducts: [],
      outOfStockProducts: [],
      categoryBreakdown: {},
      topSellingProducts: [],
      slowMovingProducts: []
    };

    const productMovement = {};

    products.forEach(product => {
      // Calculate total value
      inventoryStats.totalValue += product.stock_quantity * product.price;

      // Check stock levels
      if (product.stock_quantity === 0) {
        inventoryStats.outOfStockProducts.push(product);
      } else if (product.stock_quantity <= product.low_stock_threshold) {
        inventoryStats.lowStockProducts.push(product);
      }

      // Category breakdown
      const category = product.category;
      if (!inventoryStats.categoryBreakdown[category]) {
        inventoryStats.categoryBreakdown[category] = {
          category: category,
          productCount: 0,
          totalValue: 0,
          averageStock: 0
        };
      }

      inventoryStats.categoryBreakdown[category].productCount += 1;
      inventoryStats.categoryBreakdown[category].totalValue += product.stock_quantity * product.price;

      // Analyze product movement
      const salesHistory = product.inventory_history.filter(h => h.change_type === 'sale');
      const totalSold = salesHistory.reduce((sum, h) => sum + Math.abs(h.quantity_changed), 0);
      
      productMovement[product.id] = {
        ...product,
        totalSold,
        lastSaleDate: salesHistory.length > 0 
          ? salesHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at
          : null
      };
    });

    // Calculate category averages
    Object.values(inventoryStats.categoryBreakdown).forEach(cat => {
      cat.averageStock = cat.totalValue / cat.productCount;
    });

    // Sort products by movement
    const sortedByMovement = Object.values(productMovement)
      .sort((a, b) => b.totalSold - a.totalSold);

    inventoryStats.topSellingProducts = sortedByMovement.slice(0, 10);
    inventoryStats.slowMovingProducts = sortedByMovement
      .filter(p => p.totalSold === 0 || 
        (p.lastSaleDate && new Date() - new Date(p.lastSaleDate) > 30 * 24 * 60 * 60 * 1000))
      .slice(0, 10);

    // Filter results if requested
    let filteredProducts = products;
    if (low_stock_only === 'true') {
      filteredProducts = [...inventoryStats.lowStockProducts, ...inventoryStats.outOfStockProducts];
    }

    res.json({
      products: filteredProducts,
      stats: inventoryStats
    });
  } catch (error) {
    console.error('Inventory analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get staff performance analytics (Admin only)
router.get('/staff', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date_from, date_to, staff_id } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);
    
    const dateFrom = date_from || `${thisMonth}-01`;
    const dateTo = date_to || today;

    // Get staff members
    let staffQuery = supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'staff']);

    if (staff_id) {
      staffQuery = staffQuery.eq('id', staff_id);
    }

    const { data: staff, error: staffError } = await staffQuery;

    if (staffError) {
      return res.status(400).json({ 
        error: 'Failed to fetch staff data', 
        message: staffError.message 
      });
    }

    // Get performance data for each staff member
    const staffPerformance = [];

    for (const member of staff) {
      // Get transactions
      const { data: transactions, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('staff_id', member.id)
        .eq('status', 'completed')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`);

      // Get bookings
      const { data: bookings, error: bookingError } = await supabase
        .from('bookings')
        .select('*')
        .eq('staff_id', member.id)
        .gte('booking_date', dateFrom)
        .lte('booking_date', dateTo);

      // Get attendance
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('staff_id', member.id)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (!transactionError && !bookingError && !attendanceError) {
        // Calculate metrics
        const totalRevenue = transactions.reduce((sum, t) => sum + t.total_amount, 0);
        const totalTransactions = transactions.length;
        const totalBookings = bookings.length;
        const completedBookings = bookings.filter(b => b.status === 'completed').length;
        
        // Calculate total hours worked
        let totalHours = 0;
        attendance.forEach(record => {
          if (record.resumption_time && record.closing_time) {
            const resumption = new Date(record.resumption_time);
            const closing = new Date(record.closing_time);
            totalHours += (closing - resumption) / (1000 * 60 * 60);
          }
        });

        staffPerformance.push({
          staff: member,
          metrics: {
            totalRevenue,
            totalTransactions,
            averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
            totalBookings,
            completedBookings,
            bookingCompletionRate: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
            totalHoursWorked: totalHours,
            revenuePerHour: totalHours > 0 ? totalRevenue / totalHours : 0,
            attendanceDays: attendance.length
          }
        });
      }
    }

    // Sort by total revenue
    staffPerformance.sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue);

    res.json({
      dateRange: { from: dateFrom, to: dateTo },
      staffPerformance,
      summary: {
        totalStaff: staffPerformance.length,
        totalRevenue: staffPerformance.reduce((sum, s) => sum + s.metrics.totalRevenue, 0),
        totalTransactions: staffPerformance.reduce((sum, s) => sum + s.metrics.totalTransactions, 0),
        totalHours: staffPerformance.reduce((sum, s) => sum + s.metrics.totalHoursWorked, 0),
        topPerformer: staffPerformance[0] || null
      }
    });
  } catch (error) {
    console.error('Staff analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export data to CSV
router.get('/export/csv', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { type, date_from, date_to } = req.query;
    
    if (!type || !['transactions', 'bookings', 'products', 'attendance'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid export type', 
        message: 'Type must be one of: transactions, bookings, products, attendance' 
      });
    }

    let data = [];
    let filename = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;

    switch (type) {
      case 'transactions':
        let transactionQuery = supabase
          .from('transactions')
          .select(`
            *,
            customer:profiles!customer_id(first_name, last_name, email, phone),
            staff:profiles!staff_id(first_name, last_name)
          `);

        if (date_from) transactionQuery = transactionQuery.gte('created_at', `${date_from}T00:00:00`);
        if (date_to) transactionQuery = transactionQuery.lte('created_at', `${date_to}T23:59:59`);
        if (req.user.role === 'staff') transactionQuery = transactionQuery.eq('staff_id', req.user.id);

        const { data: transactions, error: transactionError } = await transactionQuery;
        if (transactionError) throw transactionError;

        data = transactions.map(t => ({
          ID: t.id,
          Date: t.created_at.split('T')[0],
          Customer: t.customer ? `${t.customer.first_name} ${t.customer.last_name}` : 'N/A',
          Staff: `${t.staff.first_name} ${t.staff.last_name}`,
          Type: t.type,
          Subtotal: t.subtotal,
          Discount: t.discount_amount,
          Tax: t.tax_amount,
          Total: t.total_amount,
          'Payment Method': t.payment_method,
          Status: t.status
        }));
        break;

      case 'bookings':
        let bookingQuery = supabase
          .from('bookings')
          .select(`
            *,
            customer:profiles!customer_id(first_name, last_name, email, phone),
            staff:profiles!staff_id(first_name, last_name),
            service:services(name, category, price)
          `);

        if (date_from) bookingQuery = bookingQuery.gte('booking_date', date_from);
        if (date_to) bookingQuery = bookingQuery.lte('booking_date', date_to);
        if (req.user.role === 'staff') bookingQuery = bookingQuery.eq('staff_id', req.user.id);

        const { data: bookings, error: bookingError } = await bookingQuery;
        if (bookingError) throw bookingError;

        data = bookings.map(b => ({
          ID: b.id,
          Date: b.booking_date,
          Time: b.booking_time,
          Customer: `${b.customer.first_name} ${b.customer.last_name}`,
          Staff: `${b.staff.first_name} ${b.staff.last_name}`,
          Service: b.service.name,
          Category: b.service.category,
          Price: b.service.price,
          Status: b.status,
          Notes: b.notes || ''
        }));
        break;

      case 'products':
        if (req.user.role !== 'admin') {
          return res.status(403).json({ error: 'Admin access required for product export' });
        }

        const { data: products, error: productError } = await supabase
          .from('products')
          .select('*')
          .order('name');

        if (productError) throw productError;

        data = products.map(p => ({
          ID: p.id,
          Name: p.name,
          SKU: p.sku,
          Category: p.category,
          Price: p.price,
          'Stock Quantity': p.stock_quantity,
          'Low Stock Threshold': p.low_stock_threshold,
          Status: p.is_active ? 'Active' : 'Inactive',
          'Created Date': p.created_at.split('T')[0]
        }));
        break;

      case 'attendance':
        let attendanceQuery = supabase
          .from('attendance')
          .select(`
            *,
            staff:profiles!staff_id(first_name, last_name)
          `);

        if (date_from) attendanceQuery = attendanceQuery.gte('date', date_from);
        if (date_to) attendanceQuery = attendanceQuery.lte('date', date_to);
        if (req.user.role === 'staff') attendanceQuery = attendanceQuery.eq('staff_id', req.user.id);

        const { data: attendance, error: attendanceError } = await attendanceQuery;
        if (attendanceError) throw attendanceError;

        data = attendance.map(a => {
          let hoursWorked = null;
          if (a.resumption_time && a.closing_time) {
            const resumption = new Date(a.resumption_time);
            const closing = new Date(a.closing_time);
            hoursWorked = ((closing - resumption) / (1000 * 60 * 60)).toFixed(2);
          }

          return {
            ID: a.id,
            Date: a.date,
            Staff: `${a.staff.first_name} ${a.staff.last_name}`,
            'Check In': a.resumption_time ? new Date(a.resumption_time).toLocaleTimeString() : 'N/A',
            'Check Out': a.closing_time ? new Date(a.closing_time).toLocaleTimeString() : 'N/A',
            'Hours Worked': hoursWorked || 'N/A'
          };
        });
        break;
    }

    // Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(data);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Export data to PDF
router.get('/export/pdf', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { type, date_from, date_to } = req.query;
    
    if (!type || !['transactions', 'bookings', 'daily_report'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid export type', 
        message: 'Type must be one of: transactions, bookings, daily_report' 
      });
    }

    const doc = new PDFDocument();
    const filename = `${type}_report_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);

    // Add header
    doc.fontSize(20).text('Vonne X2x Management System', 50, 50);
    doc.fontSize(16).text(`${type.charAt(0).toUpperCase() + type.slice(1)} Report`, 50, 80);
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 110);
    
    if (date_from && date_to) {
      doc.text(`Period: ${date_from} to ${date_to}`, 50, 130);
    }

    let yPosition = 160;

    switch (type) {
      case 'transactions':
        // Fetch and display transaction summary
        let transactionQuery = supabase
          .from('transactions')
          .select('*')
          .eq('status', 'completed');

        if (date_from) transactionQuery = transactionQuery.gte('created_at', `${date_from}T00:00:00`);
        if (date_to) transactionQuery = transactionQuery.lte('created_at', `${date_to}T23:59:59`);
        if (req.user.role === 'staff') transactionQuery = transactionQuery.eq('staff_id', req.user.id);

        const { data: transactions } = await transactionQuery;
        
        const totalRevenue = transactions.reduce((sum, t) => sum + t.total_amount, 0);
        const totalTransactions = transactions.length;
        
        doc.fontSize(14).text('Summary:', 50, yPosition);
        yPosition += 25;
        doc.fontSize(12)
          .text(`Total Transactions: ${totalTransactions}`, 50, yPosition)
          .text(`Total Revenue: ₦${totalRevenue.toLocaleString()}`, 50, yPosition + 20)
          .text(`Average Transaction: ₦${totalTransactions > 0 ? (totalRevenue / totalTransactions).toLocaleString() : '0'}`, 50, yPosition + 40);
        
        break;

      case 'bookings':
        // Fetch and display booking summary
        let bookingQuery = supabase
          .from('bookings')
          .select('*');

        if (date_from) bookingQuery = bookingQuery.gte('booking_date', date_from);
        if (date_to) bookingQuery = bookingQuery.lte('booking_date', date_to);
        if (req.user.role === 'staff') bookingQuery = bookingQuery.eq('staff_id', req.user.id);

        const { data: bookings } = await bookingQuery;
        
        const totalBookings = bookings.length;
        const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
        const completedBookings = bookings.filter(b => b.status === 'completed').length;
        
        doc.fontSize(14).text('Summary:', 50, yPosition);
        yPosition += 25;
        doc.fontSize(12)
          .text(`Total Bookings: ${totalBookings}`, 50, yPosition)
          .text(`Confirmed Bookings: ${confirmedBookings}`, 50, yPosition + 20)
          .text(`Completed Bookings: ${completedBookings}`, 50, yPosition + 40)
          .text(`Completion Rate: ${totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : '0'}%`, 50, yPosition + 60);
        
        break;

      case 'daily_report':
        const reportDate = date_from || new Date().toISOString().split('T')[0];
        
        // Get daily transactions
        const { data: dailyTransactions } = await supabase
          .from('transactions')
          .select('*')
          .gte('created_at', `${reportDate}T00:00:00`)
          .lt('created_at', `${reportDate}T23:59:59`);

        // Get daily bookings
        const { data: dailyBookings } = await supabase
          .from('bookings')
          .select('*')
          .eq('booking_date', reportDate);

        const dailyRevenue = dailyTransactions
          .filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + t.total_amount, 0);
        
        doc.fontSize(14).text(`Daily Report - ${reportDate}:`, 50, yPosition);
        yPosition += 25;
        doc.fontSize(12)
          .text(`Total Transactions: ${dailyTransactions.length}`, 50, yPosition)
          .text(`Total Revenue: ₦${dailyRevenue.toLocaleString()}`, 50, yPosition + 20)
          .text(`Total Bookings: ${dailyBookings.length}`, 50, yPosition + 40)
          .text(`Confirmed Bookings: ${dailyBookings.filter(b => b.status === 'confirmed').length}`, 50, yPosition + 60);
        
        break;
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

module.exports = router;