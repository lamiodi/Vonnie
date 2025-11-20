import express from 'express';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = express.Router();

// Verify Paystack signature
const verifyPaystackSignature = (req, secret) => {
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return hash === req.headers['x-paystack-signature'];
};

// Paystack webhook handler
router.post('/paystack-webhook', express.json({ type: 'application/json' }), async (req, res) => {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    
    // Verify the webhook signature
    if (!verifyPaystackSignature(req, PAYSTACK_SECRET_KEY)) {
      console.error('Invalid Paystack signature');
      return res.status(401).json(errorResponse('Invalid signature', 'INVALID_SIGNATURE', 401));
    }

    const event = req.body;
    console.log('Paystack webhook received:', event.event, event.data.reference);

    // Handle different event types
    switch (event.event) {
      case 'charge.success':
        await handleSuccessfulCharge(event.data);
        break;
      
      case 'charge.failed':
        await handleFailedCharge(event.data);
        break;
      
      case 'transfer.success':
        await handleTransferSuccess(event.data);
        break;
      
      case 'transfer.failed':
        await handleTransferFailure(event.data);
        break;
      
      default:
        console.log('Unhandled Paystack event:', event.event);
    }

    res.json(successResponse({ received: true }, 'Webhook processed successfully'));
  } catch (error) {
    console.error('Paystack webhook error:', error);
    res.status(500).json(errorResponse('Webhook processing failed', 'WEBHOOK_ERROR', 500));
  }
});

// Handle successful payment
async function handleSuccessfulCharge(data) {
  const { reference, amount, customer, metadata } = data;
  
  try {
    // Update booking payment status
    const result = await query(
      `UPDATE bookings 
       SET payment_status = 'completed', 
           payment_method = 'paystack',
           payment_reference = $1,
           payment_date = NOW(),
           payment_updated_at = NOW()
       WHERE id = $2 AND payment_status = 'pending'
       RETURNING id, status, customer_type, scheduled_time`,
      [reference, metadata?.booking_id]
    );

    if (result.rows.length > 0) {
      console.log('Payment confirmed for booking:', metadata.booking_id);
      
      // Auto-complete the service since payment is completed (Nigeria salon workflow)
      // Walk-in customers: service-before-payment, so auto-complete after payment
      // Pre-booked customers: payment-before-service, so no auto-completion (service happens later)
      const updatedBooking = result.rows[0];
      if (updatedBooking.customer_type === 'walk_in') {
        // For walk-in customers, auto-complete the service after payment confirmation
        await query(
          'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', metadata.booking_id]
        );
        console.log(`Auto-completed walk-in booking ${metadata.booking_id} after payment confirmation`);
      } else if (updatedBooking.customer_type === 'pre_booked') {
        // For pre-booked customers, only confirm payment but don't auto-complete
        // They will receive service at their scheduled time
        console.log(`Pre-booked customer payment confirmed for booking ${metadata.booking_id} - no auto-completion`);
      }
      
      // Send confirmation email/notification
      // await sendBookingConfirmation(metadata.booking_id);
    }
  } catch (error) {
    console.error('Error processing successful charge:', error);
  }
}

// Handle failed payment
async function handleFailedCharge(data) {
  const { reference, metadata } = data;
  
  try {
    await query(
      `UPDATE bookings 
       SET payment_status = 'failed',
           payment_updated_at = NOW()
       WHERE payment_reference = $1`,
      [reference]
    );
    
    console.log('Payment failed for reference:', reference);
  } catch (error) {
    console.error('Error processing failed charge:', error);
  }
}

// Handle transfer success
async function handleTransferSuccess(data) {
  console.log('Transfer successful:', data.reference);
  // Implement transfer success logic if needed
}

// Handle transfer failure  
async function handleTransferFailure(data) {
  console.log('Transfer failed:', data.reference);
  // Implement transfer failure logic if needed
}

export default router;