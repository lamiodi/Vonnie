import express from 'express';
import { query } from '../config/db.js';
import { sendEmail } from '../services/email.js';
import axios from 'axios';
import crypto from 'crypto';
import { createBooking } from '../services/bookingService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { verifyPaymentWithFallbacks, logPaymentVerification, storeWebhookData } from '../services/paymentService.js';

const router = express.Router();

// Get all services (public)
router.get('/services', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, description, price, duration FROM services WHERE is_active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json(errorResponse('Failed to fetch services', 'SERVICE_FETCH_ERROR', 500));
  }
});

// Get all workers (public)
router.get('/workers', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, specialty, current_status 
       FROM users 
       WHERE role IN ('staff', 'manager') AND is_active = true 
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json(errorResponse('Failed to fetch workers', 'WORKER_FETCH_ERROR', 500));
  }
});

// Get busy workers for today (public)
router.get('/workers/busy-today', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json(errorResponse('Date is required', 'MISSING_DATE', 400));
    }

    // Get workers who have bookings scheduled for today
    const result = await query(
      `SELECT DISTINCT bw.worker_id, u.name as worker_name, COUNT(b.id) as booking_count
       FROM booking_workers bw
       JOIN bookings b ON bw.booking_id = b.id
       JOIN users u ON bw.worker_id = u.id
       WHERE DATE(b.scheduled_time) = $1 
         AND b.status IN ('scheduled', 'in-progress')
         AND bw.status = 'active'
       GROUP BY bw.worker_id, u.name
       ORDER BY u.name`,
      [date]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching busy workers:', error);
    res.status(500).json(errorResponse('Failed to fetch busy workers', 'BUSY_WORKERS_FETCH_ERROR', 500));
  }
});

// Get available time slots (public)
router.get('/bookings/available-slots', async (req, res) => {
  try {
    const { worker_id, date, service_id, service_ids } = req.query;
    
    if (!date || (!service_id && !service_ids)) {
      return res.status(400).json(errorResponse('date and service_id or service_ids are required', 'MISSING_REQUIRED_FIELDS', 400));
    }

    // Determine service IDs to use
    let serviceIds = [];
    if (service_ids) {
      serviceIds = service_ids.split(',').map(id => id.trim()).filter(id => id !== '');
    } else if (service_id) {
      serviceIds = [service_id.trim()];
    }

    if (serviceIds.length === 0) {
      return res.status(400).json(errorResponse('At least one valid service_id is required', 'INVALID_SERVICE_IDS', 400));
    }

    // Get total duration for all services
    const serviceResult = await query(
      'SELECT SUM(duration) as total_duration FROM services WHERE id = ANY($1)',
      [serviceIds]
    );
    
    if (!serviceResult.rows[0].total_duration) {
      return res.status(404).json(errorResponse('No valid services found', 'NO_VALID_SERVICES', 404));
    }

    const totalDuration = parseInt(serviceResult.rows[0].total_duration);

    // Get existing bookings for the worker on the specified date
    // If worker_id is empty, get bookings for all workers to find common available slots
    let bookingsResult;
    if (worker_id && worker_id !== '') {
      bookingsResult = await query(
        `SELECT b.scheduled_time, bw.worker_id 
         FROM bookings b
         JOIN booking_workers bw ON b.id = bw.booking_id
         WHERE bw.worker_id = $1 
         AND DATE(b.scheduled_time) = $2 
         AND b.status IN ('scheduled', 'in-progress')`,
        [worker_id, date]
      );
    } else {
      // Get all workers to check availability across all of them
      const workersResult = await query(
        `SELECT id FROM users 
         WHERE role IN ('staff', 'manager') AND is_active = true`
      );
      const workerIds = workersResult.rows.map(row => row.id);
      
      if (workerIds.length === 0) {
        return res.status(404).json(errorResponse('No available workers found', 'NO_AVAILABLE_WORKERS', 404));
      }
      
      bookingsResult = await query(
        `SELECT b.scheduled_time, bw.worker_id 
         FROM bookings b
         JOIN booking_workers bw ON b.id = bw.booking_id
         WHERE bw.worker_id = ANY($1) 
         AND DATE(b.scheduled_time) = $2 
         AND b.status IN ('scheduled', 'in-progress')`,
        [workerIds, date]
      );
    }

    const bookedSlots = bookingsResult.rows.map(row => new Date(row.scheduled_time));

    // Generate available slots (9 AM to 6 PM, 30-minute intervals)
    const availableSlots = [];
    const startHour = 9;
    const endHour = 18;
    const slotInterval = 30; // minutes
    
    // Get current time for filtering past slots
    const now = new Date();
    
    // Create date objects for comparison (without time portion)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    const isToday = today.getTime() === selectedDate.getTime();

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotInterval) {
        const slotTime = new Date(date);
        slotTime.setHours(hour, minute, 0, 0);
        
        // Skip past times for current day - only show future times
        if (isToday && slotTime < now) {
          continue;
        }
        
        // Check if this slot conflicts with existing bookings
        const isAvailable = !bookedSlots.some(bookedTime => {
          const bookedEnd = new Date(bookedTime.getTime() + totalDuration * 60000);
          const slotEnd = new Date(slotTime.getTime() + totalDuration * 60000);
          
          return (slotTime < bookedEnd && slotEnd > bookedTime);
        });

        if (isAvailable) {
          availableSlots.push(slotTime.toISOString());
        }
      }
    }

    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    res.status(500).json(errorResponse('Failed to fetch available slots', 'SLOTS_FETCH_ERROR', 500));
  }
});

