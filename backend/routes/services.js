import express from 'express';
import { supabase } from '../config/supabase-db.js';
import { authenticateToken, requireStaff, requireAdmin } from '../middleware/auth.js';
import { validateService, validateUUID, validatePagination } from '../middleware/validation.js';

const router = express.Router();

// Get all services
router.get('/', validatePagination, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, is_active = true } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('services')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data: services, error, count } = await query;

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch services', 
        message: error.message 
      });
    }

    res.json({
      services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Services fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get service by ID
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ 
        error: 'Service not found', 
        message: error.message 
      });
    }

    res.json({ service });
  } catch (error) {
    console.error('Service fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new service (Admin only)
router.post('/', authenticateToken, requireAdmin, validateService, async (req, res) => {
  try {
    const { name, description, duration, price, category } = req.body;

    const { data: service, error } = await supabase
      .from('services')
      .insert({
        name,
        description,
        duration,
        price,
        category
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to create service', 
        message: error.message 
      });
    }

    res.status(201).json({
      message: 'Service created successfully',
      service
    });
  } catch (error) {
    console.error('Service creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update service (Admin only)
router.put('/:id', authenticateToken, requireAdmin, validateUUID, validateService, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, duration, price, category, is_active } = req.body;

    const { data: service, error } = await supabase
      .from('services')
      .update({
        name,
        description,
        duration,
        price,
        category,
        is_active
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to update service', 
        message: error.message 
      });
    }

    res.json({
      message: 'Service updated successfully',
      service
    });
  } catch (error) {
    console.error('Service update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete service (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, validateUUID, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if service has any bookings
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select('id')
      .eq('service_id', id)
      .limit(1);

    if (bookingError) {
      return res.status(400).json({ 
        error: 'Failed to check service bookings', 
        message: bookingError.message 
      });
    }

    if (bookings && bookings.length > 0) {
      // Soft delete - deactivate instead of hard delete
      const { data: service, error } = await supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ 
          error: 'Failed to deactivate service', 
          message: error.message 
        });
      }

      return res.json({
        message: 'Service deactivated successfully (has existing bookings)',
        service
      });
    }

    // Hard delete if no bookings
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to delete service', 
        message: error.message 
      });
    }

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error('Service deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get service categories
router.get('/categories/list', async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('services')
      .select('category')
      .not('category', 'is', null)
      .eq('is_active', true);

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to fetch categories', 
        message: error.message 
      });
    }

    // Get unique categories
    const uniqueCategories = [...new Set(categories.map(item => item.category))];

    res.json({ categories: uniqueCategories });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get service statistics (Staff/Admin only)
router.get('/stats/overview', authenticateToken, requireStaff, async (req, res) => {
  try {
    // Total services
    const { count: totalServices, error: totalError } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (totalError) {
      return res.status(400).json({ 
        error: 'Failed to fetch service stats', 
        message: totalError.message 
      });
    }

    // Services by category
    const { data: categoryStats, error: categoryError } = await supabase
      .from('services')
      .select('category')
      .eq('is_active', true);

    if (categoryError) {
      return res.status(400).json({ 
        error: 'Failed to fetch category stats', 
        message: categoryError.message 
      });
    }

    const categoryCounts = categoryStats.reduce((acc, service) => {
      const category = service.category || 'Uncategorized';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Most popular services (based on bookings)
    const { data: popularServices, error: popularError } = await supabase
      .from('bookings')
      .select(`
        service_id,
        services(name)
      `)
      .eq('status', 'completed')
      .not('services', 'is', null);

    if (popularError) {
      return res.status(400).json({ 
        error: 'Failed to fetch popular services', 
        message: popularError.message 
      });
    }

    const serviceCounts = popularServices.reduce((acc, booking) => {
      const serviceName = booking.services?.name;
      if (serviceName) {
        acc[serviceName] = (acc[serviceName] || 0) + 1;
      }
      return acc;
    }, {});

    const topServices = Object.entries(serviceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, bookings: count }));

    res.json({
      totalServices,
      categoryCounts,
      topServices
    });
  } catch (error) {
    console.error('Service stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;