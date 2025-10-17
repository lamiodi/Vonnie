const express = require('express');
const { supabase } = require('../config/supabase');
const { authenticateToken, requireStaff, requireAdmin } = require('../middleware/auth');
const { validateAttendance, validateUUID, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Get attendance records
router.get('/', authenticateToken, requireStaff, validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, staff_id, date_from, date_to } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('attendance')
      .select(`
        *,
        staff:profiles!staff_id(first_name, last_name, role)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('date', { ascending: false });

    // Role-based filtering
    if (req.user.role === 'staff') {
      query = query.eq('staff_id', req.user.id);
    } else if (staff_id && req.user.role === 'admin') {
      query = query.eq('staff_id', staff_id);
    }

    // Date filtering
    if (date_from) {
      query = query.gte('date', date_from);
    }
    if (date_to) {
      query = query.lte('date', date_to);
    }

    const { data: attendance, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch attendance records', 
        message: error.message 
      });
    }

    // Calculate total hours for each record
    const attendanceWithHours = attendance.map(record => {
      let hoursWorked = null;
      if (record.resumption_time && record.closing_time) {
        const resumption = new Date(record.resumption_time);
        const closing = new Date(record.closing_time);
        hoursWorked = (closing - resumption) / (1000 * 60 * 60); // Convert to hours
      }
      return {
        ...record,
        hours_worked: hoursWorked
      };
    });

    res.json({
      attendance: attendanceWithHours,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendance record by ID
router.get('/:id', authenticateToken, requireStaff, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    let query = supabase
      .from('attendance')
      .select(`
        *,
        staff:profiles!staff_id(first_name, last_name, role)
      `)
      .eq('id', id)
      .single();

    // Role-based access control
    if (req.user.role === 'staff') {
      query = query.eq('staff_id', req.user.id);
    }

    const { data: attendance, error } = await query;

    if (error) {
      return res.status(404).json({ 
        error: 'Attendance record not found', 
        message: error.message 
      });
    }

    // Calculate hours worked
    let hoursWorked = null;
    if (attendance.resumption_time && attendance.closing_time) {
      const resumption = new Date(attendance.resumption_time);
      const closing = new Date(attendance.closing_time);
      hoursWorked = (closing - resumption) / (1000 * 60 * 60);
    }

    res.json({ 
      attendance: {
        ...attendance,
        hours_worked: hoursWorked
      }
    });
  } catch (error) {
    console.error('Attendance fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check in (create attendance record or update resumption time)
router.post('/check-in', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { staff_id } = req.body;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const now = new Date().toISOString();

    // Determine staff ID (staff can only check in for themselves)
    const finalStaffId = req.user.role === 'staff' ? req.user.id : (staff_id || req.user.id);

    // Check if attendance record already exists for today
    const { data: existingRecord, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('staff_id', finalStaffId)
      .eq('date', today)
      .single();

    let attendance;
    let message;

    if (existingRecord) {
      // Update existing record with new resumption time
      const { data: updatedRecord, error: updateError } = await supabase
        .from('attendance')
        .update({ resumption_time: now })
        .eq('id', existingRecord.id)
        .select(`
          *,
          staff:profiles!staff_id(first_name, last_name)
        `)
        .single();

      if (updateError) {
        return res.status(400).json({ 
          error: 'Failed to update check-in time', 
          message: updateError.message 
        });
      }

      attendance = updatedRecord;
      message = 'Check-in time updated successfully';
    } else {
      // Create new attendance record
      const { data: newRecord, error: createError } = await supabase
        .from('attendance')
        .insert({
          staff_id: finalStaffId,
          date: today,
          resumption_time: now
        })
        .select(`
          *,
          staff:profiles!staff_id(first_name, last_name)
        `)
        .single();

      if (createError) {
        return res.status(400).json({ 
          error: 'Failed to create attendance record', 
          message: createError.message 
        });
      }

      attendance = newRecord;
      message = 'Checked in successfully';
    }

    res.json({
      message,
      attendance
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check out (update closing time)
router.post('/check-out', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { staff_id } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // Determine staff ID (staff can only check out for themselves)
    const finalStaffId = req.user.role === 'staff' ? req.user.id : (staff_id || req.user.id);

    // Find today's attendance record
    const { data: existingRecord, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('staff_id', finalStaffId)
      .eq('date', today)
      .single();

    if (fetchError || !existingRecord) {
      return res.status(404).json({ 
        error: 'No check-in record found for today', 
        message: 'Please check in first before checking out' 
      });
    }

    if (!existingRecord.resumption_time) {
      return res.status(400).json({ 
        error: 'No resumption time recorded', 
        message: 'Cannot check out without a valid check-in time' 
      });
    }

    // Update closing time
    const { data: attendance, error } = await supabase
      .from('attendance')
      .update({ closing_time: now })
      .eq('id', existingRecord.id)
      .select(`
        *,
        staff:profiles!staff_id(first_name, last_name)
      `)
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to update check-out time', 
        message: error.message 
      });
    }

    // Calculate hours worked
    const resumption = new Date(attendance.resumption_time);
    const closing = new Date(attendance.closing_time);
    const hoursWorked = (closing - resumption) / (1000 * 60 * 60);

    res.json({
      message: 'Checked out successfully',
      attendance: {
        ...attendance,
        hours_worked: hoursWorked
      }
    });
  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current attendance status
router.get('/status/current', authenticateToken, requireStaff, async (req, res) => {
  try {
    const { staff_id } = req.query;
    const today = new Date().toISOString().split('T')[0];

    // Determine staff ID
    const finalStaffId = req.user.role === 'staff' ? req.user.id : (staff_id || req.user.id);

    const { data: attendance, error } = await supabase
      .from('attendance')
      .select(`
        *,
        staff:profiles!staff_id(first_name, last_name)
      `)
      .eq('staff_id', finalStaffId)
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      return res.status(400).json({ 
        error: 'Failed to fetch attendance status', 
        message: error.message 
      });
    }

    let status = 'not_checked_in';
    let hoursWorked = null;

    if (attendance) {
      if (attendance.resumption_time && !attendance.closing_time) {
        status = 'checked_in';
        const resumption = new Date(attendance.resumption_time);
        const now = new Date();
        hoursWorked = (now - resumption) / (1000 * 60 * 60);
      } else if (attendance.resumption_time && attendance.closing_time) {
        status = 'checked_out';
        const resumption = new Date(attendance.resumption_time);
        const closing = new Date(attendance.closing_time);
        hoursWorked = (closing - resumption) / (1000 * 60 * 60);
      }
    }

    res.json({
      status,
      attendance: attendance ? {
        ...attendance,
        hours_worked: hoursWorked
      } : null
    });
  } catch (error) {
    console.error('Attendance status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create/Update attendance record (Admin only)
router.post('/', authenticateToken, requireAdmin, validateAttendance, async (req, res) => {
  try {
    const { staff_id, date, resumption_time, closing_time } = req.body;

    // Check if record already exists
    const { data: existingRecord, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('staff_id', staff_id)
      .eq('date', date)
      .single();

    let attendance;
    let message;

    if (existingRecord) {
      // Update existing record
      const { data: updatedRecord, error: updateError } = await supabase
        .from('attendance')
        .update({
          resumption_time,
          closing_time
        })
        .eq('id', existingRecord.id)
        .select(`
          *,
          staff:profiles!staff_id(first_name, last_name)
        `)
        .single();

      if (updateError) {
        return res.status(400).json({ 
          error: 'Failed to update attendance record', 
          message: updateError.message 
        });
      }

      attendance = updatedRecord;
      message = 'Attendance record updated successfully';
    } else {
      // Create new record
      const { data: newRecord, error: createError } = await supabase
        .from('attendance')
        .insert({
          staff_id,
          date,
          resumption_time,
          closing_time
        })
        .select(`
          *,
          staff:profiles!staff_id(first_name, last_name)
        `)
        .single();

      if (createError) {
        return res.status(400).json({ 
          error: 'Failed to create attendance record', 
          message: createError.message 
        });
      }

      attendance = newRecord;
      message = 'Attendance record created successfully';
    }

    // Calculate hours worked
    let hoursWorked = null;
    if (attendance.resumption_time && attendance.closing_time) {
      const resumption = new Date(attendance.resumption_time);
      const closing = new Date(attendance.closing_time);
      hoursWorked = (closing - resumption) / (1000 * 60 * 60);
    }

    res.status(existingRecord ? 200 : 201).json({
      message,
      attendance: {
        ...attendance,
        hours_worked: hoursWorked
      }
    });
  } catch (error) {
    console.error('Attendance creation/update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update attendance record (Admin only)
router.put('/:id', authenticateToken, requireAdmin, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;
    const { resumption_time, closing_time } = req.body;

    const { data: attendance, error } = await supabase
      .from('attendance')
      .update({
        resumption_time,
        closing_time
      })
      .eq('id', id)
      .select(`
        *,
        staff:profiles!staff_id(first_name, last_name)
      `)
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to update attendance record', 
        message: error.message 
      });
    }

    // Calculate hours worked
    let hoursWorked = null;
    if (attendance.resumption_time && attendance.closing_time) {
      const resumption = new Date(attendance.resumption_time);
      const closing = new Date(attendance.closing_time);
      hoursWorked = (closing - resumption) / (1000 * 60 * 60);
    }

    res.json({
      message: 'Attendance record updated successfully',
      attendance: {
        ...attendance,
        hours_worked: hoursWorked
      }
    });
  } catch (error) {
    console.error('Attendance update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete attendance record (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to delete attendance record', 
        message: error.message 
      });
    }

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Attendance deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendance statistics (Admin only)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date_from, date_to, staff_id } = req.query;
    
    let query = supabase
      .from('attendance')
      .select(`
        *,
        staff:profiles!staff_id(first_name, last_name)
      `);
    
    if (date_from) {
      query = query.gte('date', date_from);
    }
    if (date_to) {
      query = query.lte('date', date_to);
    }
    if (staff_id) {
      query = query.eq('staff_id', staff_id);
    }

    const { data: attendance, error } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch attendance stats', 
        message: error.message 
      });
    }

    // Calculate statistics
    const stats = {
      totalRecords: attendance.length,
      totalHours: 0,
      averageHours: 0,
      staffStats: {},
      dailyStats: {}
    };

    attendance.forEach(record => {
      if (record.resumption_time && record.closing_time) {
        const resumption = new Date(record.resumption_time);
        const closing = new Date(record.closing_time);
        const hoursWorked = (closing - resumption) / (1000 * 60 * 60);
        
        stats.totalHours += hoursWorked;
        
        // Staff statistics
        const staffName = `${record.staff.first_name} ${record.staff.last_name}`;
        if (!stats.staffStats[staffName]) {
          stats.staffStats[staffName] = {
            totalHours: 0,
            totalDays: 0,
            averageHours: 0
          };
        }
        stats.staffStats[staffName].totalHours += hoursWorked;
        stats.staffStats[staffName].totalDays += 1;
        stats.staffStats[staffName].averageHours = 
          stats.staffStats[staffName].totalHours / stats.staffStats[staffName].totalDays;
        
        // Daily statistics
        if (!stats.dailyStats[record.date]) {
          stats.dailyStats[record.date] = {
            totalHours: 0,
            staffCount: 0
          };
        }
        stats.dailyStats[record.date].totalHours += hoursWorked;
        stats.dailyStats[record.date].staffCount += 1;
      }
    });

    stats.averageHours = stats.totalRecords > 0 ? stats.totalHours / stats.totalRecords : 0;

    res.json({ stats });
  } catch (error) {
    console.error('Attendance stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;