import express from 'express';
import { query } from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { successResponse, errorResponse, notFoundResponse } from '../utils/apiResponse.js';
import { validatePrice, validateDuration, validateStringLength } from '../utils/inputValidation.js';

const router = express.Router();

// Get all services
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, description, price, duration, category FROM services ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get service by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'SELECT id, name, description, price, duration, category FROM services WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Create new service
router.post('/', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { name, description, price, duration, category } = req.body;
    
    // Validate required fields
    if (!name || !price || !duration) {
      return res.status(400).json(errorResponse(
        'Name, price, and duration are required',
        'MISSING_REQUIRED_FIELDS',
        400
      ));
    }
    
    // Validate service name
    const nameValidation = validateStringLength(name, { min: 2, max: 100 });
    if (!nameValidation.isValid) {
      return res.status(400).json(errorResponse(
        `Service name: ${nameValidation.message}`,
        'INVALID_SERVICE_NAME',
        400
      ));
    }
    
    // Validate price
    const priceValidation = validatePrice(price, { min: 0.01, max: 1000 });
    if (!priceValidation.isValid) {
      return res.status(400).json(errorResponse(
        `Service price: ${priceValidation.message}`,
        'INVALID_SERVICE_PRICE',
        400
      ));
    }
    
    // Validate duration
    const durationValidation = validateDuration(duration, { min: 15, max: 300 });
    if (!durationValidation.isValid) {
      return res.status(400).json(errorResponse(
        `Service duration: ${durationValidation.message}`,
        'INVALID_SERVICE_DURATION',
        400
      ));
    }
    
    // Validate description if provided
    if (description) {
      const descValidation = validateStringLength(description, { max: 500, allowEmpty: true });
      if (!descValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Service description: ${descValidation.message}`,
          'INVALID_SERVICE_DESCRIPTION',
          400
        ));
      }
    }
    
    // Validate category if provided
    if (category) {
      const categoryValidation = validateStringLength(category, { max: 50, allowEmpty: true });
      if (!categoryValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Service category: ${categoryValidation.message}`,
          'INVALID_SERVICE_CATEGORY',
          400
        ));
      }
    }
    
    const result = await query(
      `INSERT INTO services (name, description, price, duration, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, description || null, price, duration, category || null]
    );
    
    res.status(201).json(successResponse(result.rows[0], 'Service created successfully', 201));
  } catch (error) {
    console.error('Create service error:', error);
    res.status(400).json(errorResponse(error.message, 'SERVICE_CREATION_ERROR', 400));
  }
});

// Update service
router.put('/:id', authenticate, authorize(['admin', 'manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, duration, category } = req.body;
    
    // Validate required fields if provided
    if (name !== undefined && !name) {
      return res.status(400).json(errorResponse(
        'Service name cannot be empty',
        'INVALID_SERVICE_NAME',
        400
      ));
    }
    
    if (price !== undefined && (price === null || price === undefined)) {
      return res.status(400).json(errorResponse(
        'Service price cannot be null',
        'INVALID_SERVICE_PRICE',
        400
      ));
    }
    
    if (duration !== undefined && (duration === null || duration === undefined)) {
      return res.status(400).json(errorResponse(
        'Service duration cannot be null',
        'INVALID_SERVICE_DURATION',
        400
      ));
    }
    
    // Validate service name if provided
    if (name !== undefined) {
      const nameValidation = validateStringLength(name, { min: 2, max: 100 });
      if (!nameValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Service name: ${nameValidation.message}`,
          'INVALID_SERVICE_NAME',
          400
        ));
      }
    }
    
    // Validate price if provided
    if (price !== undefined) {
      const priceValidation = validatePrice(price, { min: 0.01, max: 1000 });
      if (!priceValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Service price: ${priceValidation.message}`,
          'INVALID_SERVICE_PRICE',
          400
        ));
      }
    }
    
    // Validate duration if provided
    if (duration !== undefined) {
      const durationValidation = validateDuration(duration, { min: 15, max: 300 });
      if (!durationValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Service duration: ${durationValidation.message}`,
          'INVALID_SERVICE_DURATION',
          400
        ));
      }
    }
    
    // Validate description if provided
    if (description !== undefined) {
      const descValidation = validateStringLength(description, { max: 500, allowEmpty: true });
      if (!descValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Service description: ${descValidation.message}`,
          'INVALID_SERVICE_DESCRIPTION',
          400
        ));
      }
    }
    
    // Validate category if provided
    if (category !== undefined) {
      const categoryValidation = validateStringLength(category, { max: 50, allowEmpty: true });
      if (!categoryValidation.isValid) {
        return res.status(400).json(errorResponse(
          `Service category: ${categoryValidation.message}`,
          'INVALID_SERVICE_CATEGORY',
          400
        ));
      }
    }
    
    // Get current service data to merge with updates
    const currentResult = await query(
      'SELECT name, description, price, duration, category FROM services WHERE id = $1',
      [id]
    );
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json(notFoundResponse('Service not found'));
    }
    
    const currentService = currentResult.rows[0];
    const updatedService = {
      name: name !== undefined ? name : currentService.name,
      description: description !== undefined ? description : currentService.description,
      price: price !== undefined ? price : currentService.price,
      duration: duration !== undefined ? duration : currentService.duration,
      category: category !== undefined ? category : currentService.category
    };
    
    const result = await query(
      `UPDATE services 
       SET name = $1, description = $2, price = $3, duration = $4, category = $5
       WHERE id = $6
       RETURNING *`,
      [updatedService.name, updatedService.description, updatedService.price, updatedService.duration, updatedService.category, id]
    );
    
    res.json(successResponse(result.rows[0], 'Service updated successfully'));
  } catch (error) {
    console.error('Update service error:', error);
    res.status(400).json(errorResponse(error.message, 'SERVICE_UPDATE_ERROR', 400));
  }
});

// Delete service
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if service has existing bookings
    const bookingsResult = await query(
      'SELECT COUNT(*) FROM bookings WHERE service_id = $1',
      [id]
    );
    
    if (parseInt(bookingsResult.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete service with existing bookings. Archive instead.' 
      });
    }
    
    const result = await query(
      'DELETE FROM services WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;