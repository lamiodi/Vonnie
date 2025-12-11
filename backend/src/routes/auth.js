import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { sendEmail } from '../services/email.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { validateEmail, validateStringLength, validatePhone } from '../utils/inputValidation.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email: inputEmail, password, role = 'staff', phone, specialty } = req.body;
    const email = inputEmail ? inputEmail.toLowerCase() : inputEmail;
    
    // Check if this is an admin registration attempt
    if (role === 'admin') {
      // Check if ANY admin already exists
      const adminCheck = await query('SELECT 1 FROM users WHERE role = $1', ['admin']);
      if (adminCheck.rows.length > 0) {
        return res.status(403).json(errorResponse(
          'System already has an administrator. Only one admin is allowed.',
          'ADMIN_EXISTS',
          403
        ));
      }
      // If no admin exists, proceed to create the FIRST and ONLY admin
    } else if (role === 'manager') {
      // Check if ANY manager already exists
      const managerCheck = await query('SELECT 1 FROM users WHERE role = $1', ['manager']);
      if (managerCheck.rows.length > 0) {
        return res.status(403).json(errorResponse(
          'System already has a manager. Only one manager is allowed.',
          'MANAGER_EXISTS',
          403
        ));
      }
    } else {
      // For non-admin/manager roles (staff), proceed with normal checks
      
      // Check if signups are enabled
      try {
        const statusResult = await query('SELECT is_enabled FROM signup_status ORDER BY id DESC LIMIT 1');
        if (statusResult.rows.length > 0 && !statusResult.rows[0].is_enabled) {
          return res.status(403).json(errorResponse(
            'Signups are currently disabled. Please contact your administrator.',
            'SIGNUPS_DISABLED',
            403
          ));
        }
      } catch (error) {
        console.log('Signup status check failed, proceeding with registration:', error.message);
      }
      
      // Validate role - only allow staff and manager roles for registration (unless it was the admin case above)
      const allowedRoles = ['staff', 'manager'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json(errorResponse(
          'Invalid role. Only staff and manager roles are allowed for registration.',
          'INVALID_ROLE',
          400
        ));
      }
    }
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json(errorResponse(
        'Email and password are required',
        'MISSING_REQUIRED_FIELDS',
        400
      ));
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json(errorResponse(
        `Email: ${emailValidation.message}`,
        'INVALID_EMAIL',
        400
      ));
    }
    
    // Validate password
    if (password.length < 6) {
      return res.status(400).json(errorResponse(
        'Password must be at least 6 characters long',
        'INVALID_PASSWORD',
        400
      ));
    }
    
    // Validate name if provided
    if (name) {
      const nameValidation = validateStringLength(name, { min: 2, max: 100 });
      if (!nameValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Name: ${nameValidation.message}`,
          'INVALID_NAME',
          400
        ));
      }
    }
    
    // Validate phone if provided
    if (phone) {
      const phoneValidation = validatePhone(phone);
      if (!phoneValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Phone: ${phoneValidation.message}`,
          'INVALID_PHONE',
          400
        ));
      }
    }
    
    // Debug: log the received data
    console.log('Register request received:');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('Password:', password ? 'provided' : 'missing');
    console.log('Role:', role);
    console.log('Phone:', phone);
    console.log('Full request body:', req.body);
    
    /* 
    // MOVED UP: Checks for signup status and role validation logic have been moved to the top of the function
    // to support the "Initial Admin Setup" flow.
    */
    
    // Check if user already exists
    const existingUser = await query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json(errorResponse(
        'User with this email already exists.',
        'EMAIL_ALREADY_EXISTS',
        400
      ));
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userName = name || email.split('@')[0];

    const result = await query(
      'INSERT INTO users (name, email, password_hash, role, phone, specialty) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [userName, email, hashedPassword, role, phone || null, specialty || null]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Return user data without sensitive information
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      specialty: user.specialty,
      is_active: user.is_active,
      current_status: user.current_status
    };
    
    res.status(201).json(successResponse({ token, user: userResponse }, 'User registered successfully', 201));
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json(errorResponse(error.message, 'REGISTRATION_ERROR', 400));
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json(errorResponse(
        'Email and password are required',
        'MISSING_REQUIRED_FIELDS',
        400
      ));
    }
    
    // Normalize email to lowercase for case-insensitive login
    const normalizedEmail = email.toLowerCase();
    
    // Validate email format
    const emailValidation = validateEmail(normalizedEmail);
    if (!emailValidation.isValid) {
      return res.status(400).json(errorResponse(
        `Email: ${emailValidation.message}`,
        'INVALID_EMAIL',
        400
      ));
    }
    
    console.log('Login attempt for email:', normalizedEmail);
    console.log('Request body:', req.body);
    
    const result = await query(
      'SELECT * FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    console.log('Database query result:', result);
    console.log('Number of rows found:', result.rows.length);
    
    const user = result.rows[0];
    
    // Debug: log the user object to see available fields
    console.log('User from database:', user);
    console.log('User object keys:', user ? Object.keys(user) : 'No user found');
    
    // Check if user exists and has a password field (could be password_hash or password)
    if (!user) {
      console.log('No user found with email:', email);
      return res.status(400).json(errorResponse(
        'Invalid credentials',
        'INVALID_CREDENTIALS',
        400
      ));
    }
    
    // Try different possible password field names
    const passwordField = user.password_hash || user.password;
    console.log('Password field found:', passwordField ? 'Yes' : 'No');
    console.log('Password field type:', typeof passwordField);
    
    if (!passwordField) {
      console.error('No password field found in user object:', Object.keys(user));
      return res.status(400).json(errorResponse(
        'Invalid credentials',
        'INVALID_CREDENTIALS',
        400
      ));
    }
    
    console.log('Comparing password with bcrypt...');
    const passwordMatch = await bcrypt.compare(password, passwordField);
    console.log('Password match result:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('Password does not match for user:', email);
      return res.status(400).json(errorResponse(
        'Invalid credentials',
        'INVALID_CREDENTIALS',
        400
      ));
    }

    console.log('Login successful for user:', email);
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    // Return user data without sensitive information
    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      is_active: user.is_active,
      current_status: user.current_status
    };
    
    res.json(successResponse({ token, user: userResponse }, 'Login successful'));
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(400).json(errorResponse('Invalid credentials', 'LOGIN_ERROR', 400));
  }
});

// Verify token and return current user
router.get('/verify', authenticate, async (req, res) => {
  try {
    const { id, email, role } = req.user;
    return res.json(successResponse({ user: { id, email, role } }, 'Token verified successfully'));
  } catch (error) {
    console.error('Verify error:', error);
    res.status(400).json(errorResponse(error.message, 'VERIFY_ERROR', 400));
  }
});
export default router;
