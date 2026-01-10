import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { successResponse, errorResponse, notFoundResponse, validationErrorResponse } from '../utils/apiResponse.js';
import { sendEmail } from '../services/email.js';
import { validateRequiredFields } from '../utils/validation.js';

const router = express.Router();

// Get today's queue - bookings ready for processing
router.get('/today', authenticate, authorize(['admin', 'manager', 'staff']), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    
    const result = await query(`
      SELECT 
        b.id,
        b.booking_number,
        b.customer_name,
        b.customer_phone,
        b.customer_email,
        b.scheduled_time,
        b.status,
        b.payment_status,
        b.created_at,
        b.updated_at,
        b.customer_type,
        (svc.service_names)[1] as service_name,
        svc.service_names as service_names,
        COALESCE(svc.total_duration, 0) as service_duration,
        COALESCE(svc.service_price, 0) as service_price,
        u.name as worker_name,
        u.email as worker_email,
        CASE 
          WHEN b.customer_type = 'walk_in' THEN 1
          WHEN b.customer_type = 'pre_booked' THEN 2
          WHEN b.status = 'in-progress' THEN 3
          ELSE 2
        END as queue_priority,
        CASE 
          WHEN b.customer_type = 'walk_in' AND b.status = 'scheduled' THEN 'Walk-in Ready'
          WHEN b.customer_type = 'pre_booked' AND b.status = 'scheduled' THEN 'Pre-booked Ready'
          WHEN b.status = 'in-progress' THEN 'Currently Being Served'
          ELSE 'Ready for Service'
        END as queue_status
      FROM bookings b
      LEFT JOIN LATERAL (
        SELECT 
          array_agg(s.name ORDER BY s.name) AS service_names,
          SUM(s.duration * bs.quantity) AS total_duration,
          SUM(bs.total_price) AS service_price
        FROM booking_services bs
        JOIN services s ON s.id = bs.service_id
        WHERE bs.booking_id = b.id
      ) svc ON true
      LEFT JOIN users u ON b.worker_id = u.id
      WHERE DATE(b.scheduled_time) = $1
        AND b.status IN ('scheduled', 'in-progress')
        AND b.status != 'cancelled'
      ORDER BY 
        queue_priority ASC,
        b.scheduled_time ASC,
        b.created_at ASC
    `, [today]);

    // Calculate estimated wait times and apply 14-minute buffer logic
    const currentTime = new Date();
    const queueData = result.rows.map((booking, index) => {
      const estimatedWaitTime = index * 30; // Assume 30 minutes per service on average
      const scheduledTime = new Date(booking.scheduled_time);
      const timeDiff = scheduledTime.getTime() - currentTime.getTime();
      const minutesUntilScheduled = Math.floor(timeDiff / (1000 * 60));
      
      // Apply 14-minute buffer for pre-booked customers
      const isWithinBufferTime = booking.customer_type === 'pre_booked' && 
                                minutesUntilScheduled <= 14 && 
                                minutesUntilScheduled >= -14;
      
      // Determine if customer is ready for service - all scheduled bookings are ready
      const isReadyForService = booking.status === 'scheduled';
      
      return {
        ...booking,
        queue_position: index + 1,
        estimated_wait_time_minutes: estimatedWaitTime,
        minutes_until_scheduled: minutesUntilScheduled,
        is_upcoming: minutesUntilScheduled <= 15 && minutesUntilScheduled >= -30,
        is_overdue: minutesUntilScheduled < -30,
        is_within_buffer_time: isWithinBufferTime,
        is_ready_for_service: isReadyForService
      };
    });
    
    // Simple sorting: walk-ins first, then pre-booked by scheduled time
    const sortedQueue = queueData.sort((a, b) => {
      // Walk-ins have priority over pre-booked
      if (a.customer_type === 'walk_in' && b.customer_type !== 'walk_in') return -1;
      if (a.customer_type !== 'walk_in' && b.customer_type === 'walk_in') return 1;
      
      // Same type - sort by scheduled time (earlier first)
      return new Date(a.scheduled_time) - new Date(b.scheduled_time) ||
             new Date(a.created_at) - new Date(b.created_at);
    });
    
    // Update queue positions after sorting
    const finalQueue = sortedQueue.map((booking, index) => ({
      ...booking,
      queue_position: index + 1,
      estimated_wait_time_minutes: index * 30
    }));

    res.json(successResponse({
      queue: finalQueue,
      total_bookings: finalQueue.length,
      ready_for_service: finalQueue.filter(b => b.is_ready_for_service).length,
      in_progress: finalQueue.filter(b => b.status === 'in-progress').length,
      overdue: finalQueue.filter(b => b.is_overdue).length,
      next_customer: finalQueue.length > 0 ? finalQueue[0] : null
    }));

  } catch (error) {
    console.error('Queue fetch error:', error);
    res.status(500).json(errorResponse('Failed to fetch queue data', 'QUEUE_FETCH_ERROR', 500));
  }
});

