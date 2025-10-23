import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js'
import nodemailer from 'nodemailer'
import axios from 'axios'

const router = express.Router()

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

// SMS notification endpoint (disabled - Twilio integration removed)
router.post('/sms', authenticateToken, requireStaff, async(req, res) => {
  res.status(501).json({ 
    error: 'SMS service not available', 
    message: 'SMS notifications are currently disabled. Please use email notifications instead.', 
  })
})

// WhatsApp notification endpoint (disabled - Twilio integration removed)
router.post('/whatsapp', authenticateToken, requireStaff, async(req, res) => {
  res.status(501).json({ 
    error: 'WhatsApp service not available', 
    message: 'WhatsApp notifications are currently disabled. Please use email notifications instead.', 
  })
})

// Send email notification
router.post('/email', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { to, subject, message, html, guest_customer_id, booking_id, transaction_id } = req.body

    if (!to || !subject || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'Email address, subject, and message are required', 
      })
    }

    // Prepare email options
    const mailOptions = {
      from: `"${process.env.BUSINESS_NAME}" <${process.env.EMAIL_FROM}>`,
      to: to,
      subject: subject,
      text: message,
      html: html || `<p>${message.replace(/\n/g, '<br>')}</p>`,
    }

    // Send email
    const emailResult = await emailTransporter.sendMail(mailOptions)

    // Log notification in database
    let notification
    try {
      notification = await sql`
        INSERT INTO notifications (
          type, recipient, subject, message, status, external_id, 
          customer_id, booking_id, transaction_id, sent_by, sent_at
        ) VALUES (
          'email', ${to}, ${subject}, ${message}, 'sent', ${emailResult.messageId},
          ${req.body.customer_id || null}, ${booking_id || null}, ${transaction_id || null}, ${req.user.id}, ${new Date().toISOString()}
        )
        RETURNING *
      `
    } catch (dbError) {
      console.error('Failed to log email notification:', dbError)
    }

    res.json({
      message: 'Email sent successfully',
      notification_id: notification?.id,
      external_id: emailResult.messageId,
    })
  } catch (error) {
    console.error('Email sending error:', error)
    
    // Log failed notification
    try {
      await sql`
        INSERT INTO notifications (
          type, recipient, subject, message, status, error_message,
          guest_customer_id, booking_id, transaction_id, sent_by, sent_at
        ) VALUES (
          'email', ${req.body.to}, ${req.body.subject}, ${req.body.message}, 'failed', ${error.message},
          ${req.body.guest_customer_id || null}, ${req.body.booking_id || null}, ${req.body.transaction_id || null}, ${req.user.id}, ${new Date().toISOString()}
        )
      `
    } catch (dbError) {
      console.error('Failed to log failed notification:', dbError)
    }

    res.status(500).json({ 
      error: 'Failed to send email', 
      message: error.message, 
    })
  }
})

