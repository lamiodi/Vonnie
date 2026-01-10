/**
 * Business Logic Validation Service
 * Validates booking conflicts, worker availability, and business rules
 */

import { query } from '../config/db.js';

/**
 * Check if a booking time slot conflicts with existing bookings
 * @param {Date} scheduledTime - Proposed booking time
 * @param {number} estimatedDuration - Estimated duration in minutes
 * @param {Array} workerIds - Array of worker IDs assigned to the booking
 * @param {string} excludeBookingId - Optional booking ID to exclude (for updates)
 * @returns {Promise<Object>} Validation result
 */
export async function validateBookingTimeConflict(scheduledTime, estimatedDuration, workerIds = [], excludeBookingId = null) {
  try {
    const startTime = new Date(scheduledTime);
    const endTime = new Date(startTime.getTime() + (estimatedDuration || 60) * 60 * 1000); // Default 1 hour
    
    // Check for overlapping bookings
    let conflictQuery = `
      SELECT 
        b.id,
        b.booking_number,
        b.scheduled_time,
        b.status,
        b.duration,
        u.name as worker_name,
        u.id as worker_id,
        CASE 
          WHEN b.scheduled_time <= $1 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') > $1 THEN 'starts_during'
          WHEN b.scheduled_time < $2 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') >= $2 THEN 'ends_during'
          WHEN b.scheduled_time >= $1 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') <= $2 THEN 'completely_overlaps'
          ELSE 'adjacent'
        END as conflict_type
      FROM bookings b
      LEFT JOIN booking_workers bw ON b.id = bw.booking_id AND bw.status = 'active'
      LEFT JOIN users u ON bw.worker_id = u.id
      WHERE b.status IN ('scheduled', 'in-progress', 'confirmed')
        AND (
          (b.scheduled_time <= $1 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') > $1) OR
          (b.scheduled_time < $2 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') >= $2) OR
          (b.scheduled_time >= $1 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') <= $2)
        )
    `;
    
    const queryParams = [startTime, endTime];
    
    // Exclude current booking if updating
    if (excludeBookingId) {
      conflictQuery += ` AND b.id != $${queryParams.length + 1}`;
      queryParams.push(excludeBookingId);
    }
    
    // Filter by workers if provided
    if (workerIds.length > 0) {
      conflictQuery += ` AND bw.worker_id = ANY($${queryParams.length + 1})`;
      queryParams.push(workerIds);
    }
    
    conflictQuery += ` ORDER BY b.scheduled_time`;
    
    const conflicts = await query(conflictQuery, queryParams);
    
    if (conflicts.rows.length > 0) {
      return {
        isValid: false,
        conflicts: conflicts.rows,
        message: `Time slot conflict detected with ${conflicts.rows.length} existing booking(s)`,
        details: conflicts.rows.map(conflict => ({
          bookingNumber: conflict.booking_number,
          worker: conflict.worker_name,
          scheduledTime: conflict.scheduled_time,
          conflictType: conflict.conflict_type
        }))
      };
    }
    
    return {
      isValid: true,
      message: 'No time conflicts found'
    };
    
  } catch (error) {
    console.error('Error validating booking time conflict:', error);
    return {
      isValid: false,
      message: 'Error validating booking time conflict',
      error: error.message
    };
  }
}

/**
 * Check worker availability for a given time slot
 * @param {Array} workerIds - Array of worker IDs to check
 * @param {Date} scheduledTime - Proposed booking time
 * @param {number} estimatedDuration - Estimated duration in minutes
 * @returns {Promise<Object>} Availability result
 */
