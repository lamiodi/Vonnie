import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireAdmin, requireManager } from '../middleware/auth.js'
import { validateCoupon } from '../utils/booking.js'

const router = express.Router()

// Get all coupons
router.get('/', authenticateToken, requireManager, async(req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = '' } = req.query
    const offset = (page - 1) * limit
    
    let query = sql`
      SELECT 
        c.*,
        COUNT(cr.id) as times_used,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM coupons c
      LEFT JOIN coupon_redemptions cr ON c.id = cr.coupon_id
      LEFT JOIN users u ON c.created_by = u.id
    `
    
    let countQuery = sql`SELECT COUNT(*) FROM coupons c`
    
    if (search) {
      query = query.append(sql`WHERE c.code ILIKE ${'%' + search + '%'} OR c.description ILIKE ${'%' + search + '%'}`)
      countQuery = countQuery.append(sql`WHERE c.code ILIKE ${'%' + search + '%'} OR c.description ILIKE ${'%' + search + '%'}`)
    }
    
    if (status === 'active') {
      query = query.append(sql`AND c.is_active = true AND (c.start_date IS NULL OR c.start_date <= NOW()) AND (c.end_date IS NULL OR c.end_date >= NOW())`)
      countQuery = countQuery.append(sql`AND c.is_active = true AND (c.start_date IS NULL OR c.start_date <= NOW()) AND (c.end_date IS NULL OR c.end_date >= NOW())`)
    } else if (status === 'expired') {
      query = query.append(sql`AND (c.end_date < NOW() OR c.is_active = false)`)
      countQuery = countQuery.append(sql`AND (c.end_date < NOW() OR c.is_active = false)`)
    } else if (status === 'upcoming') {
      query = query.append(sql`AND c.start_date > NOW()`)
      countQuery = countQuery.append(sql`AND c.start_date > NOW()`)
    }
    
    query = query.append(sql`
      GROUP BY c.id, u.first_name, u.last_name
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `)
    
    const coupons = await query
    const totalCount = await countQuery
    
    res.json({
      coupons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalCount[0].count),
        pages: Math.ceil(totalCount[0].count / limit),
      },
    })
    
  } catch (error) {
    console.error('Get coupons error:', error)
    res.status(500).json({ error: 'Failed to fetch coupons' })
  }
})

// Get coupon by ID
router.get('/:id', authenticateToken, requireManager, async(req, res) => {
  try {
    const { id } = req.params
    
    const coupons = await sql`
      SELECT 
        c.*,
        COUNT(cr.id) as times_used,
        u.first_name || ' ' || u.last_name as created_by_name,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', cr.id,
            'user_id', cr.user_id,
            'transaction_id', cr.transaction_id,
            'amount_saved', cr.amount_saved,
            'redeemed_at', cr.redeemed_at
          )
        ) as redemptions
      FROM coupons c
      LEFT JOIN coupon_redemptions cr ON c.id = cr.coupon_id
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ${id}
      GROUP BY c.id, u.first_name, u.last_name
    `
    
    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' })
    }
    
    res.json(coupons[0])
    
  } catch (error) {
    console.error('Get coupon error:', error)
    res.status(500).json({ error: 'Failed to fetch coupon' })
  }
})

// Create new coupon
router.post('/', authenticateToken, requireManager, async(req, res) => {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      minimum_purchase_amount = 0,
      maximum_discount_amount,
      usage_limit,
      per_user_limit = 1,
      start_date,
      end_date,
      is_active = true,
    } = req.body
    
    // Validate required fields
    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({ error: 'Code, discount type, and discount value are required' })
    }
    
    if (discount_type === 'percentage' && discount_value > 100) {
      return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' })
    }
    
    // Check if code already exists
    const existingCoupons = await sql`
      SELECT id FROM coupons WHERE code = ${code}
    `
    
    if (existingCoupons.length > 0) {
      return res.status(400).json({ error: 'Coupon code already exists' })
    }
    
    const coupons = await sql`
      INSERT INTO coupons (
        code, description, discount_type, discount_value, minimum_purchase_amount,
        maximum_discount_amount, usage_limit, per_user_limit, start_date, end_date,
        is_active, created_by
      ) VALUES (
        ${code}, ${description}, ${discount_type}, ${discount_value}, ${minimum_purchase_amount},
        ${maximum_discount_amount}, ${usage_limit}, ${per_user_limit}, ${start_date}, ${end_date},
        ${is_active}, ${req.user.id}
      ) RETURNING *
    `
    
    res.status(201).json(coupons[0])
    
  } catch (error) {
    console.error('Create coupon error:', error)
    res.status(500).json({ error: 'Failed to create coupon' })
  }
})

