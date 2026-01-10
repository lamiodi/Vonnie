import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { successResponse, errorResponse, notFoundResponse } from '../utils/apiResponse.js';
import { validateEmail, validatePhone, validateStringLength } from '../utils/inputValidation.js';
import { generateSecurePassword } from '../utils/passwordUtils.js';
import { sendEmail } from '../services/email.js';

const router = express.Router();

// Get all workers
router.get('/', authenticate, async (req, res) => {
  try {
    // 1. Auto-correct 'busy' -> 'available' if no active booking
    try {
      await query(`
        UPDATE users u
        SET current_status = 'available'
        WHERE u.current_status = 'busy'
        AND NOT EXISTS (
          SELECT 1 
          FROM booking_workers bw
          JOIN bookings b ON bw.booking_id = b.id
          WHERE bw.worker_id = u.id
          AND bw.status = 'active'
          AND (
            b.status = 'in-progress'
            OR (
              b.status = 'scheduled' 
              AND b.scheduled_time <= CURRENT_TIMESTAMP 
              AND (b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute')) > CURRENT_TIMESTAMP
            )
          )
        )
      `);
    } catch (cleanupError) {
      console.error('Worker status auto-correction failed:', cleanupError);
    }

    // 2. Mark workers as 'absent' if they haven't checked in today
    try {
      const today = new Date().toISOString().split('T')[0];
      await query(`
        UPDATE users u
        SET current_status = 'absent'
        WHERE role IN ('staff', 'manager')
        AND u.current_status != 'busy' -- Don't touch busy workers (edge case where they worked overnight?)
        AND NOT EXISTS (
           SELECT 1 FROM attendance a 
           WHERE a.worker_id = u.id 
           AND a.date = $1 
           AND a.check_in_time IS NOT NULL 
           AND a.check_out_time IS NULL
        )
      `, [today]);
      
      // 3. Mark workers as 'available' if they ARE checked in and not busy
      await query(`
        UPDATE users u
        SET current_status = 'available'
        WHERE role IN ('staff', 'manager')
        AND u.current_status = 'absent'
        AND EXISTS (
           SELECT 1 FROM attendance a 
           WHERE a.worker_id = u.id 
           AND a.date = $1 
           AND a.check_in_time IS NOT NULL 
           AND a.check_out_time IS NULL
        )
      `, [today]);

    } catch (attendanceError) {
      console.error('Worker attendance status sync failed:', attendanceError);
    }

    let sql = 'SELECT id, name, email, phone, role, is_active, current_status, created_at, updated_at FROM users WHERE role IN ($1, $2)';
    const params = ['staff', 'manager'];
    if (req.user.role !== 'admin') {
      sql += ' AND is_active = true';
    }
    sql += ' ORDER BY name';
    const result = await query(sql, params);
    res.json(successResponse(result.rows, 'Workers retrieved successfully'));
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKERS_FETCH_ERROR', 400));
  }
});

// Get worker by id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, email, phone, role, is_active, current_status, created_at, updated_at FROM users WHERE id = $1 AND role IN ($2, $3)',
      [req.params.id, 'staff', 'manager']
    );
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Worker not found'));
    }
    res.json(successResponse(result.rows[0], 'Worker retrieved successfully'));
  } catch (error) {
    console.error('Get worker error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_FETCH_ERROR', 400));
  }
});