export async function validateWorkerAvailability(workerIds, scheduledTime, estimatedDuration = 60) {
  try {
    if (!workerIds || workerIds.length === 0) {
      return {
        isValid: false,
        message: 'At least one worker must be assigned'
      };
    }
    
    const startTime = new Date(scheduledTime);
    const endTime = new Date(startTime.getTime() + estimatedDuration * 60 * 1000);
    
    // Check worker availability and current status
    const availabilityQuery = `
      SELECT 
        u.id as worker_id,
        u.name as worker_name,
        u.current_status as worker_status,
        u.is_active,
        COUNT(bw.id) as active_bookings,
        CASE 
          WHEN u.is_active = false THEN 'inactive'
          WHEN u.current_status = 'absent' THEN 'absent'
          WHEN u.current_status = 'unavailable' THEN 'unavailable'
          WHEN u.current_status = 'on_break' THEN 'on_break'
          WHEN COUNT(bw.id) > 0 THEN 'busy'
          ELSE 'available'
        END as availability_status
      FROM users u
      LEFT JOIN booking_workers bw ON u.id = bw.worker_id AND bw.status = 'active'
      LEFT JOIN bookings b ON bw.booking_id = b.id AND b.status IN ('scheduled', 'in-progress')
      WHERE u.id = ANY($1) AND u.role = 'staff'
      GROUP BY u.id, u.name, u.current_status, u.is_active
    `;
    
    const availabilityResult = await query(availabilityQuery, [workerIds]);
    
    const unavailableWorkers = availabilityResult.rows.filter(worker => 
      worker.availability_status !== 'available'
    );
    
    if (unavailableWorkers.length > 0) {
      return {
        isValid: false,
        unavailableWorkers: unavailableWorkers.map(worker => ({
          id: worker.worker_id,
          name: worker.worker_name,
          status: worker.availability_status,
          reason: getAvailabilityReason(worker.availability_status)
        })),
        message: `${unavailableWorkers.length} worker(s) are not available`
      };
    }
    
    // Check for time conflicts for available workers
    const timeConflictResult = await validateBookingTimeConflict(
      scheduledTime, 
      estimatedDuration, 
      workerIds
    );
    
    if (!timeConflictResult.isValid) {
      return {
        isValid: false,
        message: 'Workers have scheduling conflicts',
        conflicts: timeConflictResult.conflicts
      };
    }
    
    return {
      isValid: true,
      message: 'All workers are available',
      availableWorkers: availabilityResult.rows
    };
    
  } catch (error) {
    console.error('Error validating worker availability:', error);
    return {
      isValid: false,
      message: 'Error validating worker availability',
      error: error.message
    };
  }
}

/**
 * Validate service pricing consistency
 * @param {Array} serviceIds - Array of service IDs
 * @param {Object} pricingData - Pricing data to validate
 * @returns {Promise<Object>} Validation result
 */
export async function validateServicePricing(serviceIds, pricingData = {}) {
  try {
    if (!serviceIds || serviceIds.length === 0) {
      return {
        isValid: false,
        message: 'At least one service must be selected'
      };
    }
    
    // Fetch current service pricing
    const pricingQuery = `
      SELECT 
        id,
        name,
        price,
        duration,
        is_active
      FROM services 
      WHERE id = ANY($1) AND is_active = true
    `;
    
    const pricingResult = await query(pricingQuery, [serviceIds]);
    
    if (pricingResult.rows.length !== serviceIds.length) {
      const foundIds = pricingResult.rows.map(s => s.id);
      const missingIds = serviceIds.filter(id => !foundIds.includes(id));
      
      return {
        isValid: false,
        message: `${missingIds.length} service(s) not found or inactive`,
        missingServices: missingIds
      };
    }
    
    // Calculate expected total
    const expectedTotal = pricingResult.rows.reduce((total, service) => {
      const quantity = pricingData.quantities?.[service.id] || 1;
      return total + (service.price * quantity);
    }, 0);
    
    // Validate provided total against calculated total
    if (pricingData.totalAmount && Math.abs(pricingData.totalAmount - expectedTotal) > 0.01) {
      return {
        isValid: false,
        message: 'Pricing mismatch detected',
        expectedTotal: expectedTotal,
        providedTotal: pricingData.totalAmount,
        difference: Math.abs(pricingData.totalAmount - expectedTotal)
      };
    }
    
    // Validate individual service pricing if provided
    const pricingErrors = [];
    if (pricingData.individualPrices) {
      pricingResult.rows.forEach(service => {
        const providedPrice = pricingData.individualPrices[service.id];
        if (providedPrice && Math.abs(providedPrice - service.price) > 0.01) {
          pricingErrors.push({
            serviceId: service.id,
            serviceName: service.name,
            expectedPrice: service.price,
            providedPrice: providedPrice
          });
        }
      });
    }
    
    if (pricingErrors.length > 0) {
      return {
        isValid: false,
        message: 'Individual service pricing mismatches detected',
        pricingErrors: pricingErrors
      };
    }
    
    return {
      isValid: true,
      message: 'Service pricing is valid',
      totalAmount: expectedTotal,
      services: pricingResult.rows
    };
    
  } catch (error) {
    console.error('Error validating service pricing:', error);
    return {
      isValid: false,
      message: 'Error validating service pricing',
      error: error.message
    };
  }
}

