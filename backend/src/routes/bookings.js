// Fixed backend bookings.js (standardized customer_type to 'walk-in' and 'pre-booked', fixed status transitions, added arrival_status handling)
import express from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendEmail, sendUnifiedBookingConfirmation, sendPaymentConfirmation } from '../services/email.js';
import { createBooking } from '../services/bookingService.js';
import { successResponse, errorResponse, notFoundResponse } from '../utils/apiResponse.js';
import { validateBookingData, validateBookingTimeConflict, validateWorkerAvailability } from '../services/validationService.js';
const router = express.Router();

// Create booking (authenticated)
router.post('/', authenticate, async (req, res) => {
  try {
    // Validate booking data before creation
    const validationResult = await validateBookingData(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json(errorResponse(
        validationResult.message,
        'BOOKING_VALIDATION_ERROR',
        400,
        validationResult.errors || []
      ));
    }

    const booking = await createBooking(req.body, false);
    res.status(201).json(successResponse(booking, 'Booking created successfully', 201));
  } catch (error) {
    console.error('Booking creation error:', error);
   
    // Handle standardized error responses
    if (error.success === false) {
      return res.status(error.status || 400).json(error);
    }
   
    res.status(400).json(errorResponse(error.message, 'BOOKING_CREATION_ERROR', 400));
  }
});

// Get prioritized queue (new endpoint for queue management)
router.get('/queue', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        b.*,
        u.email as worker_email,
        u.name as worker_name,
        svc.service_names,
        svc.service_price,
        COALESCE(
          json_agg(
            json_build_object(
              'id', bw.id,
              'worker_id', bw.worker_id,
              'worker_name', w.name,
              'worker_email', w.email,
              'role', bw.role,
              'status', bw.status
            )
          ) FILTER (WHERE bw.id IS NOT NULL AND bw.status = 'active'),
          '[]'
        ) as workers,
        CASE
          WHEN b.customer_type = 'pre_booked' AND b.payment_status = 'completed' THEN 1
          WHEN b.customer_type = 'walk_in' THEN 2
          WHEN b.customer_type = 'pre_booked' AND b.payment_status != 'completed' THEN 3
          ELSE 2
        END as calculated_priority
      FROM bookings b
      LEFT JOIN users u ON b.worker_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          array_agg(s.name ORDER BY s.name) AS service_names,
          SUM(s.price * COALESCE(bs.quantity, 1)) AS service_price
        FROM booking_services bs
        LEFT JOIN services s ON bs.service_id = s.id
        WHERE bs.booking_id = b.id
      ) svc ON TRUE
      LEFT JOIN booking_workers bw ON bw.booking_id = b.id AND bw.status = 'active'
      LEFT JOIN users w ON bw.worker_id = w.id
      WHERE b.status IN ('scheduled', 'in-progress')
      GROUP BY b.id, u.email, u.name, svc.service_names, svc.service_price
      ORDER BY
        calculated_priority ASC,
        b.scheduled_time ASC,
        b.created_at ASC
    `);
   
    res.json(successResponse(result.rows, 'Queue retrieved successfully'));
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(400).json(errorResponse(error.message, 'QUEUE_RETRIEVAL_ERROR', 400));
  }
});

// Get all bookings (requires authentication)
router.get('/', authenticate, async (req, res) => {
  try {
    const { booking_number, worker_id, date, unassigned } = req.query;
    let sql = `
      SELECT
        b.*,
        u.email as worker_email,
        u.name as worker_name,
        svc.service_names,
        svc.service_price,
        COALESCE(
          json_agg(
            json_build_object(
              'id', bw.id,
              'worker_id', bw.worker_id,
              'worker_name', w.name,
              'worker_email', w.email,
              'role', bw.role,
              'status', bw.status
            )
          ) FILTER (WHERE bw.id IS NOT NULL AND bw.status = 'active'),
          '[]'
        ) as workers
      FROM bookings b
      LEFT JOIN users u ON b.worker_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          array_agg(s.name ORDER BY s.name) AS service_names,
          SUM(s.price * COALESCE(bs.quantity, 1)) AS service_price
        FROM booking_services bs
        LEFT JOIN services s ON bs.service_id = s.id
        WHERE bs.booking_id = b.id
      ) svc ON TRUE
      LEFT JOIN booking_workers bw ON bw.booking_id = b.id AND bw.status = 'active'
      LEFT JOIN users w ON bw.worker_id = w.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;
    
    if (booking_number) {
      paramCount++;
      sql += ` AND b.booking_number = $${paramCount}`;
      params.push(booking_number);
    }
   
    if (worker_id) {
      paramCount++;
      sql += ` AND b.worker_id = $${paramCount}`;
      params.push(worker_id);
    }
   
    if (date) {
      paramCount++;
      sql += ` AND b.scheduled_time >= $${paramCount}`;
      params.push(`${date}T00:00:00`);
     
      paramCount++;
      sql += ` AND b.scheduled_time < $${paramCount}`;
      params.push(`${date}T23:59:59`);
    }
   
    // Filter for unassigned bookings (for manager worker assignment)
    if (unassigned === 'true') {
      sql += ` AND b.worker_id IS NULL`;
    }
    
    sql += ' GROUP BY b.id, u.email, u.name, svc.service_names, svc.service_price';
    
    const result = await query(sql, params);
    res.json(successResponse(result.rows, 'Bookings retrieved successfully'));
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(400).json(errorResponse(error.message, 'BOOKINGS_RETRIEVAL_ERROR', 400));
  }
});

