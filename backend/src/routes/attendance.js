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

// Calculate distance between two coordinates in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

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
      message = 'Attendance marked successfully.';
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

export default router;