// Send booking confirmation
router.post('/booking-confirmation', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { booking_id } = req.body

    if (!booking_id) {
      return res.status(400).json({ 
        error: 'Missing booking ID', 
        message: 'Booking ID is required', 
      })
    }

    // Get booking details with PostgreSQL
    let booking
    try {
      booking = await sql`
        SELECT 
          b.*,
          gc.first_name as customer_first_name,
          gc.last_name as customer_last_name,
          gc.email as customer_email,
          gc.phone as customer_phone,
          p.first_name as staff_first_name,
          p.last_name as staff_last_name,
          s.name as service_name,
          s.category as service_category,
          s.price as service_price,
          s.duration as service_duration
        FROM bookings b
        LEFT JOIN guest_customers gc ON b.guest_customer_id = gc.id
        LEFT JOIN profiles p ON b.staff_id = p.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.id = ${booking_id}
      `
      
      if (!booking || booking.length === 0) {
        return res.status(404).json({ 
          error: 'Booking not found', 
          message: 'Invalid booking ID', 
        })
      }
      
      booking = booking[0]
    } catch (bookingError) {
      console.error('Failed to fetch booking:', bookingError)
      return res.status(500).json({ 
        error: 'Database error', 
        message: bookingError.message, 
      })
    }

    const customer = {
      first_name: booking.customer_first_name,
      last_name: booking.customer_last_name,
      email: booking.customer_email,
      phone: booking.customer_phone,
      id: booking.guest_customer_id,
    }
    const service = {
      name: booking.service_name,
      category: booking.service_category,
      price: booking.service_price,
      duration: booking.service_duration,
    }
    const staff = {
      first_name: booking.staff_first_name,
      last_name: booking.staff_last_name,
    }

    // Prepare confirmation message
    const message = `Hi ${customer.first_name}! Your appointment has been confirmed:\n\n` +
      `Service: ${service.name}\n` +
      `Date: ${new Date(booking.booking_date).toLocaleDateString()}\n` +
      `Time: ${booking.booking_time}\n` +
      `Staff: ${staff.first_name} ${staff.last_name}\n` +
      `Price: ₦${service.price.toLocaleString()}\n\n` +
      'Please arrive 10 minutes early. Contact us if you need to reschedule.\n\n' +
      `Thank you for choosing ${process.env.BUSINESS_NAME}!`

    const emailSubject = `Appointment Confirmed - ${service.name}`
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d4af37;">Appointment Confirmed</h2>
        <p>Hi ${customer.first_name}!</p>
        <p>Your appointment has been confirmed with the following details:</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Service:</strong> ${service.name}</p>
          <p><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${booking.booking_time}</p>
          <p><strong>Staff:</strong> ${staff.first_name} ${staff.last_name}</p>
          <p><strong>Price:</strong> ₦${service.price.toLocaleString()}</p>
        </div>
        <p>Please arrive 10 minutes early for your appointment.</p>
        <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
        <p>Thank you for choosing ${process.env.BUSINESS_NAME}!</p>
        <hr style="margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          ${process.env.BUSINESS_NAME}<br>
          ${process.env.BUSINESS_ADDRESS}<br>
          ${process.env.BUSINESS_PHONE}
        </p>
      </div>
    `

    const notifications = []

    // Send SMS if phone number is available
    if (customer.phone) {
      try {
        let formattedPhone = customer.phone.replace(/\s+/g, '')
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+234' + formattedPhone.substring(1)
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+234' + formattedPhone
        }

        // SMS sending disabled - Twilio integration removed
        console.warn('SMS sending disabled: Twilio integration has been removed')
        
        notifications.push({ type: 'sms', status: 'disabled', error: 'SMS service not available' })
      } catch (smsError) {
        console.error('SMS sending failed:', smsError)
        notifications.push({ type: 'sms', status: 'failed', error: smsError.message })
      }
    }

    // Send email if email address is available
    if (customer.email) {
      try {
        const emailResult = await emailTransporter.sendMail({
          from: `"${process.env.BUSINESS_NAME}" <${process.env.EMAIL_FROM}>`,
          to: customer.email,
          subject: emailSubject,
          text: message,
          html: emailHtml,
        })

        let emailNotification
        try {
          emailNotification = await sql`
            INSERT INTO notifications (
              type, recipient, subject, message, status, external_id,
              customer_id, booking_id, sent_by, sent_at
            ) VALUES (
              'email', ${customer.email}, ${emailSubject}, ${message}, 'sent', ${emailResult.messageId},
              ${customer.id}, ${booking_id}, ${req.user.id}, ${new Date().toISOString()}
            )
            RETURNING *
          `
        } catch (dbError) {
          console.error('Failed to log email notification:', dbError)
        }

        notifications.push({ type: 'email', status: 'sent', id: emailNotification?.id })
      } catch (emailError) {
        console.error('Email sending failed:', emailError)
        notifications.push({ type: 'email', status: 'failed', error: emailError.message })
      }
    }

    res.json({
      message: 'Booking confirmation sent',
      booking_id: booking_id,
      notifications: notifications,
    })
  } catch (error) {
    console.error('Booking confirmation error:', error)
    res.status(500).json({ 
      error: 'Failed to send booking confirmation', 
      message: error.message, 
    })
  }
})

// Send booking reminder
router.post('/booking-reminder', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { booking_id, hours_before = 24 } = req.body

    if (!booking_id) {
      return res.status(400).json({ 
        error: 'Missing booking ID', 
        message: 'Booking ID is required', 
      })
    }

    // Get booking details with PostgreSQL
    let booking
    try {
      booking = await sql`
        SELECT 
          b.*,
          gc.first_name as customer_first_name,
          gc.last_name as customer_last_name,
          gc.email as customer_email,
          gc.phone as customer_phone,
          p.first_name as staff_first_name,
          p.last_name as staff_last_name,
          s.name as service_name,
          s.category as service_category,
          s.price as service_price,
          s.duration as service_duration
        FROM bookings b
        LEFT JOIN guest_customers gc ON b.guest_customer_id = gc.id
        LEFT JOIN profiles p ON b.staff_id = p.id
        LEFT JOIN services s ON b.service_id = s.id
        WHERE b.id = ${booking_id}
      `
      
      if (!booking || booking.length === 0) {
        return res.status(404).json({ 
          error: 'Booking not found', 
          message: 'Invalid booking ID', 
        })
      }
      
      booking = booking[0]
    } catch (bookingError) {
      console.error('Failed to fetch booking:', bookingError)
      return res.status(500).json({ 
        error: 'Database error', 
        message: bookingError.message, 
      })
    }

    const customer = {
      first_name: booking.customer_first_name,
      last_name: booking.customer_last_name,
      email: booking.customer_email,
      phone: booking.customer_phone,
      id: booking.guest_customer_id,
    }
    const service = {
      name: booking.service_name,
      category: booking.service_category,
      price: booking.service_price,
      duration: booking.service_duration,
    }
    const staff = {
      first_name: booking.staff_first_name,
      last_name: booking.staff_last_name,
    }

    // Prepare reminder message
    const message = `Hi ${customer.first_name}! This is a reminder about your upcoming appointment:\n\n` +
      `Service: ${service.name}\n` +
      `Date: ${new Date(booking.booking_date).toLocaleDateString()}\n` +
      `Time: ${booking.booking_time}\n` +
      `Staff: ${staff.first_name} ${staff.last_name}\n\n` +
      'Please arrive 10 minutes early. Contact us if you need to reschedule or cancel.\n\n' +
      `See you soon at ${process.env.BUSINESS_NAME}!`

    const emailSubject = `Appointment Reminder - ${service.name}`
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d4af37;">Appointment Reminder</h2>
        <p>Hi ${customer.first_name}!</p>
        <p>This is a friendly reminder about your upcoming appointment:</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Service:</strong> ${service.name}</p>
          <p><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${booking.booking_time}</p>
          <p><strong>Staff:</strong> ${staff.first_name} ${staff.last_name}</p>
        </div>
        <p>Please arrive 10 minutes early for your appointment.</p>
        <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
        <p>We look forward to seeing you at ${process.env.BUSINESS_NAME}!</p>
        <hr style="margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          ${process.env.BUSINESS_NAME}<br>
          ${process.env.BUSINESS_ADDRESS}<br>
          ${process.env.BUSINESS_PHONE}
        </p>
      </div>
    `

    const notifications = []

    // Send email reminder if email is available
    if (customer.email) {
      try {
        const mailOptions = {
          from: `"${process.env.BUSINESS_NAME}" <${process.env.EMAIL_FROM}>`,
          to: customer.email,
          subject: emailSubject,
          text: message,
          html: emailHtml,
        }

        const emailResult = await emailTransporter.sendMail(mailOptions)

        const emailNotificationResult = await sql`
          INSERT INTO notifications (
            type, recipient, subject, message, status, external_id,
            customer_id, booking_id, sent_by, sent_at
          ) VALUES (
            'email', ${customer.email}, ${emailSubject}, ${message}, 'sent', ${emailResult.messageId},
            ${customer.id}, ${booking_id}, ${req.user.id}, ${new Date().toISOString()}
          )
          RETURNING id
        `

        notifications.push({ type: 'email', status: 'sent', id: emailNotificationResult[0]?.id })
      } catch (emailError) {
        console.error('Email reminder failed:', emailError)
        notifications.push({ type: 'email', status: 'failed', error: emailError.message })
      }
    }

    res.json({
      message: 'Booking reminder sent',
      booking_id: booking_id,
      notifications: notifications,
    })
  } catch (error) {
    console.error('Booking reminder error:', error)
    res.status(500).json({ 
      error: 'Failed to send booking reminder', 
      message: error.message, 
    })
  }
})