// Test endpoint to verify API is working
router.get('/conflicts/test', async (req, res) => {
  console.log('=== TEST ENDPOINT HIT ===');
  res.json({ message: 'Conflict endpoint is working', timestamp: new Date().toISOString() });
});

// Check for booking conflicts with workers
router.get('/conflicts', async (req, res) => {
  try {
    const { workerIds, startTime, endTime, excludeBookingId } = req.query;
    
    console.log('=== CONFLICT CHECK STARTED ===');
    console.log('Conflict check request:', { workerIds, startTime, endTime, excludeBookingId });
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    
    if (!workerIds || !startTime || !endTime) {
      return res.status(400).json(errorResponse('Missing required parameters: workerIds, startTime, endTime', 'MISSING_PARAMETERS', 400));
    }
    
    // Parse worker IDs - they could be integers (frontend indices) or UUIDs (database)
    const inputWorkerIds = workerIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
    
    console.log('Input worker IDs:', inputWorkerIds);
    
    if (inputWorkerIds.length === 0) {
      return res.status(400).json(errorResponse('Invalid worker IDs provided', 'INVALID_WORKER_IDS', 400));
    }
    
    // Get all workers to map indices to UUIDs
    const allWorkersResult = await query(`
      SELECT id, name, email 
      FROM users 
      WHERE role IN ('staff', 'manager') 
      ORDER BY name
    `);
    
    const allWorkers = allWorkersResult.rows;
    console.log('Available workers in database:', allWorkers.map(w => ({ id: w.id, name: w.name })));
    
    // Map input IDs to actual worker UUIDs
    let workerIdArray = [];
    
    for (const inputId of inputWorkerIds) {
      // Check if it's a UUID format
      if (inputId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        // It's already a UUID, use it directly
        workerIdArray.push(inputId);
      } else {
        // It's likely an integer index, try to map it
        const index = parseInt(inputId);
        if (!isNaN(index) && index > 0 && index <= allWorkers.length) {
          // Map 1-based index to worker UUID
          const worker = allWorkers[index - 1];
          if (worker) {
            workerIdArray.push(worker.id);
            console.log(`Mapped index ${index} to worker UUID ${worker.id} (${worker.name})`);
          }
        } else {
          console.log(`Could not map input ID '${inputId}' to a worker`);
        }
      }
    }
    
    console.log('Mapped worker UUIDs:', workerIdArray);
    
    if (workerIdArray.length === 0) {
      return res.status(400).json(errorResponse('No valid worker IDs could be mapped', 'INVALID_WORKER_IDS', 400));
    }
    
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);
    
    console.log('Date range:', startDateTime, 'to', endDateTime);
    
    // Check for overlapping bookings with these workers
    let conflictQuery = `
      SELECT 
        b.id,
        b.booking_number,
        b.scheduled_time,
        b.status,
        u.name as worker_name,
        u.id as worker_id,
        CASE 
          WHEN b.scheduled_time <= $1 AND b.scheduled_time + interval '1 hour' > $1 THEN 'starts_during'
          WHEN b.scheduled_time < $2 AND b.scheduled_time + interval '1 hour' >= $2 THEN 'ends_during'
          WHEN b.scheduled_time >= $1 AND b.scheduled_time + interval '1 hour' <= $2 THEN 'completely_overlaps'
          ELSE 'adjacent'
        END as conflict_type
      FROM bookings b
      JOIN booking_workers bw ON b.id = bw.booking_id AND bw.status = 'active'
      JOIN users u ON bw.worker_id = u.id
      WHERE b.status IN ('scheduled', 'in-progress', 'confirmed')
        AND bw.worker_id = ANY($3)
        AND (
          (b.scheduled_time <= $1 AND b.scheduled_time + interval '1 hour' > $1) OR
          (b.scheduled_time < $2 AND b.scheduled_time + interval '1 hour' >= $2) OR
          (b.scheduled_time >= $1 AND b.scheduled_time + interval '1 hour' <= $2)
        )
    `;
    
    const queryParams = [startDateTime, endDateTime, workerIdArray];
    
    // Exclude current booking if provided
    if (excludeBookingId) {
      conflictQuery += ` AND b.id != $${queryParams.length + 1}`;
      queryParams.push(excludeBookingId);
    }
    
    conflictQuery += ` ORDER BY b.scheduled_time`;
    
    console.log('Conflict query:', conflictQuery);
    console.log('Query params:', queryParams);
    
    const conflicts = await query(conflictQuery, queryParams);
    
    console.log('Found conflicts:', conflicts.rows);
    console.log('=== CONFLICT CHECK COMPLETED ===');
    
    res.json({
      conflicts: conflicts.rows,
      total_conflicts: conflicts.rows.length,
      message: conflicts.rows.length > 0 ? `${conflicts.rows.length} conflict(s) found` : 'No conflicts found'
    });
    
  } catch (error) {
    console.error('=== CONFLICT CHECK ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error details:', error);
    res.status(500).json(errorResponse('Failed to check for conflicts', 'CONFLICT_CHECK_ERROR', 500));
  }
});

