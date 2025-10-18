import express from 'express';
import { supabase } from '../config/supabase-db.js';
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js';
import { validateTransaction, validateUUID, validatePagination } from '../middleware/validation.js';

const router = express.Router();

// Get transactions
router.get('/', authenticateToken, requireStaff, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, date_from, date_to, customer_id } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transactions')
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }
    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    const { data: transactions, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch transactions', 
        message: error.message 
      });
    }

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transaction by ID
router.get('/:id', authenticateToken, requireStaff, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: transaction, error } = await supabase
      .from('transactions')
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name),
        transaction_items(
          id,
          quantity,
          unit_price,
          total_price,
          item_type,
          service:services(id, name, category, price),
          product:products(id, name, category, price, sku)
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ 
        error: 'Transaction not found', 
        message: error.message 
      });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('Transaction fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create transaction
router.post('/', authenticateToken, requireStaff, validateTransaction, async (req, res) => {
  try {
    const {
      customer_id,
      type,
      items, // Array of { item_type, item_id, quantity, unit_price }
      payment_method,
      payment_reference,
      discount_amount = 0,
      tax_amount = 0,
      notes
    } = req.body;

    // Calculate total amount from items
    let subtotal = 0;
    const processedItems = [];

    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      subtotal += itemTotal;
      
      processedItems.push({
        item_type: item.item_type,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: itemTotal
      });

      // Update inventory for products
      if (item.item_type === 'product') {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.item_id)
          .single();

        if (productError) {
          return res.status(400).json({ 
            error: 'Product not found', 
            message: productError.message 
          });
        }

        if (product.stock_quantity < item.quantity) {
          return res.status(400).json({ 
            error: 'Insufficient stock', 
            message: `Not enough stock for product ${item.item_id}` 
          });
        }

        // Reduce stock quantity
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: product.stock_quantity - item.quantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.item_id);

        if (updateError) {
          return res.status(400).json({ 
            error: 'Failed to update product stock', 
            message: updateError.message 
          });
        }

        // Create inventory history record
        await supabase
          .from('inventory_history')
          .insert({
            product_id: item.item_id,
            change_type: 'sale',
            quantity_changed: -item.quantity,
            previous_quantity: product.stock_quantity,
            new_quantity: product.stock_quantity - item.quantity,
            reference_type: 'transaction',
            notes: `Sale transaction`,
            created_by: req.user.id
          });
      }
    }

    const totalAmount = subtotal - discount_amount + tax_amount;

    // Create transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        customer_id,
        staff_id: req.user.id,
        type,
        subtotal,
        discount_amount,
        tax_amount,
        total_amount: totalAmount,
        payment_method,
        payment_reference,
        status: payment_method === 'cash' ? 'completed' : 'pending',
        notes
      })
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name)
      `)
      .single();

    if (transactionError) {
      return res.status(400).json({ 
        error: 'Failed to create transaction', 
        message: transactionError.message 
      });
    }

    // Create transaction items
    const itemsWithTransactionId = processedItems.map(item => ({
      ...item,
      transaction_id: transaction.id
    }));

    const { data: transactionItems, error: itemsError } = await supabase
      .from('transaction_items')
      .insert(itemsWithTransactionId)
      .select(`
        *,
        service:services(id, name, category, price),
        product:products(id, name, category, price, sku)
      `);

    if (itemsError) {
      return res.status(400).json({ 
        error: 'Failed to create transaction items', 
        message: itemsError.message 
      });
    }

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction: {
        ...transaction,
        transaction_items: transactionItems
      }
    });
  } catch (error) {
    console.error('Transaction creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update transaction status
router.put('/:id/status', authenticateToken, requireStaff, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_reference } = req.body;

    if (!['pending', 'completed', 'cancelled', 'refunded'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status', 
        message: 'Status must be one of: pending, completed, cancelled, refunded' 
      });
    }

    const updateData = { status };
    if (payment_reference) {
      updateData.payment_reference = payment_reference;
    }
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name)
      `)
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to update transaction status', 
        message: error.message 
      });
    }

    // If transaction is cancelled, restore inventory
    if (status === 'cancelled') {
      const { data: items, error: itemsError } = await supabase
        .from('transaction_items')
        .select('*')
        .eq('transaction_id', id);

      if (!itemsError && items) {
        for (const item of items) {
          if (item.item_type === 'product') {
            // Restore stock quantity
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.item_id)
              .single();

            if (!productError && product) {
              await supabase
                .from('products')
                .update({ 
                  stock_quantity: product.stock_quantity + item.quantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.item_id);

              // Create inventory history record
              await supabase
                .from('inventory_history')
                .insert({
                  product_id: item.item_id,
                  change_type: 'return',
                  quantity_changed: item.quantity,
                  previous_quantity: product.stock_quantity,
                  new_quantity: product.stock_quantity + item.quantity,
                  reference_type: 'transaction_cancellation',
                  reference_id: id,
                  notes: `Transaction cancellation - restored stock`,
                  created_by: req.user.id
                });
            }
          }
        }
      }
    }

    res.json({
      message: 'Transaction status updated successfully',
      transaction
    });
  } catch (error) {
    console.error('Transaction status update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update transaction
router.put('/:id', authenticateToken, requireStaff, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { discount_amount, tax_amount, notes, payment_method, payment_reference } = req.body;

    // Get current transaction
    const { data: currentTransaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ 
        error: 'Transaction not found', 
        message: fetchError.message 
      });
    }

    if (currentTransaction.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot modify completed transaction', 
        message: 'Completed transactions cannot be modified' 
      });
    }

    // Calculate new total if discount or tax changed
    let updateData = { notes, payment_method, payment_reference };
    
    if (discount_amount !== undefined || tax_amount !== undefined) {
      const newDiscountAmount = discount_amount !== undefined ? discount_amount : currentTransaction.discount_amount;
      const newTaxAmount = tax_amount !== undefined ? tax_amount : currentTransaction.tax_amount;
      const newTotalAmount = currentTransaction.subtotal - newDiscountAmount + newTaxAmount;
      
      updateData = {
        ...updateData,
        discount_amount: newDiscountAmount,
        tax_amount: newTaxAmount,
        total_amount: newTotalAmount
      };
    }

    const { data: transaction, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name)
      `)
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to update transaction', 
        message: error.message 
      });
    }

    res.json({
      message: 'Transaction updated successfully',
      transaction
    });
  } catch (error) {
    console.error('Transaction update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete transaction (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    // Get transaction details before deletion
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items(*)
      `)
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ 
        error: 'Transaction not found', 
        message: fetchError.message 
      });
    }

    // Restore inventory if transaction was completed
    if (transaction.status === 'completed') {
      for (const item of transaction.transaction_items) {
        if (item.item_type === 'product') {
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.item_id)
            .single();

          if (!productError && product) {
            await supabase
              .from('products')
              .update({ 
                stock_quantity: product.stock_quantity + item.quantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.item_id);

            // Create inventory history record
            await supabase
              .from('inventory_history')
              .insert({
                product_id: item.item_id,
                change_type: 'return',
                quantity_changed: item.quantity,
                previous_quantity: product.stock_quantity,
                new_quantity: product.stock_quantity + item.quantity,
                reference_type: 'transaction_deletion',
                reference_id: id,
                notes: `Transaction deletion - restored stock`,
                created_by: req.user.id
              });
          }
        }
      }
    }

    // Delete transaction (cascade will delete transaction_items)
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(400).json({ 
        error: 'Failed to delete transaction', 
        message: deleteError.message 
      });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Transaction deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get transaction statistics