// Send payment receipt
router.post('/payment-receipt', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { transaction_id } = req.body

    if (!transaction_id) {
      return res.status(400).json({ 
        error: 'Missing transaction ID', 
        message: 'Transaction ID is required', 
      })
    }

    // Get transaction details with PostgreSQL
    let transaction
    try {
      transaction = await sql`
        SELECT 
          t.*,
          gc.first_name as customer_first_name,
          gc.last_name as customer_last_name,
          gc.email as customer_email,
          gc.phone as customer_phone,
          p.first_name as staff_first_name,
          p.last_name as staff_last_name
        FROM transactions t
        LEFT JOIN guest_customers gc ON t.guest_customer_id = gc.id
        LEFT JOIN profiles p ON t.staff_id = p.id
        WHERE t.id = ${transaction_id}
      `
      
      if (!transaction || transaction.length === 0) {
        return res.status(404).json({ 
          error: 'Transaction not found', 
          message: 'Invalid transaction ID', 
        })
      }
      
      transaction = transaction[0]
      
      // Get transaction items with service/product details
      const itemsResult = await sql`
        SELECT 
          ti.*,
          COALESCE(s.name, p.name) as item_name,
          COALESCE(s.category, p.category) as item_category,
          p.sku as product_sku
        FROM transaction_items ti
        LEFT JOIN services s ON ti.service_id = s.id
        LEFT JOIN products p ON ti.product_id = p.id
        WHERE ti.transaction_id = ${transaction_id}
      `
      
      transaction.transaction_items = itemsResult
    } catch (transactionError) {
      console.error('Failed to fetch transaction:', transactionError)
      return res.status(500).json({ 
        error: 'Database error', 
        message: transactionError.message, 
      })
    }

    const customer = {
      first_name: transaction.customer_first_name,
      last_name: transaction.customer_last_name,
      email: transaction.customer_email,
      phone: transaction.customer_phone,
      id: transaction.guest_customer_id,
    }
    const staff = {
      first_name: transaction.staff_first_name,
      last_name: transaction.staff_last_name,
    }
    const items = transaction.transaction_items

    // Prepare receipt message
    let itemsList = ''
    items.forEach(item => {
      const itemName = item.service?.name || item.product?.name || 'Unknown Item'
      itemsList += `${item.quantity}x ${itemName} - ₦${item.total_price.toLocaleString()}\n`
    })

    const message = `Hi ${customer.first_name}! Thank you for your payment. Here's your receipt:\n\n` +
      `Receipt #: ${transaction.id.substring(0, 8).toUpperCase()}\n` +
      `Date: ${new Date(transaction.created_at).toLocaleDateString()}\n` +
      `Staff: ${staff.first_name} ${staff.last_name}\n\n` +
      `Items:\n${itemsList}\n` +
      `Subtotal: ₦${transaction.subtotal.toLocaleString()}\n` +
      (transaction.discount_amount > 0 ? `Discount: -₦${transaction.discount_amount.toLocaleString()}\n` : '') +
      (transaction.tax_amount > 0 ? `Tax: ₦${transaction.tax_amount.toLocaleString()}\n` : '') +
      `Total: ₦${transaction.total_amount.toLocaleString()}\n` +
      `Payment: ${transaction.payment_method.toUpperCase()}\n\n` +
      `Thank you for choosing ${process.env.BUSINESS_NAME}!`

    const emailSubject = `Payment Receipt - ${process.env.BUSINESS_NAME}`
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d4af37;">Payment Receipt</h2>
        <p>Hi ${customer.first_name}!</p>
        <p>Thank you for your payment. Here's your receipt:</p>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Receipt #:</strong> ${transaction.id.substring(0, 8).toUpperCase()}</p>
          <p><strong>Date:</strong> ${new Date(transaction.created_at).toLocaleDateString()}</p>
          <p><strong>Staff:</strong> ${staff.first_name} ${staff.last_name}</p>
          <hr>
          <h4>Items:</h4>
          ${items.map(item => {
    const itemName = item.service?.name || item.product?.name || 'Unknown Item'
    return `<p>${item.quantity}x ${itemName} - ₦${item.total_price.toLocaleString()}</p>`
  }).join('')}
          <hr>
          <p><strong>Subtotal:</strong> ₦${transaction.subtotal.toLocaleString()}</p>
          ${transaction.discount_amount > 0 ? `<p><strong>Discount:</strong> -₦${transaction.discount_amount.toLocaleString()}</p>` : ''}
          ${transaction.tax_amount > 0 ? `<p><strong>Tax:</strong> ₦${transaction.tax_amount.toLocaleString()}</p>` : ''}
          <p style="font-size: 18px;"><strong>Total:</strong> ₦${transaction.total_amount.toLocaleString()}</p>
          <p><strong>Payment Method:</strong> ${transaction.payment_method.toUpperCase()}</p>
        </div>
        <p>Thank you for choosing ${process.env.BUSINESS_NAME}!</p>
        <hr style="margin: 30px 0;">
        <p style="font-size: 12px; color: #666;">
          ${process.env.BUSINESS_NAME}<br>
          ${process.env.BUSINESS_ADDRESS}<br>
          ${process.env.BUSINESS_PHONE}
        </p>
      </div>
    `

    const notifications = []

    // Send SMS receipt if phone number is available
    if (customer.phone) {
      try {
        let formattedPhone = customer.phone.replace(/\s+/g, '')
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+234' + formattedPhone.substring(1)
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+234' + formattedPhone
        }

        // SMS sending disabled - Twilio integration removed
        console.warn('SMS sending disabled: Twilio integration has been removed')
        
        notifications.push({ type: 'sms', status: 'disabled', error: 'SMS service not available' })
      } catch (smsError) {
        console.error('SMS receipt failed:', smsError)
        notifications.push({ type: 'sms', status: 'failed', error: smsError.message })
      }
    }

    // Send email receipt if email address is available
    if (customer.email) {
      try {
        const emailResult = await emailTransporter.sendMail({
          from: `"${process.env.BUSINESS_NAME}" <${process.env.EMAIL_FROM}>`,
          to: customer.email,
          subject: emailSubject,
          text: message,
          html: emailHtml,
        })

        const emailNotificationResult = await sql`
          INSERT INTO notifications (
            type, recipient, subject, message, status, external_id, 
            customer_id, transaction_id, sent_by, sent_at
          ) VALUES (
            'email', ${customer.email}, ${emailSubject}, ${message}, 'sent', ${emailResult.messageId},
            ${customer.id}, ${transaction_id}, ${req.user.id}, ${new Date().toISOString()}
          ) RETURNING *
        `
        const emailNotification = emailNotificationResult.rows[0]

        notifications.push({ type: 'email', status: 'sent', id: emailNotification?.id })
      } catch (emailError) {
        console.error('Email receipt failed:', emailError)
        notifications.push({ type: 'email', status: 'failed', error: emailError.message })
      }
    }

    res.json({
      message: 'Payment receipt sent',
      transaction_id: transaction_id,
      notifications: notifications,
    })
  } catch (error) {
    console.error('Payment receipt error:', error)
    res.status(500).json({ 
      error: 'Failed to send payment receipt', 
      message: error.message, 
    })
  }
})

// Get notification history
router.get('/history', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { page = 1, limit = 20, type, status, guest_customer_id } = req.query
    const offset = (page - 1) * limit

    // Build base query with joins
    let baseQuery = sql`
      SELECT 
        n.*,
        gc.first_name as guest_customer_first_name,
        gc.last_name as guest_customer_last_name,
        gc.email as guest_customer_email,
        gc.phone as guest_customer_phone,
        p.first_name as sent_by_first_name,
        p.last_name as sent_by_last_name
      FROM notifications n
      LEFT JOIN guest_customers gc ON n.guest_customer_id = gc.id
      LEFT JOIN profiles p ON n.sent_by = p.id
      WHERE 1=1
    `

    // Apply filters
    if (type) {
      baseQuery = sql`${baseQuery} AND n.type = ${type}`
    }
    if (status) {
      baseQuery = sql`${baseQuery} AND n.status = ${status}`
    }
    if (guest_customer_id) {
      baseQuery = sql`${baseQuery} AND n.guest_customer_id = ${guest_customer_id}`
    }

    // Role-based filtering
    if (req.user.role === 'staff') {
      baseQuery = sql`${baseQuery} AND n.sent_by = ${req.user.id}`
    }

    // Get total count
    const countQuery = sql`SELECT COUNT(*) FROM (${baseQuery}) as filtered`
    const countResult = await countQuery
    const totalCount = parseInt(countResult.rows[0].count)

    // Get paginated results
    const notificationsQuery = sql`
      ${baseQuery}
      ORDER BY n.sent_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    const notificationsResult = await notificationsQuery
    const notifications = notificationsResult.rows

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Notification history error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get notification templates (Admin only)
router.get('/templates', authenticateToken, requireAdmin, async(req, res) => {
  try {
    const templates = {
      booking_confirmation: {
        name: 'Booking Confirmation',
        sms: 'Hi {customer_name}! Your appointment for {service_name} on {date} at {time} has been confirmed. Staff: {staff_name}. See you soon!',
        email: {
          subject: 'Appointment Confirmed - {service_name}',
          body: 'Your appointment has been confirmed with the following details...',
        },
      },
      booking_reminder: {
        name: 'Booking Reminder',
        sms: 'Hi {customer_name}! Reminder: You have an appointment for {service_name} tomorrow at {time}. Please arrive 10 minutes early.',
        email: {
          subject: 'Appointment Reminder - {service_name}',
          body: 'This is a reminder about your upcoming appointment...',
        },
      },
      payment_receipt: {
        name: 'Payment Receipt',
        sms: 'Thank you for your payment! Receipt #{receipt_number}. Total: ₦{amount}. Items: {items}',
        email: {
          subject: 'Payment Receipt - {business_name}',
          body: 'Thank you for your payment. Here is your receipt...',
        },
      },
      promotional: {
        name: 'Promotional Message',
        sms: 'Hi {customer_name}! Special offer: {offer_details}. Valid until {expiry_date}. Book now!',
        email: {
          subject: 'Special Offer - {business_name}',
          body: 'We have a special offer just for you...',
        },
      },
    }

    res.json({ templates })
  } catch (error) {
    console.error('Templates fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router