// Get booking by ID (for POS and other systems)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
   
    const result = await query(`
      SELECT
        b.*,
        u.email as worker_email,
        u.name as worker_name,
        svc.service_names,
        svc.service_price,
        COALESCE(
          json_agg(
            json_build_object(
              'id', bw.id,
              'worker_id', bw.worker_id,
              'worker_name', w.name,
              'worker_email', w.email,
              'role', bw.role,
              'status', bw.status
            )
          ) FILTER (WHERE bw.id IS NOT NULL AND bw.status = 'active'),
          '[]'
        ) as workers
      FROM bookings b
      LEFT JOIN users u ON b.worker_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          array_agg(s.name ORDER BY s.name) AS service_names,
          SUM(s.price * COALESCE(bs.quantity, 1)) AS service_price
        FROM booking_services bs
        LEFT JOIN services s ON bs.service_id = s.id
        WHERE bs.booking_id = b.id
      ) svc ON TRUE
      LEFT JOIN booking_workers bw ON bw.booking_id = b.id AND bw.status = 'active'
      LEFT JOIN users w ON bw.worker_id = w.id
      WHERE b.id = $1
      GROUP BY b.id, u.email, u.name, svc.service_names, svc.service_price
      LIMIT 1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking not found'));
    }
    res.json(successResponse(result.rows[0], 'Booking retrieved successfully'));
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(400).json(errorResponse(error.message, 'BOOKING_RETRIEVAL_ERROR', 400));
  }
});

// Get booking by booking number (for public access)
router.get('/number/:bookingNumber', async (req, res) => {
  try {
    const { bookingNumber } = req.params;
   
    const result = await query(`
      SELECT
        b.*,
        u.email as worker_email,
        u.name as worker_name,
        svc.service_names,
        svc.service_price,
        COALESCE(
          json_agg(
            json_build_object(
              'id', bw.id,
              'worker_id', bw.worker_id,
              'worker_name', w.name,
              'worker_email', w.email,
              'role', bw.role,
              'status', bw.status
            )
          ) FILTER (WHERE bw.id IS NOT NULL AND bw.status = 'active'),
          '[]'
        ) as workers
      FROM bookings b
      LEFT JOIN users u ON b.worker_id = u.id
      LEFT JOIN LATERAL (
        SELECT
          array_agg(s.name ORDER BY s.name) AS service_names,
          SUM(s.price * COALESCE(bs.quantity, 1)) AS service_price
        FROM booking_services bs
        LEFT JOIN services s ON bs.service_id = s.id
        WHERE bs.booking_id = b.id
      ) svc ON TRUE
      LEFT JOIN booking_workers bw ON bw.booking_id = b.id AND bw.status = 'active'
      LEFT JOIN users w ON bw.worker_id = w.id
      WHERE b.booking_number = $1
      GROUP BY b.id, u.email, u.name, svc.service_names, svc.service_price
      LIMIT 1
    `, [bookingNumber]);
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking not found'));
    }
    res.json(successResponse(result.rows[0], 'Booking retrieved successfully'));
  } catch (error) {
    console.error('Get booking by number error:', error);
    res.status(400).json(errorResponse(error.message, 'BOOKING_RETRIEVAL_ERROR', 400));
  }
});

// Update booking status (requires authentication)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scheduled_time, worker_ids } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
   
    // Get current booking details
    const currentBooking = await query(
      'SELECT status, customer_email, customer_name, customer_phone, booking_number, scheduled_time FROM bookings WHERE id = $1',
      [id]
    );
    if (currentBooking.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking not found'));
    }
    const booking = currentBooking.rows[0];
    const currentStatus = booking.status;

    // Validate time conflicts if scheduled_time is being updated
    if (scheduled_time) {
      const timeConflictValidation = await validateBookingTimeConflict(
        scheduled_time,
        60, // Default 1 hour duration
        worker_ids || [],
        id
      );
      
      if (!timeConflictValidation.isValid) {
        return res.status(400).json(errorResponse(
          timeConflictValidation.message,
          'TIME_CONFLICT_ERROR',
          400,
          timeConflictValidation.details || []
        ));
      }
    }

    // Validate worker availability if workers are being updated
    if (worker_ids && worker_ids.length > 0) {
      const workerAvailabilityValidation = await validateWorkerAvailability(
        worker_ids,
        scheduled_time || booking.scheduled_time,
        60
      );
      
      if (!workerAvailabilityValidation.isValid) {
        return res.status(400).json(errorResponse(
          workerAvailabilityValidation.message,
          'WORKER_AVAILABILITY_ERROR',
          400,
          workerAvailabilityValidation.unavailableWorkers || []
        ));
      }
    }
   
    // Define status transition rules for MVP workflow
    const allowedTransitions = {
      'pending_confirmation': {
        'scheduled': ['admin', 'manager', 'staff'], // Confirm booking
        'cancelled': ['admin', 'manager']
      },
      'scheduled': {
        'in-progress': ['admin', 'manager', 'staff'], // Start service
        'cancelled': ['admin', 'manager']
      },
      'in-progress': {
        'completed': ['admin', 'manager', 'staff'], // Complete service
        'cancelled': ['admin', 'manager']
      },
      'completed': {
        // No transitions allowed from completed
      },
      'cancelled': {
        'scheduled': ['admin', 'manager'] // Allow re-scheduling
      }
    };
   
    // Check if status transition is allowed
    const allowedRoles = allowedTransitions[currentStatus]?.[status];
    if (!allowedRoles) {
      return res.status(400).json(errorResponse(
        `Invalid status transition from ${currentStatus} to ${status}`,
        'INVALID_STATUS_TRANSITION',
        400
      ));
    }
   
    // Check if user has required role
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json(errorResponse(
        `Only ${allowedRoles.join(' or ')} can change status from ${currentStatus} to ${status}`,
        'INSUFFICIENT_PERMISSIONS',
        403
      ));
    }
   
    // Update booking status with manager approval tracking
    const result = await query(
      `WITH updated AS (
         UPDATE bookings
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *
       )
       SELECT
         updated.*,
         (svc.service_names)[1] AS service_name,
         (SELECT email FROM users WHERE id = updated.worker_id) as worker_email
       FROM updated
       LEFT JOIN LATERAL (
         SELECT
           array_agg(s.name ORDER BY s.name) AS service_names
         FROM booking_services bs
         JOIN services s ON bs.service_id = s.id
         WHERE bs.booking_id = updated.id
       ) svc ON TRUE`,
      [status, id]
    );
    const updatedBooking = result.rows[0];
    // Send appropriate notifications based on status change
    let emailSubject = 'Booking Status Update';
    let emailMessage = `Your booking ${booking.booking_number} status has been updated to: ${status}`;
   
    if (status === 'scheduled' && currentStatus === 'pending_confirmation') {
      emailSubject = 'Booking Confirmed!';
      emailMessage = `Dear ${booking.customer_name},
Great news! Your booking has been confirmed and scheduled.
Booking Number: ${booking.booking_number}
Service: ${updatedBooking.service_name}
Date & Time: ${new Date(booking.scheduled_time).toLocaleString()}
Status: Scheduled
We look forward to serving you. If you have any questions, please don't hesitate to contact us.
Thank you for choosing Vonne X2X!`;
    } else if (status === 'cancelled') {
      // For cancelled bookings, we'll still use the basic email since it's a different flow
      emailSubject = 'Booking Cancelled';
      emailMessage = `Dear ${booking.customer_name},
We regret to inform you that your booking has been cancelled.
Booking Number: ${booking.booking_number}
Service: ${updatedBooking.service_name}
Date & Time: ${new Date(booking.scheduled_time).toLocaleString()}
If you have any questions or would like to reschedule, please contact us.
Thank you for your understanding.`;
    }
    
    // Send status update notification
    if (status === 'scheduled') {
      // Use unified booking confirmation for new confirmations
      await sendUnifiedBookingConfirmation(
        booking.customer_email,
        {
          bookingNumber: booking.booking_number,
          customerName: booking.customer_name,
          serviceName: updatedBooking.service_name,
          bookingDate: booking.scheduled_time,
          bookingTime: new Date(booking.scheduled_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          price: booking.service_price
        }
      );
    } else {
      // Use basic email for other status updates
      await sendEmail(
        booking.customer_email,
        emailSubject,
        emailMessage
      );
    }
    // WhatsApp notifications removed - using email only
        },
        status
      );
    }
    // Update worker status based on booking status changes
    if (status === 'completed' || status === 'cancelled') {
      // Get all workers assigned to this booking
      const assignedWorkers = await query(
        'SELECT worker_id FROM booking_workers WHERE booking_id = $1 AND status = $2',
        [id, 'active']
      );
      
      // Update status for each assigned worker
      for (const worker of assignedWorkers.rows) {
        // Check if worker is still assigned to other active bookings before setting to available
        const activeBookings = await query(
          `SELECT COUNT(*) as active_count
           FROM booking_workers bw
           JOIN bookings b ON bw.booking_id = b.id
           WHERE bw.worker_id = $1 
             AND bw.status = 'active'
             AND b.status IN ('scheduled', 'in-progress')
             AND b.id != $2`,
          [worker.worker_id, id]
        );
        
        // Only set worker to available if they have no other active bookings
        if (activeBookings.rows[0].active_count === '0') {
          await query(
            'UPDATE users SET current_status = $1 WHERE id = $2',
            ['available', worker.worker_id]
          );
        }
      }
    } else if (status === 'in-progress') {
      // Set all assigned workers to busy when service starts
      const assignedWorkers = await query(
        'SELECT worker_id FROM booking_workers WHERE booking_id = $1 AND status = $2',
        [id, 'active']
      );
      
      for (const worker of assignedWorkers.rows) {
        await query(
          'UPDATE users SET current_status = $1 WHERE id = $2',
          ['busy', worker.worker_id]
        );
      }
    }
   
    res.json(successResponse(updatedBooking, 'Booking status updated successfully'));
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(400).json(errorResponse(error.message, 'BOOKING_UPDATE_ERROR', 400));
  }
});

// Remove a worker from a booking
router.delete('/:bookingId/workers/:workerId', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { bookingId, workerId } = req.params;
    
    // Check if assignment exists
    const assignment = await query(
      'SELECT * FROM booking_workers WHERE booking_id = $1 AND worker_id = $2 AND status = $3',
      [bookingId, workerId, 'active']
    );
    
    if (assignment.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Worker assignment not found'));
    }
    
    // Deactivate the assignment
    await query(
      'UPDATE booking_workers SET status = $1 WHERE booking_id = $2 AND worker_id = $3',
      ['cancelled', bookingId, workerId]
    );
    
    // If this was the primary worker, update bookings table
    const booking = await query('SELECT worker_id FROM bookings WHERE id = $1', [bookingId]);
    if (booking.rows[0].worker_id === workerId) {
      // Find another active worker or set to null
      const otherWorkers = await query(
        'SELECT worker_id FROM booking_workers WHERE booking_id = $1 AND status = $2 AND worker_id != $3 LIMIT 1',
        [bookingId, 'active', workerId]
      );
      
      const newPrimaryWorker = otherWorkers.rows.length > 0 ? otherWorkers.rows[0].worker_id : null;
      await query(
        'UPDATE bookings SET worker_id = $1 WHERE id = $2',
        [newPrimaryWorker, bookingId]
      );
    }
    
    // Check if worker is still assigned to other active bookings before setting to available
    const activeBookings = await query(
      `SELECT COUNT(*) as active_count
       FROM booking_workers bw
       JOIN bookings b ON bw.booking_id = b.id
       WHERE bw.worker_id = $1 
         AND bw.status = 'active'
         AND b.status IN ('scheduled', 'in-progress')`,
      [workerId]
    );
    
    // Only set worker to available if they have no other active bookings
    if (activeBookings.rows[0].active_count === '0') {
      await query(
        'UPDATE users SET current_status = $1 WHERE id = $2',
        ['available', workerId]
      );
    }
    
    res.json(successResponse(null, 'Worker removed successfully'));
  } catch (error) {
    console.error('Remove worker error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_REMOVAL_ERROR', 400));
  }
});

// Enhanced worker assignment endpoint
router.post('/:id/assign-workers', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { workers } = req.body; // Array of {worker_id, role} objects
    const assignedBy = req.user.id;
    
    if (!workers || !Array.isArray(workers) || workers.length === 0) {
      return res.status(400).json(errorResponse('Workers array is required', 'MISSING_WORKERS', 400));
    }
    
    // Check if booking exists
    const bookingResult = await query('SELECT scheduled_time, duration, status FROM bookings WHERE id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking not found'));
    }
    
    const booking = bookingResult.rows[0];
    const workerIds = workers.map(w => w.worker_id);
    
    // Check if any workers are already assigned to this booking
    const existingAssignments = await query(
      `SELECT bw.worker_id, u.name as worker_name 
       FROM booking_workers bw
       JOIN users u ON bw.worker_id = u.id
       WHERE bw.booking_id = $1 
         AND bw.status = 'active'
         AND bw.worker_id = ANY($2)`,
      [id, workerIds]
    );
    
    if (existingAssignments.rows.length > 0) {
      const assignedWorkerNames = existingAssignments.rows.map(row => row.worker_name);
      return res.status(409).json(errorResponse(
        `The following workers are already assigned to this booking: ${assignedWorkerNames.join(', ')}`,
        'WORKER_ALREADY_ASSIGNED_ERROR',
        409,
        existingAssignments.rows.map(row => ({
          worker_id: row.worker_id,
          worker_name: row.worker_name
        }))
      ));
    }
    
    // Validate worker availability using enhanced validation service
    const workerAvailabilityValidation = await validateWorkerAvailability(
      workerIds,
      booking.scheduled_time,
      booking.duration || 60,
      id // Exclude current booking from conflict check
    );
    
    if (!workerAvailabilityValidation.isValid) {
      return res.status(409).json(errorResponse(
        workerAvailabilityValidation.message,
        'WORKER_AVAILABILITY_ERROR',
        409,
        workerAvailabilityValidation.unavailableWorkers || []
      ));
    }
    
    // Deactivate existing worker assignments
    await query(
      'UPDATE booking_workers SET status = $1 WHERE booking_id = $2',
      ['cancelled', id]
    );
    
    // Insert new worker assignments
    const assignedWorkers = [];
    for (const worker of workers) {
      const result = await query(
        `INSERT INTO booking_workers (booking_id, worker_id, assigned_by, role, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *,
         (SELECT name FROM users WHERE id = $2) as worker_name`,
        [id, worker.worker_id, assignedBy, worker.role || 'primary', 'active']
      );
      assignedWorkers.push(result.rows[0]);
    }
    
    // Update the main booking with primary worker (first in array)
    if (workers.length > 0) {
      await query(
        'UPDATE bookings SET worker_id = $1 WHERE id = $2',
        [workers[0].worker_id, id]
      );
    }
    
    // Update worker status to busy for all newly assigned workers
    for (const worker of workers) {
      await query(
        `UPDATE users 
         SET current_status = 'busy' 
         WHERE id = $1 
           AND current_status = 'available'
           AND is_active = true`,
        [worker.worker_id]
      );
    }
    
    // Automatically change booking status to 'scheduled' if it's currently 'pending_confirmation'
    // Enhanced logic for Nigeria salon workflow
    if (booking.status === 'pending_confirmation') {
      let newStatus = 'scheduled';
      
      // For walk-in customers with immediate service needs, consider auto-starting
      if (booking.customer_type === 'walk_in' && new Date(booking.scheduled_time) <= new Date()) {
        // If scheduled time is now or in the past, and it's a walk-in, start immediately
        newStatus = 'in-progress';
        console.log(`Auto-starting walk-in booking ${id} - scheduled time is current/immediate`);
      }
      
      await query(
        'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStatus, id]
      );
      console.log(`Auto-updated booking ${id} from pending_confirmation to ${newStatus} after worker assignment`);
    }
    
    res.json(successResponse({
      message: 'Workers assigned successfully',
      assigned_workers: assignedWorkers
    }, 'Workers assigned successfully'));
  } catch (error) {
    console.error('Assign workers error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_ASSIGNMENT_ERROR', 400));
  }
});

// Get available time slots for booking
router.get('/available-slots', authenticate, async (req, res) => {
  try {
    const { date, worker_id, service_ids } = req.query;
   
    if (!date || !worker_id || !service_ids) {
      return res.status(400).json(errorResponse('Date, worker_id, and service_ids are required', 'MISSING_REQUIRED_FIELDS', 400));
    }
    const ids = String(service_ids)
      .split(',')
      .map(id => id.trim())
      .filter(id => id !== '');
    if (ids.length === 0) {
      return res.status(400).json(errorResponse('Invalid service_ids provided', 'INVALID_SERVICE_IDS', 400));
    }
    // Get worker schedule for the specific day
    const dayOfWeek = new Date(date).getDay(); // 0 = Sunday, 1 = Monday, etc.
    const scheduleResult = await query(
      'SELECT start_time, end_time FROM worker_schedules WHERE worker_id = $1 AND day_of_week = $2 AND is_available = true',
      [worker_id, dayOfWeek]
    );
    if (scheduleResult.rows.length === 0) {
      return res.json([]); // No available slots if worker not scheduled
    }
    const { start_time, end_time } = scheduleResult.rows[0];
   
    // Get total duration across selected services
    const serviceResult = await query(
      'SELECT COALESCE(SUM(duration), 0) AS total_duration FROM services WHERE id = ANY($1)',
      [ids]
    );
    const serviceDuration = parseInt(serviceResult.rows[0]?.total_duration || 0, 10);
    if (serviceDuration <= 0) {
      return res.status(400).json(errorResponse('No valid services found for provided service_ids', 'NO_VALID_SERVICES', 400));
    }
   
    // Get existing bookings for this worker on this date
    const bookingsResult = await query(
      `SELECT
         b.scheduled_time,
         COALESCE(svc.total_duration, 0) AS duration
       FROM bookings b
       LEFT JOIN LATERAL (
         SELECT SUM(s.duration * COALESCE(bs.quantity, 1)) AS total_duration
         FROM booking_services bs
         JOIN services s ON s.id = bs.service_id
         WHERE bs.booking_id = b.id
       ) svc ON TRUE
       WHERE b.worker_id = $1
         AND DATE(b.scheduled_time) = $2
         AND b.status IN ('scheduled', 'in-progress')`,
      [worker_id, date]
    );
    // Generate available time slots
    const availableSlots = [];
    const start = new Date(`${date}T${start_time}`);
    const end = new Date(`${date}T${end_time}`);
   
    let currentTime = new Date(start);
   
    while (currentTime < end) {
      const slotEnd = new Date(currentTime.getTime() + serviceDuration * 60000);
     
      if (slotEnd <= end) {
        // Check if this slot conflicts with existing bookings
        const isAvailable = !bookingsResult.rows.some(booking => {
          const bookingStart = new Date(booking.scheduled_time);
          const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);
         
          return (currentTime < bookingEnd && slotEnd > bookingStart);
        });
       
        if (isAvailable) {
          availableSlots.push({
            start_time: currentTime.toISOString(),
            end_time: slotEnd.toISOString(),
            formatted_time: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
     
      // Move to next slot (30-minute intervals)
      currentTime = new Date(currentTime.getTime() + 30 * 60000);
    }
   
    res.json(availableSlots);
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(400).json(errorResponse(error.message, 'AVAILABLE_SLOTS_ERROR', 400));
  }
});

// Manager approval endpoint for pending bookings
router.post('/:id/approve', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Get current booking details with service info
    const currentBooking = await query(
      `SELECT b.id, b.status, b.customer_email, b.customer_name, b.customer_phone, 
              b.booking_number, b.scheduled_time, b.customer_type, b.worker_id,
              array_agg(s.name ORDER BY s.name) as service_names
       FROM bookings b
       LEFT JOIN booking_services bs ON bs.booking_id = b.id
       LEFT JOIN services s ON bs.service_id = s.id
       WHERE b.id = $1
       GROUP BY b.id`,
      [id]
    );
    
    if (currentBooking.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking not found'));
    }
    
    const booking = currentBooking.rows[0];
    
    // Only approve bookings in pending_confirmation status
    if (booking.status !== 'pending_confirmation') {
      return res.status(400).json(errorResponse(
        `Booking cannot be approved. Current status: ${booking.status}`,
        'INVALID_BOOKING_STATUS',
        400
      ));
    }
    
    // Remove auto-assignment - force manual worker assignment first
    // This ensures accurate worker tracking for reports and analytics
    let requiresManualAssignment = false;
    if (!booking.worker_id) {
      requiresManualAssignment = true;
    }
    
    // Update booking status from pending_confirmation to scheduled
    // Don't modify worker_id - force manual assignment first
    const result = await query(
      `WITH updated AS (
         UPDATE bookings 
         SET status = 'scheduled', 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING *
       )
       SELECT
         updated.*,
         (SELECT email FROM users WHERE id = updated.worker_id) as worker_email,
         (SELECT name FROM users WHERE id = updated.worker_id) as worker_name
       FROM updated`,
      [id]
    );
    
    const updatedBooking = result.rows[0];
    
    // Prepare service names for notifications
    const serviceNames = booking.service_names?.filter(name => name).join(', ') || 'Service';
    
    // Send confirmation email using unified function
    await sendUnifiedBookingConfirmation(
      booking.customer_email,
      {
        bookingNumber: booking.booking_number,
        customerName: booking.customer_name,
        serviceName: serviceNames,
        bookingDate: booking.scheduled_time,
        bookingTime: new Date(booking.scheduled_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        price: booking.service_price
      }
    );
    
    // WhatsApp notifications removed - using email only
    
    res.json(successResponse({
      ...updatedBooking,
      requires_manual_assignment: requiresManualAssignment || !booking.worker_id
    }, 'Booking approved successfully'));
  } catch (error) {
    console.error('Approve booking error:', error);
    res.status(400).json(errorResponse(error.message, 'BOOKING_APPROVAL_ERROR', 400));
  }
});

// Daily worker status reset - reset all workers to 'available' at start of business day
router.post('/reset-worker-status', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    // Reset all active workers to 'available' status at start of business day
    const result = await query(
      `UPDATE users
       SET current_status = 'available'
       WHERE role IN ('staff', 'manager')
         AND is_active = true
         AND current_status IN ('busy', 'available')`
    );
   
    res.json({
      message: `Reset ${result.rowCount} workers to available status`,
      reset_count: result.rowCount
    });
  } catch (error) {
    console.error('Worker status reset error:', error);
    res.status(500).json(errorResponse('Failed to reset worker status', 'WORKER_STATUS_RESET_ERROR', 500));
  }
});

// Handle 15-minute wait time for pre-booked customers
router.post('/:id/check-wait-time', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
   
    const result = await query(`
      SELECT
        b.*,
        (svc.service_names)[1] AS service_name
      FROM bookings b
      LEFT JOIN LATERAL (
        SELECT
          array_agg(s.name ORDER BY s.name) AS service_names
        FROM booking_services bs
        JOIN services s ON bs.service_id = s.id
        WHERE bs.booking_id = b.id
      ) svc ON TRUE
      WHERE b.id = $1 AND b.customer_type = 'pre_booked' AND b.status = 'scheduled'
    `, [id]);
   
    if (result.rows.length === 0) {
      return res.status(404).json(errorResponse('Pre-booked booking not found or not in scheduled status', 'INVALID_BOOKING_STATUS', 404));
    }
   
    const booking = result.rows[0];
    const scheduledTime = new Date(booking.scheduled_time);
    const currentTime = new Date();
    const timeDiff = currentTime - scheduledTime;
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));
   
    // Check if 15 minutes have passed
    if (minutesDiff >= 15) {
      // Move to lower priority queue position
      await query(
        'UPDATE bookings SET queue_priority = 3 WHERE id = $1',
        [id]
      );
     
      res.json({
        waitTimeExceeded: true,
        minutesLate: minutesDiff,
        message: 'Customer is 15+ minutes late, moved to lower priority queue position',
        newPriority: 3
      });
    } else {
      res.json({
        waitTimeExceeded: false,
        minutesUntilDeadline: 15 - minutesDiff,
        message: 'Customer still within 15-minute grace period'
      });
    }
  } catch (error) {
    console.error('Check wait time error:', error);
    res.status(400).json(errorResponse(error.message, 'WAIT_TIME_CHECK_ERROR', 400));
  }
});

// Simplify to single worker assignment endpoint
router.patch('/:id/assign-worker', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { worker_id } = req.body;
    
    if (!worker_id) {
      return res.status(400).json(errorResponse('Worker ID is required', 'MISSING_WORKER_ID', 400));
    }
    
    // Check if worker exists and is active
    const workerResult = await query(
      'SELECT id, name, email FROM users WHERE id = $1 AND role IN ($2, $3, $4) AND is_active = true',
      [worker_id, 'staff', 'manager', 'admin']
    );
    
    if (workerResult.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Worker not found or not available'));
    }
    
    const worker = workerResult.rows[0];
    
    // Get booking details for validation
    const bookingResult = await query(
      'SELECT scheduled_time, duration FROM bookings WHERE id = $1',
      [id]
    );
    
    if (bookingResult.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking not found'));
    }
    
    const booking = bookingResult.rows[0];
    
    // Validate worker availability using enhanced validation service
    const workerAvailabilityValidation = await validateWorkerAvailability(
      [worker_id],
      booking.scheduled_time,
      booking.duration || 60,
      id // Exclude current booking from conflict check
    );
    
    if (!workerAvailabilityValidation.isValid) {
      return res.status(409).json(errorResponse(
        workerAvailabilityValidation.message,
        'WORKER_AVAILABILITY_ERROR',
        409,
        workerAvailabilityValidation.unavailableWorkers || []
      ));
    }
    
    // Update booking with worker
    const result = await query(
      `WITH updated AS (
         UPDATE bookings
         SET worker_id = $1
         WHERE id = $2
         RETURNING *
       )
       SELECT
         updated.*,
         (svc.service_names)[1] AS service_name,
         COALESCE(svc.service_price, 0) AS service_price
       FROM updated
       LEFT JOIN LATERAL (
         SELECT
           array_agg(s.name ORDER BY s.name) AS service_names,
           SUM(bs.total_price) AS service_price
         FROM booking_services bs
         JOIN services s ON s.id = bs.service_id
         WHERE bs.booking_id = updated.id
       ) svc ON TRUE`,
      [worker_id, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking not found'));
    }
    
    const updatedBooking = result.rows[0];
    
    // Also add to booking_workers table
    const existingAssignment = await query(
      'SELECT id FROM booking_workers WHERE booking_id = $1 AND worker_id = $2',
      [id, worker_id]
    );
    
    if (existingAssignment.rows.length > 0) {
      // Update existing assignment
      await query(
        'UPDATE booking_workers SET status = $1, assigned_at = CURRENT_TIMESTAMP WHERE booking_id = $2 AND worker_id = $3',
        ['active', id, worker_id]
      );
    } else {
      // Create new assignment
      await query(
        'INSERT INTO booking_workers (booking_id, worker_id, assigned_by, role, status) VALUES ($1, $2, $3, $4, $5)',
        [id, worker_id, req.user.id, 'primary', 'active']
      );
    }
    
    // Update worker status to 'busy'
    await query(
      `UPDATE users
       SET current_status = 'busy'
       WHERE id = $1
         AND current_status = 'available'
         AND is_active = true`,
      [worker_id]
    );
    
    // Send notification to customer
    await sendEmail(
      updatedBooking.customer_email,
      'Worker Assigned to Your Booking',
      `Dear ${updatedBooking.customer_name},
A worker has been assigned to your booking!
Booking Number: ${updatedBooking.booking_number}
Service: ${updatedBooking.service_name}
Assigned Worker: ${worker.name}
Date & Time: ${new Date(updatedBooking.scheduled_time).toLocaleString()}
Thank you for choosing our service!`
    );
    
    res.json(successResponse({
      booking: {
        ...updatedBooking,
        worker_name: worker.name,
        worker_email: worker.email
      }
    }, 'Worker assigned successfully'));
    
  } catch (error) {
    console.error('Assign worker error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKER_ASSIGNMENT_ERROR', 400));
  }
});

// Get assigned workers for a booking
router.get('/:id/workers', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
   
    const result = await query(`
      SELECT bw.*, u.name as worker_name, u.email as worker_email
      FROM booking_workers bw
      JOIN users u ON bw.worker_id = u.id
      WHERE bw.booking_id = $1 AND bw.status = $2
      ORDER BY bw.assigned_at ASC
    `, [id, 'active']);
   
    res.json(successResponse(result.rows, 'Workers retrieved successfully'));
  } catch (error) {
    console.error('Get assigned workers error:', error);
    res.status(400).json(errorResponse(error.message, 'WORKERS_RETRIEVAL_ERROR', 400));
  }
});

// Get services for a booking (service IDs and names)
router.get('/:id/services', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT s.id, s.name
       FROM booking_services bs
       JOIN services s ON bs.service_id = s.id
       WHERE bs.booking_id = $1
       ORDER BY s.name`,
      [id]
    );
    res.json(successResponse(result.rows, 'Services retrieved successfully'));
  } catch (error) {
    console.error('Get booking services error:', error);
    res.status(400).json(errorResponse(error.message, 'SERVICES_RETRIEVAL_ERROR', 400));
  }
});

