const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const axios = require('axios');

const router = express.Router();

// Initialize email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// SMS notification endpoint (disabled - Twilio integration removed)
router.post('/sms', authenticateToken, requireStaff, async (req, res) => {
  res.status(501).json({ 
    error: 'SMS service not available', 
    message: 'SMS notifications are currently disabled. Please use email notifications instead.' 
  });
});

// WhatsApp notification endpoint (disabled - Twilio integration removed)
router.post('/whatsapp', authenticateToken, requireStaff, async (req, res) => {
  res.status(501).json({ 
    error: 'WhatsApp service not available', 
    message: 'WhatsApp notifications are currently disabled. Please use email notifications instead.' 
  });
});

// Send email notification
router.post('/email', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { to, subject, message, html, customer_id, booking_id, transaction_id } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        message: 'Email address, subject, and message are required' 
      });
    }

    // Prepare email options
    const mailOptions = {
      from: `"${process.env.BUSINESS_NAME}" <${process.env.EMAIL_FROM}>`,
      to: to,
      subject: subject,
      text: message,
      html: html || `<p>${message.replace(/\n/g, '<br>')}</p>`
    };

    // Send email
    const emailResult = await emailTransporter.sendMail(mailOptions);

    // Log notification in database
    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert({
        type: 'email',
        recipient: to,
        subject: subject,
        message: message,
        status: 'sent',
        external_id: emailResult.messageId,
        customer_id: customer_id || null,
        booking_id: booking_id || null,
        transaction_id: transaction_id || null,
        sent_by: req.user.id,
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('Failed to log email notification:', dbError);
    }

    res.json({
      message: 'Email sent successfully',
      notification_id: notification?.id,
      external_id: emailResult.messageId
    });
  } catch (error) {
    console.error('Email sending error:', error);
    
    // Log failed notification
    await supabase
      .from('notifications')
      .insert({
        type: 'email',
        recipient: req.body.to,
        subject: req.body.subject,
        message: req.body.message,
        status: 'failed',
        error_message: error.message,
        customer_id: req.body.customer_id || null,
        booking_id: req.body.booking_id || null,
        transaction_id: req.body.transaction_id || null,
        sent_by: req.user.id,
        sent_at: new Date().toISOString()
      });

    res.status(500).json({ 
      error: 'Failed to send email', 
      message: error.message 
    });
  }
});