// Get queue statistics for dashboard
router.get('/stats', authenticate, authorize(['admin', 'manager', 'staff']), async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await query(`
      SELECT 
        COUNT(*) as total_today,
        COUNT(CASE WHEN status = 'scheduled' AND payment_status = 'completed' THEN 1 END) as ready_for_service,
        COUNT(CASE WHEN status = 'scheduled' AND payment_status = 'pending' THEN 1 END) as payment_pending,
        COUNT(CASE WHEN status = 'in-progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN DATE(scheduled_time) = $1 AND status = 'completed' THEN 1 END) as completed_today,
        AVG(CASE WHEN status = 'completed' AND DATE(updated_at) = $1 
            THEN EXTRACT(EPOCH FROM (updated_at - scheduled_time))/60 
            ELSE NULL END) as avg_service_time_minutes
      FROM bookings 
      WHERE DATE(scheduled_time) = $1
        AND status != 'cancelled'
    `, [today]);

    res.json(successResponse(result.rows[0]));

  } catch (error) {
    console.error('Queue stats error:', error);
    res.status(500).json(errorResponse('Failed to fetch queue statistics', 'QUEUE_STATS_ERROR', 500));
  }
});

// Update booking status from queue
router.patch('/:id/status', authenticate, authorize(['admin', 'manager', 'staff']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    const validation = validateRequiredFields({ status }, ['status']);
    if (!validation.isValid) {
      return res.status(400).json(validationErrorResponse(validation.missingFields, 'Missing required fields'));
    }
    
    // Validate status value
    const validStatuses = ['scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(errorResponse('Invalid status. Must be one of: scheduled, in-progress, completed, cancelled, no-show', 'INVALID_STATUS', 400));
    }
    
    // Get current booking details
    const currentBooking = await query(
      'SELECT status, customer_email, customer_name, booking_number, scheduled_time, service_id FROM bookings WHERE id = $1',
      [id]
    );

    if (currentBooking.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking', id));
    }

    const booking = currentBooking.rows[0];
    
    // Update booking status with notes and timestamp
    const result = await query(
      `UPDATE bookings 
       SET status = $1, 
           manager_notes = COALESCE(manager_notes || '\n' || $3, $3),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 
       RETURNING *,
       (SELECT name FROM services WHERE id = service_id) as service_name,
       (SELECT email FROM users WHERE id = worker_id) as worker_email`,
      [status, id, notes || '']
    );

    const updatedBooking = result.rows[0];

    // Send status update notification if important status change
    if (status === 'in-progress' || status === 'completed') {
      await sendEmail(
        booking.customer_email,
        `Booking ${status === 'in-progress' ? 'Started' : 'Completed'}`,
        `Dear ${booking.customer_name},

Your booking ${booking.booking_number} is now ${status}.

Service: ${updatedBooking.service_name}
Scheduled Time: ${new Date(booking.scheduled_time).toLocaleString()}

${status === 'completed' ? 'Thank you for choosing Vonne X2X!' : 'Your service is now in progress.'}`
      );
    }

    // Emit real-time update to queue room
    const io = req.app.get('io');
    if (io) {
      io.to('queue-room').emit('queue-update', {
        type: 'booking-updated',
        booking: updatedBooking,
        timestamp: new Date().toISOString()
      });
      console.log('📡 Emitted queue update for booking:', id);
    }

    res.json(successResponse(updatedBooking));

  } catch (error) {
    console.error('Queue status update error:', error);
    res.status(500).json(errorResponse('Failed to update booking status', 'QUEUE_STATUS_UPDATE_ERROR', 500));
  }
});

export default router;