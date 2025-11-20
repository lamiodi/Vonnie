import express from 'express';
import { query } from '../config/database.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Simple admin health check
router.get('/health', authenticate, authorize(['admin', 'manager']), (req, res) => {
  res.json({ status: 'OK', scope: 'admin' });
});

// Example: fetch dashboard metrics
router.get('/dashboard', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const [{ count: product_count }] = (await query('SELECT COUNT(*) FROM products')).rows;
    const [{ count: user_count }] = (await query('SELECT COUNT(*) FROM users')).rows;
    return res.json({ product_count: Number(product_count), user_count: Number(user_count) });
  } catch (err) {
    console.error('Error fetching dashboard metrics:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

// Get current signup status
router.get('/signup-status', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    // Check if signup_status table exists, if not create it
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'signup_status'
        )
      `);
      
      if (!result.rows[0].exists) {
        // Create signup_status table if it doesn't exist
        await query(`
          CREATE TABLE signup_status (
            id SERIAL PRIMARY KEY,
            is_enabled BOOLEAN DEFAULT true,
            updated_by UUID REFERENCES users(id),
            updated_at TIMESTAMP DEFAULT NOW(),
            message TEXT DEFAULT 'Signups are currently enabled.'
          )
        `);
        
        // Insert default record
        await query(`
          INSERT INTO signup_status (is_enabled, message) 
          VALUES (true, 'Signups are currently enabled.')
        `);
      }
    } catch (error) {
      console.error('Error checking/creating signup_status table:', error);
    }
    
    // Get current status
    const statusResult = await query('SELECT * FROM signup_status ORDER BY id DESC LIMIT 1');
    
    if (statusResult.rows.length === 0) {
      return res.json({ 
        is_enabled: true, 
        message: 'Signups are currently enabled.',
        updated_at: new Date().toISOString()
      });
    }
    
    res.json(statusResult.rows[0]);
  } catch (error) {
    console.error('Error fetching signup status:', error);
    res.status(500).json({ error: 'Failed to fetch signup status' });
  }
});

// Update signup status
router.put('/signup-status', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { is_enabled, message } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (typeof is_enabled !== 'boolean') {
      return res.status(400).json({ error: 'is_enabled must be a boolean' });
    }
    
    // Check if signup_status table exists, if not create it
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'signup_status'
        )
      `);
      
      if (!result.rows[0].exists) {
        await query(`
          CREATE TABLE signup_status (
            id SERIAL PRIMARY KEY,
            is_enabled BOOLEAN DEFAULT true,
            updated_by UUID REFERENCES users(id),
            updated_at TIMESTAMP DEFAULT NOW(),
            message TEXT DEFAULT 'Signups are currently enabled.'
          )
        `);
      }
    } catch (error) {
      console.error('Error checking signup_status table:', error);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Update signup status
    const updateResult = await query(`
      INSERT INTO signup_status (is_enabled, updated_by, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [is_enabled, userId, message || (is_enabled ? 'Signups are currently enabled.' : 'Signups are currently disabled.')]);
    
    res.json({
      success: true,
      data: updateResult.rows[0],
      message: `Signups have been ${is_enabled ? 'enabled' : 'disabled'} successfully`
    });
    
  } catch (error) {
    console.error('Error updating signup status:', error);
    res.status(500).json({ error: 'Failed to update signup status' });
  }
});

export default router;