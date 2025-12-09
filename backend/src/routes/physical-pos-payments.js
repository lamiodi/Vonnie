import express from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { successResponse, errorResponse, notFoundResponse } from '../utils/apiResponse.js';

const router = express.Router();

// Initiate physical POS payment
router.post('/initiate-physical-pos/:bookingId', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const managerId = req.user.id;

    // Get booking details
    const bookingResult = await query(`
      SELECT b.*, s.name as service_name, s.price as service_price
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = $1
    `, [bookingId]);

    if (bookingResult.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Booking', bookingId));
    }

    const booking = bookingResult.rows[0];

    // Check if booking can be paid
    if (booking.payment_status === 'completed') {
      return res.status(400).json(errorResponse('Booking is already paid', 'BOOKING_ALREADY_PAID', 400));
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json(errorResponse('Cannot process payment for cancelled booking', 'CANCELLED_BOOKING_PAYMENT', 400));
    }

    // Generate physical POS reference
    const physicalPosReference = `POS-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Update booking with physical POS payment initiation
    await query(`
      UPDATE bookings 
      SET 
        payment_status = 'pending',
        physical_pos_reference = $1,
        physical_pos_initiated_by = $2,
        physical_pos_initiated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [physicalPosReference, managerId, bookingId]);

    res.json(successResponse({
      booking_id: bookingId,
      booking_number: booking.booking_number,
      physical_pos_reference: physicalPosReference,
      amount: booking.service_price,
      payment_status: 'pending'
    }, 'Physical POS payment initiated successfully'));

  } catch (error) {
    console.error('Initiate physical POS payment error:', error);
    res.status(400).json(errorResponse(error.message, 'INITIATE_PHYSICAL_POS_ERROR', 400));
  }
});

// Confirm physical POS payment
router.post('/confirm-physical-pos/:bookingId', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { payment_reference, notes } = req.body;
    const managerId = req.user.id;

    // Get booking details
    const bookingResult = await query(`
      SELECT b.*, s.name as service_name, s.price as service_price
      FROM bookings b
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.id = $1 AND b.payment_status = 'pending'
    `, [bookingId]);

    if (bookingResult.rows.length === 0) {
      return res.status(404).json(errorResponse('Booking not found or not in pending physical POS status', 'PHYSICAL_POS_BOOKING_NOT_FOUND', 404));
    }

    const booking = bookingResult.rows[0];

    // Update booking payment status
    await query(`
      UPDATE bookings 
      SET 
        payment_status = 'completed',
        payment_method = 'physical_pos',
        payment_reference = $1,
        payment_confirmed_by = $2,
        payment_confirmed_at = CURRENT_TIMESTAMP,
        payment_notes = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [payment_reference, managerId, notes, bookingId]);

    res.json(successResponse({
      booking_id: bookingId,
      booking_number: booking.booking_number,
      payment_status: 'completed',
      payment_reference: payment_reference
    }, 'Physical POS payment confirmed successfully'));

  } catch (error) {
    console.error('Confirm physical POS payment error:', error);
    res.status(400).json({
      success: false,
      error: 'Physical POS payment confirmation failed',
      message: error.message,
      details: {
        booking_id: bookingId,
        payment_reference: payment_reference,
        error_type: error.name,
        stack_trace: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
});

export default router;