// Create worker
router.post('/', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { name, email, phone, role = 'staff' } = req.body;
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json(errorResponse(
        'Name and email are required',
        'MISSING_REQUIRED_FIELDS',
        400
      ));
    }
    
    // Validate name
    const nameValidation = validateStringLength(name, { min: 2, max: 100 });
    if (!nameValidation.isValid) {
      return res.status(400).json(errorResponse(
        `Worker name: ${nameValidation.message}`,
        'INVALID_WORKER_NAME',
        400
      ));
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return res.status(400).json(errorResponse(
        `Worker email: ${emailValidation.message}`,
        'INVALID_WORKER_EMAIL',
        400
      ));
    }
    
    // Validate phone if provided
    if (phone) {
      const phoneValidation = validatePhone(phone);
      if (!phoneValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Worker phone: ${phoneValidation.message}`,
          'INVALID_WORKER_PHONE',
          400
        ));
      }
    }
    
    // Validate role
    const normalizedRole = role === 'worker' ? 'staff' : role;
    if (!['staff','manager'].includes(normalizedRole) && req.user.role !== 'admin') {
      return res.status(403).json(errorResponse(
        'Only admin can assign non-staff/manager roles',
        'INSUFFICIENT_PERMISSIONS',
        403
      ));
    }
    
    // Check if manager already exists
    if (normalizedRole === 'manager') {
      const managerCheck = await query('SELECT 1 FROM users WHERE role = $1', ['manager']);
      if (managerCheck.rows.length > 0) {
        return res.status(403).json(errorResponse(
          'System already has a manager. Only one manager is allowed.',
          'MANAGER_EXISTS',
          403
        ));
      }
    }
    
    // Check if email already exists
    const exists = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.status(400).json(errorResponse(
        'Email already exists',
        'EMAIL_ALREADY_EXISTS',
        400
      ));
    }
    
    // Generate secure random password
    const generatedPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);
    
    const result = await query(
      'INSERT INTO users (name, email, phone, role, password_hash, current_status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, phone, role, is_active, current_status, created_at',
      [name, email, phone || null, normalizedRole, hashedPassword, 'available']
    );
    
    // Send welcome email with password
    const welcomeSubject = 'Welcome to Vonne X2X - Your Account Details';
    const welcomeHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #9333ea;">Welcome to Vonne X2X!</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your staff account has been created successfully. Here are your login details:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${generatedPassword}</code></p>
        </div>
        <p>Please log in and change your password immediately.</p>
        <p>Best regards,<br>Vonne X2X Team</p>
      </div>
    `;
    
    // Try to send email, but don't fail if it errors (admin will see password in response)
    try {
      await sendEmail(email, welcomeSubject, `Welcome! Your password is: ${generatedPassword}`, welcomeHtml);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    // Return user data AND the generated password so admin can share it manually if needed
    const responseData = {
      ...result.rows[0],
      generatedPassword // Only returned on creation
    };
    
    res.status(201).json(successResponse(responseData, 'Worker created successfully', 201));
  } catch (error) {
    console.error('Create worker error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_CREATION_ERROR', 400));
  }
});

// Update worker
router.put('/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { name, email, phone, role, is_active } = req.body;
    
    // Validate fields if provided
    if (name !== undefined && !name) {
      return res.status(400).json(errorResponse(
        'Worker name cannot be empty',
        'INVALID_WORKER_NAME',
        400
      ));
    }
    
    if (email !== undefined && !email) {
      return res.status(400).json(errorResponse(
        'Worker email cannot be empty',
        'INVALID_WORKER_EMAIL',
        400
      ));
    }
    
    if (name !== undefined) {
      const nameValidation = validateStringLength(name, { min: 2, max: 100 });
      if (!nameValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Worker name: ${nameValidation.message}`,
          'INVALID_WORKER_NAME',
          400
        ));
      }
    }
    
    if (email !== undefined) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Worker email: ${emailValidation.message}`,
          'INVALID_WORKER_EMAIL',
          400
        ));
      }
      
      // Check if new email already exists (excluding current worker)
      const emailExists = await query('SELECT 1 FROM users WHERE email = $1 AND id != $2', [email, req.params.id]);
      if (emailExists.rows.length) {
        return res.status(400).json(errorResponse(
          'Email already exists',
          'EMAIL_ALREADY_EXISTS',
          400
        ));
      }
    }
    
    if (phone !== undefined && phone) {
      const phoneValidation = validatePhone(phone);
      if (!phoneValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Worker phone: ${phoneValidation.message}`,
          'INVALID_WORKER_PHONE',
          400
        ));
      }
    }
    
    if (role !== undefined) {
      const normalizedRole = role === 'worker' ? 'staff' : role;
      if (!['staff','manager'].includes(normalizedRole) && req.user.role !== 'admin') {
        return res.status(403).json(errorResponse(
          'Only admin can assign non-staff/manager roles',
          'INSUFFICIENT_PERMISSIONS',
          403
        ));
      }
      
      // Check if manager already exists
      if (normalizedRole === 'manager') {
        const managerCheck = await query('SELECT 1 FROM users WHERE role = $1 AND id != $2', ['manager', req.params.id]);
        if (managerCheck.rows.length > 0) {
          return res.status(403).json(errorResponse(
            'System already has a manager. Only one manager is allowed.',
            'MANAGER_EXISTS',
            403
          ));
        }
      }
    }
    
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone); }
    if (role !== undefined) { const r = role === 'worker' ? 'staff' : role; fields.push(`role = $${idx++}`); values.push(r); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(!!is_active); }
    if (fields.length === 0) {
      return res.status(400).json(errorResponse(
        'No fields to update',
        'NO_UPDATE_FIELDS',
        400
      ));
    }
    
    values.push(req.params.id);
    const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING id, name, email, phone, role, is_active, updated_at`;
    const result = await query(sql, values);
    
    if (!result.rows.length) {
      return res.status(404).json(notFoundResponse('Worker not found'));
    }
    
    res.json(successResponse(result.rows[0], 'Worker updated successfully'));
  } catch (error) {
    console.error('Update worker error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_UPDATE_ERROR', 400));
  }
});

