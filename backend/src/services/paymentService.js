/**
 * Enhanced Payment Service with fallback confirmation methods
 * Provides multiple verification strategies for reliable payment processing
 */

import { query } from '../config/db.js';
import axios from 'axios';
import crypto from 'crypto';

/**
 * Primary payment verification via Paystack API
 */
export const verifyPaystackPayment = async (reference) => {
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );
    
    return {
      success: response.data.data.status === 'success',
      data: response.data.data,
      method: 'paystack_api'
    };
  } catch (error) {
    console.error('Paystack API verification failed:', error);
    throw new Error('Paystack verification failed');
  }
};

/**
 * Fallback verification via webhook data storage
 * Checks if we received webhook confirmation
 */
export const verifyViaWebhook = async (reference) => {
  try {
    const result = await query(
      `SELECT * FROM payment_webhooks 
       WHERE reference = $1 
       AND event = 'charge.success' 
       AND created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [reference]
    );
    
    if (result.rows.length > 0) {
      return {
        success: true,
        data: result.rows[0],
        method: 'webhook_fallback'
      };
    }
    
    return {
      success: false,
      data: null,
      method: 'webhook_fallback'
    };
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return {
      success: false,
      data: null,
      method: 'webhook_fallback'
    };
  }
};

/**
 * Secondary fallback - check booking payment status directly
 */
export const verifyViaBookingStatus = async (reference) => {
  try {
    const result = await query(
      `SELECT id, booking_number, payment_status, payment_reference, payment_date
       FROM bookings 
       WHERE payment_reference = $1 
       AND payment_status = 'completed'
       LIMIT 1`,
      [reference]
    );
    
    if (result.rows.length > 0) {
      return {
        success: true,
        data: result.rows[0],
        method: 'booking_status_fallback'
      };
    }
    
    return {
      success: false,
      data: null,
      method: 'booking_status_fallback'
    };
  } catch (error) {
    console.error('Booking status verification failed:', error);
    return {
      success: false,
      data: null,
      method: 'booking_status_fallback'
    };
  }
};

/**
 * Enhanced payment verification with multiple fallback methods
 */
export const verifyPaymentWithFallbacks = async (reference) => {
  const verificationAttempts = [];
  
  try {
    // Method 1: Primary Paystack API verification
    const paystackResult = await verifyPaystackPayment(reference);
    verificationAttempts.push(paystackResult);
    
    if (paystackResult.success) {
      return {
        success: true,
        data: paystackResult.data,
        method: paystackResult.method,
        attempts: verificationAttempts
      };
    }
  } catch (error) {
    verificationAttempts.push({
      success: false,
      error: error.message,
      method: 'paystack_api'
    });
  }
  
  try {
    // Method 2: Webhook data fallback
    const webhookResult = await verifyViaWebhook(reference);
    verificationAttempts.push(webhookResult);
    
    if (webhookResult.success) {
      return {
        success: true,
        data: webhookResult.data,
        method: webhookResult.method,
        attempts: verificationAttempts
      };
    }
  } catch (error) {
    verificationAttempts.push({
      success: false,
      error: error.message,
      method: 'webhook_fallback'
    });
  }
  
  try {
    // Method 3: Booking status fallback
    const bookingResult = await verifyViaBookingStatus(reference);
    verificationAttempts.push(bookingResult);
    
    if (bookingResult.success) {
      return {
        success: true,
        data: bookingResult.data,
        method: bookingResult.method,
        attempts: verificationAttempts
      };
    }
  } catch (error) {
    verificationAttempts.push({
      success: false,
      error: error.message,
      method: 'booking_status_fallback'
    });
  }
  
  // All methods failed
  return {
    success: false,
    data: null,
    method: 'all_methods_failed',
    attempts: verificationAttempts
  };
};

/**
 * Store webhook data for fallback verification
 */
export const storeWebhookData = async (webhookData) => {
  try {
    const { event, data } = webhookData;
    const reference = data?.reference;
    
    if (!reference) {
      console.error('No reference in webhook data');
      return false;
    }
    
    await query(
      `INSERT INTO payment_webhooks (event, reference, data, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [event, reference, JSON.stringify(data)]
    );
    
    return true;
  } catch (error) {
    console.error('Error storing webhook data:', error);
    return false;
  }
};

/**
 * Create payment verification log
 */
export const logPaymentVerification = async (reference, result, userId = null) => {
  try {
    await query(
      `INSERT INTO payment_verification_logs 
       (reference, success, method, data, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
      [reference, result.success, result.method, JSON.stringify(result), userId]
    );
  } catch (error) {
    console.error('Error logging payment verification:', error);
  }
};

/**
 * Initialize payment verification table
 */
export const initializePaymentTables = async () => {
  try {
    // Create payment_webhooks table
    await query(`
      CREATE TABLE IF NOT EXISTS payment_webhooks (
        id SERIAL PRIMARY KEY,
        event VARCHAR(100) NOT NULL,
        reference VARCHAR(100) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reference (reference),
        INDEX idx_created_at (created_at)
      )
    `);
    
    // Create payment_verification_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS payment_verification_logs (
        id SERIAL PRIMARY KEY,
        reference VARCHAR(100) NOT NULL,
        success BOOLEAN NOT NULL,
        method VARCHAR(50) NOT NULL,
        data JSONB NOT NULL,
        user_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_reference (reference),
        INDEX idx_created_at (created_at)
      )
    `);
    
    console.log('Payment verification tables initialized');
  } catch (error) {
    console.error('Error initializing payment tables:', error);
  }
};