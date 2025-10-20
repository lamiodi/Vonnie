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

// Test database connection endpoint
router.get('/test-db', async (req, res) => {
  try {
    // Simple query to test database connection
    const result = await sql`SELECT NOW() as current_time, 'Database connected successfully!' as message`;
    
    res.json({
      success: true,
      message: 'Supabase database connection is working!',
      timestamp: result[0].current_time,
      database_message: result[0].message
    });
  } catch (error) {
    console.error('Database connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: error.message
    });
  }
});

// Setup database tables and demo accounts
router.post('/setup-database', async (req, res) => {
  try {
    console.log('🚀 Starting database setup via API...');
    const results = [];
    
    // 1. Enable UUID extension
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
      results.push('✅ UUID extension enabled');
    } catch (error) {
      results.push('ℹ️  UUID extension already exists');
    }
    
    // 2. Create users table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'customer')),
          is_active BOOLEAN DEFAULT true,
          email_verified BOOLEAN DEFAULT false,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      results.push('✅ Users table created');
    } catch (error) {
      results.push('ℹ️  Users table already exists');
    }
    
    // 3. Create departments table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS departments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          manager_id UUID REFERENCES users(id),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      results.push('✅ Departments table created');
    } catch (error) {
      results.push('ℹ️  Departments table already exists');
    }
    
    // 4. Create profiles table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          specialization VARCHAR(255),
          experience VARCHAR(100),
          employee_id VARCHAR(50) UNIQUE,
          hire_date DATE,
          salary DECIMAL(12,2),
          commission_rate DECIMAL(5,2) DEFAULT 0.00,
          address TEXT,
          emergency_contact VARCHAR(255),
          emergency_phone VARCHAR(20),
          skills TEXT,
          notes TEXT,
          avatar_url VARCHAR(500),
          department_id UUID REFERENCES departments(id),
          position VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      results.push('✅ Profiles table created');
    } catch (error) {
      results.push('ℹ️  Profiles table already exists');
    }
    
    // 5. Create guest_customers table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS guest_customers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(20) NOT NULL,
          address TEXT,
          date_of_birth DATE,
          gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
          notes TEXT,
          loyalty_points INTEGER DEFAULT 0,
          total_visits INTEGER DEFAULT 0,
          total_spent DECIMAL(12,2) DEFAULT 0.00,
          last_visit TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      results.push('✅ Guest customers table created');
    } catch (error) {
      results.push('ℹ️  Guest customers table already exists');
    }
    
    // 6. Insert demo departments
    try {
      await sql`
        INSERT INTO departments (name, description, is_active) VALUES
        ('Hair Styling', 'Hair cutting, styling, and treatments', true),
        ('Nail Care', 'Manicure, pedicure, and nail art services', true),
        ('Skin Care', 'Facial treatments and skin care services', true),
        ('Massage Therapy', 'Relaxation and therapeutic massage services', true),
        ('Administration', 'Management and administrative staff', true)
        ON CONFLICT (name) DO NOTHING
      `;
      results.push('✅ Demo departments created');
    } catch (error) {
      results.push('ℹ️  Demo departments already exist');
    }
    
    // 7. Insert demo admin account
    try {
      // Password: Admin@2024 (hashed with bcrypt)
      const adminResult = await sql`
        INSERT INTO users (email, password_hash, full_name, phone, role, is_active, email_verified) VALUES
        ('admin@vonnex2x.com', '$2b$12$LQv3c1yqBwEHXjp.RweHNe1fF0XgMhOxp5dMChWnkUOib1h.kNjSW', 'Admin Demo', '+2348012345678', 'admin', true, true)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;
      
      if (adminResult.length > 0) {
        results.push('✅ Admin account created');
        
        // Create admin profile
        const adminDept = await sql`SELECT id FROM departments WHERE name = 'Administration' LIMIT 1`;
        if (adminDept.length > 0) {
          await sql`
            INSERT INTO profiles (
              user_id, first_name, last_name, specialization, experience, 
              employee_id, hire_date, position, department_id
            ) VALUES (
              ${adminResult[0].id}, 'Admin', 'Demo', 'System Administration', 'Expert Level',
              'EMP001', CURRENT_DATE - INTERVAL '2 years', 'System Administrator', ${adminDept[0].id}
            )
            ON CONFLICT DO NOTHING
          `;
          results.push('✅ Admin profile created');
        }
      } else {
        results.push('ℹ️  Admin account already exists');
      }
    } catch (error) {
      results.push('ℹ️  Admin account already exists');
    }
    
    // 8. Insert demo staff account
    try {
      // Password: Staff@2024 (hashed with bcrypt)
      const staffResult = await sql`
        INSERT INTO users (email, password_hash, full_name, phone, role, is_active, email_verified) VALUES
        ('staff@vonnex2x.com', '$2b$12$8Y.VPZaN7pmYpHgeJAoH4.WiAy8qfNjH/Oy6aJqO8qfNjH/Oy6aJqO', 'Staff Demo', '+2348087654321', 'staff', true, true)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;
      
      if (staffResult.length > 0) {
        results.push('✅ Staff account created');
        
        // Create staff profile
        const hairDept = await sql`SELECT id FROM departments WHERE name = 'Hair Styling' LIMIT 1`;
        if (hairDept.length > 0) {
          await sql`
            INSERT INTO profiles (
              user_id, first_name, last_name, specialization, experience, 
              employee_id, hire_date, salary, commission_rate, position, department_id
            ) VALUES (
              ${staffResult[0].id}, 'Staff', 'Demo', 'Hair Styling & Treatment', 'Intermediate Level',
              'EMP002', CURRENT_DATE - INTERVAL '1 year', 150000.00, 15.00, 'Senior Hair Stylist', ${hairDept[0].id}
            )
            ON CONFLICT DO NOTHING
          `;
          results.push('✅ Staff profile created');
        }
      } else {
        results.push('ℹ️  Staff account already exists');
      }
    } catch (error) {
      results.push('ℹ️  Staff account already exists');
    }
    
    // 9. Insert demo guest customers
    try {
      await sql`
        INSERT INTO guest_customers (first_name, last_name, email, phone, address, gender, loyalty_points, total_visits, total_spent, last_visit) VALUES
        ('Sarah', 'Johnson', 'sarah.johnson@email.com', '+2348123456789', '123 Victoria Island, Lagos', 'female', 450, 8, 680000.00, NOW() - INTERVAL '3 days'),
        ('Michael', 'Adebayo', 'michael.adebayo@email.com', '+2348134567890', '456 Ikeja GRA, Lagos', 'male', 280, 5, 420000.00, NOW() - INTERVAL '1 week'),
        ('Fatima', 'Ibrahim', 'fatima.ibrahim@email.com', '+2348145678901', '789 Abuja Central, FCT', 'female', 320, 6, 510000.00, NOW() - INTERVAL '5 days'),
        ('David', 'Okafor', 'david.okafor@email.com', '+2348156789012', '321 Port Harcourt, Rivers', 'male', 180, 3, 285000.00, NOW() - INTERVAL '2 weeks')
        ON CONFLICT DO NOTHING
      `;
      results.push('✅ Demo guest customers created');
    } catch (error) {
      results.push('ℹ️  Demo guest customers already exist');
    }
    
    // Verification
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'profiles', 'guest_customers', 'departments')
      ORDER BY table_name
    `;
    
    const demoUsers = await sql`
      SELECT email, full_name, role, is_active 
      FROM users 
      WHERE email IN ('admin@vonnex2x.com', 'staff@vonnex2x.com')
      ORDER BY role DESC
    `;
    
    const departments = await sql`
      SELECT name, description 
      FROM departments 
      WHERE is_active = true
      ORDER BY name
    `;
    
    res.json({
      success: true,
      message: 'Database setup completed successfully!',
      results: results,
      verification: {
        tables: tables.map(t => t.table_name),
        demo_accounts: demoUsers.map(u => ({ email: u.email, role: u.role, name: u.full_name })),
        departments: departments.map(d => d.name)
      },
      credentials: {
        admin: { email: 'admin@vonnex2x.com', password: 'Admin@2024' },
        staff: { email: 'staff@vonnex2x.com', password: 'Staff@2024' }
      }
    });
    
  } catch (error) {
    console.error('Database setup failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database setup failed',
      error: error.message
    });
  }
});

export default router;