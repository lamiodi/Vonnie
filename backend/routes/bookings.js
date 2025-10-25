import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js'
import { validateBooking, validateUUID, validatePagination } from '../middleware/validation.js'
import { generateBookingId, logBookingUpdate, validateCoupon } from '../utils/booking.js'
import { sendGuestBookingConfirmation } from '../utils/notifications.js'

const router = express.Router()

// Get all bookings
router.get('/', authenticateToken, validatePagination, async(req, res) => {
  try {
    const { page = 1, limit = 20, status, staff_id, guest_customer_id, date_from, date_to } = req.query
    const offset = (page - 1) * limit

    let whereConditions = []
    let queryParams = []

    // Role-based filtering
    if (req.user.role === 'staff') {
      whereConditions.push(`b.staff_id = $${whereConditions.length + 1}`)
      queryParams.push(req.user.id)
    }

    // Additional filters
    if (status) {
      whereConditions.push(`b.status = $${whereConditions.length + 1}`)
      queryParams.push(status)
    }
    if (staff_id && req.user.role === 'admin') {
      whereConditions.push(`b.staff_id = $${whereConditions.length + 1}`)
      queryParams.push(staff_id)
    }
    if (guest_customer_id && ['admin', 'staff'].includes(req.user.role)) {
      whereConditions.push(`b.guest_customer_id = $${whereConditions.length + 1}`)
      queryParams.push(guest_customer_id)
    }
    if (date_from) {
      whereConditions.push(`b.start_time >= $${whereConditions.length + 1}`)
      queryParams.push(date_from)
    }
    if (date_to) {
      whereConditions.push(`b.start_time <= $${whereConditions.length + 1}`)
      queryParams.push(date_to)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM bookings b
      ${whereClause}
    `
    const countResult = await sql.unsafe(countQuery, queryParams)
    const totalCount = parseInt(countResult[0].count)

    // Get paginated bookings with related data
    const bookingsQuery = `
      SELECT 
        b.*,
        s.name as service_name,
        s.duration as service_duration,
        s.price as service_price,
        s.category as service_category,
        gc.first_name as guest_first_name,
        gc.last_name as guest_last_name,
        gc.phone as guest_phone,
        p.first_name as staff_first_name,
        p.last_name as staff_last_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN guest_customers gc ON b.guest_customer_id = gc.id
      LEFT JOIN profiles p ON b.staff_id = p.id
      ${whereClause}
      ORDER BY b.start_time DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `

    const finalParams = [...queryParams, limit, offset]
    const bookings = await sql.unsafe(bookingsQuery, finalParams)

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Bookings fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get booking by ID
router.get('/:id', authenticateToken, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    let whereConditions = ['b.id = $1']
    let queryParams = [id]

    // Role-based access control
    if (req.user.role === 'staff') {
      whereConditions.push(`b.staff_id = $${whereConditions.length + 1}`)
      queryParams.push(req.user.id)
    }

    const whereClause = whereConditions.join(' AND ')

    const bookingQuery = `
      SELECT 
        b.*,
        s.name as service_name,
        s.duration as service_duration,
        s.price as service_price,
        s.category as service_category,
        s.description as service_description,
        gc.first_name as guest_first_name,
        gc.last_name as guest_last_name,
        gc.phone as guest_phone,
        gc.email as guest_email,
        p.first_name as staff_first_name,
        p.last_name as staff_last_name,
        p.phone as staff_phone
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN guest_customers gc ON b.guest_customer_id = gc.id
      LEFT JOIN profiles p ON b.staff_id = p.id
      WHERE ${whereClause}
    `

    const bookings = await sql.unsafe(bookingQuery, queryParams)

    if (bookings.length === 0) {
      return res.status(404).json({ 
        error: 'Booking not found',
      })
    }

    res.json({ booking: bookings[0] })
  } catch (error) {
    console.error('Booking fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Check staff availability
router.get('/availability/check', async(req, res) => {
  try {
    const { staff_id, date, service_id } = req.query

    if (!staff_id || !date || !service_id) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        message: 'staff_id, date, and service_id are required', 
      })
    }

    // Get service duration
    const serviceQuery = `
      SELECT duration FROM services 
      WHERE id = $1 AND is_active = true
    `
    const services = await sql.unsafe(serviceQuery, [service_id])

    if (services.length === 0) {
      return res.status(404).json({ 
        error: 'Service not found',
      })
    }

    const service = services[0]

    // Get existing bookings for the staff on the date
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const bookingsQuery = `
      SELECT start_time, end_time 
      FROM bookings 
      WHERE staff_id = $1 
        AND status IN ('scheduled', 'in_progress')
        AND start_time >= $2 
        AND start_time <= $3
      ORDER BY start_time ASC
    `
    
    const existingBookings = await sql.unsafe(bookingsQuery, [
      staff_id, 
      startOfDay.toISOString(), 
      endOfDay.toISOString(),
    ])

    // Generate available time slots (9 AM to 6 PM, 30-minute intervals)
    const availableSlots = []
    const workStart = new Date(date)
    workStart.setHours(9, 0, 0, 0)
    const workEnd = new Date(date)
    workEnd.setHours(18, 0, 0, 0)

    const serviceDuration = service.duration // in minutes
    const slotInterval = 30 // 30-minute intervals

    for (let time = new Date(workStart); time < workEnd; time.setMinutes(time.getMinutes() + slotInterval)) {
      const slotStart = new Date(time)
      const slotEnd = new Date(time.getTime() + serviceDuration * 60000)

      // Check if slot conflicts with existing bookings
      const hasConflict = existingBookings.some(booking => {
        const bookingStart = new Date(booking.start_time)
        const bookingEnd = new Date(booking.end_time)
        
        return (slotStart < bookingEnd && slotEnd > bookingStart)
      })

      if (!hasConflict && slotEnd <= workEnd) {
        availableSlots.push({
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
        })
      }
    }

    res.json({ 
      available_slots: availableSlots,
      service_duration: serviceDuration,
    })
  } catch (error) {
    console.error('Availability check error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new booking
router.post('/', authenticateToken, validateBooking, async(req, res) => {
  try {
    const { service_id, staff_id, start_time, end_time, guest_customer_id, notes } = req.body

    // Use provided guest customer ID (staff/admin can book for any guest customer)
    let finalGuestCustomerId = guest_customer_id

    // Validate service exists
    const services = await sql`
      SELECT * FROM services 
      WHERE id = ${service_id} AND is_active = true
    `

    if (services.length === 0) {
      return res.status(404).json({ 
        error: 'Service not found or inactive', 
        message: 'Service not found or is inactive', 
      })
    }

    // Validate staff exists and has staff role
    const staffMembers = await sql`
      SELECT * FROM profiles 
      WHERE id = ${staff_id} AND role IN ('staff', 'admin')
    `

    if (staffMembers.length === 0) {
      return res.status(404).json({ 
        error: 'Staff member not found', 
        message: 'Staff member not found or does not have appropriate role', 
      })
    }

    // Check for scheduling conflicts
    const conflicts = await sql`
      SELECT id FROM bookings 
      WHERE staff_id = ${staff_id}
      AND status IN ('scheduled', 'in_progress')
      AND (
        (start_time < ${end_time} AND end_time > ${start_time}) OR
        (start_time >= ${start_time} AND start_time < ${end_time}) OR
        (end_time > ${start_time} AND end_time <= ${end_time})
      )
    `

    if (conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Time slot conflict', 
        message: 'The selected time slot conflicts with an existing booking', 
      })
    }

    // Generate booking ID
    const bookingId = await generateBookingId(finalGuestCustomerId)

    // Create booking
    const booking = await sql`
      INSERT INTO bookings (
        service_id, staff_id, guest_customer_id, start_time, end_time, 
        notes, status, booking_id
      )
      VALUES (
        ${service_id}, ${staff_id}, ${finalGuestCustomerId}, ${start_time}, ${end_time},
        ${notes}, 'scheduled', ${bookingId}
      )
      RETURNING *
    `

    // Get full booking details with joins
    const fullBooking = await sql`
      SELECT 
        b.*,
        s.name as service_name, s.duration as service_duration, 
        s.price as service_price, s.category as service_category,
        gc.first_name as guest_first_name, gc.last_name as guest_last_name, 
        gc.phone as guest_phone,
        p.first_name as staff_first_name, p.last_name as staff_last_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN guest_customers gc ON b.guest_customer_id = gc.id
      LEFT JOIN profiles p ON b.staff_id = p.id
      WHERE b.id = ${booking[0].id}
    `

    if (fullBooking.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to create booking', 
        message: 'Booking was created but could not retrieve details', 
      })
    }

    const bookingDetails = fullBooking[0]

    // Send booking confirmation email for guest bookings
    if (bookingDetails.guest_customer_id) {
      try {
        // Prepare booking data for email
        const emailBookingData = {
          id: bookingDetails.id,
          booking_number: bookingDetails.booking_id,
          guest_customer_id: bookingDetails.guest_customer_id,
          guest_name: `${bookingDetails.guest_first_name} ${bookingDetails.guest_last_name}`.trim(),
          guest_email: bookingDetails.guest_email || null,
          service_name: bookingDetails.service_name,
          service_duration: bookingDetails.service_duration,
          staff_name: `${bookingDetails.staff_first_name} ${bookingDetails.staff_last_name}`.trim(),
          appointment_date: bookingDetails.start_time.toISOString().split('T')[0],
          appointment_time: bookingDetails.start_time.toTimeString().slice(0, 5),
          total_amount: bookingDetails.service_price
        }

        // Get guest email from guest_customers table
        const guestCustomer = await sql`
          SELECT email FROM guest_customers WHERE id = ${bookingDetails.guest_customer_id}
        `

        if (guestCustomer.length > 0 && guestCustomer[0].email) {
          emailBookingData.guest_email = guestCustomer[0].email
          
          const emailResult = await sendGuestBookingConfirmation(emailBookingData)
          
          if (emailResult.success) {
            console.log('Booking confirmation email sent successfully:', emailResult.messageId)
          } else {
            console.error('Failed to send booking confirmation email:', emailResult.error)
          }
        } else {
          console.warn('No email address found for guest customer:', bookingDetails.guest_customer_id)
        }
      } catch (emailError) {
        console.error('Error sending booking confirmation email:', emailError)
        // Don't fail the booking creation if email fails
      }
    }

    res.status(201).json({
      message: 'Booking created successfully',
      booking: bookingDetails,
    })
  } catch (error) {
    console.error('Booking creation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update booking
router.put('/:id', authenticateToken, validateUUID, async(req, res) => {
  try {
    const { id } = req.params
    const { service_id, staff_id, start_time, end_time, status, notes, reason } = req.body

    // Check if user can update this booking
    const existingBooking = await sql`
      SELECT * FROM bookings WHERE id = ${id}
    `

    if (existingBooking.length === 0) {
      return res.status(404).json({ 
        error: 'Booking not found', 
        message: 'No booking found with the specified ID', 
      })
    }

    const bookingData = existingBooking[0]

    // Role-based access control
    if (req.user.role === 'staff' && bookingData.staff_id !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'You can only update your assigned bookings', 
      })
    }

    // Staff and admin can update all fields
    let updateData = {
      service_id: service_id || bookingData.service_id,
      staff_id: staff_id || bookingData.staff_id,
      start_time: start_time || bookingData.start_time,
      end_time: end_time || bookingData.end_time,
      status: status || bookingData.status,
      notes: notes !== undefined ? notes : bookingData.notes,
    }

    // Check for conflicts if time or staff changed
    if ((start_time || end_time || staff_id) && status !== 'cancelled') {
      const checkStaffId = staff_id || bookingData.staff_id
      const checkStartTime = start_time || bookingData.start_time
      const checkEndTime = end_time || bookingData.end_time

      const conflicts = await sql`
        SELECT id FROM bookings 
        WHERE staff_id = ${checkStaffId}
          AND id != ${id}
          AND status IN ('scheduled', 'in_progress')
          AND start_time < ${checkEndTime}
          AND end_time > ${checkStartTime}
      `

      if (conflicts.length > 0) {
        return res.status(409).json({ 
          error: 'Time slot conflict', 
          message: 'The updated time slot conflicts with an existing booking', 
        })
      }
    }

    // Track changes for logging
    const changes = {}
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== bookingData[key]) {
        changes[key] = {
          old: bookingData[key],
          new: updateData[key],
        }
      }
    })

    // Update booking
    const booking = await sql`
      UPDATE bookings 
      SET 
        service_id = ${updateData.service_id},
        staff_id = ${updateData.staff_id},
        start_time = ${updateData.start_time},
        end_time = ${updateData.end_time},
        status = ${updateData.status},
        notes = ${updateData.notes},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (booking.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to update booking', 
        message: 'Booking could not be updated', 
      })
    }

    // Get full booking details with joins
    const fullBooking = await sql`
      SELECT 
        b.*,
        s.name as service_name, s.duration as service_duration, 
        s.price as service_price, s.category as service_category,
        gc.first_name as guest_first_name, gc.last_name as guest_last_name, 
        gc.phone as guest_phone,
        p.first_name as staff_first_name, p.last_name as staff_last_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN guest_customers gc ON b.guest_customer_id = gc.id
      LEFT JOIN profiles p ON b.staff_id = p.id
      WHERE b.id = ${id}
    `

    // Log booking update if changes were made and user is manager/admin
    if (Object.keys(changes).length > 0 && ['admin', 'manager'].includes(req.user.role)) {
      await logBookingUpdate(id, req.user.id, changes, reason)
    }

    res.json({
      message: 'Booking updated successfully',
      booking: fullBooking[0],
    })
  } catch (error) {
    console.error('Booking update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete booking (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    const result = await sql`
      DELETE FROM bookings 
      WHERE id = ${id}
      RETURNING id
    `

    if (result.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to delete booking', 
        message: 'Booking not found or could not be deleted', 
      })
    }

    res.json({ message: 'Booking deleted successfully' })
  } catch (error) {
    console.error('Booking deletion error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get booking statistics (Staff/Admin only)
router.get('/stats/overview', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { date_from, date_to } = req.query
    
    let whereClause = ''
    let params = []
    
    if (date_from) {
      whereClause += ' AND b.start_time >= $' + (params.length + 1)
      params.push(date_from)
    }
    if (date_to) {
      whereClause += ' AND b.start_time <= $' + (params.length + 1)
      params.push(date_to)
    }
    
    // Role-based filtering
    if (req.user.role === 'staff') {
      whereClause += ' AND b.staff_id = $' + (params.length + 1)
      params.push(req.user.id)
    }
    
    // Remove leading ' AND ' if present
    if (whereClause.startsWith(' AND ')) {
      whereClause = ' WHERE ' + whereClause.substring(5)
    }
    
    const query = `
      SELECT 
        b.status,
        s.name as service_name
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      ${whereClause}
    `
    
    const stats = await sql.unsafe(query, params)

    if (stats.length === 0) {
      return res.json({
        statusCounts: {},
        serviceCounts: {},
        totalBookings: 0,
      })
    }

    // Total bookings by status
    const statusCounts = stats.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1
      return acc
    }, {})

    // Bookings by service
    const serviceCounts = stats.reduce((acc, booking) => {
      const serviceName = booking.service_name || 'Unknown'
      acc[serviceName] = (acc[serviceName] || 0) + 1
      return acc
    }, {})

    res.json({
      statusCounts,
      serviceCounts,
      totalBookings: stats.length,
    })
  } catch (error) {
    console.error('Booking stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router