import express from 'express'
import axios from 'axios'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js'
import { validateUUID } from '../middleware/validation.js'

const router = express.Router()

// Search bookings for check-in
router.get('/check-in/search', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { query, date } = req.query
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Search query required', 
        message: 'Please provide a booking number or customer name', 
      })
    }

    // Build SQL query for searching bookings
    let sqlQuery = sql`
      SELECT 
        b.id,
        b.booking_number,
        b.start_time,
        b.end_time,
        b.status,
        b.notes,
        s.name as service_name,
        s.duration as service_duration,
        s.price as service_price,
        s.category as service_category,
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
      WHERE (
        b.booking_number ILIKE ${'%' + query + '%'}
        OR gc.first_name ILIKE ${'%' + query + '%'}
        OR gc.last_name ILIKE ${'%' + query + '%'}
        OR gc.phone ILIKE ${'%' + query + '%'}
      )
      ORDER BY b.start_time DESC
      LIMIT 10
    `

    // Filter by date if provided
    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      
      sqlQuery = sql`
        SELECT * FROM (${sqlQuery}) as subquery
        WHERE start_time >= ${startOfDay.toISOString()}
          AND start_time <= ${endOfDay.toISOString()}
      `
    }

    const bookings = await sqlQuery

    if (!bookings || bookings.length === 0) {
      return res.status(404).json({
        error: 'No bookings found',
        message: 'No bookings match your search criteria',
      })
    }

    res.json({ bookings })
  } catch (error) {
    console.error('Booking search error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get booking details for check-in
router.get('/check-in/:id', authenticateToken, requireStaff, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    const booking = await sql`
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
      WHERE b.id = ${id}
    `

    const bookingData = booking[0]

    if (!bookingData) {
      return res.status(404).json({
        error: 'Booking not found',
        message: 'No booking found with the specified ID',
      })
    }

    res.json({ booking })
  } catch (error) {
    console.error('Booking fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Add services/products to booking
router.post('/check-in/:id/add-items', authenticateToken, requireStaff, validateUUID, async(req, res) => {
  try {
    const { id } = req.params
    const { items } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Items required', 
        message: 'Please provide items to add', 
      })
    }

    // Get booking details
    const booking = await sql`
      SELECT guest_customer_id, status
      FROM bookings
      WHERE id = ${id}
    `
    const bookingData = booking[0]

    if (!bookingData) {
      return res.status(404).json({ 
        error: 'Booking not found', 
        message: 'No booking found with the specified ID', 
      })
    }

    // Check if booking can be modified
    if (bookingData.status === 'completed' || bookingData.status === 'cancelled') {
      return res.status(400).json({ 
        error: 'Booking not modifiable', 
        message: 'Cannot add items to completed or cancelled bookings', 
      })
    }

    // Process items and create transaction items
    const processedItems = []
    let totalAmount = 0

    for (const item of items) {
      let unitPrice = 0
      let itemName = ''

      // Get item details based on type
      if (item.item_type === 'service') {
        const service = await sql`
          SELECT name, price
          FROM services
          WHERE id = ${item.item_id} AND is_active = true
        `
        const serviceData = service[0]

        if (!serviceData) {
          return res.status(404).json({ 
            error: 'Service not found', 
            message: `Service ${item.item_id} not found or inactive`, 
          })
        }

        unitPrice = serviceData.price
        itemName = serviceData.name
      } else if (item.item_type === 'product') {
        const product = await sql`
          SELECT name, price, stock_quantity
          FROM products
          WHERE id = ${item.item_id} AND is_active = true
        `
        const productData = product[0]

        if (!productData) {
          return res.status(404).json({ 
            error: 'Product not found', 
            message: `Product ${item.item_id} not found or inactive`, 
          })
        }

        // Check stock availability
        if (productData.stock_quantity < item.quantity) {
          return res.status(400).json({ 
            error: 'Insufficient stock', 
            message: `Not enough stock for ${productData.name}`, 
          })
        }

        unitPrice = productData.price
        itemName = productData.name
      }

      const itemTotal = item.quantity * unitPrice
      totalAmount += itemTotal

      processedItems.push({
        transaction_id: null, // Will be set when creating transaction
        item_type: item.item_type,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: itemTotal,
        notes: item.notes || `Added during check-in: ${itemName}`,
      })
    }

    // Update booking with new items (store in booking metadata or create transaction)
    const updatedBooking = await sql`
      UPDATE bookings
      SET additional_items = ${JSON.stringify(processedItems)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (!updatedBooking || updatedBooking.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to update booking', 
        message: 'Could not update booking with new items', 
      })
    }

    res.json({
      message: 'Items added successfully',
      booking: updatedBooking,
      added_items: processedItems,
      total_amount: totalAmount,
    })
  } catch (error) {
    console.error('Add items error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Generate payment link
router.post('/generate-link', authenticateToken, requireStaff, async(req, res) => {
  try {
    const {
      booking_id,
      amount,
      customer_email,
      customer_phone,
      customer_name,
      description = 'Payment for services',
    } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        error: 'Invalid amount', 
        message: 'Amount must be greater than 0', 
      })
    }

    // Generate unique reference
    const paymentReference = `VONNE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Convert amount to kobo (Paystack uses kobo)
    const amountInKobo = Math.round(amount * 100)

    // Call Paystack API to create payment link
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: customer_email || 'customer@example.com',
        amount: amountInKobo,
        reference: paymentReference,
        metadata: {
          booking_id,
          customer_name,
          customer_phone,
          description,
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money'],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const paymentData = paystackResponse.data.data

    // Store payment reference in database
    if (booking_id) {
      await sql`
        UPDATE bookings
        SET payment_reference = ${paymentReference},
            payment_status = 'pending',
            updated_at = NOW()
        WHERE id = ${booking_id}
      `
    }

    res.json({
      message: 'Payment link generated successfully',
      payment_reference: paymentReference,
      payment_url: paymentData.authorization_url,
      access_code: paymentData.access_code,
      amount: amount,
    })
  } catch (error) {
    console.error('Payment link generation error:', error)
    
    if (error.response?.data) {
      return res.status(400).json({ 
        error: 'Payment gateway error', 
        message: error.response.data.message,
        details: error.response.data,
      })
    }

    res.status(500).json({ error: 'Internal server error' })
  }
})

// Payment verification webhook
router.post('/verify', async(req, res) => {
  try {
    const { reference } = req.body

    if (!reference) {
      return res.status(400).json({ 
        error: 'Reference required', 
        message: 'Payment reference is required', 
      })
    }

    // Verify payment with Paystack
    const verificationResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )

    const verificationData = verificationResponse.data.data
    const paymentStatus = verificationData.status === 'success' ? 'completed' : 'failed'

    // Update booking payment status
    const booking = await sql`
      UPDATE bookings
      SET payment_status = ${paymentStatus},
          payment_date = NOW(),
          updated_at = NOW()
      WHERE payment_reference = ${reference}
      RETURNING *
    `
    const bookingData = booking[0]

    if (bookingData) {
      // If payment successful, update booking status and handle inventory
      if (paymentStatus === 'completed') {
        await handleSuccessfulPayment(bookingData)
      }

      // Send notification
      await sendPaymentNotification(bookingData, paymentStatus, verificationData)
    }

    res.json({
      message: 'Payment verified successfully',
      status: paymentStatus,
      reference: reference,
      data: verificationData,
    })
  } catch (error) {
    console.error('Payment verification error:', error)
    
    if (error.response?.data) {
      return res.status(400).json({ 
        error: 'Payment verification failed', 
        message: error.response.data.message,
        details: error.response.data,
      })
    }

    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper function to handle successful payment
async function handleSuccessfulPayment(booking) {
  try {
    // Update booking status to completed
    await sql`
      UPDATE bookings
      SET status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${booking.id}
    `

    // Handle inventory for products in booking
    if (booking.additional_items && Array.isArray(booking.additional_items)) {
      for (const item of booking.additional_items) {
        if (item.item_type === 'product') {
          // Reduce product stock
          const product = await sql`
          SELECT stock_quantity
          FROM products
          WHERE id = ${item.item_id}
        `
          const productData = product[0]

          if (productData) {
            await sql`
            UPDATE products
            SET stock_quantity = ${productData.stock_quantity - item.quantity},
                updated_at = NOW()
            WHERE id = ${item.item_id}
          `

            // Create inventory log
            await sql`
              INSERT INTO inventory_logs (
                product_id, change_type, quantity_changed, previous_quantity,
                new_quantity, reference_type, reference_id, notes, created_at
              ) VALUES (
                ${item.item_id}, 'sale', ${-item.quantity}, ${productData.stock_quantity},
                ${productData.stock_quantity - item.quantity}, 'booking_payment', ${booking.id},
                ${`Sale from booking payment - ${item.notes}`}, NOW()
              )
            `
          }
        }
      }
    }
  } catch (error) {
    console.error('Successful payment handling error:', error)
    throw error
  }
}

// Helper function to send payment notifications
async function sendPaymentNotification(booking, status, paymentData) {
  try {
    let message = ''
    let notificationType = ''

    if (status === 'completed') {
      message = `Payment completed for booking ${booking.booking_number}. Amount: ₦${paymentData.amount / 100}`
      notificationType = 'payment_success'
    } else {
      message = `Payment failed for booking ${booking.booking_number}. Please try again.`
      notificationType = 'payment_failed'
    }

    // Send to customer (if guest customer exists)
    if (booking.guest_customer_id) {
      const customer = await sql`
        SELECT phone, email
        FROM guest_customers
        WHERE id = ${booking.guest_customer_id}
      `
      const customerData = customer[0]

      if (customerData) {
        // Create notification record
        await sql`
          INSERT INTO notifications (
            user_type, user_id, type, title, message,
            related_entity, related_entity_id, status, created_at
          ) VALUES (
            'guest_customer', ${booking.guest_customer_id}, ${notificationType}, 'Payment Update',
            ${message}, 'booking', ${booking.id}, 'pending', NOW()
          )
        `

        // TODO: Integrate with WhatsApp/SMS service
        console.log(`Would send ${notificationType} notification to customer:`, customer.phone || customer.email)
      }
    }

    // Send to staff
    if (booking.staff_id) {
      await sql`
        INSERT INTO notifications (
          user_type, user_id, type, title, message,
          related_entity, related_entity_id, status, created_at
        ) VALUES (
          'staff', ${booking.staff_id}, ${notificationType}, 'Payment Update',
          ${message}, 'booking', ${booking.id}, 'pending', NOW()
        )
      `
    }

  } catch (error) {
    console.error('Notification sending error:', error)
  }
}

export default router