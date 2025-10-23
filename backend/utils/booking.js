import { sql } from '../config/database.js'

// Generate booking ID in format: {UPPERCASE-FIRSTNAME}-{LAST4PHONE}
const generateBookingId = async(guestCustomerId) => {
  try {
    if (!guestCustomerId) {
      // For bookings without guest customer, use timestamp-based ID
      const timestamp = Date.now().toString(36).toUpperCase()
      return `GUEST-${timestamp}`
    }

    // Get guest customer details
    const guestCustomers = await sql`
      SELECT first_name, phone FROM guest_customers WHERE id = ${guestCustomerId}
    `

    if (guestCustomers.length === 0) {
      throw new Error('Guest customer not found')
    }

    const guestCustomer = guestCustomers[0]
    
    // Extract first name and format
    const firstName = guestCustomer.first_name || 'GUEST'
    const formattedFirstName = firstName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 10)
    
    // Extract last 4 digits of phone
    const phone = guestCustomer.phone || ''
    const last4Phone = phone.replace(/\D/g, '').slice(-4)
    
    // If phone is not available, use timestamp
    const phoneSuffix = last4Phone || Date.now().toString(36).slice(-4).toUpperCase()
    
    const baseBookingId = `${formattedFirstName}-${phoneSuffix}`
    
    // Check for duplicates and append counter if needed
    let bookingId = baseBookingId
    let counter = 1
    
    while (true) {
      const existingBookings = await sql`
        SELECT id FROM bookings WHERE booking_id = ${bookingId}
      `
      
      if (existingBookings.length === 0) {
        break
      }
      
      counter++
      bookingId = `${baseBookingId}-${counter}`
      
      // Safety check to prevent infinite loop
      if (counter > 100) {
        throw new Error('Unable to generate unique booking ID')
      }
    }
    
    return bookingId
  } catch (error) {
    console.error('Booking ID generation error:', error)
    // Fallback to timestamp-based ID
    const timestamp = Date.now().toString(36).toUpperCase()
    return `FALLBACK-${timestamp}`
  }
}

// Log booking updates for manager edits
const logBookingUpdate = async(bookingId, managerId, changes, reason = null) => {
  try {
    await sql`
      INSERT INTO booking_updates (booking_id, manager_id, changes, reason)
      VALUES (${bookingId}, ${managerId}, ${JSON.stringify(changes)}, ${reason})
    `
  } catch (error) {
    console.error('Failed to log booking update:', error)
    // Don't throw error as logging shouldn't break the main operation
  }
}

// Validate coupon code
const validateCoupon = async(couponCode, userId, totalAmount) => {
  try {
    if (!couponCode) {
      return { isValid: false, error: 'Coupon code is required' }
    }

    const coupons = await sql`
      SELECT * FROM coupons 
      WHERE code = ${couponCode} 
      AND is_active = true
      AND (start_date IS NULL OR start_date <= NOW())
      AND (end_date IS NULL OR end_date >= NOW())
    `

    if (coupons.length === 0) {
      return { isValid: false, error: 'Invalid or expired coupon code' }
    }

    const coupon = coupons[0]

    // Check usage limits
    if (coupon.usage_limit) {
      const redemptions = await sql`
        SELECT COUNT(*) as count FROM coupon_redemptions 
        WHERE coupon_id = ${coupon.id}
      `
      
      if (redemptions[0].count >= coupon.usage_limit) {
        return { isValid: false, error: 'Coupon usage limit reached' }
      }
    }

    // Check per user limit
    if (userId && coupon.per_user_limit) {
      const userRedemptions = await sql`
        SELECT COUNT(*) as count FROM coupon_redemptions 
        WHERE coupon_id = ${coupon.id} AND user_id = ${userId}
      `
      
      if (userRedemptions[0].count >= coupon.per_user_limit) {
        return { isValid: false, error: 'You have already used this coupon' }
      }
    }

    // Check minimum purchase amount
    if (coupon.minimum_purchase_amount && totalAmount < coupon.minimum_purchase_amount) {
      return { 
        isValid: false, 
        error: `Minimum purchase of ₦${coupon.minimum_purchase_amount} required`, 
      }
    }

    // Calculate discount amount
    let discountAmount = 0
    if (coupon.discount_type === 'percentage') {
      discountAmount = (totalAmount * coupon.discount_value) / 100
      
      // Apply maximum discount limit if specified
      if (coupon.maximum_discount_amount && discountAmount > coupon.maximum_discount_amount) {
        discountAmount = coupon.maximum_discount_amount
      }
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = coupon.discount_value
    }

    return {
      isValid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discountAmount,
        final_amount: totalAmount - discountAmount,
      },
    }

  } catch (error) {
    console.error('Coupon validation error:', error)
    return { isValid: false, error: 'Coupon validation failed' }
  }
}

export {
  generateBookingId,
  logBookingUpdate,
  validateCoupon,
}