// Create public booking (no authentication required)
router.post('/bookings', async (req, res) => {
  try {
    const booking = await createBooking(req.body, true);
    res.status(201).json(successResponse(booking, 'Booking created successfully', 201));
  } catch (error) {
    console.error('Public booking creation error:', error);
    
    // Handle standardized error responses
    if (error.success === false) {
      return res.status(error.status || 400).json(error);
    }
    
    res.status(400).json(errorResponse(error.message, 'BOOKING_CREATION_ERROR', 400));
  }
});

// Create walk-in booking with optional service and worker assignment
router.post('/walk-in', async (req, res) => {
  try {
    const { 
      customer_email, 
      customer_name, 
      customer_phone, 
      notes, 
      service_ids, 
      worker_id, 
      worker_ids 
    } = req.body;

    if (!customer_name || !customer_phone) {
      return res.status(400).json(errorResponse('Customer name and phone are required', 'MISSING_CUSTOMER_INFO', 400));
    }

    // Validate services if provided and calculate total amount
    let finalServiceIds = [];
    let totalAmount = 0;
    let totalDuration = 0;
    
    if (service_ids && service_ids.length > 0) {
      const servicesResult = await query(
        'SELECT id, price, duration FROM services WHERE id = ANY($1) AND is_active = true',
        [service_ids]
      );
      
      if (servicesResult.rows.length !== service_ids.length) {
        return res.status(400).json(errorResponse('One or more services not found or inactive', 'INVALID_SERVICES', 400));
      }
      finalServiceIds = service_ids;
      
      // Calculate total amount and duration
      servicesResult.rows.forEach(service => {
        totalAmount += parseFloat(service.price);
        totalDuration += parseInt(service.duration);
      });
    } else {
      // Get default service if none provided
      const defaultServiceResult = await query(
        'SELECT id, price, duration FROM services WHERE is_active = true ORDER BY name LIMIT 1'
      );
      
      if (defaultServiceResult.rows.length === 0) {
        return res.status(400).json(errorResponse('No services available', 'NO_SERVICES_AVAILABLE', 400));
      }
      finalServiceIds = [defaultServiceResult.rows[0].id];
      totalAmount = parseFloat(defaultServiceResult.rows[0].price);
      totalDuration = parseInt(defaultServiceResult.rows[0].duration);
    }

    const bookingPayload = {
      customer_name,
      customer_email,
      customer_phone,
      customer_type: 'walk_in',
      scheduled_time: new Date().toISOString(),
      worker_id: worker_id || null,
      service_ids: finalServiceIds,
      notes,
      payment_status: 'pending',
      total_amount: totalAmount,
      duration: totalDuration
    };

    const booking = await createBooking(bookingPayload, false);
    
    // Handle worker assignment if worker_ids are provided
    let assignedWorkers = [];
    if (worker_ids && worker_ids.length > 0 && booking.id) {
      try {
        // Validate workers exist and are active
        const workersResult = await query(
          'SELECT id FROM users WHERE id = ANY($1) AND role IN ($2, $3, $4) AND is_active = true',
          [worker_ids, 'staff', 'manager', 'admin']
        );
        
        if (workersResult.rows.length !== worker_ids.length) {
          console.warn('Some workers not found or inactive, skipping assignment');
        } else {
          // Assign each worker to the booking
          for (const workerId of worker_ids) {
            await query(
              `INSERT INTO booking_workers (booking_id, worker_id, assigned_by, role, status)
               VALUES ($1, $2, $3, $4, $5)`,
              [booking.id, workerId, null, 'primary', 'active']
            );
            assignedWorkers.push(workerId);
          }
          
          // Update main booking with first worker as primary
          if (worker_ids.length > 0) {
            await query(
              'UPDATE bookings SET worker_id = $1 WHERE id = $2',
              [worker_ids[0], booking.id]
            );
          }
        }
      } catch (workerError) {
        console.error('Error assigning workers to walk-in booking:', workerError);
        // Don't fail the booking creation, just log the error
      }
    }

    const response = {
      ...booking,
      assigned_workers: assignedWorkers
    };

    res.status(201).json(successResponse(response, 'Walk-in booking created successfully', 201));
  } catch (error) {
    console.error('Walk-in booking creation error:', error);
    if (error.success === false) {
      return res.status(error.status || 400).json(error);
    }
    res.status(400).json(errorResponse(error.message || 'Failed to create walk-in booking', 'WALK_IN_BOOKING_ERROR', 400));
  }
});

