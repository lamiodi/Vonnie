import express from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Shop coordinates - Updated to your new location
const BUSINESS_LOCATION = {
  LATITUDE: 6.433331886076934,
  LONGITUDE: 3.4912971316281003,
  ALLOWED_RADIUS_METERS: 500 // Increased to 500 meters for more flexibility
};

// Work hours configuration (Lagos Time)
const WORK_HOURS = {
  RESUMPTION: { HOUR: 9, MINUTE: 0 }, // 9:00 AM
  CLOSING: { HOUR: 20, MINUTE: 30 }   // 8:30 PM
};

// Helper to get current Lagos time
function getLagosTime() {
  const now = new Date();
  const lagosTimeStr = now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' });
  return new Date(lagosTimeStr);
}

// Calculate distance between two coordinates in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Validate GPS coordinates
function validateGPSCoordinates(latitude, longitude, accuracy = null) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return { isValid: false, error: 'Coordinates must be numbers' };
  }

  if (latitude < -90 || latitude > 90) {
    return { isValid: false, error: 'Latitude must be between -90 and 90' };
  }

  if (longitude < -180 || longitude > 180) {
    return { isValid: false, error: 'Longitude must be between -180 and 180' };
  }

  // Check accuracy if provided
  if (accuracy && accuracy > 100) { // If accuracy is worse than 100m
    return {
      isValid: false,
      error: 'GPS accuracy is too poor for reliable location verification. Please try again in an area with better GPS signal.'
    };
  }

  return { isValid: true };
}

