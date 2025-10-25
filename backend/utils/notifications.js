import nodemailer from 'nodemailer'
import { sql } from '../config/database.js'

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

/**
 * Send booking confirmation email to guest customer
 * @param {Object} booking - Booking details with all related information
 * @returns {Promise<Object>} - Result of email sending operation
 */
export const sendGuestBookingConfirmation = async (booking) => {
  try {
    if (!booking.guest_email) {
      throw new Error('Guest email is required for booking confirmation')
    }

    // Format date and time
    const appointmentDate = new Date(booking.appointment_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const appointmentTime = booking.appointment_time

    // Prepare email content
    const emailSubject = `Booking Confirmation - ${booking.service_name} | ${booking.booking_number}`
    
    const textMessage = `Hi ${booking.guest_name}!\n\n` +
      `Thank you for booking with ${process.env.BUSINESS_NAME || 'Vonne X2x'}!\n\n` +
      `Your booking has been confirmed with the following details:\n\n` +
      `Booking Number: ${booking.booking_number}\n` +
      `Service: ${booking.service_name}\n` +
      `Date: ${appointmentDate}\n` +
      `Time: ${appointmentTime}\n` +
      `Stylist: ${booking.staff_name}\n` +
      `Duration: ${booking.service_duration} minutes\n` +
      `Total Amount: ₦${booking.total_amount.toLocaleString()}\n\n` +
      `Important Notes:\n` +
      `• Please save your booking number: ${booking.booking_number}\n` +
      `• Arrive 10 minutes before your scheduled time\n` +
      `• Our team will contact you within 24 hours to confirm payment details\n` +
      `• If you need to reschedule, please contact us as soon as possible\n\n` +
      `We look forward to serving you!\n\n` +
      `Best regards,\n` +
      `${process.env.BUSINESS_NAME || 'Vonne X2x'} Team`

    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #d4af37; margin-bottom: 10px;">${process.env.BUSINESS_NAME || 'Vonne X2x'}</h1>
          <h2 style="color: #333; margin: 0;">Booking Confirmation</h2>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 24px; font-weight: bold; color: #d4af37; margin-bottom: 5px;">
              ${booking.booking_number}
            </div>
            <div style="color: #666; font-size: 14px;">Your Booking Number</div>
          </div>
        </div>

        <p style="color: #333; font-size: 16px;">Hi ${booking.guest_name}!</p>
        <p style="color: #333;">Thank you for booking with us! Your appointment has been confirmed with the following details:</p>
        
        <div style="background-color: #fff; border: 2px solid #d4af37; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Service:</td>
              <td style="padding: 8px 0; color: #333; font-weight: bold;">${booking.service_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Date:</td>
              <td style="padding: 8px 0; color: #333; font-weight: bold;">${appointmentDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Time:</td>
              <td style="padding: 8px 0; color: #333; font-weight: bold;">${appointmentTime}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Stylist:</td>
              <td style="padding: 8px 0; color: #333; font-weight: bold;">${booking.staff_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; font-weight: 500;">Duration:</td>
              <td style="padding: 8px 0; color: #333; font-weight: bold;">${booking.service_duration} minutes</td>
            </tr>
            <tr style="border-top: 1px solid #eee;">
              <td style="padding: 12px 0 8px 0; color: #666; font-weight: 500;">Total Amount:</td>
              <td style="padding: 12px 0 8px 0; color: #d4af37; font-weight: bold; font-size: 18px;">₦${booking.total_amount.toLocaleString()}</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
          <h3 style="color: #1976d2; margin: 0 0 10px 0; font-size: 16px;">Important Notes:</h3>
          <ul style="color: #333; margin: 0; padding-left: 20px;">
            <li>Please save your booking number: <strong>${booking.booking_number}</strong></li>
            <li>Arrive 10 minutes before your scheduled time</li>
            <li>Our team will contact you within 24 hours to confirm payment details</li>
            <li>If you need to reschedule, please contact us as soon as possible</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #333; font-size: 16px;">We look forward to serving you!</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <div style="text-align: center; color: #666; font-size: 14px;">
          <p style="margin: 5px 0;"><strong>${process.env.BUSINESS_NAME || 'Vonne X2x'}</strong></p>
          <p style="margin: 5px 0;">${process.env.BUSINESS_ADDRESS || '123 Beauty Street, Victoria Island, Lagos'}</p>
          <p style="margin: 5px 0;">Phone: ${process.env.BUSINESS_PHONE || '+234 801 234 5678'}</p>
          <p style="margin: 5px 0;">Email: ${process.env.BUSINESS_EMAIL || 'info@vonnex2x.com'}</p>
        </div>
      </div>
    `

    // Send email
    const emailResult = await emailTransporter.sendMail({
      from: `"${process.env.BUSINESS_NAME || 'Vonne X2x'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: booking.guest_email,
      subject: emailSubject,
      text: textMessage,
      html: htmlMessage,
    })

    // Log notification in database
    try {
      await sql`
        INSERT INTO notifications (
          type, recipient, subject, message, status, external_id,
          guest_customer_id, booking_id, sent_at
        ) VALUES (
          'email', ${booking.guest_email}, ${emailSubject}, ${textMessage}, 'sent', ${emailResult.messageId},
          ${booking.guest_customer_id}, ${booking.id}, ${new Date().toISOString()}
        )
      `
    } catch (dbError) {
      console.error('Failed to log email notification:', dbError)
    }

    return {
      success: true,
      messageId: emailResult.messageId,
      message: 'Booking confirmation email sent successfully'
    }

  } catch (error) {
    console.error('Failed to send booking confirmation email:', error)
    
    // Log failed notification
    try {
      await sql`
        INSERT INTO notifications (
          type, recipient, subject, message, status, error_message,
          guest_customer_id, booking_id, sent_at
        ) VALUES (
          'email', ${booking.guest_email || 'unknown'}, 'Booking Confirmation', 'Failed to send', 'failed', ${error.message},
          ${booking.guest_customer_id || null}, ${booking.id || null}, ${new Date().toISOString()}
        )
      `
    } catch (dbError) {
      console.error('Failed to log failed notification:', dbError)
    }

    return {
      success: false,
      error: error.message,
      message: 'Failed to send booking confirmation email'
    }
  }
}

/**
 * Send SMS notification (currently disabled)
 * @param {string} phone - Phone number
 * @param {string} message - SMS message
 * @returns {Promise<Object>} - Result indicating SMS is disabled
 */
export const sendSMS = async (phone, message) => {
  return {
    success: false,
    error: 'SMS service not available',
    message: 'SMS notifications are currently disabled. Please use email notifications instead.'
  }
}