// Public payment verification endpoint (no authentication required)
router.post('/payment/verify', async (req, res) => {
  const { reference } = req.body;
  
  if (!reference) {
    return res.status(400).json(errorResponse('Reference is required', 'MISSING_REFERENCE', 400));
  }
  
  try {
    // Use enhanced payment verification with fallback methods
    const verificationResult = await verifyPaymentWithFallbacks(reference);
    
    // Log the verification attempt
    await logPaymentVerification(reference, verificationResult);
    
    if (verificationResult.success) {
      // Extract booking number from reference (format: BOOKINGNUMBER_timestamp)
      // Handle multiple underscore formats and edge cases
      let booking_number = reference;
      
      // Try to extract booking number from reference format: BOOKINGNUMBER_timestamp
      if (reference.includes('_')) {
        booking_number = reference.split('_')[0];
      }
      
      // If booking number is too long (likely contains timestamp), try alternative extraction
      if (booking_number.length > 20) {
        // Look for the booking number in metadata if available
        if (verificationResult.data.metadata && verificationResult.data.metadata.booking_number) {
          booking_number = verificationResult.data.metadata.booking_number;
        }
      }
      
      console.log('Payment verification successful - Reference:', reference, 'Method:', verificationResult.method, 'Extracted booking number:', booking_number);
      
      // Update booking payment status
      const bookingResult = await query(
        `UPDATE bookings 
         SET payment_status = $1, 
             payment_method = $2, 
             payment_reference = $3,
             payment_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE booking_number = $4 
         RETURNING id, customer_email, customer_name, total_amount, service_id, booking_number`,
        ['completed', 'card', reference, booking_number]
      );
      
      if (bookingResult.rows.length > 0) {
        const booking = bookingResult.rows[0];
        
        // Get service names from booking_services junction
        const serviceResult = await query(
          `SELECT s.name 
           FROM services s 
           JOIN booking_services bs ON s.id = bs.service_id 
           WHERE bs.booking_id = $1`,
          [booking.id]
        );
        const serviceNames = serviceResult.rows.map(row => row.name);
        const serviceNamesList = serviceNames.length > 0 ? serviceNames.join(', ') : 'Service';
        
        // Send payment confirmation email
        try {
          await sendEmail(
            booking.customer_email,
            'Payment Confirmed - Your Booking is Confirmed!',
            `Dear ${booking.customer_name},

Great news! Your payment has been successfully processed and your booking is now confirmed.

Booking Number: ${booking.booking_number}
Services: ${serviceNamesList}
Payment Amount: ₦${(booking.total_amount).toFixed(2)}
Payment Method: Card
Payment Reference: ${reference}

Thank you for choosing Vonne X2X! We look forward to serving you.

Best regards,
Vonne X2X Team`
          );
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Continue even if email fails
        }
        
        console.log(`Payment verified successfully for booking ${booking_number}`);
        
        res.json({ 
          success: true, 
          message: 'Payment verified and booking updated',
          data: response.data.data 
        });
      } else {
        // Booking not found with the extracted booking number
        console.error(`Booking not found for booking number: ${booking_number}, reference: ${reference}`);
        
        // Try to find booking by payment reference as fallback
        const fallbackBookingResult = await query(
          `SELECT id, booking_number, customer_email, customer_name, total_amount 
           FROM bookings 
           WHERE payment_reference = $1 
           LIMIT 1`,
          [reference]
        );
        
        if (fallbackBookingResult.rows.length > 0) {
          // Booking found by reference, payment already processed
          console.log(`Payment already processed for reference: ${reference}`);
          res.json({ 
            success: true, 
            message: 'Payment already processed',
            data: response.data.data 
          });
        } else {
          // No booking found at all
          console.error(`No booking found for reference: ${reference}`);
          res.status(404).json({ 
            success: false, 
            error: 'Booking not found',
            message: 'Could not find booking associated with this payment reference'
          });
        }
      }
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Payment verification failed',
        data: response.data.data 
      });
    }
    
  } catch (error) {
    console.error('Public payment verification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Payment verification failed',
      message: error.message 
    });
  }
});

// Paystack webhook endpoint for payment notifications
router.post('/payment/webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Verify webhook signature (optional but recommended)
    const signature = req.headers['x-paystack-signature'];
    if (signature && process.env.PAYSTACK_SECRET_KEY) {
      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(JSON.stringify(webhookData))
        .digest('hex');
      
      if (hash !== signature) {
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    }
    
    // Store webhook data for fallback verification
    await storeWebhookData(webhookData);
    
    // Process successful payments
    if (webhookData.event === 'charge.success') {
      const { reference, data } = webhookData;
      
      // Auto-verify the payment
      try {
        const verificationResult = await verifyPaymentWithFallbacks(reference);
        await logPaymentVerification(reference, verificationResult, null);
        
        console.log(`Webhook payment verification completed for reference: ${reference}`);
      } catch (verifyError) {
        console.error('Error during webhook payment verification:', verifyError);
      }
    }
    
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

// Health check endpoint for UptimeRobot monitoring
router.get('/health', async (req, res) => {
  try {
    // Basic health check - verify database connection
    await query('SELECT 1');
    
    // Return simple 'healthy' response
    res.status(200).send('healthy');
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).send('unhealthy');
  }
});

export default router;