// Send booking confirmation
router.post('/booking-confirmation', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ 
        error: 'Missing booking ID', 
        message: 'Booking ID is required' 
      });
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name),
        service:services(name, category, price, duration)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ 
        error: 'Booking not found', 
        message: bookingError?.message || 'Invalid booking ID' 
      });
    }

    const customer = booking.customer;
    const service = booking.service;
    const staff = booking.staff;

    // Prepare confirmation message
    const message = `Hi ${customer.first_name}! Your appointment has been confirmed:\n\n` +
      `Service: ${service.name}\n` +
      `Date: ${new Date(booking.booking_date).toLocaleDateString()}\n` +
      `Time: ${booking.booking_time}\n` +
      `Staff: ${staff.first_name} ${staff.last_name}\n` +
      `Price: ₦${service.price.toLocaleString()}\n\n` +
      `Please arrive 10 minutes early. Contact us if you need to reschedule.\n\n` +
      `Thank you for choosing ${process.env.BUSINESS_NAME}!`;

    const emailSubject = `Appointment Confirmed - ${service.name}`;
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
    `;

    const notifications = [];

    // Send SMS if phone number is available
    if (customer.phone) {
      try {
        let formattedPhone = customer.phone.replace(/\s+/g, '');
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+234' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+234' + formattedPhone;
        }

        const smsResult = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone
        });

        const { data: smsNotification } = await supabase
          .from('notifications')
          .insert({
            type: 'sms',
            recipient: formattedPhone,
            message: message,
            status: 'sent',
            external_id: smsResult.sid,
            customer_id: customer.id,
            booking_id: booking_id,
            sent_by: req.user.id,
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        notifications.push({ type: 'sms', status: 'sent', id: smsNotification?.id });
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        notifications.push({ type: 'sms', status: 'failed', error: smsError.message });
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
          html: emailHtml
        });

        const { data: emailNotification } = await supabase
          .from('notifications')
          .insert({
            type: 'email',
            recipient: customer.email,
            subject: emailSubject,
            message: message,
            status: 'sent',
            external_id: emailResult.messageId,
            customer_id: customer.id,
            booking_id: booking_id,
            sent_by: req.user.id,
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        notifications.push({ type: 'email', status: 'sent', id: emailNotification?.id });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        notifications.push({ type: 'email', status: 'failed', error: emailError.message });
      }
    }

    res.json({
      message: 'Booking confirmation sent',
      booking_id: booking_id,
      notifications: notifications
    });
  } catch (error) {
    console.error('Booking confirmation error:', error);
    res.status(500).json({ 
      error: 'Failed to send booking confirmation', 
      message: error.message 
    });
  }
});

// Send booking reminder
router.post('/booking-reminder', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { booking_id, hours_before = 24 } = req.body;

    if (!booking_id) {
      return res.status(400).json({ 
        error: 'Missing booking ID', 
        message: 'Booking ID is required' 
      });
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name),
        service:services(name, category, price, duration)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return res.status(404).json({ 
        error: 'Booking not found', 
        message: bookingError?.message || 'Invalid booking ID' 
      });
    }

    const customer = booking.customer;
    const service = booking.service;
    const staff = booking.staff;

    // Prepare reminder message
    const message = `Hi ${customer.first_name}! This is a reminder about your upcoming appointment:\n\n` +
      `Service: ${service.name}\n` +
      `Date: ${new Date(booking.booking_date).toLocaleDateString()}\n` +
      `Time: ${booking.booking_time}\n` +
      `Staff: ${staff.first_name} ${staff.last_name}\n\n` +
      `Please arrive 10 minutes early. Reply CANCEL if you need to cancel.\n\n` +
      `See you soon at ${process.env.BUSINESS_NAME}!`;

    const notifications = [];

    // Send SMS reminder if phone number is available
    if (customer.phone) {
      try {
        let formattedPhone = customer.phone.replace(/\s+/g, '');
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+234' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+234' + formattedPhone;
        }

        const smsResult = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone
        });

        const { data: smsNotification } = await supabase
          .from('notifications')
          .insert({
            type: 'sms',
            recipient: formattedPhone,
            message: message,
            status: 'sent',
            external_id: smsResult.sid,
            customer_id: customer.id,
            booking_id: booking_id,
            sent_by: req.user.id,
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        notifications.push({ type: 'sms', status: 'sent', id: smsNotification?.id });
      } catch (smsError) {
        console.error('SMS reminder failed:', smsError);
        notifications.push({ type: 'sms', status: 'failed', error: smsError.message });
      }
    }

    res.json({
      message: 'Booking reminder sent',
      booking_id: booking_id,
      notifications: notifications
    });
  } catch (error) {
    console.error('Booking reminder error:', error);
    res.status(500).json({ 
      error: 'Failed to send booking reminder', 
      message: error.message 
    });
  }
});

// Send payment receipt
router.post('/payment-receipt', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { transaction_id } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ 
        error: 'Missing transaction ID', 
        message: 'Transaction ID is required' 
      });
    }

    // Get transaction details
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name),
        transaction_items(
          *,
          service:services(name, category),
          product:products(name, category, sku)
        )
      `)
      .eq('id', transaction_id)
      .single();

    if (transactionError || !transaction) {
      return res.status(404).json({ 
        error: 'Transaction not found', 
        message: transactionError?.message || 'Invalid transaction ID' 
      });
    }

    const customer = transaction.customer;
    const staff = transaction.staff;
    const items = transaction.transaction_items;

    // Prepare receipt message
    let itemsList = '';
    items.forEach(item => {
      const itemName = item.service?.name || item.product?.name || 'Unknown Item';
      itemsList += `${item.quantity}x ${itemName} - ₦${item.total_price.toLocaleString()}\n`;
    });

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
      `Thank you for choosing ${process.env.BUSINESS_NAME}!`;

    const emailSubject = `Payment Receipt - ${process.env.BUSINESS_NAME}`;
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
            const itemName = item.service?.name || item.product?.name || 'Unknown Item';
            return `<p>${item.quantity}x ${itemName} - ₦${item.total_price.toLocaleString()}</p>`;
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
    `;

    const notifications = [];

    // Send SMS receipt if phone number is available
    if (customer.phone) {
      try {
        let formattedPhone = customer.phone.replace(/\s+/g, '');
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '+234' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+234' + formattedPhone;
        }

        const smsResult = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone
        });

        const { data: smsNotification } = await supabase
          .from('notifications')
          .insert({
            type: 'sms',
            recipient: formattedPhone,
            message: message,
            status: 'sent',
            external_id: smsResult.sid,
            customer_id: customer.id,
            transaction_id: transaction_id,
            sent_by: req.user.id,
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        notifications.push({ type: 'sms', status: 'sent', id: smsNotification?.id });
      } catch (smsError) {
        console.error('SMS receipt failed:', smsError);
        notifications.push({ type: 'sms', status: 'failed', error: smsError.message });
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
          html: emailHtml
        });

        const { data: emailNotification } = await supabase
          .from('notifications')
          .insert({
            type: 'email',
            recipient: customer.email,
            subject: emailSubject,
            message: message,
            status: 'sent',
            external_id: emailResult.messageId,
            customer_id: customer.id,
            transaction_id: transaction_id,
            sent_by: req.user.id,
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        notifications.push({ type: 'email', status: 'sent', id: emailNotification?.id });
      } catch (emailError) {
        console.error('Email receipt failed:', emailError);
        notifications.push({ type: 'email', status: 'failed', error: emailError.message });
      }
    }

    res.json({
      message: 'Payment receipt sent',
      transaction_id: transaction_id,
      notifications: notifications
    });
  } catch (error) {
    console.error('Payment receipt error:', error);
    res.status(500).json({ 
      error: 'Failed to send payment receipt', 
      message: error.message 
    });
  }
});

// Get notification history
router.get('/history', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, customer_id } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('notifications')
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        sent_by_user:profiles!sent_by(first_name, last_name)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('sent_at', { ascending: false });

    // Apply filters
    if (type) {
      query = query.eq('type', type);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    }

    // Role-based filtering
    if (req.user.role === 'staff') {
      query = query.eq('sent_by', req.user.id);
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch notification history', 
        message: error.message 
      });
    }

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Notification history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get notification templates (Admin only)
router.get('/templates', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const templates = {
      booking_confirmation: {
        name: 'Booking Confirmation',
        sms: 'Hi {customer_name}! Your appointment for {service_name} on {date} at {time} has been confirmed. Staff: {staff_name}. See you soon!',
        email: {
          subject: 'Appointment Confirmed - {service_name}',
          body: 'Your appointment has been confirmed with the following details...'
        }
      },
      booking_reminder: {
        name: 'Booking Reminder',
        sms: 'Hi {customer_name}! Reminder: You have an appointment for {service_name} tomorrow at {time}. Please arrive 10 minutes early.',
        email: {
          subject: 'Appointment Reminder - {service_name}',
          body: 'This is a reminder about your upcoming appointment...'
        }
      },
      payment_receipt: {
        name: 'Payment Receipt',
        sms: 'Thank you for your payment! Receipt #{receipt_number}. Total: ₦{amount}. Items: {items}',
        email: {
          subject: 'Payment Receipt - {business_name}',
          body: 'Thank you for your payment. Here is your receipt...'
        }
      },
      promotional: {
        name: 'Promotional Message',
        sms: 'Hi {customer_name}! Special offer: {offer_details}. Valid until {expiry_date}. Book now!',
        email: {
          subject: 'Special Offer - {business_name}',
          body: 'We have a special offer just for you...'
        }
      }
    };

    res.json({ templates });
  } catch (error) {
    console.error('Templates fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;