/**
 * Comprehensive booking validation before creation/update
 * @param {Object} bookingData - Booking data to validate
 * @param {string} excludeBookingId - Optional booking ID to exclude (for updates)
 * @returns {Promise<Object>} Validation result
 */
export async function validateBookingData(bookingData, excludeBookingId = null) {
  try {
    const errors = [];
    const warnings = [];
    
    // Validate required fields
    const requiredFields = ['customer_name', 'customer_phone', 'scheduled_time', 'services'];
    for (const field of requiredFields) {
      if (!bookingData[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    if (errors.length > 0) {
      return {
        isValid: false,
        message: 'Missing required fields',
        errors: errors
      };
    }
    
    // Validate customer phone format
    const phoneRegex = /^[\d\s\-\(\)\+]{10,}$/;
    if (bookingData.customer_phone && !phoneRegex.test(bookingData.customer_phone)) {
      errors.push('Invalid phone number format');
    }
    
    // Validate scheduled time is in the future
    const scheduledTime = new Date(bookingData.scheduled_time);
    const now = new Date();
    const minAdvanceTime = 30; // 30 minutes minimum advance notice
    
    if (scheduledTime <= now) {
      errors.push('Scheduled time must be in the future');
    } else if (scheduledTime < new Date(now.getTime() + minAdvanceTime * 60 * 1000)) {
      warnings.push('Booking is scheduled with less than 30 minutes advance notice');
    }
    
    // Validate worker availability
    if (bookingData.worker_ids && bookingData.worker_ids.length > 0) {
      const workerAvailability = await validateWorkerAvailability(
        bookingData.worker_ids,
        bookingData.scheduled_time,
        bookingData.estimated_duration
      );
      
      if (!workerAvailability.isValid) {
        errors.push(workerAvailability.message);
        if (workerAvailability.unavailableWorkers) {
          errors.push(...workerAvailability.unavailableWorkers.map(w => 
            `${w.name} is ${w.status}: ${w.reason}`
          ));
        }
      }
    }
    
    // Validate service pricing
    if (bookingData.services && bookingData.services.length > 0) {
      const serviceValidation = await validateServicePricing(
        bookingData.services.map(s => s.id || s),
        {
          totalAmount: bookingData.total_amount,
          quantities: bookingData.service_quantities
        }
      );
      
      if (!serviceValidation.isValid) {
        errors.push(serviceValidation.message);
      }
    }
    
    // Validate booking time conflicts
    if (bookingData.scheduled_time && bookingData.worker_ids) {
      const conflictValidation = await validateBookingTimeConflict(
        bookingData.scheduled_time,
        bookingData.estimated_duration,
        bookingData.worker_ids,
        excludeBookingId
      );
      
      if (!conflictValidation.isValid) {
        errors.push(conflictValidation.message);
        if (conflictValidation.conflicts) {
          errors.push(...conflictValidation.conflicts.map(c => 
            `Conflict with booking ${c.bookingNumber} for ${c.worker}`
          ));
        }
      }
    }
    
    if (errors.length > 0) {
      return {
        isValid: false,
        message: 'Booking validation failed',
        errors: errors,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    }
    
    return {
      isValid: true,
      message: 'Booking data is valid',
      warnings: warnings.length > 0 ? warnings : undefined
    };
    
  } catch (error) {
    console.error('Error validating booking data:', error);
    return {
      isValid: false,
      message: 'Error validating booking data',
      error: error.message
    };
  }
}

/**
 * Helper function to get availability reason
 * @param {string} status - Availability status
 * @returns {string} Human-readable reason
 */
function getAvailabilityReason(status) {
  const reasons = {
    'inactive': 'Worker account is inactive',
    'unavailable': 'Worker is marked as unavailable',
    'on_break': 'Worker is currently on break',
    'busy': 'Worker has active bookings'
  };
  
  return reasons[status] || 'Worker is not available';
}

/**
 * Enhanced worker availability validation with row-level locking
 * Prevents race conditions by locking worker rows during validation
 * @param {Array} workerIds - Array of worker IDs to validate
 * @param {Date} scheduledTime - Proposed booking time
 * @param {number} estimatedDuration - Estimated duration in minutes
 * @param {string} excludeBookingId - Optional booking ID to exclude
 * @param {Object} client - Database client for transaction context
 * @returns {Promise<Object>} Availability result with locking
 */
export async function validateWorkerAvailabilityWithLocking(workerIds, scheduledTime, estimatedDuration = 60, excludeBookingId = null, client = null) {
  try {
    if (!workerIds || workerIds.length === 0) {
      return {
        isValid: false,
        message: 'At least one worker must be assigned'
      };
    }
    
    const startTime = new Date(scheduledTime);
    const endTime = new Date(startTime.getTime() + estimatedDuration * 60 * 1000);
    
    // Use provided client or default query function
    // Fix: Ensure queryFunction is callable even if client object is passed
    const queryFunction = client ? (text, params) => client.query(text, params) : query;
    
    // 🔒 CRITICAL: Lock worker rows to prevent concurrent assignments
    const availabilityQuery = `
      WITH locked_workers AS (
        SELECT id, name, current_status, is_active
        FROM users
        WHERE id = ANY($1) AND role = 'staff'
        FOR UPDATE SKIP LOCKED
      )
      SELECT 
        u.id as worker_id,
        u.name as worker_name,
        u.current_status as worker_status,
        u.is_active,
        -- Count only OVERLAPPING active bookings
        COUNT(CASE 
          WHEN bw.id IS NOT NULL 
               AND b.status IN ('scheduled', 'in-progress', 'confirmed')
               AND (b.scheduled_time < $3 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') > $2)
               AND ($4::uuid IS NULL OR b.id != $4)
          THEN 1 
          ELSE NULL 
        END) as active_bookings,
        CASE 
          WHEN u.is_active = false THEN 'inactive'
          WHEN u.current_status = 'unavailable' THEN 'unavailable'
          WHEN u.current_status = 'on_break' THEN 'on_break'
          -- Check overlap count instead of total count
          WHEN COUNT(CASE 
            WHEN bw.id IS NOT NULL 
                 AND b.status IN ('scheduled', 'in-progress', 'confirmed')
                 AND (b.scheduled_time < $3 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') > $2)
                 AND ($4::uuid IS NULL OR b.id != $4)
            THEN 1 
            ELSE NULL 
          END) > 0 THEN 'busy'
          ELSE 'available'
        END as availability_status
      FROM locked_workers u
      LEFT JOIN booking_workers bw ON u.id = bw.worker_id AND bw.status = 'active'
      LEFT JOIN bookings b ON bw.booking_id = b.id
      GROUP BY u.id, u.name, u.current_status, u.is_active
    `;
    
    const availabilityResult = await queryFunction(availabilityQuery, [workerIds, startTime, endTime, excludeBookingId]);
    
    // Check if any workers were skipped due to locking
    if (availabilityResult.rows.length !== workerIds.length) {
      const lockedWorkerIds = workerIds.filter(id => 
        !availabilityResult.rows.some(row => row.worker_id === id)
      );
      
      return {
        isValid: false,
        message: `Some workers are currently being assigned by another user: ${lockedWorkerIds.join(', ')}`,
        lockedWorkers: lockedWorkerIds
      };
    }
    
    const unavailableWorkers = availabilityResult.rows.filter(worker => 
      worker.availability_status !== 'available'
    );
    
    if (unavailableWorkers.length > 0) {
      return {
        isValid: false,
        unavailableWorkers: unavailableWorkers.map(worker => ({
          id: worker.worker_id,
          name: worker.worker_name,
          status: worker.availability_status,
          reason: getAvailabilityReason(worker.availability_status)
        })),
        message: `${unavailableWorkers.length} worker(s) are not available`
      };
    }
    
    // Check for time conflicts with row locking
    const timeConflictResult = await validateBookingTimeConflictWithLocking(
      scheduledTime, 
      estimatedDuration, 
      workerIds,
      excludeBookingId,
      queryFunction
    );
    
    if (!timeConflictResult.isValid) {
      return {
        isValid: false,
        message: 'Workers have scheduling conflicts',
        conflicts: timeConflictResult.conflicts
      };
    }
    
    return {
      isValid: true,
      message: 'All workers are available',
      availableWorkers: availabilityResult.rows
    };
    
  } catch (error) {
    console.error('Error validating worker availability with locking:', error);
    return {
      isValid: false,
      message: 'Error validating worker availability',
      error: error.message
    };
  }
}

/**
 * Enhanced time conflict validation with row locking
 * @param {Date} scheduledTime - Proposed booking time
 * @param {number} estimatedDuration - Estimated duration in minutes
 * @param {Array} workerIds - Array of worker IDs
 * @param {string} excludeBookingId - Optional booking ID to exclude
 * @param {Function} queryFunction - Query function (with transaction context)
 * @returns {Promise<Object>} Conflict validation result
 */
async function validateBookingTimeConflictWithLocking(scheduledTime, estimatedDuration, workerIds = [], excludeBookingId = null, queryFunction = query) {
  try {
    const startTime = new Date(scheduledTime);
    const endTime = new Date(startTime.getTime() + (estimatedDuration || 60) * 60 * 1000);
    
    // Check for overlapping bookings with row locking
    let conflictQuery = `
      SELECT 
        b.id,
        b.booking_number,
        b.scheduled_time,
        b.status,
        b.duration,
        u.name as worker_name,
        u.id as worker_id,
        CASE 
          WHEN b.scheduled_time <= $1 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') > $1 THEN 'starts_during'
          WHEN b.scheduled_time < $2 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') >= $2 THEN 'ends_during'
          WHEN b.scheduled_time >= $1 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') <= $2 THEN 'completely_overlaps'
          ELSE 'adjacent'
        END as conflict_type
      FROM bookings b
      INNER JOIN booking_workers bw ON b.id = bw.booking_id AND bw.status = 'active'
      INNER JOIN users u ON bw.worker_id = u.id
      WHERE b.status IN ('scheduled', 'in-progress', 'confirmed')
        AND (
          (b.scheduled_time <= $1 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') > $1) OR
          (b.scheduled_time < $2 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') >= $2) OR
          (b.scheduled_time >= $1 AND b.scheduled_time + (COALESCE(b.duration, 60) * interval '1 minute') <= $2)
        )
    `;
    
    const queryParams = [startTime, endTime];
    
    // Exclude current booking if updating
    if (excludeBookingId) {
      conflictQuery += ` AND b.id != $${queryParams.length + 1}`;
      queryParams.push(excludeBookingId);
    }
    
    // Filter by workers if provided
    if (workerIds.length > 0) {
      conflictQuery += ` AND bw.worker_id = ANY($${queryParams.length + 1})`;
      queryParams.push(workerIds);
    }
    
    // 🔒 LOCK CONFLICTING BOOKING ROWS TO PREVENT CONCURRENT ASSIGNMENTS
    conflictQuery += ` ORDER BY b.scheduled_time FOR UPDATE OF b`;
    
    const conflicts = await queryFunction(conflictQuery, queryParams);
    
    if (conflicts.length > 0) {
      return {
        isValid: false,
        message: `Time conflicts detected with ${conflicts.length} existing booking(s)`,
        conflicts: conflicts.map(conflict => ({
          bookingId: conflict.id,
          bookingNumber: conflict.booking_number,
          scheduledTime: conflict.scheduled_time,
          duration: conflict.duration,
          worker: conflict.worker_name,
          workerId: conflict.worker_id,
          conflictType: conflict.conflict_type
        }))
      };
    }
    
    return {
      isValid: true,
      message: 'No time conflicts detected'
    };
    
  } catch (error) {
    console.error('Error validating booking time conflict with locking:', error);
    return {
      isValid: false,
      message: 'Error validating time conflicts',
      error: error.message
    };
  }
}
