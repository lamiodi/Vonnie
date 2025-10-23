import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js'
import { validateService, validateUUID, validatePagination } from '../middleware/validation.js'

const router = express.Router()

// Get all services
router.get('/', validatePagination, async(req, res) => {
  try {
    const { page = 1, limit = 20, category, is_active = true } = req.query
    const offset = (page - 1) * limit

    let whereClause = ''
    let params = []
    
    if (category) {
      whereClause += ' AND category = $' + (params.length + 1)
      params.push(category)
    }

    if (is_active !== undefined) {
      whereClause += ' AND is_active = $' + (params.length + 1)
      params.push(is_active === 'true')
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM services WHERE 1=1 ${whereClause}`
    const countResult = await sql.unsafe(countQuery, params)
    const total = parseInt(countResult[0].total)

    // Get services with pagination
    const servicesQuery = `
      SELECT * FROM services 
      WHERE 1=1 ${whereClause}
      ORDER BY name ASC 
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    params.push(limit, offset)
    
    const services = await sql.unsafe(servicesQuery, params)

    res.json({
      services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Services fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get service by ID
router.get('/:id', validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    const service = await sql`
      SELECT * FROM services WHERE id = ${id}
    `

    if (!service || service.length === 0) {
      return res.status(404).json({ 
        error: 'Service not found', 
        message: 'Service not found', 
      })
    }

    res.json({ service: service[0] })
  } catch (error) {
    console.error('Service fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new service (Admin only)
router.post('/', authenticateToken, requireAdmin, validateService, async(req, res) => {
  try {
    const { name, description, duration, price, category } = req.body

    const service = await sql`
      INSERT INTO services (name, description, duration, price, category)
      VALUES (${name}, ${description}, ${duration}, ${price}, ${category})
      RETURNING *
    `

    res.status(201).json({
      message: 'Service created successfully',
      service: service[0],
    })
  } catch (error) {
    console.error('Service creation error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update service (Admin only)
router.put('/:id', authenticateToken, requireAdmin, validateUUID, validateService, async(req, res) => {
  try {
    const { id } = req.params
    const { name, description, duration, price, category, is_active } = req.body

    const service = await sql`
      UPDATE services 
      SET name = ${name}, description = ${description}, duration = ${duration}, 
          price = ${price}, category = ${category}, is_active = ${is_active}
      WHERE id = ${id}
      RETURNING *
    `

    if (!service || service.length === 0) {
      return res.status(404).json({ 
        error: 'Service not found', 
        message: 'Service not found', 
      })
    }

    res.json({
      message: 'Service updated successfully',
      service: service[0],
    })
  } catch (error) {
    console.error('Service update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete service (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    // Check if service has any bookings
    let bookings
    try {
      bookings = await sql`
        SELECT id FROM bookings WHERE service_id = ${id} LIMIT 1
      `
    } catch (bookingError) {
      return res.status(400).json({ 
        error: 'Failed to check service bookings', 
        message: bookingError.message, 
      })
    }

    if (bookings && bookings.length > 0) {
      // Soft delete - deactivate instead of hard delete
      const service = await sql`
        UPDATE services SET is_active = false WHERE id = ${id} RETURNING *
      `

      if (!service || service.length === 0) {
        return res.status(404).json({ 
          error: 'Service not found', 
          message: 'Service not found', 
        })
      }

      return res.json({
        message: 'Service deactivated successfully (has existing bookings)',
        service: service[0],
      })
    }

    // Hard delete if no bookings
    try {
      await sql`
        DELETE FROM services WHERE id = ${id}
      `
    } catch (deleteError) {
      return res.status(400).json({ 
        error: 'Failed to delete service', 
        message: deleteError.message, 
      })
    }

    res.json({ message: 'Service deleted successfully' })
  } catch (error) {
    console.error('Service deletion error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get service categories
router.get('/categories/list', async(req, res) => {
  try {
    const categories = await sql`
      SELECT DISTINCT category FROM services 
      WHERE category IS NOT NULL AND is_active = true
      ORDER BY category
    `

    // Get unique categories
    const uniqueCategories = categories.map(item => item.category)

    res.json({ categories: uniqueCategories })
  } catch (error) {
    console.error('Categories fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get service statistics (Staff/Admin only)
router.get('/stats/overview', authenticateToken, requireStaff, async(req, res) => {
  try {
    // Total services
    const totalServicesResult = await sql`
      SELECT COUNT(*) as total FROM services WHERE is_active = true
    `
    const totalServices = parseInt(totalServicesResult[0].total)

    // Services by category
    const categoryStats = await sql`
      SELECT category, COUNT(*) as count FROM services 
      WHERE is_active = true AND category IS NOT NULL
      GROUP BY category
    `

    const categoryCounts = categoryStats.reduce((acc, stat) => {
      const category = stat.category || 'Uncategorized'
      acc[category] = parseInt(stat.count)
      return acc
    }, {})

    // Most popular services (based on bookings)
    const popularServices = await sql`
      SELECT s.name, COUNT(b.id) as booking_count
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      WHERE b.status = 'completed'
      GROUP BY s.name
      ORDER BY booking_count DESC
      LIMIT 5
    `

    const topServices = popularServices.map(service => ({
      name: service.name,
      bookings: parseInt(service.booking_count),
    }))

    res.json({
      totalServices,
      categoryCounts,
      topServices,
    })
  } catch (error) {
    console.error('Service stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router