router.get('/stats/overview', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { date_from, date_to, staff_id } = req.query;
    
    let query = supabase
      .from('transactions')
      .select('*');
    
    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to);
    }
    if (staff_id && req.user.role === 'admin') {
      query = query.eq('staff_id', staff_id);
    } else if (req.user.role === 'staff') {
      query = query.eq('staff_id', req.user.id);
    }

    const { data: transactions, error } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch transaction stats', 
        message: error.message 
      });
    }

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
      monthlyStats: {}
    };

    transactions.forEach(transaction => {
      // Revenue calculation (only completed transactions)
      if (transaction.status === 'completed') {
        stats.totalRevenue += transaction.total_amount;
        stats.completedTransactions += 1;
      }
      
      // Status counts
      if (transaction.status === 'pending') stats.pendingTransactions += 1;
      if (transaction.status === 'cancelled') stats.cancelledTransactions += 1;
      if (transaction.status === 'refunded') stats.refundedTransactions += 1;
      
      // Payment methods
      const paymentMethod = transaction.payment_method || 'unknown';
      stats.paymentMethods[paymentMethod] = (stats.paymentMethods[paymentMethod] || 0) + 1;
      
      // Transaction types
      const transactionType = transaction.type || 'unknown';
      stats.transactionTypes[transactionType] = (stats.transactionTypes[transactionType] || 0) + 1;
      
      // Daily stats
      const date = transaction.created_at.split('T')[0];
      if (!stats.dailyStats[date]) {
        stats.dailyStats[date] = {
          count: 0,
          revenue: 0
        };
      }
      stats.dailyStats[date].count += 1;
      if (transaction.status === 'completed') {
        stats.dailyStats[date].revenue += transaction.total_amount;
      }
      
      // Monthly stats
      const month = date.substring(0, 7); // YYYY-MM
      if (!stats.monthlyStats[month]) {
        stats.monthlyStats[month] = {
          count: 0,
          revenue: 0
        };
      }
      stats.monthlyStats[month].count += 1;
      if (transaction.status === 'completed') {
        stats.monthlyStats[month].revenue += transaction.total_amount;
      }
    });

    stats.averageTransactionValue = stats.completedTransactions > 0 
      ? stats.totalRevenue / stats.completedTransactions 
      : 0;

    res.json({ stats });
  } catch (error) {
    console.error('Transaction stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily sales report
router.get('/reports/daily', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { date = new Date().toISOString().split('T')[0] } = req.query;
    
    let query = supabase
      .from('transactions')
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name),
        staff:profiles!staff_id(first_name, last_name),
        transaction_items(
          *,
          service:services(name, category),
          product:products(name, category, sku)
        )
      `)
      .gte('created_at', `${date}T00:00:00`)
      .lt('created_at', `${date}T23:59:59`)
      .order('created_at', { ascending: false });

    // Role-based filtering
    if (req.user.role === 'staff') {
      query = query.eq('staff_id', req.user.id);
    }

    const { data: transactions, error } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch daily report', 
        message: error.message 
      });
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
      paymentMethods: {}
    };

    summary.averageTransactionValue = summary.completedTransactions > 0 
      ? summary.totalRevenue / summary.completedTransactions 
      : 0;

    // Analyze transaction items
    transactions.forEach(transaction => {
      // Payment methods
      const paymentMethod = transaction.payment_method || 'unknown';
      summary.paymentMethods[paymentMethod] = (summary.paymentMethods[paymentMethod] || 0) + 1;
      
      // Services and products
      transaction.transaction_items.forEach(item => {
        if (item.item_type === 'service' && item.service) {
          const serviceName = item.service.name;
          summary.topServices[serviceName] = (summary.topServices[serviceName] || 0) + item.quantity;
        } else if (item.item_type === 'product' && item.product) {
          const productName = item.product.name;
          summary.topProducts[productName] = (summary.topProducts[productName] || 0) + item.quantity;
        }
      });
    });

    res.json({
      summary,
      transactions
    });
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;