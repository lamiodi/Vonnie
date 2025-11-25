import { query, getClient } from '../config/db.js';
import { sendEmail } from './email.js';
import { generateUniqueBookingNumber, generateBookingNumberWithName } from '../utils/bookingUtils.js';

/**
 * Create a new booking with comprehensive validation and notification
 * @param {Object} bookingData - Booking data from request
 * @param {boolean} skipNotification - Whether to skip sending notifications
 * @returns {Promise<Object>} Created booking with all details
 */
export const createBooking = async (bookingData, skipNotification = false) => {
  const {
    customer_name,
    customer_email,
    customer_phone,
    customer_type,
    scheduled_time,
    worker_id,
    service_ids,
    notes,
    payment_status = 'pending'
  } = bookingData;

  // Validate required fields
  if (!customer_name || !customer_email || !customer_phone || !scheduled_time || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0) {
    throw {
      success: false,
      message: 'Missing required fields: customer_name, customer_email, customer_phone, scheduled_time, and service_ids are required',
      status: 400
    };
  }

  // Validate and format scheduled_time
  let formattedScheduledTime;
  try {
    const dateObj = new Date(scheduled_time);
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date format');
    }
    formattedScheduledTime = dateObj.toISOString();
  } catch (error) {
    throw {
      success: false,
      message: `Invalid scheduled_time format: ${scheduled_time}. Please use ISO 8601 format (YYYY-MM-DDTHH:mm:ss)`,
      status: 400
    };
  }

  // Validate customer type
  const validCustomerTypes = ['walk_in', 'pre_booked'];
  if (customer_type && !validCustomerTypes.includes(customer_type)) {
    throw {
      success: false,
      message: 'Invalid customer type. Must be one of: walk_in, pre_booked',
      status: 400
    };
  }

  // Validate services exist and calculate pricing
  const servicesResult = await query(
    'SELECT id, name, price, duration FROM services WHERE id = ANY($1) AND is_active = true',
    [service_ids]
  );

  if (servicesResult.rows.length !== service_ids.length) {
    throw {
      success: false,
      message: 'One or more services not found or inactive',
      status: 400
    };
  }

  const services = servicesResult.rows;
  const totalPrice = services.reduce((sum, service) => sum + parseFloat(service.price), 0);
  const totalDuration = services.reduce((sum, service) => sum + parseInt(service.duration || 0), 0);

  // Generate server-side booking number (ignore frontend-provided number to prevent conflicts)
  const bookingNumber = await generateBookingNumberWithName(customer_name);

  // Check worker availability if worker_id is provided
  if (worker_id) {
    const workerResult = await query(
      'SELECT id FROM users WHERE id = $1 AND role IN ($2, $3, $4) AND is_active = true',
      [worker_id, 'staff', 'manager', 'admin']
    );

    if (workerResult.rows.length === 0) {
      throw {
        success: false,
        message: 'Worker not found or not available',
        status: 400
      };
    }

    // Check for scheduling conflicts
    const conflictResult = await query(
      `SELECT id FROM bookings 
       WHERE worker_id = $1 
       AND scheduled_time = $2 
       AND status IN ('scheduled', 'in-progress')`,
      [worker_id, formattedScheduledTime]
    );

    if (conflictResult.rows.length > 0) {
      throw {
        success: false,
        message: 'Worker is not available at the selected time',
        status: 409
      };
    }
  }

  // Begin transaction
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    // Create booking
    const bookingResult = await client.query(
      `INSERT INTO bookings (
        booking_number, customer_name, customer_email, customer_phone, 
        customer_type, scheduled_time, worker_id, duration, total_amount, 
        payment_status, status, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        bookingNumber,
        customer_name,
        customer_email,
        customer_phone,
        customer_type || 'pre_booked',
        formattedScheduledTime,
        worker_id,
        totalDuration,
        totalPrice,
        payment_status,
        worker_id ? 'scheduled' : 'pending_confirmation', // Auto-schedule if worker is assigned during creation
        notes
      ]
    );

    const booking = bookingResult.rows[0];

    // Create booking services
    for (const service of services) {
      await client.query(
        `INSERT INTO booking_services (booking_id, service_id, quantity, unit_price, total_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [booking.id, service.id, 1, service.price, service.price]
      );
    }

    await client.query('COMMIT');

    // Send notifications unless skipped
    if (!skipNotification) {
      try {
        // Send email confirmation
        await sendEmail(
          customer_email,
          'Booking Confirmation - Vonne X2X',
          `Dear ${customer_name},

Thank you for booking with Vonne X2X! Your booking has been received and is pending confirmation.

Booking Details:
- Booking Number: ${bookingNumber}
- Date & Time: ${new Date(scheduled_time).toLocaleString()}
- Total Price: ₦${totalPrice.toFixed(2)}
- Services: ${services.map(s => s.name).join(', ')}

We will send you a confirmation email once your booking is approved by our team.

If you have any questions, please don't hesitate to contact us.

Thank you for choosing Vonne X2X!`
        );

        // WhatsApp notifications removed - using email only

      } catch (notificationError) {
        console.error('Notification error:', notificationError);
        // Don't throw error if notification fails
      }
    }

    // Return booking with services
    const bookingWithServices = {
      ...booking,
      services: services.map(service => ({
        id: service.id,
        name: service.name,
        price: service.price,
        duration: service.duration
      }))
    };

    return bookingWithServices;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get booking by ID with full details
 * @param {number} bookingId - Booking ID
 * @returns {Promise<Object>} Booking with services and worker details
 */
