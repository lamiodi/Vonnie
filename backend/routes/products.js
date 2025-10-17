const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateProduct, validateUUID, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Get all products
router.get('/', validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, is_active = true, low_stock } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    if (low_stock === 'true') {
      query = query.filter('stock_level', 'lte', 'low_stock_threshold');
    }

    const { data: products, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch products', 
        message: error.message 
      });
    }

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by ID
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ 
        error: 'Product not found', 
        message: error.message 
      });
    }

    res.json({ product });
  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search products by name or SKU
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(limit);

    if (error) {
      return res.status(400).json({ 
        error: 'Search failed', 
        message: error.message 
      });
    }

    res.json({ products });
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new product (Staff/Admin only)
router.post('/', authenticateToken, requireStaff, validateProduct, async (req, res) => {
  try {
    const { name, description, sku, price, category, stock_level, low_stock_threshold, image_url } = req.body;

    // Check if SKU already exists
    const { data: existingProduct, error: checkError } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .single();

    if (existingProduct) {
      return res.status(400).json({ 
        error: 'SKU already exists', 
        message: 'A product with this SKU already exists' 
      });
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name,
        description,
        sku,
        price,
        category,
        stock_level,
        low_stock_threshold: low_stock_threshold || 5,
        image_url
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to create product', 
        message: error.message 
      });
    }

    // Log initial inventory
    await supabase
      .from('inventory_logs')
      .insert({
        product_id: product.id,
        adjustment_type: 'initial',
        quantity: stock_level,
        notes: 'Initial stock entry',
        staff_id: req.user.id
      });

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product (Staff/Admin only)
router.put('/:id', authenticateToken, requireStaff, validateUUID, validateProduct, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sku, price, category, stock_level, low_stock_threshold, image_url, is_active } = req.body;

    // Check if SKU already exists for other products
    const { data: existingProduct, error: checkError } = await supabase
      .from('products')
      .select('id')
      .eq('sku', sku)
      .neq('id', id)
      .single();

    if (existingProduct) {
      return res.status(400).json({ 
        error: 'SKU already exists', 
        message: 'Another product with this SKU already exists' 
      });
    }

    const { data: product, error } = await supabase
      .from('products')
      .update({
        name,
        description,
        sku,
        price,
        category,
        stock_level,
        low_stock_threshold,
        image_url,
        is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to update product', 
        message: error.message 
      });
    }

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Product update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Adjust stock level (Staff/Admin only)
router.patch('/:id/stock', authenticateToken, requireStaff, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment_type, quantity, notes } = req.body;

    if (!['sale', 'restock', 'adjustment'].includes(adjustment_type)) {
      return res.status(400).json({ 
        error: 'Invalid adjustment type', 
        message: 'Adjustment type must be sale, restock, or adjustment' 
      });
    }

    if (!quantity || typeof quantity !== 'number') {
      return res.status(400).json({ 
        error: 'Invalid quantity', 
        message: 'Quantity must be a valid number' 
      });
    }

    // Get current product
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('stock_level')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ 
        error: 'Product not found', 
        message: fetchError.message 
      });
    }

    // Calculate new stock level
    let newStockLevel;
    if (adjustment_type === 'sale') {
      newStockLevel = currentProduct.stock_level - Math.abs(quantity);
    } else if (adjustment_type === 'restock') {
      newStockLevel = currentProduct.stock_level + Math.abs(quantity);
    } else { // adjustment
      newStockLevel = quantity; // Direct set
    }

    if (newStockLevel < 0) {
      return res.status(400).json({ 
        error: 'Insufficient stock', 
        message: 'Stock level cannot be negative' 
      });
    }

    // Update product stock
    const { data: product, error: updateError } = await supabase
      .from('products')
      .update({ stock_level: newStockLevel })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ 
        error: 'Failed to update stock', 
        message: updateError.message 
      });
    }

    // Log inventory adjustment
    const logQuantity = adjustment_type === 'sale' ? -Math.abs(quantity) : 
                      adjustment_type === 'restock' ? Math.abs(quantity) : 
                      quantity - currentProduct.stock_level;

    await supabase
      .from('inventory_logs')
      .insert({
        product_id: id,
        adjustment_type,
        quantity: logQuantity,
        notes,
        staff_id: req.user.id
      });

    res.json({
      message: 'Stock adjusted successfully',
      product,
      adjustment: {
        type: adjustment_type,
        quantity: logQuantity,
        previous_stock: currentProduct.stock_level,
        new_stock: newStockLevel
      }
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product inventory history (Staff/Admin only)
router.get('/:id/inventory-history', authenticateToken, requireStaff, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data: logs, error, count } = await supabase
      .from('inventory_logs')
      .select(`
        *,
        profiles(first_name, last_name)
      `, { count: 'exact' })
      .eq('product_id', id)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch inventory history', 
        message: error.message 
      });
    }

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Inventory history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete product (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product has any transaction items
    const { data: transactionItems, error: transactionError } = await supabase
      .from('transaction_items')
      .select('id')
      .eq('product_id', id)
      .limit(1);

    if (transactionError) {
      return res.status(400).json({ 
        error: 'Failed to check product transactions', 
        message: transactionError.message 
      });
    }

    if (transactionItems && transactionItems.length > 0) {
      // Soft delete - deactivate instead of hard delete
      const { data: product, error } = await supabase
        .from('products')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ 
          error: 'Failed to deactivate product', 
          message: error.message 
        });
      }

      return res.json({
        message: 'Product deactivated successfully (has transaction history)',
        product
      });
    }

    // Hard delete if no transactions
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to delete product', 
        message: error.message 
      });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Product deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product categories
router.get('/categories/list', async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('products')
      .select('category')
      .not('category', 'is', null)
      .eq('is_active', true);

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch categories', 
        message: error.message 
      });
    }

    // Get unique categories
    const uniqueCategories = [...new Set(categories.map(item => item.category))];

    res.json({ categories: uniqueCategories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get low stock products (Staff/Admin only)
router.get('/alerts/low-stock', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .filter('stock_level', 'lte', 'low_stock_threshold')
      .eq('is_active', true)
      .order('stock_level', { ascending: true });

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch low stock products', 
        message: error.message 
      });
    }

    res.json({ products });
  } catch (error) {
    console.error('Low stock fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;