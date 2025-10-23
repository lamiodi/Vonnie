import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js'
import { validateTransaction, validateUUID, validatePagination } from '../middleware/validation.js'
import { validateCoupon } from '../utils/booking.js'

const router = express.Router()

// Get transactions
router.get('/', authenticateToken, requireStaff, validatePagination, async(req, res) => {
  try {
    const { page = 1, limit = 20, type, status, date_from, date_to, guest_customer_id } = req.query
    const offset = (page - 1) * limit

    // Build base query with joins
    let baseQuery = sql`
      SELECT 
        t.*,
        gc.first_name as guest_first_name,
        gc.last_name as guest_last_name,
        gc.email as guest_email,
        gc.phone as guest_phone,
        p.first_name as staff_first_name,
        p.last_name as staff_last_name,
        COUNT(*) OVER() as total_count
      FROM transactions t
      LEFT JOIN guest_customers gc ON t.guest_customer_id = gc.id
      LEFT JOIN profiles p ON t.staff_id = p.id
      WHERE 1=1
    `

    // Apply filters
    if (type) {
      baseQuery = sql`${baseQuery} AND t.type = ${type}`
    }
    if (status) {
      baseQuery = sql`${baseQuery} AND t.status = ${status}`
    }
    if (guest_customer_id) {
      baseQuery = sql`${baseQuery} AND t.guest_customer_id = ${guest_customer_id}`
    }
    if (date_from) {
      baseQuery = sql`${baseQuery} AND t.created_at >= ${date_from}`
    }
    if (date_to) {
      baseQuery = sql`${baseQuery} AND t.created_at <= ${date_to}`
    }

    // Add ordering and pagination
    const finalQuery = sql`
      ${baseQuery}
      ORDER BY t.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    const transactions = await finalQuery
    
    // Extract total count from first row if available
    const total = transactions.length > 0 ? parseInt(transactions[0].total_count) : 0

    res.json({
      transactions: transactions.map(tx => ({
        ...tx,
        guest_customer: tx.guest_first_name ? {
          first_name: tx.guest_first_name,
          last_name: tx.guest_last_name,
          email: tx.guest_email,
          phone: tx.guest_phone,
        } : null,
        staff: tx.staff_first_name ? {
          first_name: tx.staff_first_name,
          last_name: tx.staff_last_name,
        } : null,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Transactions fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get transaction by ID
router.get('/:id', authenticateToken, requireStaff, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    // Get transaction with guest customer and staff details
    const transactions = await sql`
      SELECT 
        t.*,
        gc.first_name as guest_first_name,
        gc.last_name as guest_last_name,
        gc.email as guest_email,
        gc.phone as guest_phone,
        p.first_name as staff_first_name,
        p.last_name as staff_last_name
      FROM transactions t
      LEFT JOIN guest_customers gc ON t.guest_customer_id = gc.id
      LEFT JOIN profiles p ON t.staff_id = p.id
      WHERE t.id = ${id}
    `

    if (transactions.length === 0) {
      return res.status(404).json({ 
        error: 'Transaction not found', 
        message: 'Transaction not found', 
      })
    }

    const transaction = transactions[0]

    // Get transaction items with product/service details
    const transactionItems = await sql`
      SELECT 
        ti.*,
        s.id as service_id, s.name as service_name, s.category as service_category, s.price as service_price,
        p.id as product_id, p.name as product_name, p.category as product_category, p.price as product_price, p.sku as product_sku
      FROM transaction_items ti
      LEFT JOIN services s ON ti.item_type = 'service' AND ti.item_id = s.id
      LEFT JOIN products p ON ti.item_type = 'product' AND ti.item_id = p.id
      WHERE ti.transaction_id = ${id}
    `

    // Format the response
    const formattedTransaction = {
      ...transaction,
      guest_customer: transaction.guest_first_name ? {
        first_name: transaction.guest_first_name,
        last_name: transaction.guest_last_name,
        email: transaction.guest_email,
        phone: transaction.guest_phone,
      } : null,
      staff: transaction.staff_first_name ? {
        first_name: transaction.staff_first_name,
        last_name: transaction.staff_last_name,
      } : null,
      transaction_items: transactionItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        item_type: item.item_type,
        service: item.service_id ? {
          id: item.service_id,
          name: item.service_name,
          category: item.service_category,
          price: item.service_price,
        } : null,
        product: item.product_id ? {
          id: item.product_id,
          name: item.product_name,
          category: item.product_category,
          price: item.product_price,
          sku: item.product_sku,
        } : null,
      })),
    }

    res.json({ transaction: formattedTransaction })
  } catch (error) {
    console.error('Transaction fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create transaction
router.post('/', authenticateToken, requireStaff, validateTransaction, async(req, res) => {
  try {
    const {
      customer_id,
      type,
      items, // Array of { item_type, item_id, quantity, unit_price }
      payment_method,
      payment_reference,
      discount_amount = 0,
      tax_amount = 0,
      coupon_code,
      notes,
    } = req.body

    // Calculate total amount from items
    let subtotal = 0
    const processedItems = []

    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price
      subtotal += itemTotal
      
      processedItems.push({
        item_type: item.item_type,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: itemTotal,
      })

      // Update inventory for products
      if (item.item_type === 'product') {
        const products = await sql`
          SELECT stock_quantity FROM products WHERE id = ${item.item_id}
        `

        if (products.length === 0) {
          return res.status(400).json({ 
            error: 'Product not found', 
            message: 'Product not found', 
          })
        }

        const product = products[0]
        if (product.stock_quantity < item.quantity) {
          return res.status(400).json({ 
            error: 'Insufficient stock', 
            message: `Not enough stock for product ${item.item_id}`, 
          })
        }

        // Reduce stock quantity
        await sql`
          UPDATE products 
          SET stock_quantity = ${product.stock_quantity - item.quantity}, updated_at = NOW()
          WHERE id = ${item.item_id}
        `

        // Create inventory history record
        await sql`
          INSERT INTO inventory_history (
            product_id, change_type, quantity_changed, previous_quantity,
            new_quantity, reference_type, notes, created_by
          ) VALUES (
            ${item.item_id}, 'sale', ${-item.quantity}, ${product.stock_quantity},
            ${product.stock_quantity - item.quantity}, 'transaction', 'Sale transaction', ${req.user.id}
          )
        `
      }
    }

    // Handle coupon validation and redemption
    let couponDiscount = 0
    let couponId = null
    let finalDiscountAmount = discount_amount
    
    if (coupon_code) {
      const couponValidation = await validateCoupon(coupon_code, customer_id, subtotal)
      
      if (!couponValidation.isValid) {
        return res.status(400).json({ 
          error: 'Invalid coupon', 
          message: couponValidation.error, 
        })
      }
      
      couponDiscount = couponValidation.coupon.discount_amount
      couponId = couponValidation.coupon.id
      finalDiscountAmount += couponDiscount
    }

    const totalAmount = subtotal - finalDiscountAmount + tax_amount

    // Create transaction
    const transactions = await sql`
      INSERT INTO transactions (
        customer_id, type, subtotal, discount_amount, tax_amount,
        total_amount, payment_method, payment_reference, status,
        notes, created_by, coupon_id, coupon_discount
      ) VALUES (
        ${customer_id}, ${type}, ${subtotal}, ${finalDiscountAmount}, ${tax_amount},
        ${totalAmount}, ${payment_method}, ${payment_reference}, 'completed',
        ${notes}, ${req.user.id}, ${couponId}, ${couponDiscount}
      ) RETURNING *
    `
    
    if (transactions.length === 0) {
      return res.status(500).json({ 
        error: 'Failed to create transaction', 
        message: 'Transaction creation failed', 
      })
    }
    
    const transaction = transactions[0]

    // Create transaction items
    const transactionItems = processedItems.map(item => ({
      transaction_id: transaction.id,
      item_type: item.item_type,
      item_id: item.item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    // Insert transaction items
    for (const item of transactionItems) {
      await sql`
        INSERT INTO transaction_items (
          transaction_id, item_type, item_id, quantity, unit_price, total_price
        ) VALUES (
          ${item.transaction_id}, ${item.item_type}, ${item.item_id}, ${item.quantity}, ${item.unit_price}, ${item.total_price}
        )
      `
    }

    // Record coupon redemption if coupon was used
    if (couponId && couponDiscount > 0) {
      await sql`
        INSERT INTO coupon_redemptions (
          coupon_id, user_id, transaction_id, amount_saved, channel
        ) VALUES (
          ${couponId}, ${customer_id}, ${transaction.id}, ${couponDiscount}, 'pos'
        )
      `
    }

    // Get full transaction details with customer and staff info
    const fullTransactions = await sql`
      SELECT 
        t.*,
        c.*,
        p.first_name as staff_first_name,
        p.last_name as staff_last_name,
        json_agg(
          json_build_object(
            'id', ti.id,
            'item_type', ti.item_type,
            'item_id', ti.item_id,
            'quantity', ti.quantity,
            'unit_price', ti.unit_price,
            'total_price', ti.total_price,
            'created_at', ti.created_at
          )
        ) as items
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN profiles p ON t.created_by = p.id
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.id = ${transaction.id}
      GROUP BY t.id, c.id, p.id
    `

    if (fullTransactions.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to fetch transaction details', 
        message: 'Transaction details not found', 
      })
    }

    res.status(201).json(fullTransactions[0])
  } catch (error) {
    console.error('Transaction creation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update transaction status
router.put('/:id/status', authenticateToken, requireStaff, validateUUID, async(req, res) => {
  try {
    const { id } = req.params
    const { status, payment_reference } = req.body

    if (!['pending', 'completed', 'cancelled', 'refunded'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status', 
        message: 'Status must be one of: pending, completed, cancelled, refunded', 
      })
    }

    const updateData = { status }
    if (payment_reference) {
      updateData.payment_reference = payment_reference
    }
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }

    const transactionResult = await sql`
      UPDATE transactions 
      SET 
        status = ${updateData.status},
        payment_reference = ${updateData.payment_reference || null},
        completed_at = ${updateData.completed_at || null},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Transaction not found', 
        message: 'Transaction not found', 
      })
    }

    const transaction = transactionResult.rows[0]

    // If transaction is cancelled, restore inventory
    if (status === 'cancelled') {
      const itemsResult = await sql`
        SELECT * FROM transaction_items WHERE transaction_id = ${id}
      `

      if (itemsResult.rows.length > 0) {
        for (const item of itemsResult.rows) {
          if (item.item_type === 'product') {
            // Restore stock quantity
            const productResult = await sql`
              SELECT stock_quantity FROM products WHERE id = ${item.item_id}
            `

            if (productResult.rows.length > 0) {
              const product = productResult.rows[0]
              const newQuantity = product.stock_quantity + item.quantity

              await sql`
                UPDATE products 
                SET 
                  stock_quantity = ${newQuantity},
                  updated_at = ${new Date().toISOString()}
                WHERE id = ${item.item_id}
              `

              // Create inventory history record
              await sql`
                INSERT INTO inventory_history (
                  product_id, change_type, quantity_changed, previous_quantity,
                  new_quantity, reference_type, reference_id, notes, created_by
                ) VALUES (
                  ${item.item_id}, 'return', ${item.quantity}, ${product.stock_quantity},
                  ${newQuantity}, 'transaction_cancellation', ${id}, 
                  ${'Transaction cancellation - restored stock'}, ${req.user.id}
                )
              `
            }
          }
        }
      }
    }

    res.json({
      message: 'Transaction status updated successfully',
      transaction,
    })
  } catch (error) {
    console.error('Transaction status update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update transaction
router.put('/:id', authenticateToken, requireStaff, validateUUID, async(req, res) => {
  try {
    const { id } = req.params
    const { discount_amount, tax_amount, notes, payment_method, payment_reference } = req.body

    // Get current transaction
    const currentTransactionResult = await sql`
      SELECT * FROM transactions WHERE id = ${id}
    `

    if (currentTransactionResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Transaction not found', 
        message: 'Transaction not found', 
      })
    }

    const currentTransaction = currentTransactionResult.rows[0]

    if (currentTransaction.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot modify completed transaction', 
        message: 'Completed transactions cannot be modified', 
      })
    }

    // Calculate new total if discount or tax changed
    let updateData = { notes, payment_method, payment_reference }
    
    if (discount_amount !== undefined || tax_amount !== undefined) {
      const newDiscountAmount = discount_amount !== undefined ? discount_amount : currentTransaction.discount_amount
      const newTaxAmount = tax_amount !== undefined ? tax_amount : currentTransaction.tax_amount
      const newTotalAmount = currentTransaction.subtotal - newDiscountAmount + newTaxAmount
      
      updateData = {
        ...updateData,
        discount_amount: newDiscountAmount,
        tax_amount: newTaxAmount,
        total_amount: newTotalAmount,
      }
    }

    const transactionResult = await sql`
      UPDATE transactions 
      SET 
        notes = ${updateData.notes || null},
        payment_method = ${updateData.payment_method || null},
        payment_reference = ${updateData.payment_reference || null},
        discount_amount = ${updateData.discount_amount || null},
        tax_amount = ${updateData.tax_amount || null},
        total_amount = ${updateData.total_amount || null},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `

    if (transactionResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to update transaction', 
        message: 'Transaction not found or could not be updated', 
      })
    }

    const transaction = transactionResult.rows[0]

    res.json({
      message: 'Transaction updated successfully',
      transaction,
    })
  } catch (error) {
    console.error('Transaction update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete transaction (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    // Get transaction details before deletion
    const transactionResult = await sql`
      SELECT 
        t.*,
        json_agg(ti.*) as transaction_items
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      WHERE t.id = ${id}
      GROUP BY t.id
    `

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Transaction not found', 
        message: 'Transaction not found', 
      })
    }

    const transaction = {
      ...transactionResult.rows[0],
      transaction_items: transactionResult.rows[0].transaction_items || [],
    }

    // Restore inventory if transaction was completed
    if (transaction.status === 'completed') {
      for (const item of transaction.transaction_items) {
        if (item.item_type === 'product') {
          const productResult = await sql`
            SELECT stock_quantity FROM products WHERE id = ${item.item_id}
          `

          if (productResult.rows.length > 0) {
            const product = productResult.rows[0]
            const newQuantity = product.stock_quantity + item.quantity

            await sql`
              UPDATE products 
              SET 
                stock_quantity = ${newQuantity},
                updated_at = ${new Date().toISOString()}
              WHERE id = ${item.item_id}
            `

            // Create inventory history record
            await sql`
              INSERT INTO inventory_history (
                product_id, change_type, quantity_changed, previous_quantity,
                new_quantity, reference_type, reference_id, notes, created_by
              ) VALUES (
                ${item.item_id}, 'return', ${item.quantity}, ${product.stock_quantity},
                ${newQuantity}, 'transaction_deletion', ${id}, 
                ${'Transaction deletion - restored stock'}, ${req.user.id}
              )
            `
          }
        }
      }
    }

    // Delete transaction (cascade will delete transaction_items)
    const deleteResult = await sql`
      DELETE FROM transactions WHERE id = ${id}
    `

    if (deleteResult.rowCount === 0) {
      return res.status(400).json({ 
        error: 'Failed to delete transaction', 
        message: 'Transaction not found or could not be deleted', 
      })
    }

    res.json({ message: 'Transaction deleted successfully' })
  } catch (error) {
    console.error('Transaction deletion error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get transaction statistics
router.get('/stats/overview', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { date_from, date_to, staff_id } = req.query
    
    // Build the base query
    let whereConditions = []
    let queryParams = []
    
    if (date_from) {
      whereConditions.push(`created_at >= $${queryParams.length + 1}`)
      queryParams.push(date_from)
    }
    if (date_to) {
      whereConditions.push(`created_at <= $${queryParams.length + 1}`)
      queryParams.push(date_to)
    }
    
    // Role-based filtering
    if (req.user.role === 'staff') {
      whereConditions.push(`staff_id = $${queryParams.length + 1}`)
      queryParams.push(req.user.id)
    } else if (staff_id && req.user.role === 'admin') {
      whereConditions.push(`staff_id = $${queryParams.length + 1}`)
      queryParams.push(staff_id)
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : ''
    
    const transactionsResult = await sql`
      SELECT * FROM transactions ${sql.unsafe(whereClause)}
    `
    
    const transactions = transactionsResult.rows

    // Calculate statistics
    const stats = {
      totalTransactions: transactions.length,
      totalRevenue: 0,
      averageTransactionValue: 0,
      completedTransactions: 0,
      pendingTransactions: 0,
      cancelledTransactions: 0,
      refundedTransactions: 0,
      paymentMethods: {},
      transactionTypes: {},
      dailyStats: {},
      monthlyStats: {},
    }

    transactions.forEach(transaction => {
      // Revenue calculation (only completed transactions)
      if (transaction.status === 'completed') {
        stats.totalRevenue += transaction.total_amount
        stats.completedTransactions += 1
      }
      
      // Status counts
      if (transaction.status === 'pending') stats.pendingTransactions += 1
      if (transaction.status === 'cancelled') stats.cancelledTransactions += 1
      if (transaction.status === 'refunded') stats.refundedTransactions += 1
      
      // Payment methods
      const paymentMethod = transaction.payment_method || 'unknown'
      stats.paymentMethods[paymentMethod] = (stats.paymentMethods[paymentMethod] || 0) + 1
      
      // Transaction types
      const transactionType = transaction.type || 'unknown'
      stats.transactionTypes[transactionType] = (stats.transactionTypes[transactionType] || 0) + 1
      
      // Daily stats
      const date = transaction.created_at.split('T')[0]
      if (!stats.dailyStats[date]) {
        stats.dailyStats[date] = {
          count: 0,
          revenue: 0,
        }
      }
      stats.dailyStats[date].count += 1
      if (transaction.status === 'completed') {
        stats.dailyStats[date].revenue += transaction.total_amount
      }
      
      // Monthly stats
      const month = date.substring(0, 7) // YYYY-MM
      if (!stats.monthlyStats[month]) {
        stats.monthlyStats[month] = {
          count: 0,
          revenue: 0,
        }
      }
      stats.monthlyStats[month].count += 1
      if (transaction.status === 'completed') {
        stats.monthlyStats[month].revenue += transaction.total_amount
      }
    })

    stats.averageTransactionValue = stats.completedTransactions > 0 
      ? stats.totalRevenue / stats.completedTransactions 
      : 0

    res.json({ stats })
  } catch (error) {
    console.error('Transaction stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get daily sales report
router.get('/reports/daily', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query
    
    // Build base query with joins
    let whereConditions = [
      't.created_at >= $1',
      't.created_at < $2',
    ]
    let queryParams = [
      `${date}T00:00:00`,
      `${date}T23:59:59`,
    ]
    
    // Role-based filtering
    if (req.user.role === 'staff') {
      whereConditions.push(`t.staff_id = $${queryParams.length + 1}`)
      queryParams.push(req.user.id)
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : ''
    
    // Get transactions with related data
    const transactionsResult = await sql`
      SELECT 
        t.*,
        gc.first_name as guest_customer_first_name,
        gc.last_name as guest_customer_last_name,
        p.first_name as staff_first_name,
        p.last_name as staff_last_name
      FROM transactions t
      LEFT JOIN guest_customers gc ON t.guest_customer_id = gc.id
      LEFT JOIN profiles p ON t.staff_id = p.id
      ${sql.unsafe(whereClause)}
      ORDER BY t.created_at DESC
    `
    
    const transactions = transactionsResult.rows
    
    // Get transaction items for each transaction
    for (const transaction of transactions) {
      const itemsResult = await sql`
        SELECT 
          ti.*,
          s.name as service_name,
          s.category as service_category,
          pr.name as product_name,
          pr.category as product_category,
          pr.sku as product_sku
        FROM transaction_items ti
        LEFT JOIN services s ON ti.item_type = 'service' AND ti.item_id = s.id
        LEFT JOIN products pr ON ti.item_type = 'product' AND ti.item_id = pr.id
        WHERE ti.transaction_id = ${transaction.id}
      `
      
      transaction.transaction_items = itemsResult.rows
    }

    // Calculate summary
    const summary = {
      date,
      totalTransactions: transactions.length,
      completedTransactions: transactions.filter(t => t.status === 'completed').length,
      totalRevenue: transactions
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.total_amount, 0),
      averageTransactionValue: 0,
      topServices: {},
      topProducts: {},
      paymentMethods: {},
    }

    summary.averageTransactionValue = summary.completedTransactions > 0 
      ? summary.totalRevenue / summary.completedTransactions 
      : 0

    // Analyze transaction items
    transactions.forEach(transaction => {
      // Payment methods
      const paymentMethod = transaction.payment_method || 'unknown'
      summary.paymentMethods[paymentMethod] = (summary.paymentMethods[paymentMethod] || 0) + 1
      
      // Services and products
      transaction.transaction_items.forEach(item => {
        if (item.item_type === 'service' && item.service) {
          const serviceName = item.service.name
          summary.topServices[serviceName] = (summary.topServices[serviceName] || 0) + item.quantity
        } else if (item.item_type === 'product' && item.product) {
          const productName = item.product.name
          summary.topProducts[productName] = (summary.topProducts[productName] || 0) + item.quantity
        }
      })
    })

    res.json({
      summary,
      transactions,
    })
  } catch (error) {
    console.error('Daily report error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router