import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js'
import PDFDocument from 'pdfkit'
import { Parser } from 'json2csv'

const router = express.Router()

// Get dashboard overview statistics
router.get('/dashboard', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { date_from, date_to } = req.query
    const today = new Date().toISOString().split('T')[0]
    const thisMonth = new Date().toISOString().substring(0, 7)
    
    // Base date filters
    const dateFrom = date_from || `${thisMonth}-01`
    const dateTo = date_to || today

    // Get transactions data
    let transactionQuery = `
      SELECT * FROM transactions 
      WHERE created_at >= $1 AND created_at <= $2
    `
    let transactionParams = [`${dateFrom}T00:00:00`, `${dateTo}T23:59:59`]

    // Role-based filtering
    if (req.user.role === 'staff') {
      transactionQuery += ` AND staff_id = $${transactionParams.length + 1}`
      transactionParams.push(req.user.id)
    }

    const transactionsResult = await sql.query(transactionQuery, transactionParams)
    const transactions = transactionsResult.rows

    // Get bookings data
    let bookingQuery = `
      SELECT * FROM bookings 
      WHERE booking_date >= $1 AND booking_date <= $2
    `
    let bookingParams = [dateFrom, dateTo]

    if (req.user.role === 'staff') {
      bookingQuery += ` AND staff_id = $${bookingParams.length + 1}`
      bookingParams.push(req.user.id)
    }

    const bookingsResult = await sql.query(bookingQuery, bookingParams)
    const bookings = bookingsResult.rows

    // Get products data (Admin only)
    let productsData = []
    if (req.user.role === 'admin') {
      const productsResult = await sql.query(
        'SELECT * FROM products WHERE is_active = true',
      )
      productsData = productsResult.rows
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
      averageDailyRevenue: 0,
    }

    // Calculate averages
    if (stats.completedTransactions > 0) {
      stats.averageTransactionValue = stats.totalRevenue / stats.completedTransactions
    }

    // Calculate daily revenue average
    const daysDiff = Math.ceil((new Date(dateTo) - new Date(dateFrom)) / (1000 * 60 * 60 * 24)) + 1
    if (daysDiff > 0) {
      stats.averageDailyRevenue = stats.totalRevenue / daysDiff
    }

    // Get recent transactions
    const recentTransactions = transactions
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)

    // Get upcoming bookings
    const upcomingBookings = bookings
      .filter(b => new Date(b.booking_date) >= new Date() && b.status === 'confirmed')
      .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date))
      .slice(0, 5)

    res.json({
      stats,
      recentTransactions,
      upcomingBookings,
      dateRange: { from: dateFrom, to: dateTo },
    })
  } catch (error) {
    console.error('Dashboard report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router