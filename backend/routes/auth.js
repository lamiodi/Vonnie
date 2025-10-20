import express from 'express';
import { body, validationResult } from 'express-validator';
import { sql } from '../config/database.js';
import {
  hashPassword,
  comparePassword,
  encryptEmail,
  decryptEmail,
  generateToken,
  validatePasswordStrength,
  validateEmail,
  verifyToken
} from '../utils/auth.js';

const router = express.Router();

// User registration
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('first_name').trim().notEmpty(),
  body('last_name').trim().notEmpty(),
  body('phone').optional().trim(),
  body('role').optional().isIn(['staff', 'admin'])
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, first_name, last_name, phone, role = 'staff' } = req.body;

    // Validate email format
    validateEmail(email);
    
    // Validate password strength
    validatePasswordStrength(password);

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user in database
    const users = await sql`
      INSERT INTO users (email, password_hash, full_name, phone, role, is_active, created_at, updated_at)
      VALUES (${email}, ${hashedPassword}, ${`${first_name} ${last_name}`}, ${phone || null}, ${role}, true, NOW(), NOW())
      RETURNING *
    `;

    if (users.length === 0) {
      console.error('Registration error: Failed to create user');
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const user = users[0];

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// User login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user by email
    const users = await sql`
      SELECT * FROM users WHERE email = ${email}
    `;

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Compare passwords
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    // This will be protected by authentication middleware
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const users = await sql`
      SELECT * FROM users WHERE id = ${decoded.userId}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    res.json({
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Update user profile
router.put('/profile', [
  body('full_name').optional().trim().notEmpty(),
  body('phone').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const { full_name, phone } = req.body;

    const users = await sql`
      UPDATE users 
      SET full_name = ${full_name}, phone = ${phone}, updated_at = NOW()
      WHERE id = ${decoded.userId}
      RETURNING *
    `;

    if (users.length === 0) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    const user = users[0];

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Change password
router.put('/change-password', [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const { current_password, new_password } = req.body;

    // Validate new password strength
    validatePasswordStrength(new_password);

    // Get current user
    const users = await sql`
      SELECT password_hash FROM users WHERE id = ${decoded.userId}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newHashedPassword = await hashPassword(new_password);

    // Update password
    await sql`
      UPDATE users 
      SET password_hash = ${newHashedPassword}, updated_at = NOW()
      WHERE id = ${decoded.userId}
    `;

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;