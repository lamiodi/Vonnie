import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { errorHandler } from './middleware/error.js';

// Import routes
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import posRoutes from './routes/pos.js';
import workerRoutes from './routes/workers.js';
import attendanceRoutes from './routes/attendance.js';
import couponRoutes from './routes/coupons.js';
import reportRoutes from './routes/reports.js';
import serviceRoutes from './routes/services.js';
import inventoryRoutes from './routes/inventory.js';
import publicRoutes from './routes/public.js';

import paymentConfirmationRoutes from './routes/payment-confirmation.js';
import physicalPosPaymentRoutes from './routes/physical-pos-payments.js';
import adminRoutes from './routes/admin.js';
import queueRoutes from './routes/queue.js';
import paymentWebhooks from './routes/payment-webhooks.js';



// Load environment variables
if (process.env.NODE_ENV === 'development') {
  dotenv.config({ path: '.env.development' });
} else {
  dotenv.config();
}

// Check for required environment variables
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Application startup failed due to missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'http://localhost:5179', 'http://localhost:5180', 'http://localhost:5181'],
    credentials: true
  }
});

console.log('Environment:', process.env.NODE_ENV);
console.log('PORT from env:', process.env.PORT);
const PORT = process.env.PORT || 5006;
console.log('Final PORT:', PORT);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176', 'http://localhost:5177', 'http://localhost:5178', 'http://localhost:5179', 'http://localhost:5180', 'http://localhost:5181', 'http://localhost:5182'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/payment-confirmation', paymentConfirmationRoutes);
app.use('/api/physical-pos', physicalPosPaymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/webhooks', paymentWebhooks);



// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Join queue room for real-time updates
  socket.on('join-queue', () => {
    socket.join('queue-room');
    console.log('👥 Client joined queue room');
  });
  
  // Leave queue room
  socket.on('leave-queue', () => {
    socket.leave('queue-room');
    console.log('👋 Client left queue room');
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Vonne X2X Management System API is running',
    timestamp: new Date().toISOString()
  });
});

// Migration endpoint for admin
app.post('/api/admin/migrate-booking-statuses', async (req, res) => {
  try {
    // Simple security check - in production, add proper authentication
    if (req.headers['x-admin-key'] !== 'vonne-admin-2024') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { query } = await import('./config/database.js');

    console.log('🔄 Starting booking status migration...');

    // Step 1: First, update all existing statuses to valid new ones
    console.log('🔄 Migrating existing booking statuses...');
    
    // Convert 'pending' -> 'pending_confirmation'
    const pendingResult = await query(`
      UPDATE bookings SET status = 'pending_confirmation' 
      WHERE status = 'pending';
    `);
    console.log(`✅ Converted ${pendingResult.rowCount} pending bookings to pending_confirmation`);

    // Convert 'confirmed' -> 'scheduled'
    const confirmedResult = await query(`
      UPDATE bookings SET status = 'scheduled' 
      WHERE status = 'confirmed';
    `);
    console.log(`✅ Converted ${confirmedResult.rowCount} confirmed bookings to scheduled`);

    // Convert 'in_progress' -> 'in-progress'
    const inProgressResult = await query(`
      UPDATE bookings SET status = 'in-progress' 
      WHERE status = 'in_progress';
    `);
    console.log(`✅ Converted ${inProgressResult.rowCount} in_progress bookings to in-progress`);

    // Convert 'no_show' -> 'cancelled'
    const noShowResult = await query(`
      UPDATE bookings SET status = 'cancelled' 
      WHERE status = 'no_show';
    `);
    console.log(`✅ Converted ${noShowResult.rowCount} no_show bookings to cancelled`);

    // Handle any other unknown statuses by converting to 'cancelled'
    const unknownResult = await query(`
      UPDATE bookings SET status = 'cancelled' 
      WHERE status NOT IN ('scheduled', 'in-progress', 'completed', 'cancelled', 'pending_confirmation');
    `);
    console.log(`✅ Converted ${unknownResult.rowCount} unknown status bookings to cancelled`);

    // Step 2: Now update the constraint
    console.log('📋 Updating booking status constraint...');
    await query(`
      ALTER TABLE bookings 
      DROP CONSTRAINT IF EXISTS bookings_status_check;
    `);

    await query(`
      ALTER TABLE bookings 
      ADD CONSTRAINT bookings_status_check 
      CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled', 'pending_confirmation'));
    `);

    // Step 3: Update the default status
    console.log('🔧 Updating default status...');
    await query(`
      ALTER TABLE bookings 
      ALTER COLUMN status SET DEFAULT 'pending_confirmation';
    `);

    // Step 4: Create index for better performance on status queries
    console.log('📊 Creating performance index...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_bookings_status_updated ON bookings(status, updated_at);
    `);

    // Verify the changes
    const statusCounts = await query(`
      SELECT status, COUNT(*) as count 
      FROM bookings 
      GROUP BY status 
      ORDER BY status;
    `);
    
    console.log('📈 Current booking status distribution:');
    statusCounts.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    res.json({ 
      message: 'Booking status migration completed successfully!',
      statusCounts: statusCounts.rows
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export app for testing
export default app;

// Start server only if this file is run directly
// Cross-platform module check
import { fileURLToPath } from 'url';
import { dirname, resolve, normalize } from 'path';

const isMainModule = () => {
  try {
    // Convert import.meta.url to file path
    const importPath = fileURLToPath(import.meta.url);
    const processPath = resolve(process.argv[1]);
    
    // Normalize both paths for comparison
    return normalize(importPath) === normalize(processPath);
  } catch (error) {
    console.log('Error in path comparison:', error.message);
    return false;
  }
};

if (isMainModule()) {
  const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on ${HOST}:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 API Base URL: ${process.env.NODE_ENV === 'production' ? process.env.API_URL : `http://localhost:${PORT}/api`}`);
    console.log(`⚡ Socket.IO server ready`);
  });
} else {
  console.log('Server not started - module check failed');
}