export const getBookingById = async (bookingId) => {
  const result = await query(`
    SELECT 
      b.*,
      u.email as worker_email,
      u.name as worker_name,
      svc.service_names,
      svc.service_duration
    FROM bookings b
    LEFT JOIN users u ON b.worker_id = u.id
    LEFT JOIN LATERAL (
      SELECT 
        array_agg(s.name ORDER BY s.name) AS service_names,
        SUM(s.duration * COALESCE(bs.quantity, 1)) AS service_duration
      FROM booking_services bs
      LEFT JOIN services s ON bs.service_id = s.id
      WHERE bs.booking_id = b.id
    ) svc ON TRUE
    WHERE b.id = $1
    LIMIT 1
  `, [bookingId]);

  return result.rows[0];
};

/**
 * Get booking by booking number
 * @param {string} bookingNumber - Booking number
 * @returns {Promise<Object>} Booking details
 */
export const getBookingByNumber = async (bookingNumber) => {
  const result = await query(`
    SELECT 
      b.*,
      u.email as worker_email,
      u.name as worker_name,
      svc.service_names,
      svc.service_price
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
    WHERE b.booking_number = $1
    LIMIT 1
  `, [bookingNumber]);

  return result.rows[0];
};

/**
 * Update booking status
 * @param {number} bookingId - Booking ID
 * @param {string} status - New status
 * @param {Object} user - User making the update
 * @returns {Promise<Object>} Updated booking
 */
export const updateBookingStatus = async (bookingId, status, user) => {
  // Get current booking details
  const currentBooking = await query(
    'SELECT status, customer_email, customer_name, customer_phone, booking_number, scheduled_time FROM bookings WHERE id = $1',
    [bookingId]
  );

  if (currentBooking.rows.length === 0) {
    throw {
      success: false,
      message: 'Booking not found',
      status: 404
    };
  }

  const booking = currentBooking.rows[0];
  
  // Update status
  const result = await query(
    'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [status, bookingId]
  );

  const updatedBooking = result.rows[0];

  // Send notifications for important status changes
  if (status === 'scheduled' || status === 'cancelled') {
    try {
      await sendEmail(
        booking.customer_email,
        `Booking ${status === 'scheduled' ? 'Confirmed' : 'Cancelled'} - Vonne X2X`,
        `Dear ${booking.customer_name},

Your booking ${booking.booking_number} has been ${status}.

${status === 'scheduled' ? 
  `We look forward to serving you on ${new Date(booking.scheduled_time).toLocaleString()}.` :
  'We regret the inconvenience. Please contact us if you would like to reschedule.'
}

Thank you for choosing Vonne X2X!`
      );

      await sendBookingStatusUpdate(
        booking.customer_phone,
        {
          booking_number: booking.booking_number,
          status: status,
          scheduled_time: booking.scheduled_time
        },
        status
      );
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
    }
  }

  return updatedBooking;
};

/**
 * Get bookings with filters
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Bookings array
 */
export const getBookings = async (filters = {}) => {
  const {
    booking_number,
    worker_id,
    date,
    unassigned,
    status,
    customer_type,
    limit = 100,
    offset = 0
  } = filters;

  let sql = `
    SELECT 
      b.*,
      u.email as worker_email,
      u.name as worker_name,
      svc.service_names,
      svc.service_price
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
  
  if (unassigned === 'true') {
    sql += ` AND b.worker_id IS NULL`;
  }
  
  if (status) {
    paramCount++;
    sql += ` AND b.status = $${paramCount}`;
    params.push(status);
  }
  
  if (customer_type) {
    paramCount++;
    sql += ` AND b.customer_type = $${paramCount}`;
    params.push(customer_type);
  }

  sql += ` ORDER BY b.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  return result.rows;
};