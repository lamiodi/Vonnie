const express = require('express');
const { supabase } = require('../config/supabase-db');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateBooking, validateUUID, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Get all bookings
router.get('/', authenticateToken, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, staff_id, customer_id, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        services(name, duration, price, category),
        customer:profiles!customer_id(first_name, last_name, phone),
        staff:profiles!staff_id(first_name, last_name)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('start_time', { ascending: false });

    // Role-based filtering
    if (req.user.role === 'staff') {
      query = query.eq('staff_id', req.user.id);
    } else if (req.user.role === 'customer') {
      query = query.eq('customer_id', req.user.id);
    }

    // Additional filters
    if (status) {
      query = query.eq('status', status);
    }
    if (staff_id && req.user.role === 'admin') {
      query = query.eq('staff_id', staff_id);
    }
    if (customer_id && ['admin', 'staff'].includes(req.user.role)) {
      query = query.eq('customer_id', customer_id);
    }
    if (date_from) {
      query = query.gte('start_time', date_from);
    }
    if (date_to) {
      query = query.lte('start_time', date_to);
    }

    const { data: bookings, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch bookings', 
        message: error.message 
      });
    }

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Bookings fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get booking by ID
router.get('/:id', authenticateToken, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        services(name, duration, price, category, description),
        customer:profiles!customer_id(first_name, last_name, phone, email),
        staff:profiles!staff_id(first_name, last_name, phone)
      `)
      .eq('id', id)
      .single();

    // Role-based access control
    if (req.user.role === 'staff') {
      query = query.eq('staff_id', req.user.id);
    } else if (req.user.role === 'customer') {
      query = query.eq('customer_id', req.user.id);
    }

    const { data: booking, error } = await query;

    if (error) {
      return res.status(404).json({ 
        error: 'Booking not found', 
        message: error.message 
      });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Booking fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check staff availability
router.get('/availability/check', async (req, res) => {
  try {
    const { staff_id, date, service_id } = req.query;

    if (!staff_id || !date || !service_id) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        message: 'staff_id, date, and service_id are required' 
      });
    }

    // Get service duration
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('duration')
      .eq('id', service_id)
      .single();

    if (serviceError) {
      return res.status(404).json({ 
        error: 'Service not found', 
        message: serviceError.message 
      });
    }

    // Get existing bookings for the staff on the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('staff_id', staff_id)
      .in('status', ['scheduled', 'in_progress'])
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time', { ascending: true });

    if (bookingsError) {
      return res.status(400).json({ 
        error: 'Failed to check availability', 
        message: bookingsError.message 
      });
    }

    // Generate available time slots (9 AM to 6 PM, 30-minute intervals)
    const availableSlots = [];
    const workStart = new Date(date);
    workStart.setHours(9, 0, 0, 0);
    const workEnd = new Date(date);
    workEnd.setHours(18, 0, 0, 0);

    const serviceDuration = service.duration; // in minutes
    const slotInterval = 30; // 30-minute intervals

    for (let time = new Date(workStart); time < workEnd; time.setMinutes(time.getMinutes() + slotInterval)) {
      const slotStart = new Date(time);
      const slotEnd = new Date(time.getTime() + serviceDuration * 60000);

      // Check if slot conflicts with existing bookings
      const hasConflict = existingBookings.some(booking => {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);
        
        return (slotStart < bookingEnd && slotEnd > bookingStart);
      });

      if (!hasConflict && slotEnd <= workEnd) {
        availableSlots.push({
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString()
        });
      }
    }

    res.json({ 
      available_slots: availableSlots,
      service_duration: serviceDuration
    });
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new booking
router.post('/', authenticateToken, validateBooking, async (req, res) => {
  try {
    const { service_id, staff_id, start_time, end_time, customer_id, notes } = req.body;

    // Determine customer ID based on user role
    let finalCustomerId = customer_id;
    if (req.user.role === 'customer') {
      finalCustomerId = req.user.id; // Customers can only book for themselves
    }

    // Validate service exists
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', service_id)
      .eq('is_active', true)
      .single();

    if (serviceError) {
      return res.status(404).json({ 
        error: 'Service not found or inactive', 
        message: serviceError.message 
      });
    }

    // Validate staff exists and has staff role
    const { data: staff, error: staffError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', staff_id)
      .in('role', ['staff', 'admin'])
      .single();

    if (staffError) {
      return res.status(404).json({ 
        error: 'Staff member not found', 
        message: staffError.message 
      });
    }

    // Check for scheduling conflicts
    const { data: conflicts, error: conflictError } = await supabase
      .from('bookings')
      .select('id')
      .eq('staff_id', staff_id)
      .in('status', ['scheduled', 'in_progress'])
      .or(`and(start_time.lt.${end_time},end_time.gt.${start_time})`);

    if (conflictError) {
      return res.status(400).json({ 
        error: 'Failed to check conflicts', 
        message: conflictError.message 
      });
    }

    if (conflicts && conflicts.length > 0) {
      return res.status(409).json({ 
        error: 'Time slot conflict', 
        message: 'The selected time slot conflicts with an existing booking' 
      });
    }

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        service_id,
        staff_id,
        customer_id: finalCustomerId,
        start_time,
        end_time,
        notes,
        status: 'scheduled'
      })
      .select(`
        *,
        services(name, duration, price, category),
        customer:profiles!customer_id(first_name, last_name, phone),
        staff:profiles!staff_id(first_name, last_name)
      `)
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to create booking', 
        message: error.message 
      });
    }

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update booking
router.put('/:id', authenticateToken, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { service_id, staff_id, start_time, end_time, status, notes } = req.body;

    // Check if user can update this booking
    const { data: existingBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ 
        error: 'Booking not found', 
        message: fetchError.message 
      });
    }

    // Role-based access control
    if (req.user.role === 'customer' && existingBooking.customer_id !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'You can only update your own bookings' 
      });
    }

    if (req.user.role === 'staff' && existingBooking.staff_id !== req.user.id) {
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'You can only update your assigned bookings' 
      });
    }

    // Customers can only update notes and cancel bookings
    let updateData = {};
    if (req.user.role === 'customer') {
      if (status && status !== 'cancelled') {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'Customers can only cancel bookings' 
        });
      }
      updateData = { notes, status: status || existingBooking.status };
    } else {
      // Staff and admin can update all fields
      updateData = {
        service_id: service_id || existingBooking.service_id,
        staff_id: staff_id || existingBooking.staff_id,
        start_time: start_time || existingBooking.start_time,
        end_time: end_time || existingBooking.end_time,
        status: status || existingBooking.status,
        notes: notes !== undefined ? notes : existingBooking.notes
      };

      // Check for conflicts if time or staff changed
      if ((start_time || end_time || staff_id) && status !== 'cancelled') {
        const checkStaffId = staff_id || existingBooking.staff_id;
        const checkStartTime = start_time || existingBooking.start_time;
        const checkEndTime = end_time || existingBooking.end_time;

        const { data: conflicts, error: conflictError } = await supabase
          .from('bookings')
          .select('id')
          .eq('staff_id', checkStaffId)
          .neq('id', id)
          .in('status', ['scheduled', 'in_progress'])
          .or(`and(start_time.lt.${checkEndTime},end_time.gt.${checkStartTime})`);

        if (conflicts && conflicts.length > 0) {
          return res.status(409).json({ 
            error: 'Time slot conflict', 
            message: 'The updated time slot conflicts with an existing booking' 
          });
        }
      }
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        services(name, duration, price, category),
        customer:profiles!customer_id(first_name, last_name, phone),
        staff:profiles!staff_id(first_name, last_name)
      `)
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to update booking', 
        message: error.message 
      });
    }

    res.json({
      message: 'Booking updated successfully',
      booking
    });
  } catch (error) {
    console.error('Booking update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete booking (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to delete booking', 
        message: error.message 
      });
    }

    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Booking deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get booking statistics (Staff/Admin only)
router.get('/stats/overview', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    
    let baseQuery = supabase.from('bookings');
    
    if (date_from) {
      baseQuery = baseQuery.gte('start_time', date_from);
    }
    if (date_to) {
      baseQuery = baseQuery.lte('start_time', date_to);
    }

    // Total bookings by status
    const { data: statusStats, error: statusError } = await baseQuery
      .select('status');

    if (statusError) {
      return res.status(400).json({ 
        error: 'Failed to fetch booking stats', 
        message: statusError.message 
      });
    }

    const statusCounts = statusStats.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});

    // Bookings by service
    const { data: serviceStats, error: serviceError } = await baseQuery
      .select(`
        services(name)
      `);

    if (serviceError) {
      return res.status(400).json({ 
        error: 'Failed to fetch service stats', 
        message: serviceError.message 
      });
    }

    const serviceCounts = serviceStats.reduce((acc, booking) => {
      const serviceName = booking.services?.name || 'Unknown';
      acc[serviceName] = (acc[serviceName] || 0) + 1;
      return acc;
    }, {});

    res.json({
      statusCounts,
      serviceCounts,
      totalBookings: statusStats.length
    });
  } catch (error) {
    console.error('Booking stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;