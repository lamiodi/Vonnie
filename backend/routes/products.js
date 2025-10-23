import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js'
import { validateProduct, validateUUID, validatePagination } from '../middleware/validation.js'

const router = express.Router()

// Get all products
router.get('/', validatePagination, async(req, res) => {
  try {
    const { page = 1, limit = 20, category, is_active = true, low_stock } = req.query
    const offset = (page - 1) * limit

    // Build the base query
    let query = 'SELECT * FROM products'
    let countQuery = 'SELECT COUNT(*) FROM products'
    const conditions = []
    const params = []
    let paramCount = 0

    if (category) {
      paramCount++
      conditions.push(`category = $${paramCount}`)
      params.push(category)
    }

    if (is_active !== undefined) {
      paramCount++
      conditions.push(`is_active = $${paramCount}`)
      params.push(is_active === 'true')
    }

    if (low_stock === 'true') {
      conditions.push('stock_level <= low_stock_threshold')
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      const whereClause = ` WHERE ${conditions.join(' AND ')}`
      query += whereClause
      countQuery += whereClause
    }

    // Add ordering and pagination
    query += ` ORDER BY name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(parseInt(limit), offset)

    // Execute queries
    const productsResult = await sql.query(query, params)
    const countResult = await sql.query(countQuery, params.slice(0, -2)) // Remove limit and offset params for count

    const products = productsResult.rows
    const total = parseInt(countResult.rows[0].count)

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Products fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get product by ID
router.get('/:id', validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    const result = await sql.query(
      'SELECT * FROM products WHERE id = $1',
      [id],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Product not found', 
        message: 'Product with the specified ID was not found', 
      })
    }

    res.json({ product: result.rows[0] })
  } catch (error) {
    console.error('Product fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Search products by name or SKU
router.get('/search/:query', async(req, res) => {
  try {
    const { query } = req.params
    const { limit = 10 } = req.query

    const result = await sql.query(
      `SELECT * FROM products 
       WHERE (name ILIKE $1 OR sku ILIKE $1) 
       AND is_active = true 
       LIMIT $2`,
      [`%${query}%`, parseInt(limit)],
    )

    res.json({ products: result.rows })
  } catch (error) {
    console.error('Product search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new product (Staff/Admin only)
router.post('/', authenticateToken, requireStaff, validateProduct, async(req, res) => {
  try {
    const { name, description, sku, price, category, stock_level, low_stock_threshold, image_url } = req.body

    // Check if SKU already exists
    const existingProductResult = await sql.query(
      'SELECT id FROM products WHERE sku = $1',
      [sku],
    )

    if (existingProductResult.rows.length > 0) {
      return res.status(400).json({ 
        error: 'SKU already exists', 
        message: 'A product with this SKU already exists', 
      })
    }

    // Create product
    const productResult = await sql.query(
      `INSERT INTO products 
       (name, description, sku, price, category, stock_level, low_stock_threshold, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, description, sku, price, category, stock_level, low_stock_threshold || 5, image_url],
    )

    const product = productResult.rows[0]

    // Log initial inventory
    await sql.query(
      `INSERT INTO inventory_logs 
       (product_id, adjustment_type, quantity, notes, staff_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [product.id, 'initial', stock_level, 'Initial stock entry', req.user.id],
    )

    res.status(201).json({
      message: 'Product created successfully',
      product,
    })
  } catch (error) {
    console.error('Product creation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update product (Staff/Admin only)
router.put('/:id', authenticateToken, requireStaff, validateUUID, validateProduct, async(req, res) => {
  try {
    const { id } = req.params
    const { name, description, sku, price, category, stock_level, low_stock_threshold, image_url, is_active } = req.body

    // Check if SKU already exists for other products
    const existingProductResult = await sql.query(
      'SELECT id FROM products WHERE sku = $1 AND id != $2',
      [sku, id],
    )

    if (existingProductResult.rows.length > 0) {
      return res.status(400).json({ 
        error: 'SKU already exists', 
        message: 'Another product with this SKU already exists', 
      })
    }

    const productResult = await sql.query(
      `UPDATE products 
       SET name = $1, description = $2, sku = $3, price = $4, category = $5, 
           stock_level = $6, low_stock_threshold = $7, image_url = $8, is_active = $9
       WHERE id = $10
       RETURNING *`,
      [name, description, sku, price, category, stock_level, low_stock_threshold, image_url, is_active, id],
    )

    if (productResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Product not found', 
        message: 'Product with the specified ID was not found', 
      })
    }

    res.json({
      message: 'Product updated successfully',
      product: productResult.rows[0],
    })
  } catch (error) {
    console.error('Product update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Adjust stock level (Staff/Admin only)
router.patch('/:id/stock', authenticateToken, requireStaff, validateUUID, async(req, res) => {
  try {
    const { id } = req.params
    const { adjustment_type, quantity, notes } = req.body

    if (!['sale', 'restock', 'adjustment'].includes(adjustment_type)) {
      return res.status(400).json({ 
        error: 'Invalid adjustment type', 
        message: 'Adjustment type must be sale, restock, or adjustment', 
      })
    }

    if (!quantity || typeof quantity !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid quantity', 
        message: 'Quantity must be a valid number', 
      })
    }

    // Get current product
    const currentProductResult = await sql.query(
      'SELECT stock_level FROM products WHERE id = $1',
      [id],
    )

    if (currentProductResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Product not found', 
        message: 'Product with the specified ID was not found', 
      })
    }

    // Calculate new stock level
    const currentStock = currentProductResult.rows[0].stock_level
    let newStockLevel
    if (adjustment_type === 'sale') {
      newStockLevel = currentStock - Math.abs(quantity)
    } else if (adjustment_type === 'restock') {
      newStockLevel = currentStock + Math.abs(quantity)
    } else { // adjustment
      newStockLevel = quantity // Direct set
    }

    if (newStockLevel < 0) {
      return res.status(400).json({ 
        error: 'Insufficient stock', 
        message: 'Stock level cannot be negative', 
      })
    }

    // Update product stock
    const productResult = await sql.query(
      'UPDATE products SET stock_level = $1 WHERE id = $2 RETURNING *',
      [newStockLevel, id],
    )

    if (productResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Product not found', 
        message: 'Product with the specified ID was not found', 
      })
    }

    // Log inventory adjustment
    const logQuantity = adjustment_type === 'sale' ? -Math.abs(quantity) : 
      adjustment_type === 'restock' ? Math.abs(quantity) : 
        quantity - currentStock

    await sql.query(
      'INSERT INTO inventory_logs (product_id, adjustment_type, quantity, notes, staff_id) VALUES ($1, $2, $3, $4, $5)',
      [id, adjustment_type, logQuantity, notes, req.user.id],
    )

    res.json({
      message: 'Stock adjusted successfully',
      product: productResult.rows[0],
      adjustment: {
        type: adjustment_type,
        quantity: logQuantity,
        previous_stock: currentStock,
        new_stock: newStockLevel,
      },
    })
  } catch (error) {
    console.error('Stock adjustment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get product inventory history (Staff/Admin only)
router.get('/:id/inventory-history', authenticateToken, requireStaff, validateUUID, async(req, res) => {
  try {
    const { id } = req.params
    const { page = 1, limit = 20 } = req.query
    const offset = (page - 1) * limit

    // Get inventory logs with pagination
    const logsResult = await sql.query(
      `SELECT il.*, p.first_name, p.last_name
       FROM inventory_logs il
       LEFT JOIN profiles p ON il.staff_id = p.id
       WHERE il.product_id = $1
       ORDER BY il.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset],
    )

    // Get total count
    const countResult = await sql.query(
      'SELECT COUNT(*) FROM inventory_logs WHERE product_id = $1',
      [id],
    )
    
    const total = parseInt(countResult.rows[0].count)

    res.json({
      logs: logsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Inventory history error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete product (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    // Check if product has any transaction items
    const transactionItemsResult = await sql.query(
      'SELECT id FROM transaction_items WHERE product_id = $1 LIMIT 1',
      [id],
    )

    if (transactionItemsResult.rows.length > 0) {
      // Soft delete - deactivate instead of hard delete
      const deactivateResult = await sql.query(
        'UPDATE products SET is_active = false WHERE id = $1 RETURNING *',
        [id],
      )

      if (deactivateResult.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Product not found', 
          message: 'Product with the specified ID was not found', 
        })
      }

      return res.json({
        message: 'Product deactivated successfully (has transaction history)',
        product: deactivateResult.rows[0],
      })
    }

    // Hard delete if no transactions
    const deleteResult = await sql.query(
      'DELETE FROM products WHERE id = $1',
      [id],
    )

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ 
        error: 'Product not found', 
        message: 'Product with the specified ID was not found', 
      })
    }

    res.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Product deletion error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get product categories
router.get('/categories/list', async(req, res) => {
  try {
    const categoriesResult = await sql.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND is_active = true',
    )

    // Get unique categories
    const uniqueCategories = categoriesResult.rows.map(item => item.category)

    res.json({ categories: uniqueCategories })
  } catch (error) {
    console.error('Categories fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get low stock products (Staff/Admin only)
router.get('/alerts/low-stock', authenticateToken, requireStaff, async(req, res) => {
  try {
    const productsResult = await sql.query(
      'SELECT * FROM products WHERE stock_level <= low_stock_threshold AND is_active = true ORDER BY stock_level ASC',
    )

    res.json({ products: productsResult.rows })
  } catch (error) {
    console.error('Low stock fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router