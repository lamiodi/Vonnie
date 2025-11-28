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
        // Send email confirmation with simplified design using Patrick Hand font
        const bookingConfirmationHtml = `
          <div style="font-family: 'Patrick Hand', cursive; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 15px; overflow: hidden; border: 2px solid #9333ea;">
            <!-- Simple Header -->
            <div style="background: #9333ea; padding: 30px 20px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 28px; font-family: 'Patrick Hand', cursive; font-weight: bold;">
                ✨ Booking Confirmed!
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 16px;">Your appointment is booked</p>
            </div>
            
            <!-- Main content -->
            <div style="padding: 25px 20px;">
              <p style="font-size: 16px; color: #333; margin-bottom: 15px; font-family: 'Patrick Hand', cursive;">Dear <strong style="color: #9333ea;">${customer_name}</strong>,</p>
              <p style="font-size: 14px; color: #555; line-height: 1.5; margin-bottom: 20px; font-family: 'Patrick Hand', cursive;">
                Thank you for booking with Vonne X2X! Your appointment has been received and is being prepared for you.
              </p>
              
              <!-- Simple Booking Details -->
              <div style="background: #f9f5ff; border: 1px solid #e0d4f7; border-radius: 10px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #9333ea; margin: 0 0 15px 0; font-size: 18px; font-family: 'Patrick Hand', cursive; font-weight: bold;">
                  📋 Your Booking Details
                </h3>
                
                <div style="display: grid; gap: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e0d4f7;">
                    <span style="font-weight: 600; color: #666; font-family: 'Patrick Hand', cursive;">Booking Number:</span>
                    <span style="color: #9333ea; font-weight: bold; font-size: 16px; font-family: 'Patrick Hand', cursive;">${bookingNumber}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e0d4f7;">
                    <span style="font-weight: 600; color: #666; font-family: 'Patrick Hand', cursive;">Date & Time:</span>
                    <span style="color: #333; font-weight: 600; font-family: 'Patrick Hand', cursive;">${new Date(scheduled_time).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                    <span style="font-weight: 600; color: #666; font-family: 'Patrick Hand', cursive;">Total Price:</span>
                    <span style="color: #059669; font-weight: bold; font-size: 16px; font-family: 'Patrick Hand', cursive;">₦${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
                
                <!-- Simple Services list -->
                <div style="margin-top: 15px; padding: 10px; background: white; border-radius: 8px;">
                  <h4 style="margin: 0 0 10px 0; color: #9333ea; font-size: 14px; font-weight: 600; font-family: 'Patrick Hand', cursive;">Services:</h4>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${services.map(service => `
                      <span style="background: #9333ea; color: white; padding: 4px 10px; border-radius: 15px; font-size: 12px; font-family: 'Patrick Hand', cursive;">
                        ${service.name}
                      </span>
                    `).join('')}
                  </div>
                </div>
              </div>
              
              <!-- Simple Next steps -->
              <div style="background: #f5f3ff; border: 1px solid #d0c2f4; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h4 style="margin: 0 0 8px 0; color: #9333ea; font-size: 14px; font-weight: 600; font-family: 'Patrick Hand', cursive;">🌟 What happens next?</h4>
                <p style="margin: 0; color: #65548b; font-size: 13px; line-height: 1.4; font-family: 'Patrick Hand', cursive;">
                  We'll confirm your booking once approved. Please arrive 10 minutes early.
                </p>
              </div>
              
              <!-- Simple Contact info -->
              <div style="text-align: center; margin: 20px 0; padding: 15px; background: #faf8ff; border-radius: 8px;">
                <p style="margin: 0 0 5px 0; color: #65548b; font-size: 13px; font-family: 'Patrick Hand', cursive;">Questions? Contact us at</p>
                <p style="margin: 0; color: #9333ea; font-weight: 600; font-family: 'Patrick Hand', cursive;">
                  <a href="mailto:support@vonneex2x.store" style="color: #9333ea; text-decoration: none;">support@vonneex2x.store</a>
                </p>
              </div>
            </div>
            
            <!-- Simple Footer -->
            <div style="background: #9333ea; padding: 20px; text-align: center; color: white;">
              <p style="margin: 0; font-size: 16px; font-family: 'Patrick Hand', cursive; margin-bottom: 5px;">Vonne X2X</p>
              <p style="margin: 0; font-size: 12px; opacity: 0.9; font-family: 'Patrick Hand', cursive;">Professional Service Management System</p>
              <p style="margin: 5px 0 0 0; font-size: 11px; opacity: 0.8; font-family: 'Patrick Hand', cursive;">Thank you for choosing us!</p>
            </div>
          </div>
        `;
        
        await sendEmail(
          customer_email,
          '✨ Booking Confirmed - Vonne X2X',
          `Dear ${customer_name}, Your booking ${bookingNumber} has been received. Date: ${new Date(scheduled_time).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. Total: ₦${totalPrice.toFixed(2)}. We'll send confirmation once approved.`,
          bookingConfirmationHtml
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
      // Professional status update email matching PublicBooking.jsx design
      const statusIcon = status === 'scheduled' ? '✅' : '❌';
      const statusColor = status === 'scheduled' ? '#10b981' : '#ef4444';
      const statusGradient = status === 'scheduled' 
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
        : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
      const statusText = status === 'scheduled' ? 'Confirmed' : 'Cancelled';
      
      const statusUpdateHtml = `
        <div style="font-family: 'Patrick Hand', cursive, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
          <!-- Header with status-specific gradient -->
          <div style="background: ${statusGradient}; padding: 40px 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 32px; font-family: 'UnifrakturCook', cursive, serif; font-weight: bold;">
              ${statusIcon} Booking ${statusText}
            </h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">
              ${status === 'scheduled' ? 'Your appointment is confirmed!' : 'Appointment cancelled'}
            </p>
          </div>
          
          <!-- Status progress indicator -->
          <div style="background: #f8fafc; padding: 20px; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
              <div style="text-align: center;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin: 0 auto 5px; box-shadow: 0 4px 15px rgba(147, 51, 234, 0.3);">✓</div>
                <p style="margin: 0; font-size: 12px; color: #9333ea; font-weight: 600;">Booked</p>
              </div>
              <div style="flex: 0 0 30px; height: 2px; background: linear-gradient(90deg, #9333ea, #ec4899);"></div>
              <div style="text-align: center;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${statusColor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; margin: 0 auto 5px; box-shadow: 0 4px 15px rgba(${status === 'scheduled' ? '16, 185, 129' : '239, 68, 68'}, 0.3);">${statusIcon}</div>
                <p style="margin: 0; font-size: 12px; color: ${statusColor}; font-weight: 600;">${statusText}</p>
              </div>
            </div>
          </div>
          
          <!-- Main content -->
          <div style="padding: 30px;">
            <p style="font-size: 18px; color: #1f2937; margin-bottom: 20px;">Dear <strong style="color: #9333ea;">${booking.customer_name}</strong>,</p>
            
            ${status === 'scheduled' ? `
              <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
                Great news! Your booking <strong style="color: #10b981;">${booking.booking_number}</strong> has been confirmed and we're excited to serve you.
              </p>
              
              <!-- Confirmed booking details -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #10b981; border-radius: 16px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.1);">
                <h3 style="color: #10b981; margin: 0 0 20px 0; font-size: 22px; font-family: 'UnifrakturCook', cursive, serif; background: linear-gradient(45deg, #10b981, #059669); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  📅 Appointment Confirmed
                </h3>
                
                <div style="display: grid; gap: 15px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #10b981;">
                    <span style="font-weight: 600; color: #6b7280;">Booking Number:</span>
                    <span style="color: #10b981; font-weight: bold; font-size: 18px; font-family: monospace;">${booking.booking_number}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #059669;">
                    <span style="font-weight: 600; color: #6b7280;">Scheduled Date:</span>
                    <span style="color: #1f2937; font-weight: 600;">${new Date(booking.scheduled_time).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                
                <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-top: 20px;">
                  <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                    <strong>💡 Reminder:</strong> Please arrive 10 minutes early for your appointment to complete any necessary preparation.
                  </p>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f0fdf4; border-radius: 12px;">
                <p style="margin: 0 0 10px 0; color: #10b981; font-size: 16px; font-weight: 600;">We look forward to serving you!</p>
                <p style="margin: 0; color: #64748b; font-size: 14px;">Need to reschedule? Contact us at <a href="mailto:support@vonneex2x.store" style="color: #059669;">support@vonneex2x.store</a></p>
              </div>
            ` : `
              <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 25px;">
                We regret to inform you that your booking <strong style="color: #ef4444;">${booking.booking_number}</strong> has been cancelled.
              </p>
              
              <!-- Cancelled booking details -->
              <div style="background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #ef4444; border-radius: 16px; padding: 25px; margin: 25px 0; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.1);">
                <h3 style="color: #ef4444; margin: 0 0 20px 0; font-size: 22px; font-family: 'UnifrakturCook', cursive, serif; background: linear-gradient(45deg, #ef4444, #dc2626); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  ❌ Appointment Cancelled
                </h3>
                
                <div style="display: grid; gap: 15px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #ef4444;">
                    <span style="font-weight: 600; color: #6b7280;">Booking Number:</span>
                    <span style="color: #ef4444; font-weight: bold; font-size: 18px; font-family: monospace;">${booking.booking_number}</span>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: white; border-radius: 10px; border-left: 4px solid #dc2626;">
                    <span style="font-weight: 600; color: #6b7280;">Was Scheduled For:</span>
                    <span style="color: #1f2937; font-weight: 600;">${new Date(booking.scheduled_time).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
              
              <div style="background: #f3e8ff; border: 1px solid #c084fc; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h4 style="margin: 0 0 10px 0; color: #7c3aed; font-size: 16px; font-weight: 600;">🔄 Ready to Reschedule?</h4>
                <p style="margin: 0; color: #5b21b6; font-size: 14px; line-height: 1.5;">
                  We sincerely apologize for any inconvenience. Please contact us to reschedule your appointment at a more convenient time.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0; padding: 20px; background: #fef2f2; border-radius: 12px;">
                <p style="margin: 0 0 10px 0; color: #ef4444; font-size: 14px;">We regret the inconvenience.</p>
                <p style="margin: 0; color: #64748b; font-size: 14px;">Contact us to reschedule: <a href="mailto:support@vonneex2x.store" style="color: #dc2626;">support@vonneex2x.store</a></p>
              </div>
            `}
            
          </div>
          
          <!-- Footer -->
          <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 30px; text-align: center; color: white;">
            <p style="margin: 0; font-size: 18px; font-family: 'UnifrakturCook', cursive, serif; margin-bottom: 10px;">Vonne X2X</p>
            <p style="margin: 0; font-size: 14px; opacity: 0.8;">Professional Service Management System</p>
            <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.6;">Thank you for choosing us for your beauty needs!</p>
          </div>
        </div>
      `;
      
      await sendEmail(
        booking.customer_email,
        `${statusIcon} Booking ${statusText} - Vonne X2X`,
        `Dear ${booking.customer_name}, Your booking ${booking.booking_number} has been ${status}. ${status === 'scheduled' ? `We look forward to serving you on ${new Date(booking.scheduled_time).toLocaleString()}.` : 'We regret the inconvenience. Please contact us if you would like to reschedule.'}`,
        statusUpdateHtml
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