import express from 'express'
import { sql } from '../config/database.js'
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js'
import { validateAttendance, validateUUID, validatePagination } from '../middleware/validation.js'

const router = express.Router()

// Get attendance records
router.get('/', authenticateToken, requireStaff, validatePagination, async(req, res) => {
  try {
    const { page = 1, limit = 20, staff_id, date_from, date_to } = req.query
    const offset = (page - 1) * limit

    // Build WHERE conditions
    let whereConditions = []
    let whereParams = []

    // Role-based filtering
    if (req.user.role === 'staff') {
      whereConditions.push('a.staff_id = $1')
      whereParams.push(req.user.id)
    } else if (staff_id && req.user.role === 'admin') {
      whereConditions.push('a.staff_id = $1')
      whereParams.push(staff_id)
    }

    // Date filtering
    if (date_from) {
      whereConditions.push(`a.date >= $${whereParams.length + 1}`)
      whereParams.push(date_from)
    }
    if (date_to) {
      whereConditions.push(`a.date <= $${whereParams.length + 1}`)
      whereParams.push(date_to)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) 
      FROM attendance a
      ${whereClause}
    `
    const countResult = await sql.query(countQuery, whereParams)
    const totalCount = parseInt(countResult.rows[0].count)

    // Get paginated data
    const dataQuery = `
      SELECT 
        a.*,
        p.first_name,
        p.last_name,
        p.role
      FROM attendance a
      LEFT JOIN profiles p ON a.staff_id = p.id
      ${whereClause}
      ORDER BY a.date DESC
      LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}
    `
    
    const dataParams = [...whereParams, limit, offset]
    const dataResult = await sql.query(dataQuery, dataParams)

    // Calculate total hours for each record
    const attendanceWithHours = dataResult.rows.map(record => {
      let hoursWorked = null
      if (record.resumption_time && record.closing_time) {
        const resumption = new Date(record.resumption_time)
        const closing = new Date(record.closing_time)
        hoursWorked = (closing - resumption) / (1000 * 60 * 60) // Convert to hours
      }
      return {
        ...record,
        hours_worked: hoursWorked,
      }
    })

    res.json({
      attendance: attendanceWithHours,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Attendance fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get attendance record by ID
router.get('/:id', authenticateToken, requireStaff, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    let query = `
      SELECT 
        a.*,
        p.first_name,
        p.last_name,
        p.role
      FROM attendance a
      LEFT JOIN profiles p ON a.staff_id = p.id
      WHERE a.id = $1
    `
    let params = [id]

    // Role-based access control
    if (req.user.role === 'staff') {
      query += ' AND a.staff_id = $2'
      params.push(req.user.id)
    }

    const result = await sql.query(query, params)

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Attendance record not found', 
        message: 'No attendance record found with the specified ID', 
      })
    }

    const attendance = result.rows[0]

    // Calculate hours worked
    let hoursWorked = null
    if (attendance.resumption_time && attendance.closing_time) {
      const resumption = new Date(attendance.resumption_time)
      const closing = new Date(attendance.closing_time)
      hoursWorked = (closing - resumption) / (1000 * 60 * 60)
    }

    res.json({ 
      attendance: {
        ...attendance,
        hours_worked: hoursWorked,
      },
    })
  } catch (error) {
    console.error('Attendance fetch error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Check in (create attendance record or update resumption time)
router.post('/check-in', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { staff_id } = req.body
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const now = new Date().toISOString()

    // Determine staff ID (staff can only check in for themselves)
    const finalStaffId = req.user.role === 'staff' ? req.user.id : (staff_id || req.user.id)

    // Check if attendance record already exists for today
    const existingRecordQuery = `
      SELECT * FROM attendance 
      WHERE staff_id = $1 AND date = $2
    `
    const existingRecordResult = await sql.query(existingRecordQuery, [finalStaffId, today])
    const existingRecord = existingRecordResult.rows[0]

    let attendance
    let message

    if (existingRecord) {
      // Update existing record with new resumption time
      const updateQuery = `
        UPDATE attendance 
        SET resumption_time = $1
        WHERE id = $2
        RETURNING *
      `
      const updateResult = await sql.query(updateQuery, [now, existingRecord.id])
      
      if (updateResult.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Failed to update check-in time', 
          message: 'No record was updated', 
        })
      }

      attendance = updateResult.rows[0]
      message = 'Check-in time updated successfully'
    } else {
      // Create new attendance record
      const insertQuery = `
        INSERT INTO attendance (staff_id, date, resumption_time)
        VALUES ($1, $2, $3)
        RETURNING *
      `
      const insertResult = await sql.query(insertQuery, [finalStaffId, today, now])
      
      if (insertResult.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Failed to create attendance record', 
          message: 'No record was created', 
        })
      }

      attendance = insertResult.rows[0]
      message = 'Checked in successfully'
    }

    // Get staff details
    const staffQuery = `
      SELECT first_name, last_name FROM profiles WHERE id = $1
    `
    const staffResult = await sql.query(staffQuery, [finalStaffId])
    const staff = staffResult.rows[0]

    res.json({
      message,
      attendance: {
        ...attendance,
        staff,
      },
    })
  } catch (error) {
    console.error('Check-in error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Check out (update closing time)
router.post('/check-out', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { staff_id } = req.body
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    // Determine staff ID (staff can only check out for themselves)
    const finalStaffId = req.user.role === 'staff' ? req.user.id : (staff_id || req.user.id)

    // Find today's attendance record
    const existingRecordQuery = `
      SELECT * FROM attendance 
      WHERE staff_id = $1 AND date = $2
    `
    const existingRecordResult = await sql.query(existingRecordQuery, [finalStaffId, today])
    const existingRecord = existingRecordResult.rows[0]

    if (!existingRecord) {
      return res.status(404).json({ 
        error: 'No check-in record found for today', 
        message: 'Please check in first before checking out', 
      })
    }

    if (!existingRecord.resumption_time) {
      return res.status(400).json({ 
        error: 'No resumption time recorded', 
        message: 'Cannot check out without a valid check-in time', 
      })
    }

    // Update closing time
    const updateQuery = `
      UPDATE attendance 
      SET closing_time = $1
      WHERE id = $2
      RETURNING *
    `
    const updateResult = await sql.query(updateQuery, [now, existingRecord.id])

    if (updateResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to update check-out time', 
        message: 'No record was updated', 
      })
    }

    const attendance = updateResult.rows[0]

    // Get staff details
    const staffQuery = `
      SELECT first_name, last_name FROM profiles WHERE id = $1
    `
    const staffResult = await sql.query(staffQuery, [finalStaffId])
    const staff = staffResult.rows[0]

    // Calculate hours worked
    const resumption = new Date(attendance.resumption_time)
    const closing = new Date(attendance.closing_time)
    const hoursWorked = (closing - resumption) / (1000 * 60 * 60)

    res.json({
      message: 'Checked out successfully',
      attendance: {
        ...attendance,
        staff,
        hours_worked: hoursWorked,
      },
    })
  } catch (error) {
    console.error('Check-out error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current attendance status
router.get('/status/current', authenticateToken, requireStaff, async(req, res) => {
  try {
    const { staff_id } = req.query
    const today = new Date().toISOString().split('T')[0]

    // Determine staff ID
    const finalStaffId = req.user.role === 'staff' ? req.user.id : (staff_id || req.user.id)

    const query = `
      SELECT 
        a.*,
        p.first_name,
        p.last_name
      FROM attendance a
      LEFT JOIN profiles p ON a.staff_id = p.id
      WHERE a.staff_id = $1 AND a.date = $2
    `
    const result = await sql.query(query, [finalStaffId, today])
    const attendance = result.rows[0]

    let status = 'not_checked_in'
    let hoursWorked = null

    if (attendance) {
      if (attendance.resumption_time && !attendance.closing_time) {
        status = 'checked_in'
        const resumption = new Date(attendance.resumption_time)
        const now = new Date()
        hoursWorked = (now - resumption) / (1000 * 60 * 60)
      } else if (attendance.resumption_time && attendance.closing_time) {
        status = 'checked_out'
        const resumption = new Date(attendance.resumption_time)
        const closing = new Date(attendance.closing_time)
        hoursWorked = (closing - resumption) / (1000 * 60 * 60)
      }
    }

    res.json({
      status,
      attendance: attendance ? {
        ...attendance,
        hours_worked: hoursWorked,
      } : null,
    })
  } catch (error) {
    console.error('Attendance status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create/Update attendance record (Admin only)
router.post('/', authenticateToken, requireAdmin, validateAttendance, async(req, res) => {
  try {
    const { staff_id, date, resumption_time, closing_time } = req.body

    // Check if record already exists
    const existingRecordQuery = `
      SELECT * FROM attendance 
      WHERE staff_id = $1 AND date = $2
    `
    const existingRecordResult = await sql.query(existingRecordQuery, [staff_id, date])
    const existingRecord = existingRecordResult.rows[0]

    let attendance
    let message

    if (existingRecord) {
      // Update existing record
      const updateQuery = `
        UPDATE attendance 
        SET resumption_time = $1, closing_time = $2
        WHERE id = $3
        RETURNING *
      `
      const updateResult = await sql.query(updateQuery, [resumption_time, closing_time, existingRecord.id])
      
      if (updateResult.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Failed to update attendance record', 
          message: 'No record was updated', 
        })
      }

      attendance = updateResult.rows[0]
      message = 'Attendance record updated successfully'
    } else {
      // Create new record
      const insertQuery = `
        INSERT INTO attendance (staff_id, date, resumption_time, closing_time)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `
      const insertResult = await sql.query(insertQuery, [staff_id, date, resumption_time, closing_time])
      
      if (insertResult.rows.length === 0) {
        return res.status(400).json({ 
          error: 'Failed to create attendance record', 
          message: 'No record was created', 
        })
      }

      attendance = insertResult.rows[0]
      message = 'Attendance record created successfully'
    }

    // Get staff details
    const staffQuery = `
      SELECT first_name, last_name FROM profiles WHERE id = $1
    `
    const staffResult = await sql.query(staffQuery, [staff_id])
    const staff = staffResult.rows[0]

    // Calculate hours worked
    let hoursWorked = null
    if (attendance.resumption_time && attendance.closing_time) {
      const resumption = new Date(attendance.resumption_time)
      const closing = new Date(attendance.closing_time)
      hoursWorked = (closing - resumption) / (1000 * 60 * 60)
    }

    res.status(existingRecord ? 200 : 201).json({
      message,
      attendance: {
        ...attendance,
        staff,
        hours_worked: hoursWorked,
      },
    })
  } catch (error) {
    console.error('Attendance creation/update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update attendance record (Admin only)
router.put('/:id', authenticateToken, requireAdmin, validateUUID, async(req, res) => {
  try {
    const { id } = req.params
    const { resumption_time, closing_time } = req.body

    const updateQuery = `
      UPDATE attendance 
      SET resumption_time = $1, closing_time = $2
      WHERE id = $3
      RETURNING *
    `
    const updateResult = await sql.query(updateQuery, [resumption_time, closing_time, id])

    if (updateResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Failed to update attendance record', 
        message: 'No record was updated', 
      })
    }

    const attendance = updateResult.rows[0]

    // Get staff details
    const staffQuery = `
      SELECT first_name, last_name FROM profiles WHERE id = $1
    `
    const staffResult = await sql.query(staffQuery, [attendance.staff_id])
    const staff = staffResult.rows[0]

    // Calculate hours worked
    let hoursWorked = null
    if (attendance.resumption_time && attendance.closing_time) {
      const resumption = new Date(attendance.resumption_time)
      const closing = new Date(attendance.closing_time)
      hoursWorked = (closing - resumption) / (1000 * 60 * 60)
    }

    res.json({
      message: 'Attendance record updated successfully',
      attendance: {
        ...attendance,
        staff,
        hours_worked: hoursWorked,
      },
    })
  } catch (error) {
    console.error('Attendance update error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete attendance record (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async(req, res) => {
  try {
    const { id } = req.params

    const deleteQuery = `
      DELETE FROM attendance 
      WHERE id = $1
    `
    const result = await sql.query(deleteQuery, [id])

    if (result.rowCount === 0) {
      return res.status(400).json({ 
        error: 'Failed to delete attendance record', 
        message: 'No record was deleted', 
      })
    }

    res.json({ message: 'Attendance record deleted successfully' })
  } catch (error) {
    console.error('Attendance deletion error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get attendance statistics (Admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async(req, res) => {
  try {
    const { date_from, date_to, staff_id } = req.query
    
    // Build WHERE conditions
    let whereConditions = []
    let whereParams = []

    if (date_from) {
      whereConditions.push(`a.date >= $${whereParams.length + 1}`)
      whereParams.push(date_from)
    }
    if (date_to) {
      whereConditions.push(`a.date <= $${whereParams.length + 1}`)
      whereParams.push(date_to)
    }
    if (staff_id) {
      whereConditions.push(`a.staff_id = $${whereParams.length + 1}`)
      whereParams.push(staff_id)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const query = `
      SELECT 
        a.*,
        p.first_name,
        p.last_name
      FROM attendance a
      LEFT JOIN profiles p ON a.staff_id = p.id
      ${whereClause}
    `
    
    const result = await sql.query(query, whereParams)
    const attendance = result.rows

    // Calculate statistics
    const stats = {
      totalRecords: attendance.length,
      totalHours: 0,
      averageHours: 0,
      staffStats: {},
      dailyStats: {},
    }

    attendance.forEach(record => {
      if (record.resumption_time && record.closing_time) {
        const resumption = new Date(record.resumption_time)
        const closing = new Date(record.closing_time)
        const hoursWorked = (closing - resumption) / (1000 * 60 * 60)
        
        stats.totalHours += hoursWorked
        
        // Staff statistics
        const staffName = `${record.first_name} ${record.last_name}`
        if (!stats.staffStats[staffName]) {
          stats.staffStats[staffName] = {
            totalHours: 0,
            totalDays: 0,
            averageHours: 0,
          }
        }
        stats.staffStats[staffName].totalHours += hoursWorked
        stats.staffStats[staffName].totalDays += 1
        stats.staffStats[staffName].averageHours = 
          stats.staffStats[staffName].totalHours / stats.staffStats[staffName].totalDays
        
        // Daily statistics
        if (!stats.dailyStats[record.date]) {
          stats.dailyStats[record.date] = {
            totalHours: 0,
            staffCount: 0,
          }
        }
        stats.dailyStats[record.date].totalHours += hoursWorked
        stats.dailyStats[record.date].staffCount += 1
      }
    })

    stats.averageHours = stats.totalRecords > 0 ? stats.totalHours / stats.totalRecords : 0

    res.json({ stats })
  } catch (error) {
    console.error('Attendance stats error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router