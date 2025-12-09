import express from 'express';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import { sendWebhookAlert } from '../services/email.js';

const router = express.Router();

const verifyPaystackSignature = (req, secret) => {
  // When using express.raw({ type: 'application/json' }), req.body should be a Buffer.
  // However, if other middleware (like express.json()) runs before this, req.body might already be an object.
  // We need to handle both cases or ensure correct middleware order.
  
  let body = req.body;
  
  if (typeof body !== 'string' && !Buffer.isBuffer(body)) {
    // If body is already parsed (object), we cannot reliably verify the signature
    // because the order of keys might have changed.
    // In a properly configured Express app for webhooks, this route should handle the raw body.
    // If we are here, it means some middleware parsed it. 
    // We'll attempt to stringify it, but this is prone to failure if keys were reordered.
    console.warn('Warning: req.body is not a Buffer/string. Signature verification might fail.');
    body = JSON.stringify(body);
  }

  const hash = crypto
    .createHmac('sha512', secret)
    .update(body)
    .digest('hex');
  return hash === req.headers['x-paystack-signature'];
};

// Use a specific middleware stack for this route to avoid global body parsers interfering
router.post('/paystack-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    
    // Verify the webhook signature
    if (!verifyPaystackSignature(req, PAYSTACK_SECRET_KEY)) {
      console.error('Invalid Paystack signature');
      // Add webhook alert for signature failure
      await sendWebhookAlert('Webhook Signature Verification Failed', {
        error: 'Invalid Paystack signature',
        headers: req.headers,
        body: req.body
      });
      return res.status(401).json(errorResponse('Invalid signature', 'INVALID_SIGNATURE', 401));
    }

    let event;
    if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString('utf8'));
    } else if (typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else {
      // It's already an object (parsed by some upstream middleware)
      event = req.body;
    }

    console.log('Paystack webhook received:', event.event, event.data?.reference);
    console.log('Webhook data:', JSON.stringify(event.data, null, 2));
    
    // Log metadata for debugging
    if (event.data?.metadata) {
      console.log('Metadata found:', JSON.stringify(event.data.metadata, null, 2));
    } else {
      console.log('No metadata found in webhook data');
    }

    // Persist webhook to database for audit and fallback verification
    try {
      await query(
        'INSERT INTO payment_webhooks (event, reference, data) VALUES ($1, $2, $3)',
        [event.event, event.data?.reference, event.data]
      );
      console.log('Webhook logged to database');
    } catch (dbError) {
      console.error('Failed to log webhook to database:', dbError);
      // Continue processing even if logging fails
    }

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
    // Add webhook alert here
    await sendWebhookAlert('Webhook Processing Failure', {
      error: error.message,
      stack: error.stack,
      route: '/api/webhooks/paystack-webhook'
    }, event);
    res.status(500).json(errorResponse('Webhook processing failed', 'WEBHOOK_ERROR', 500));
  }
});

// Handle successful payment
async function handleSuccessfulCharge(data, io) {
  const { reference, amount, customer, metadata } = data;
  
  console.log('Processing successful charge:', { reference, amount, customer, metadata });
  
  try {
    // Check if booking_id exists in metadata
    if (!metadata || !metadata.booking_id) {
      console.warn('Missing booking_id in webhook metadata. Skipping booking update.');
      console.log('Available metadata keys:', metadata ? Object.keys(metadata) : 'No metadata');
      // Add webhook alert for missing booking_id
      await sendWebhookAlert('Missing Booking ID in Webhook', {
        error: 'booking_id missing in webhook metadata',
        reference: reference,
        available_metadata: metadata ? Object.keys(metadata) : 'No metadata',
        metadata: metadata
      });
      return;
    }
    
    console.log('Found booking_id in metadata:', metadata.booking_id);

    // Update booking payment status
    console.log('Attempting to update booking payment status...');
    const result = await query(
      `UPDATE bookings 
       SET payment_status = 'completed', 
           payment_method = 'paystack',
           payment_reference = $1,
           payment_date = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND payment_status != 'completed'
       RETURNING id, status, customer_type, scheduled_time`,
      [reference, metadata.booking_id]
    );

    console.log('Update result:', { rowCount: result.rowCount, rows: result.rows });

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
      
      // Emit socket event for real-time update
      if (io) {
        console.log(`🔌 Emitting payment-verified event for booking ${metadata.booking_id}`);
        io.emit('payment-verified', {
          success: true,
          booking_id: metadata.booking_id,
          reference: reference,
          amount: amount,
          status: 'completed'
        });
      }

      // Send confirmation email/notification
      // await sendBookingConfirmation(metadata.booking_id);
    } else {
      console.log('No booking updated. Possible reasons:');
      console.log('- Booking ID not found:', metadata.booking_id);
      console.log('- Booking payment status is already completed');
      console.log('- Booking does not exist');
      
      // Even if update failed (e.g. already completed), emit event so UI can update
      if (io) {
        console.log(`🔌 Emitting payment-verified event (duplicate) for booking ${metadata.booking_id}`);
        io.emit('payment-verified', {
          success: true,
          booking_id: metadata.booking_id,
          reference: reference,
          amount: amount,
          status: 'completed',
          duplicate: true
        });
      }

      // Add webhook alert for no booking update
      await sendWebhookAlert('No Booking Updated After Payment', {
        error: 'No booking was updated after successful payment',
        booking_id: metadata.booking_id,
        reference: reference,
        possible_reasons: ['Booking ID not found', 'Payment status already completed', 'Booking does not exist']
      });
    }
  } catch (error) {
    console.error('Error processing successful charge:', error);
    // Add webhook alert for successful charge processing failure
    await sendWebhookAlert('Successful Charge Processing Failure', {
      error: error.message,
      stack: error.stack,
      reference: reference,
      booking_id: metadata?.booking_id
    });
  }
}

// Handle failed payment
async function handleFailedCharge(data, io) {
  const { reference, metadata } = data;
  
  try {
    // Check if booking_id exists in metadata, if so use it to find the booking
    if (metadata && metadata.booking_id) {
        await query(
            `UPDATE bookings 
             SET payment_status = 'failed',
                 payment_updated_at = NOW()
             WHERE id = $1`,
            [metadata.booking_id]
        );
        console.log('Payment failed recorded for booking:', metadata.booking_id);
        
        // Emit socket event for failed payment
        if (io) {
          console.log(`🔌 Emitting payment-failed event for booking ${metadata.booking_id}`);
          io.emit('payment-failed', {
            success: false,
            booking_id: metadata.booking_id,
            reference: reference,
            status: 'failed'
          });
        }
    } else {
        // Fallback to updating by payment_reference if booking_id is missing (less reliable if reference wasn't saved yet)
        await query(
        `UPDATE bookings 
        SET payment_status = 'failed',
            payment_updated_at = NOW()
        WHERE payment_reference = $1`,
        [reference]
        );
        console.log('Payment failed recorded by reference:', reference);
    }

  } catch (error) {
    console.error('Error processing failed charge:', error);
    // Add webhook alert for failed charge processing failure
    await sendWebhookAlert('Failed Charge Processing Failure', {
      error: error.message,
      stack: error.stack,
      reference: reference
    });
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
