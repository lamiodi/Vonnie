const express = require('express');
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase-db');
const {
  hashPassword,
  comparePassword,
  encryptEmail,
  decryptEmail,
  generateToken,
  validatePasswordStrength,
  validateEmail
} = require('../utils/auth');

const router = express.Router();

// User registration
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('first_name').trim().notEmpty(),
  body('last_name').trim().notEmpty(),
  body('phone').optional().trim(),
  body('role').optional().isIn(['customer', 'staff', 'admin'])
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, first_name, last_name, phone, role = 'customer' } = req.body;

    // Validate email format
    validateEmail(email);
    
    // Validate password strength
    validatePasswordStrength(password);

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', encryptEmail(email))
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Encrypt email
    const encryptedEmail = encryptEmail(email);

    // Create user in database
    const { data: user, error: createError } = await supabase
      .from('profiles')
      .insert([{
        email: encryptedEmail,
        password_hash: hashedPassword,
        first_name,
        last_name,
        phone: phone || null,
        role,
        is_active: true,
        email_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select('*')
      .single();

    if (createError) {
      console.error('Registration error:', createError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: decryptEmail(user.email),
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
    
    // Encrypt email for database query
    const encryptedEmail = encryptEmail(email);

    // Find user by encrypted email
    const { data: user, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', encryptedEmail)
      .single();

    if (findError || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

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
        first_name: user.first_name,
        last_name: user.last_name,
        email: decryptEmail(user.email),
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
    const { verifyToken } = require('../utils/auth');
    const decoded = verifyToken(token);

    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: decryptEmail(user.email),
        phone: user.phone,
        role: user.role,
        is_active: user.is_active,
        email_verified: user.email_verified,
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
  body('first_name').optional().trim().notEmpty(),
  body('last_name').optional().trim().notEmpty(),
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
    const { verifyToken } = require('../utils/auth');
    const decoded = verifyToken(token);

    const { first_name, last_name, phone } = req.body;

    const { data: user, error } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name,
        phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.userId)
      .select('*')
      .single();

    if (error) {
      console.error('Update error:', error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: decryptEmail(user.email),
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
    const { verifyToken } = require('../utils/auth');
    const decoded = verifyToken(token);

    const { current_password, new_password } = req.body;

    // Validate new password strength
    validatePasswordStrength(new_password);

    // Get current user
    const { data: user, error: findError } = await supabase
      .from('profiles')
      .select('password_hash')
      .eq('id', decoded.userId)
      .single();

    if (findError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newHashedPassword = await hashPassword(new_password);

    // Update password
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        password_hash: newHashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', decoded.userId);

    if (updateError) {
      console.error('Password change error:', updateError);
      return res.status(500).json({ error: 'Failed to change password' });
    }

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;