// Update payment status for a booking
router.patch('/:id/payment-status', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_method, payment_reference } = req.body;
    const userId = req.user.id;
   
    // Validate payment status
    const validPaymentStatuses = ['pending', 'completed', 'failed', 'refunded'];
    if (!validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json(errorResponse(
        `Invalid payment status. Must be one of: ${validPaymentStatuses.join(', ')}`,
        'INVALID_PAYMENT_STATUS',
        400
      ));
    }
   
    // Get current booking details
    const currentBooking = await query(
      `SELECT b.customer_email, b.customer_name, b.booking_number, b.total_amount, b.payment_status,
              array_agg(s.name) as service_names
       FROM bookings b
       LEFT JOIN booking_services bs ON b.id = bs.booking_id
       LEFT JOIN services s ON bs.service_id = s.id
       WHERE b.id = $1
       GROUP BY b.id, b.customer_email, b.customer_name, b.booking_number, b.total_amount, b.payment_status`,
      [id]
    );
    if (currentBooking.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking not found'));
    }
    const booking = currentBooking.rows[0];
    const currentPaymentStatus = booking.payment_status;
   
    // Update payment status
    const result = await query(
      `WITH updated AS (
         UPDATE bookings
         SET payment_status = $1,
             payment_method = COALESCE($2, payment_method),
             payment_reference = COALESCE($3, payment_reference),
             payment_date = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE payment_date END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *
       )
       SELECT
         updated.*,
         (svc.service_names)[1] AS service_name,
         (SELECT email FROM users WHERE id = updated.worker_id) as worker_email
       FROM updated
       LEFT JOIN LATERAL (
         SELECT
           array_agg(s.name ORDER BY s.name) AS service_names
         FROM booking_services bs
         JOIN services s ON bs.service_id = s.id
         WHERE bs.booking_id = updated.id
       ) svc ON TRUE`,
      [payment_status, payment_method, payment_reference, id]
    );
    const updatedBooking = result.rows[0];
    
    // Send payment confirmation email if status changed to completed
    if (payment_status === 'completed' && currentPaymentStatus !== 'completed') {
      await sendEmail(
        booking.customer_email,
        'Payment Confirmed - Booking Payment Received',
        `Dear ${booking.customer_name},
Your payment has been confirmed!
Booking Number: ${booking.booking_number}
Payment Amount: $${booking.total_amount}
Payment Method: ${payment_method || 'Not specified'}
Payment Status: Completed
Your booking payment has been successfully processed. Thank you for your business!
If you have any questions, please don't hesitate to contact us.
Thank you for choosing Vonne X2X!`
      );
    }
    
    res.json(successResponse(updatedBooking, 'Payment status updated successfully'));
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(400).json(errorResponse(error.message, 'PAYMENT_STATUS_UPDATE_ERROR', 400));
  }
});

export default router;