import express from 'express';
import { query, getClient } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendEmail, sendInventoryAlert } from '../services/email.js';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse } from '../utils/apiResponse.js';
import { validateRequiredFields } from '../utils/validation.js';

const router = express.Router();

// Get all products
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM products');
    res.json(successResponse(result.rows, 'Products retrieved successfully'));
  } catch (error) {
    console.error('Get products error:', error);
    res.status(400).json(errorResponse(error.message, 'INVENTORY_FETCH_ERROR', 400));
  }
});

// Add new product
router.post('/', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { name, description, sku, price, category, stock_level } = req.body;
  
  // Validate required fields
  const requiredFields = ['name', 'price', 'category', 'stock_level'];
  const validation = validateRequiredFields(req.body, requiredFields);
  
  if (!validation.isValid) {
    return res.status(400).json(validationErrorResponse(validation.missingFields, validation.error));
  }
  
  // Validate data types and ranges
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json(errorResponse('Product name must be a non-empty string', 'INVALID_PRODUCT_NAME', 400));
  }
  
  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json(errorResponse('Product price must be a positive number', 'INVALID_PRODUCT_PRICE', 400));
  }
  
  if (typeof category !== 'string' || category.trim().length === 0) {
    return res.status(400).json(errorResponse('Product category must be a non-empty string', 'INVALID_PRODUCT_CATEGORY', 400));
  }
  
  if (typeof stock_level !== 'number' || stock_level < 0) {
    return res.status(400).json(errorResponse('Stock level must be a non-negative number', 'INVALID_STOCK_LEVEL', 400));
  }
  
  if (sku && typeof sku !== 'string') {
    return res.status(400).json(errorResponse('SKU must be a string if provided', 'INVALID_SKU_FORMAT', 400));
  }
  
  if (description && typeof description !== 'string') {
    return res.status(400).json(errorResponse('Description must be a string if provided', 'INVALID_DESCRIPTION_FORMAT', 400));
  }
  
  try {
    const result = await query(
      `INSERT INTO products (name, description, sku, price, category, stock_level)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, sku, price, category, stock_level]
    );
    
    res.status(201).json(successResponse(result.rows[0], 'Product created successfully', 201));
  } catch (error) {
    console.error('Add product error:', error);
    res.status(400).json(errorResponse(error.message, 'PRODUCT_CREATE_ERROR', 400));
  }
});

// Update product stock (quick adjustment)
router.patch('/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { stock_level } = req.body;
  
  // Validate required fields
  if (stock_level === undefined || stock_level === null) {
    return res.status(400).json(errorResponse('Stock level is required', 'MISSING_STOCK_LEVEL', 400));
  }
  
  // Validate data type and range
  if (typeof stock_level !== 'number' || stock_level < 0) {
    return res.status(400).json(errorResponse('Stock level must be a non-negative number', 'INVALID_STOCK_LEVEL', 400));
  }
  
  try {
    const result = await query(
      'UPDATE products SET stock_level = $1 WHERE id = $2 RETURNING *',
      [stock_level, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Product', id));
    }

    const product = result.rows[0];
    
    if (stock_level < 5) {
      await sendInventoryAlert({
        alertType: 'low_stock',
        products: [{ name: product.name, sku: product.sku, stock_level: stock_level }],
        recipientEmail: 'admin@vonneex2x.store'
      });
    }

    res.json(successResponse(product, 'Product stock updated successfully'));
  } catch (error) {
    console.error('Update product stock error:', error);
    res.status(400).json(errorResponse(error.message, 'STOCK_UPDATE_ERROR', 400));
  }
});

// Full product update
router.put('/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { name, description, sku, price, category, stock_level } = req.body;
  
  try {
    const result = await query(
      `UPDATE products 
       SET name = $1, description = $2, sku = $3, price = $4, category = $5, stock_level = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 
       RETURNING *`,
      [name, description, sku, price, category, stock_level, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Product', id));
    }

    const product = result.rows[0];
    
    if (stock_level < 5) {
      await sendInventoryAlert({
        alertType: 'low_stock',
        products: [{ name: product.name, sku: product.sku, stock_level: stock_level }],
        recipientEmail: 'admin@vonneex2x.store'
      });
    }

    res.json(successResponse(product, 'Product updated successfully'));
  } catch (error) {
    console.error('Full product update error:', error);
    res.status(400).json(errorResponse(error.message, 'PRODUCT_UPDATE_ERROR', 400));
  }
});

// Search product by SKU (used as barcode)
router.get('/barcode/:barcode', authenticate, async (req, res) => {
  const { barcode } = req.params;
  
  try {
    const result = await query(
      'SELECT * FROM products WHERE sku = $1',
      [barcode]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Product', barcode));
    }
    
    res.json(successResponse(result.rows[0], 'Product retrieved successfully'));
  } catch (error) {
    console.error('SKU search error:', error);
    res.status(400).json(errorResponse(error.message, 'SKU_SEARCH_ERROR', 400));
  }
});

// Log stock adjustment
router.post('/adjust/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { id } = req.params;
  const { adjustment, reason } = req.body;
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Get current stock level
    const productResult = await client.query(
      'SELECT stock_level FROM products WHERE id = $1 FOR UPDATE',
      [id]
    );
    
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json(notFoundResponse('Product', id));
    }
    
    const currentStock = productResult.rows[0].stock_level;
    const newStock = currentStock + adjustment;
    
    // Update product stock
    const updateResult = await client.query(
      'UPDATE products SET stock_level = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newStock, id]
    );
    
    // Log the adjustment
    await client.query(
      `INSERT INTO payment_inventory_logs (product_id, adjustment_quantity, previous_stock_level, new_stock_level, adjustment_reason, adjusted_by, booking_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, adjustment, currentStock, newStock, reason, req.user.id, req.user.id] // Using user.id as booking_id as a placeholder
    );
    
    await client.query('COMMIT');
    
    res.json(successResponse(updateResult.rows[0], 'Stock adjusted successfully'));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Stock adjustment error:', error);
    res.status(400).json(errorResponse(error.message, 'STOCK_ADJUSTMENT_ERROR', 400));
  } finally {
    client.release();
  }
});

export default router;