// Deactivate worker (soft delete)
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const result = await query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) {
      return res.status(404).json(notFoundResponse('Worker not found'));
    }
    res.json(successResponse({ id: result.rows[0].id }, 'Worker deactivated successfully'));
  } catch (error) {
    console.error('Delete worker error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_DEACTIVATION_ERROR', 400));
  }
});

// Get worker schedule
router.get('/:id/schedule', authenticate, async (req, res) => {
  try {
    const workerResult = await query(
      'SELECT id FROM users WHERE id = $1 AND role IN ($2, $3)',
      [req.params.id, 'staff', 'manager']
    );
    if (workerResult.rows.length === 0) return res.status(404).json({ error: 'Worker not found' });
    
    const scheduleResult = await query(
      'SELECT day_of_week, start_time, end_time, is_available FROM worker_schedules WHERE worker_id = $1 ORDER BY day_of_week',
      [req.params.id]
    );
    
    if (scheduleResult.rows.length === 0) {
      const defaultSchedule = Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        start_time: '09:00',
        end_time: '17:00',
        is_available: true
      }));
      return res.json(defaultSchedule);
    }
    
    res.json(scheduleResult.rows);
  } catch (error) {
    console.error('Get worker schedule error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Update worker schedule
router.put('/:id/schedule', authenticate, async (req, res) => {
  try {
    const { schedule } = req.body;
    
    if (!Array.isArray(schedule)) {
      return res.status(400).json({ 
        error: 'Schedule must be an array',
        details: 'Expected an array of schedule objects with day_of_week, start_time, end_time, and is_available properties'
      });
    }
    
    // Validate each schedule slot
    const validationErrors = [];
    schedule.forEach((slot, index) => {
      if (typeof slot.day_of_week !== 'number' || slot.day_of_week < 0 || slot.day_of_week > 6) {
        validationErrors.push(`Slot ${index}: day_of_week must be a number between 0-6 (0=Sunday, 6=Saturday)`);
      }
      
      if (slot.start_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(slot.start_time)) {
        validationErrors.push(`Slot ${index}: start_time must be in HH:MM format (24-hour)`);
      }
      
      if (slot.end_time && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(slot.end_time)) {
        validationErrors.push(`Slot ${index}: end_time must be in HH:MM format (24-hour)`);
      }
      
      if (slot.start_time && slot.end_time && slot.start_time >= slot.end_time) {
        validationErrors.push(`Slot ${index}: start_time must be before end_time`);
      }
      
      if (typeof slot.is_available !== 'boolean') {
        validationErrors.push(`Slot ${index}: is_available must be a boolean`);
      }
    });
    
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Invalid schedule data',
        details: validationErrors,
        example: {
          day_of_week: 1,
          start_time: '09:00',
          end_time: '17:00', 
          is_available: true
        }
      });
    }
    
    const workerResult = await query(
      'SELECT id FROM users WHERE id = $1 AND role IN ($2, $3)',
      [req.params.id, 'staff', 'manager']
    );
    if (workerResult.rows.length === 0) return res.status(404).json({ error: 'Worker not found' });
    
    await query('BEGIN');
    
    try {
      await query('DELETE FROM worker_schedules WHERE worker_id = $1', [req.params.id]);
      
      for (const slot of schedule) {
        await query(
          'INSERT INTO worker_schedules (worker_id, day_of_week, start_time, end_time, is_available) VALUES ($1, $2, $3, $4, $5)',
          [req.params.id, slot.day_of_week, slot.start_time || '09:00', slot.end_time || '17:00', slot.is_available]
        );
      }
      
      await query('COMMIT');
      res.json({ message: 'Schedule updated successfully' });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update worker schedule error:', error);
    res.status(400).json({ 
      error: 'Failed to update schedule',
      details: error.message 
    });
  }
});

export default router;