// Update coupon
router.put('/:id', authenticateToken, requireManager, async(req, res) => {
  try {
    const { id } = req.params
    const {
      code,
      description,
      discount_type,
      discount_value,
      minimum_purchase_amount,
      maximum_discount_amount,
      usage_limit,
      per_user_limit,
      start_date,
      end_date,
      is_active,
    } = req.body
    
    // Check if coupon exists
    const existingCoupons = await sql`
      SELECT id FROM coupons WHERE id = ${id}
    `
    
    if (existingCoupons.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' })
    }
    
    // Check if new code conflicts with existing coupons
    if (code) {
      const conflictCoupons = await sql`
        SELECT id FROM coupons WHERE code = ${code} AND id != ${id}
      `
      
      if (conflictCoupons.length > 0) {
        return res.status(400).json({ error: 'Coupon code already exists' })
      }
    }
    
    const coupons = await sql`
      UPDATE coupons SET
        code = COALESCE(${code}, code),
        description = COALESCE(${description}, description),
        discount_type = COALESCE(${discount_type}, discount_type),
        discount_value = COALESCE(${discount_value}, discount_value),
        minimum_purchase_amount = COALESCE(${minimum_purchase_amount}, minimum_purchase_amount),
        maximum_discount_amount = COALESCE(${maximum_discount_amount}, maximum_discount_amount),
        usage_limit = COALESCE(${usage_limit}, usage_limit),
        per_user_limit = COALESCE(${per_user_limit}, per_user_limit),
        start_date = COALESCE(${start_date}, start_date),
        end_date = COALESCE(${end_date}, end_date),
        is_active = COALESCE(${is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    
    res.json(coupons[0])
    
  } catch (error) {
    console.error('Update coupon error:', error)
    res.status(500).json({ error: 'Failed to update coupon' })
  }
})

// Delete coupon
router.delete('/:id', authenticateToken, requireAdmin, async(req, res) => {
  try {
    const { id } = req.params
    
    // Check if coupon exists
    const existingCoupons = await sql`
      SELECT id FROM coupons WHERE id = ${id}
    `
    
    if (existingCoupons.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' })
    }
    
    await sql`DELETE FROM coupons WHERE id = ${id}`
    
    res.json({ message: 'Coupon deleted successfully' })
    
  } catch (error) {
    console.error('Delete coupon error:', error)
    res.status(500).json({ error: 'Failed to delete coupon' })
  }
})

// Validate coupon code
router.post('/validate', authenticateToken, async(req, res) => {
  try {
    const { coupon_code, customer_id, total_amount = 0 } = req.body
    
    if (!coupon_code) {
      return res.status(400).json({ error: 'Coupon code is required' })
    }
    
    const validation = await validateCoupon(coupon_code, customer_id, total_amount)
    
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid coupon', 
        message: validation.error, 
      })
    }
    
    res.json(validation.coupon)
    
  } catch (error) {
    console.error('Validate coupon error:', error)
    res.status(500).json({ error: 'Failed to validate coupon' })
  }
})

// Get coupon redemption statistics
router.get('/:id/statistics', authenticateToken, requireManager, async(req, res) => {
  try {
    const { id } = req.params
    
    const stats = await sql`
      SELECT 
        COUNT(*) as total_redemptions,
        SUM(amount_saved) as total_savings,
        AVG(amount_saved) as average_savings,
        MIN(redeemed_at) as first_redemption,
        MAX(redeemed_at) as last_redemption
      FROM coupon_redemptions 
      WHERE coupon_id = ${id}
    `
    
    const userStats = await sql`
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_redemptions
      FROM coupon_redemptions 
      WHERE coupon_id = ${id}
    `
    
    res.json({
      ...stats[0],
      ...userStats[0],
    })
    
  } catch (error) {
    console.error('Get coupon statistics error:', error)
    res.status(500).json({ error: 'Failed to fetch coupon statistics' })
  }
})

export default router