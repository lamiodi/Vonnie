const express = require('express');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', validateUserRegistration, async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role = 'customer' } = req.body;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ 
        error: 'Registration failed', 
        message: authError.message 
      });
    }

    // Create user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: `${first_name} ${last_name}`,
        phone,
        role
      })
      .select()
      .single();

    if (profileError) {
      // Cleanup: delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ 
        error: 'Profile creation failed', 
        message: profileError.message 
      });
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', validateUserLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Sign in with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return res.status(401).json({ 
        error: 'Login failed', 
        message: authError.message 
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({ 
        error: 'Profile not found', 
        message: profileError.message 
      });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        profile
      },
      session: authData.session
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return res.status(400).json({ 
        error: 'Logout failed', 
        message: error.message 
      });
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ 
        error: 'Profile not found', 
        message: error.message 
      });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name, phone, avatar_url } = req.body;
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        full_name: `${first_name} ${last_name}`,
        phone,
        avatar_url
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Profile update failed', 
        message: error.message 
      });
    }

    res.json({
      message: 'Profile updated successfully',
      profile
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return res.status(400).json({ 
        error: 'Password change failed', 
        message: error.message 
      });
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh session
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error) {
      return res.status(401).json({ 
        error: 'Token refresh failed', 
        message: error.message 
      });
    }

    res.json({
      message: 'Session refreshed successfully',
      session: data.session
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all users
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (role) {
      query = query.eq('role', role);
    }

    const { data: users, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch users', 
        message: error.message 
      });
    }

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create demo accounts (Admin only)
router.post('/demo-accounts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const demoAccounts = [
      {
        email: 'admin@demo.com',
        password: 'admin123',
        first_name: 'Demo',
        last_name: 'Admin',
        phone: '+1234567890',
        role: 'admin'
      },
      {
        email: 'staff@demo.com',
        password: 'staff123',
        first_name: 'Demo',
        last_name: 'Staff',
        phone: '+1234567891',
        role: 'staff'
      }
    ];

    const createdAccounts = [];

    for (const account of demoAccounts) {
      try {
        // Check if user already exists
        const { data: existingUser } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .eq('email', account.email)
          .single();

        if (existingUser) {
          createdAccounts.push({
            email: account.email,
            status: 'exists',
            message: 'Account already exists'
          });
          continue;
        }

        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true
        });

        if (authError) {
          createdAccounts.push({
            email: account.email,
            status: 'error',
            message: authError.message
          });
          continue;
        }

        // Create user profile
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: authData.user.id,
            first_name: account.first_name,
            last_name: account.last_name,
            phone: account.phone,
            role: account.role
          })
          .select()
          .single();

        if (profileError) {
          // Cleanup: delete the auth user if profile creation fails
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          createdAccounts.push({
            email: account.email,
            status: 'error',
            message: profileError.message
          });
          continue;
        }

        createdAccounts.push({
          email: account.email,
          status: 'created',
          message: 'Account created successfully',
          user: {
            id: authData.user.id,
            email: authData.user.email,
            profile
          }
        });

      } catch (error) {
        createdAccounts.push({
          email: account.email,
          status: 'error',
          message: error.message
        });
      }
    }

    res.status(201).json({
      message: 'Demo accounts processed',
      accounts: createdAccounts
    });

  } catch (error) {
    console.error('Demo account creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;