// Check in
router.post('/checkin', authenticate, async (req, res) => {
  try {
    const { worker_id, latitude, longitude, accuracy } = req.body;

    if (!worker_id) {
      return res.status(400).json({ error: 'worker_id is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const existing = await query(
      `SELECT * FROM attendance 
       WHERE worker_id = $1 
       AND (date = $2 OR date::text LIKE $3)`,
      [worker_id, today, `${today}%`]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Already checked in today' });
    }

    let locationVerificationStatus = null;
    let distanceFromShop = null;
    let attendanceStatus = 'present';

    // Lateness detection (9:00 AM Lagos Time)
    const lagosNow = getLagosTime();
    const resumptionTime = new Date(lagosNow);
    resumptionTime.setHours(WORK_HOURS.RESUMPTION.HOUR, WORK_HOURS.RESUMPTION.MINUTE, 0, 0);

    if (lagosNow > resumptionTime) {
      attendanceStatus = 'late';
    }

    // Validate GPS coordinates and calculate distance if provided
    if (latitude !== undefined && longitude !== undefined) {
      const validation = validateGPSCoordinates(latitude, longitude, accuracy);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }

      // Calculate distance from shop
      distanceFromShop = calculateDistance(latitude, longitude, BUSINESS_LOCATION.LATITUDE, BUSINESS_LOCATION.LONGITUDE);

      // Determine location verification status based on distance
      if (distanceFromShop <= BUSINESS_LOCATION.ALLOWED_RADIUS_METERS) {
        locationVerificationStatus = 'verified';
      } else {
        locationVerificationStatus = 'rejected';
        attendanceStatus = 'flagged'; // Flag attendance if outside allowed radius
      }
    } else {
      // No GPS data provided
      locationVerificationStatus = 'flagged';
    }

    const result = await query(
      `INSERT INTO attendance (worker_id, date, check_in_time, status, check_in_latitude, check_in_longitude, 
                              location_verification_status, distance_from_shop) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        worker_id,
        today,
        new Date().toISOString(),
        attendanceStatus,
        latitude || null,
        longitude || null,
        locationVerificationStatus,
        distanceFromShop
      ]
    );

    // Update user status to 'available' on checkin (if not busy)
    try {
      await query("UPDATE users SET current_status = 'available' WHERE id = $1 AND current_status != 'busy'", [worker_id]);
    } catch (statusError) {
      console.error('Failed to update user status on checkin:', statusError);
    }

    // Return appropriate message based on verification status
    let message = 'Check-in successful';
    if (locationVerificationStatus === 'verified') {
      message = attendanceStatus === 'late'
        ? 'Attendance marked (Late). Work starts at 9:00 AM.'
        : 'Attendance marked successfully.';
    } else if (locationVerificationStatus === 'rejected') {
      message = 'Unable to verify attendance. You appear to be too far from shop.';
    } else if (locationVerificationStatus === 'flagged') {
      message = 'Check-in recorded without location verification.';
    }

    // REMOVED INCORRECT LOGIC: "Update user status to 'offline' on checkout" block was copy-pasted into checkin route
    // The checkin route should set status to 'available', which is already handled above.

    res.json({
      message: message,
      attendance: result.rows[0],
      gps_verified: locationVerificationStatus === 'verified',
      location_verification_status: locationVerificationStatus,
      distance_from_shop: distanceFromShop
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Check out
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { worker_id, latitude, longitude, accuracy } = req.body;

    if (!worker_id) {
      return res.status(400).json({ error: 'worker_id is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    let locationVerificationStatus = null;
    let distanceFromShop = null;

    // Validate GPS coordinates and calculate distance if provided
    if (latitude !== undefined && longitude !== undefined) {
      const validation = validateGPSCoordinates(latitude, longitude, accuracy);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }

      // Calculate distance from shop
      distanceFromShop = calculateDistance(latitude, longitude, BUSINESS_LOCATION.LATITUDE, BUSINESS_LOCATION.LONGITUDE);

      // Determine location verification status based on distance
      if (distanceFromShop <= BUSINESS_LOCATION.ALLOWED_RADIUS_METERS) {
        locationVerificationStatus = 'verified';
      } else {
        locationVerificationStatus = 'rejected';
      }
    } else {
      // No GPS data provided
      locationVerificationStatus = 'flagged';
    }

    const result = await query(
      `UPDATE attendance 
       SET check_out_time = $1, 
           check_out_latitude = $2, 
           check_out_longitude = $3,
           location_verification_status = COALESCE(location_verification_status, $4)
       WHERE worker_id = $5 AND date = $6 
       RETURNING *`,
      [new Date().toISOString(), latitude || null, longitude || null, locationVerificationStatus, worker_id, today]
    );

    // Update user status to 'offline' on checkout
    try {
      await query("UPDATE users SET current_status = 'offline' WHERE id = $1", [worker_id]);
    } catch (statusError) {
      console.error('Failed to update user status on checkout:', statusError);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No check-in record found for today' });
    }

    // Return appropriate message based on verification status
    let message = 'Check-out successful';
    if (locationVerificationStatus === 'verified') {
      message = 'Check-out completed successfully.';
    } else if (locationVerificationStatus === 'rejected') {
      message = 'Check-out recorded but location verification failed.';
    } else if (locationVerificationStatus === 'flagged') {
      message = 'Check-out recorded without location verification.';
    }

    res.json({
      message: message,
      attendance: result.rows[0],
      gps_verified: locationVerificationStatus === 'verified',
      location_verification_status: locationVerificationStatus,
      distance_from_shop: distanceFromShop
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get attendance records
router.get('/', authenticate, async (req, res) => {
  try {
    let { start_date, end_date, worker_id } = req.query;

    // If not admin/manager, can only view own attendance
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      worker_id = req.user.id;
    }

    // For regular staff, convert full date string to YYYY-MM-DD for accurate comparison
    // This fixes the issue where timezone differences might cause date mismatch in queries
    if (start_date && start_date.includes('T')) {
      start_date = start_date.split('T')[0];
    }
    if (end_date && end_date.includes('T')) {
      end_date = end_date.split('T')[0];
    }

    let sql = `
      SELECT a.*, a.date::text as date_str, u.name, u.email 
      FROM attendance a 
      LEFT JOIN users u ON a.worker_id = u.id 
      WHERE 1=1
    `;
    const params = [];

    if (start_date) {
      params.push(start_date);
      sql += ` AND a.date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      sql += ` AND a.date <= $${params.length}`;
    }
    if (worker_id) {
      params.push(worker_id);
      sql += ` AND a.worker_id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND a.status = $${params.length}`;
    }

    // Ensure we're fetching dates as strings to avoid timezone shifts in JSON response
    sql += ' ORDER BY a.date DESC, a.check_in_time DESC';

    const result = await query(sql, params);

    // Process results to include GPS verification status and ensure date is string
    const processedRows = result.rows.map(row => ({
      ...row,
      date: row.date_str || row.date, // Use the text version of date to avoid timezone shifts
      gps_check_in_verified: !!(row.check_in_latitude && row.check_in_longitude),
      gps_check_out_verified: !!(row.check_out_latitude && row.check_out_longitude)
    }));

    res.json(processedRows);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GPS location verification
router.post('/verify-location', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, worker_id } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Validate GPS coordinates
    const validation = validateGPSCoordinates(latitude, longitude, accuracy);
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.error });
    }

    // Calculate distance from business location
    const distance = calculateDistance(latitude, longitude, BUSINESS_LOCATION.LATITUDE, BUSINESS_LOCATION.LONGITUDE);
    const isWithinRadius = distance <= BUSINESS_LOCATION.ALLOWED_RADIUS_METERS;

    res.json({
      verified: isWithinRadius,
      distance_meters: Math.round(distance),
      max_allowed_distance: BUSINESS_LOCATION.ALLOWED_RADIUS_METERS,
      business_location: {
        latitude: BUSINESS_LOCATION.LATITUDE,
        longitude: BUSINESS_LOCATION.LONGITUDE
      },
      worker_location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        accuracy: accuracy ? Math.round(accuracy) : null
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verify location logic here
// ...

// Enroll fingerprint template
router.post('/enroll-fingerprint', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { worker_id, fingerprint_template } = req.body;
    if (!worker_id || !fingerprint_template) {
      return res.status(400).json({ error: 'Worker ID and fingerprint template are required' });
    }

    await query('UPDATE users SET fingerprint_template = $1 WHERE id = $2', [fingerprint_template, worker_id]);
    res.json({ message: 'Fingerprint enrolled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify scanned fingerprint and mark attendance
router.post('/verify-fingerprint', authenticate, async (req, res) => {
  try {
    const { worker_id, fingerprint_data } = req.body;
    if (!worker_id) {
      return res.status(400).json({ error: 'Worker ID is required' });
    }
    // Verification is now handled by the local ZKBridge SDK via the frontend.
    // The frontend sends the matched worker_id directly after identifying them.
    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const existing = await query(
      `SELECT * FROM attendance 
       WHERE worker_id = $1 
       AND (date = $2 OR date::text LIKE $3)`,
      [worker_id, today, `${today}%`]
    );

    if (existing.rows.length > 0) {
      // If already checked in, maybe they are checking out? Or just reject.
      // For simplicity, let's say "Already checked in".
      return res.status(400).json({ error: 'Already checked in today' });
    }

    let attendanceStatus = 'present';

    // Lateness detection (9:00 AM Lagos Time)
    const lagosNow = getLagosTime();
    const resumptionTime = new Date(lagosNow);
    resumptionTime.setHours(WORK_HOURS.RESUMPTION.HOUR, WORK_HOURS.RESUMPTION.MINUTE, 0, 0);

    if (lagosNow > resumptionTime) {
      attendanceStatus = 'late';
    }

    const result = await query(
      `INSERT INTO attendance (worker_id, date, check_in_time, status, 
                              location_verification_status) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        worker_id,
        today,
        new Date().toISOString(),
        attendanceStatus,
        'verified' // Fingerprint counts as verified
      ]
    );

    // Update user status
    try {
      await query("UPDATE users SET current_status = 'available' WHERE id = $1 AND current_status != 'busy'", [worker_id]);
    } catch (statusError) {
      console.error('Failed to update user status on fingerprint checkin:', statusError);
    }

    res.json({
      message: 'Attendance marked successfully via fingerprint',
      attendance: result.rows[0],
      gps_verified: false,
      location_verification_status: 'verified'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kiosk Mode: Auto Check-in or Check-out via fingerprint (now verified by local SDK bridge)
router.post('/kiosk-scan', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { worker_id } = req.body;
    
    if (!worker_id) {
      return res.status(400).json({ error: 'Worker ID is required. Fingerprint matching must occur locally.' });
    }

    // Get user details
    const userResult = await query('SELECT name FROM users WHERE id = $1 AND is_active = true', [worker_id]);
    if (userResult.rows.length === 0) {
       return res.status(404).json({ error: 'Worker not found or inactive.' });
    }
    const workerName = userResult.rows[0].name;

    const today = new Date().toISOString().split('T')[0];

    // Check existing attendance for today
    const existing = await query(
      `SELECT * FROM attendance 
       WHERE worker_id = $1 
       AND (date = $2 OR date::text LIKE $3)
       ORDER BY created_at DESC LIMIT 1`,
      [worker_id, today, `${today}%`]
    );

    let action = 'check_in';

    if (existing.rows.length > 0) {
      const record = existing.rows[0];
      if (record.check_out_time) {
        return res.status(400).json({ error: `${workerName} has already checked out for today.` });
      }
      
      // Perform Check-Out
      action = 'check_out';
      await query(
        `UPDATE attendance 
         SET check_out_time = $1, location_verification_status = 'verified'
         WHERE id = $2`,
        [new Date().toISOString(), record.id]
      );

      // Update user status
      try {
        await query("UPDATE users SET current_status = 'offline' WHERE id = $1", [worker_id]);
      } catch (err) {}

    } else {
      // Perform Check-In
      action = 'check_in';
      let attendanceStatus = 'present';

      // Lateness detection
      const lagosNow = getLagosTime();
      const resumptionTime = new Date(lagosNow);
      resumptionTime.setHours(WORK_HOURS.RESUMPTION.HOUR, WORK_HOURS.RESUMPTION.MINUTE, 0, 0);

      if (lagosNow > resumptionTime) {
        attendanceStatus = 'late';
      }

      await query(
        `INSERT INTO attendance (worker_id, date, check_in_time, status, location_verification_status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [worker_id, today, new Date().toISOString(), attendanceStatus, 'verified']
      );

      // Update user status
      try {
        await query("UPDATE users SET current_status = 'available' WHERE id = $1 AND current_status != 'busy'", [worker_id]);
      } catch (err) {}
    }

    res.json({
      success: true,
      action: action,
      worker_name: workerName,
      message: `Successfully ${action === 'check_in' ? 'checked in' : 'checked out'} ${workerName}`
    });

  } catch (error) {
    console.error('Kiosk scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public Kiosk Mode: Auto Check-in or Check-out via fingerprint (no auth required)
router.post('/public-kiosk-scan', async (req, res) => {
  try {
    const { worker_id } = req.body;
    
    if (!worker_id) {
      return res.status(400).json({ error: 'Worker ID is required. Fingerprint matching must occur locally.' });
    }

    // Get user details
    const userResult = await query('SELECT name FROM users WHERE id = $1 AND is_active = true', [worker_id]);
    if (userResult.rows.length === 0) {
       return res.status(404).json({ error: 'Worker not found or inactive.' });
    }
    const workerName = userResult.rows[0].name;

    const today = new Date().toISOString().split('T')[0];

    // Check existing attendance for today
    const existing = await query(
      `SELECT * FROM attendance 
       WHERE worker_id = $1 
       AND (date = $2 OR date::text LIKE $3)
       ORDER BY created_at DESC LIMIT 1`,
      [worker_id, today, `${today}%`]
    );

    let action = 'check_in';

    if (existing.rows.length > 0) {
      const record = existing.rows[0];
      if (record.check_out_time) {
        return res.status(400).json({ error: `${workerName} has already checked out for today.` });
      }
      
      // Perform Check-Out
      action = 'check_out';
      await query(
        `UPDATE attendance 
         SET check_out_time = $1, location_verification_status = 'verified'
         WHERE id = $2`,
        [new Date().toISOString(), record.id]
      );

      // Update user status
      try {
        await query("UPDATE users SET current_status = 'offline' WHERE id = $1", [worker_id]);
      } catch (err) {}

    } else {
      // Perform Check-In
      action = 'check_in';
      let attendanceStatus = 'present';

      // Lateness detection
      const lagosNow = getLagosTime();
      const resumptionTime = new Date(lagosNow);
      resumptionTime.setHours(WORK_HOURS.RESUMPTION.HOUR, WORK_HOURS.RESUMPTION.MINUTE, 0, 0);

      if (lagosNow > resumptionTime) {
        attendanceStatus = 'late';
      }

      await query(
        `INSERT INTO attendance (worker_id, date, check_in_time, status, location_verification_status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [worker_id, today, new Date().toISOString(), attendanceStatus, 'verified']
      );

      // Update user status
      try {
        await query("UPDATE users SET current_status = 'available' WHERE id = $1 AND current_status != 'busy'", [worker_id]);
      } catch (err) {}
    }

    res.json({
      success: true,
      action: action,
      worker_name: workerName,
      message: `Successfully ${action === 'check_in' ? 'checked in' : 'checked out'} ${workerName}`
    });

  } catch (error) {
    console.error('Public kiosk scan error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all enrolled fingerprint templates for the local bridge to match against
router.get('/templates', async (req, res) => {
  try {
    const result = await query("SELECT id, fingerprint_template as template FROM users WHERE fingerprint_template IS NOT NULL AND is_active = true");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// TIME-OFF REQUESTS
// ==========================================

// Submit time-off request
router.post('/time-off', authenticate, async (req, res) => {
  try {
    const { worker_id, start_date, end_date, reason, type = 'time_off' } = req.body;

    if (!worker_id || !start_date || !end_date || !reason) {
      return res.status(400).json({ error: 'worker_id, start_date, end_date, and reason are required' });
    }

    const result = await query(
      `INSERT INTO time_off_requests (worker_id, start_date, end_date, reason, type, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [worker_id, start_date, end_date, reason, type]
    );

    res.status(201).json({ message: 'Time-off request submitted', request: result.rows[0] });
  } catch (error) {
    console.error('Time-off request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get time-off requests (own for staff, all for manager/admin)
router.get('/time-off', authenticate, async (req, res) => {
  try {
    const { worker_id, status } = req.query;
    let sql = `
      SELECT tor.*, u.name as worker_name
      FROM time_off_requests tor
      JOIN users u ON tor.worker_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // Non-admin/manager can only see their own
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      sql += ` AND tor.worker_id = $${idx++}`;
      params.push(req.user.id);
    } else if (worker_id) {
      sql += ` AND tor.worker_id = $${idx++}`;
      params.push(worker_id);
    }

    if (status) {
      sql += ` AND tor.status = $${idx++}`;
      params.push(status);
    }

    sql += ' ORDER BY tor.created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get time-off requests error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Approve/reject time-off request (manager/admin only)
router.put('/time-off/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const result = await query(
      `UPDATE time_off_requests
       SET status = $1, reviewed_by = $2, review_notes = $3, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, req.user.id, review_notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time-off request not found' });
    }

    res.json({ message: `Time-off request ${status}`, request: result.rows[0] });
  } catch (error) {
    console.error('Update time-off request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// ATTENDANCE CORRECTION REQUESTS
// ==========================================

// Submit attendance correction request
router.post('/correction-request', authenticate, async (req, res) => {
  try {
    const { worker_id, date, requested_check_in, requested_check_out, reason } = req.body;

    if (!worker_id || !date || !reason) {
      return res.status(400).json({ error: 'worker_id, date, and reason are required' });
    }

    // Get existing attendance record if any
    let existingAttendance = null;
    const existingResult = await query(
      'SELECT * FROM attendance WHERE worker_id = $1 AND date = $2',
      [worker_id, date]
    );
    if (existingResult.rows.length > 0) {
      existingAttendance = existingResult.rows[0];
    }

    const result = await query(
      `INSERT INTO attendance_correction_requests
       (worker_id, date, existing_check_in, existing_check_out, requested_check_in, requested_check_out, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        worker_id,
        date,
        existingAttendance?.check_in_time || null,
        existingAttendance?.check_out_time || null,
        requested_check_in || null,
        requested_check_out || null,
        reason
      ]
    );

    res.status(201).json({ message: 'Correction request submitted', request: result.rows[0] });
  } catch (error) {
    console.error('Correction request error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get correction requests
router.get('/correction-requests', authenticate, async (req, res) => {
  try {
    const { worker_id, status } = req.query;
    let sql = `
      SELECT acr.*, u.name as worker_name
      FROM attendance_correction_requests acr
      JOIN users u ON acr.worker_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      sql += ` AND acr.worker_id = $${idx++}`;
      params.push(req.user.id);
    } else if (worker_id) {
      sql += ` AND acr.worker_id = $${idx++}`;
      params.push(worker_id);
    }

    if (status) {
      sql += ` AND acr.status = $${idx++}`;
      params.push(status);
    }

    sql += ' ORDER BY acr.created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get correction requests error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Approve/reject correction request (manager/admin only)
router.put('/correction-requests/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  const { getClient } = await import('../config/db.js');
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { status, review_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    // Get the correction request
    const requestResult = await client.query(
      'SELECT * FROM attendance_correction_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Correction request not found' });
    }

    const correctionReq = requestResult.rows[0];

    // Update the request status
    const updateResult = await client.query(
      `UPDATE attendance_correction_requests
       SET status = $1, reviewed_by = $2, review_notes = $3, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, req.user.id, review_notes || null, id]
    );

    // If approved, update the attendance record
    if (status === 'approved') {
      if (correctionReq.requested_check_in || correctionReq.requested_check_out) {
        // Update existing attendance record
        await client.query(
          `UPDATE attendance
           SET check_in_time = COALESCE($1, check_in_time),
               check_out_time = COALESCE($2, check_out_time),
               status = 'present',
               updated_at = CURRENT_TIMESTAMP
           WHERE worker_id = $3 AND date = $4`,
          [correctionReq.requested_check_in, correctionReq.requested_check_out, correctionReq.worker_id, correctionReq.date]
        );
      } else {
        // Create new attendance record if none exists
        await client.query(
          `INSERT INTO attendance (worker_id, date, check_in_time, check_out_time, status, location_verification_status)
           VALUES ($1, $2, $3, $4, 'present', 'verified')`,
          [correctionReq.worker_id, correctionReq.date, correctionReq.requested_check_in, correctionReq.requested_check_out]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: `Correction request ${status}`, request: updateResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update correction request error:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get today's attendance for the kiosk display
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await query(
      `SELECT a.id, a.worker_id, a.check_in_time, a.check_out_time, a.status, a.location_verification_status, u.name as worker_name
       FROM attendance a
       JOIN users u ON a.worker_id = u.id
       WHERE DATE(a.check_in_time) = $1
       ORDER BY a.check_in_time ASC`,
      [today]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;