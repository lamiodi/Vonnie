/**
 * GPS Coordinate Validation Utility
 * Validates latitude and longitude coordinates
 * 
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Object} Validation result with isValid flag and error message
 */
export function validateGPSCoordinates(latitude, longitude) {
  // If both are undefined, it's valid (GPS is optional)
  if (latitude === undefined && longitude === undefined) {
    return { isValid: true, error: null };
  }
  
  // If only one is provided, it's invalid
  if (latitude === undefined || longitude === undefined) {
    return { isValid: false, error: 'Both latitude and longitude must be provided' };
  }
  
  // Validate data types
  if (isNaN(latitude) || isNaN(longitude)) {
    return { isValid: false, error: 'Invalid GPS coordinates' };
  }
  
  // Validate ranges
  if (latitude < -90 || latitude > 90) {
    return { isValid: false, error: 'Latitude must be between -90 and 90' };
  }
  
  if (longitude < -180 || longitude > 180) {
    return { isValid: false, error: 'Longitude must be between -180 and 180' };
  }
  
  return { isValid: true, error: null };
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * 
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

/**
 * Business Location Configuration
 * Shop coordinates for Vonne X2X Management System
 */
export const BUSINESS_LOCATION = {
  LATITUDE: 6.439277581916012, // Shop latitude
  LONGITUDE: 3.4902032386207504, // Shop longitude
  ALLOWED_RADIUS_METERS: 100 // 100 meters radius
};

/**
 * Common validation patterns and constants
 */
export const VALIDATION_PATTERNS = {
  PHONE: /^[\d\s\-\(\)\+]{10,}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  BARCODE: /^[\dA-Za-z\-\_\.]{8,}$/
};

/**
 * Validate required fields in request body
 * 
 * @param {Object} body - Request body object
 * @param {Array} requiredFields - Array of required field names
 * @returns {Object} Validation result with isValid flag and missing fields
 */
export function validateRequiredFields(body, requiredFields) {
  const missingFields = requiredFields.filter(field => !body[field]);
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    error: missingFields.length > 0 ? `Missing required fields: ${missingFields.join(', ')}` : null
  };
}