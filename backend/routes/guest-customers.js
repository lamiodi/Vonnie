import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff } from '../middleware/auth.js'
import { isValidEmail, isValidPhone } from '../utils/auth.js'

const router = express.Router()

// Create new guest customer (public endpoint for guest bookings)
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, address, gender } = req.body

    // Validation
    if (!first_name || !email || !phone) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'First name, email, and phone are required'
      })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        message: 'Please provide a valid email address'
      })
    }

    // Basic phone validation
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return res.status(400).json({
        error: 'Invalid phone format',
        message: 'Please provide a valid phone number'
      })
    }

    // Check if guest customer already exists with same email or phone
    const existingGuest = await sql`
      SELECT id, email, phone FROM guest_customers 
      WHERE email = ${email} OR phone = ${phone}
    `

    if (existingGuest.length > 0) {
      const existing = existingGuest[0]
      if (existing.email === email && existing.phone === phone) {
        // Same guest, return existing record
        return res.json({
          message: 'Guest customer already exists',
          guest_customer: existing
        })
      } else if (existing.email === email) {
        return res.status(409).json({
          error: 'Email already registered',
          message: 'A guest customer with this email already exists'
        })
      } else if (existing.phone === phone) {
        return res.status(409).json({
          error: 'Phone already registered',
          message: 'A guest customer with this phone number already exists'
        })
      }
    }

    // Create new guest customer
    const guestCustomer = await sql`
      INSERT INTO guest_customers (
        first_name, last_name, email, phone, address, gender
      )
      VALUES (
        ${first_name}, ${last_name || null}, ${email}, ${phone}, 
        ${address || null}, ${gender || null}
      )
      RETURNING *
    `

    res.status(201).json({
      message: 'Guest customer created successfully',
      guest_customer: guestCustomer[0]
    })

  } catch (error) {
    console.error('Guest customer creation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get all guest customers (staff/admin only)
router.get('/', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query
    const offset = (page - 1) * limit

    let whereClause = ''
    let queryParams = []

    if (search) {
      whereClause = `WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1`
      queryParams.push(`%${search}%`)
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM guest_customers ${whereClause}`
    const countResult = await sql.unsafe(countQuery, queryParams)
    const totalCount = parseInt(countResult[0].count)

    // Get paginated guest customers
    const guestCustomersQuery = `
      SELECT * FROM guest_customers 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `

    const finalParams = [...queryParams, limit, offset]
    const guestCustomers = await sql.unsafe(guestCustomersQuery, finalParams)

    res.json({
      guest_customers: guestCustomers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Guest customers fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get guest customer by ID (staff/admin only)
router.get('/:id', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { id } = req.params

    const guestCustomers = await sql`
      SELECT * FROM guest_customers WHERE id = ${id}
    `

    if (guestCustomers.length === 0) {
      return res.status(404).json({
        error: 'Guest customer not found'
      })
    }

    res.json({
      guest_customer: guestCustomers[0]
    })

  } catch (error) {
    console.error('Guest customer fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update guest customer (staff/admin only)
router.put('/:id', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { id } = req.params
    const { first_name, last_name, email, phone, address, gender, loyalty_points, total_visits, total_spent } = req.body

    // Check if guest customer exists
    const existingGuest = await sql`
      SELECT * FROM guest_customers WHERE id = ${id}
    `

    if (existingGuest.length === 0) {
      return res.status(404).json({
        error: 'Guest customer not found'
      })
    }

    // Validate email and phone if provided
    if (email && !isValidEmail(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      })
    }

    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({
        error: 'Invalid phone format'
      })
    }

    // Check for conflicts with other guest customers
    if (email || phone) {
      const conflicts = await sql`
        SELECT id, email, phone FROM guest_customers 
        WHERE (email = ${email || ''} OR phone = ${phone || ''}) AND id != ${id}
      `

      if (conflicts.length > 0) {
        const conflict = conflicts[0]
        if (conflict.email === email) {
          return res.status(409).json({
            error: 'Email already registered',
            message: 'Another guest customer with this email already exists'
          })
        }
        if (conflict.phone === phone) {
          return res.status(409).json({
            error: 'Phone already registered',
            message: 'Another guest customer with this phone number already exists'
          })
        }
      }
    }

    // Update guest customer
    const updatedGuest = await sql`
      UPDATE guest_customers SET
        first_name = ${first_name || existingGuest[0].first_name},
        last_name = ${last_name !== undefined ? last_name : existingGuest[0].last_name},
        email = ${email || existingGuest[0].email},
        phone = ${phone || existingGuest[0].phone},
        address = ${address !== undefined ? address : existingGuest[0].address},
        gender = ${gender !== undefined ? gender : existingGuest[0].gender},
        loyalty_points = ${loyalty_points !== undefined ? loyalty_points : existingGuest[0].loyalty_points},
        total_visits = ${total_visits !== undefined ? total_visits : existingGuest[0].total_visits},
        total_spent = ${total_spent !== undefined ? total_spent : existingGuest[0].total_spent},
        updated_at = ${new Date().toISOString()}
      WHERE id = ${id}
      RETURNING *
    `

    res.json({
      message: 'Guest customer updated successfully',
      guest_customer: updatedGuest[0]
    })

  } catch (error) {
    console.error('Guest customer update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete guest customer (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Only administrators can delete guest customers'
      })
    }

    // Check if guest customer exists
    const existingGuest = await sql`
      SELECT * FROM guest_customers WHERE id = ${id}
    `

    if (existingGuest.length === 0) {
      return res.status(404).json({
        error: 'Guest customer not found'
      })
    }

    // Check if guest customer has any bookings
    const bookings = await sql`
      SELECT COUNT(*) as count FROM bookings WHERE guest_customer_id = ${id}
    `

    if (parseInt(bookings[0].count) > 0) {
      return res.status(409).json({
        error: 'Cannot delete guest customer',
        message: 'Guest customer has existing bookings and cannot be deleted'
      })
    }

    // Delete guest customer
    await sql`
      DELETE FROM guest_customers WHERE id = ${id}
    `

    res.json({
      message: 'Guest customer deleted successfully'
    })

  } catch (error) {
    console.error('Guest customer deletion error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router