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
router.get('/signup-status', authenticate, authorize(['admin']), async (req, res) => {
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
router.put('/signup-status', authenticate, authorize(['admin']), async (req, res) => {
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

// Admin Settings Endpoints - Simplified version
// Get admin settings (simplified: only online bookings and email notifications)
router.get('/settings', authenticate, authorize(['admin']), async (req, res) => {
  try {
    // Check if admin_settings table exists, if not create it with simplified structure
    try {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'admin_settings'
        )
      `);
      
      if (!result.rows[0].exists) {
        // Create simplified admin_settings table with maintenance mode
        await query(`
          CREATE TABLE admin_settings (
            id SERIAL PRIMARY KEY,
            enable_online_booking BOOLEAN DEFAULT true,
            enable_email_notifications BOOLEAN DEFAULT true,
            enable_maintenance_mode BOOLEAN DEFAULT false,
            updated_by UUID REFERENCES users(id),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `);
        
        // Insert default record with simplified settings
        await query(`
          INSERT INTO admin_settings (
            enable_online_booking, enable_email_notifications, enable_maintenance_mode
          ) VALUES (true, true, false)
        `);
      }
    } catch (error) {
      console.error('Error checking/creating admin_settings table:', error);
    }
    
    // Get current settings
    const settingsResult = await query('SELECT * FROM admin_settings ORDER BY id DESC LIMIT 1');
    
    if (settingsResult.rows.length === 0) {
      // Return simplified default settings if no record exists
      return res.json({
        enable_online_booking: true,
        enable_email_notifications: true,
        enable_maintenance_mode: false
      });
    }
    
    res.json(settingsResult.rows[0]);
  } catch (error) {
    console.error('Error fetching admin settings:', error);
    res.status(500).json({ error: 'Failed to fetch admin settings' });
  }
});

// Update admin settings (simplified version)
router.put('/settings', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const {
      enable_online_booking,
      enable_email_notifications,
      enable_maintenance_mode
    } = req.body;
    
    const userId = req.user.id;
    
    // Validate required fields
    if (enable_online_booking === undefined || enable_email_notifications === undefined || enable_maintenance_mode === undefined) {
      return res.status(400).json({ error: 'Missing required fields: enable_online_booking, enable_email_notifications, and enable_maintenance_mode' });
    }
    
    // Update or insert settings (simplified)
    const updateResult = await query(`
      INSERT INTO admin_settings (
        enable_online_booking, enable_email_notifications, enable_maintenance_mode, updated_by
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      enable_online_booking,
      enable_email_notifications,
      enable_maintenance_mode,
      userId
    ]);
    
    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Admin settings updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating admin settings:', error);
    res.status(500).json({ error: 'Failed to update admin settings' });
  }
});

// Export Customer Data (CSV Format)
router.get('/export-customers', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    // Fetch users with 'customer' role or extract distinct customers from bookings if no specific customer role exists
    // Assuming we want all users who are not admin/manager/staff, or we can fetch from a dedicated customers table if it existed.
    // For now, let's fetch all users with role='customer' AND also anyone who has made a booking (distinct email/phone).
    
    // Strategy: 
    // 1. Get registered users with role 'customer'
    // 2. Get unique customers from bookings table (name, email, phone)
    // 3. Merge them based on email/phone to avoid duplicates
    
    // 1. Fetch registered customers
    const registeredUsersQuery = `
      SELECT name, email, phone, created_at 
      FROM users 
      WHERE role = 'customer'
    `;
    const registeredUsers = (await query(registeredUsersQuery)).rows;

    // 2. Fetch distinct customers from bookings
    const bookingCustomersQuery = `
      SELECT DISTINCT customer_name as name, customer_email as email, customer_phone as phone
      FROM bookings
      WHERE customer_email IS NOT NULL OR customer_phone IS NOT NULL
    `;
    const bookingCustomers = (await query(bookingCustomersQuery)).rows;

    // 3. Merge list (using a Map to deduplicate by email or phone)
    const customerMap = new Map();

    // Helper to generate a unique key (prefer email, fallback to phone)
    const getKey = (c) => c.email ? c.email.toLowerCase() : (c.phone || Math.random().toString());

    // Add registered users first (they might have more accurate data)
    registeredUsers.forEach(user => {
      if (user.email || user.phone) {
        customerMap.set(getKey(user), {
          name: user.name || 'N/A',
          email: user.email || '',
          phone: user.phone || '',
          source: 'Registered'
        });
      }
    });

    // Add booking customers (if not already present)
    bookingCustomers.forEach(cust => {
      const key = getKey(cust);
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: cust.name || 'Guest',
          email: cust.email || '',
          phone: cust.phone || '',
          source: 'Walk-in/Booking'
        });
      }
    });

    const allCustomers = Array.from(customerMap.values());

    // 4. Generate CSV
    // Simple CSV generation without external library to keep it lightweight
    const csvHeader = 'Name,Email,Phone,Source\n';
    const csvRows = allCustomers.map(c => {
      // Escape quotes and handle commas in fields
      const safeName = `"${(c.name || '').replace(/"/g, '""')}"`;
      const safeEmail = `"${(c.email || '').replace(/"/g, '""')}"`;
      const safePhone = `"${(c.phone || '').replace(/"/g, '""')}"`;
      const safeSource = `"${(c.source || '').replace(/"/g, '""')}"`;
      return `${safeName},${safeEmail},${safePhone},${safeSource}`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    // 5. Send Response
    res.header('Content-Type', 'text/csv');
    res.attachment('customer_export.csv');
    return res.send(csvContent);

  } catch (error) {
    console.error('Error exporting customers:', error);
    res.status(500).json({ error: 'Failed to export customer data' });
  }
});

export default router;