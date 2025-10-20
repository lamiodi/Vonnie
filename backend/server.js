import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

// Database connection for operations
import { sql } from './config/database.js';

const app = express();
const PORT = process.env.PORT || 5002;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting - Use environment variables for production
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes default
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root endpoint - API information
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Vonne X2x Management System API',
    version: '1.0.0',
    status: 'running',
    message: 'Welcome to Vonne X2x Management System API',
    endpoints: {
      health: '/health',
      api: '/api',
      routes: [
        '/api/auth',
        '/api/services', 
        '/api/products',
        '/api/bookings',
        '/api/attendance',
        '/api/transactions',
        '/api/reports',
        '/api/notifications',
        '/api/payments'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Vonne X2x Management System API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
import authRoutes from './routes/auth.js';
import servicesRoutes from './routes/services.js';
import productsRoutes from './routes/products.js';
import bookingsRoutes from './routes/bookings.js';
import attendanceRoutes from './routes/attendance.js';
import transactionsRoutes from './routes/transactions.js';
import reportsRoutes from './routes/reports.js';
import notificationsRoutes from './routes/notifications.js';
import paymentsRoutes from './routes/payments.js';

app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/payments', paymentsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Function to send automated email reminders 24 hours before appointments
async function send24HourReminders() {
  try {
    console.log('🔔 Checking for appointments needing 24-hour reminders...');
    
    // Calculate the target date and time for appointments 24 hours from now
    const now = new Date();
    const targetDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    // Get bookings scheduled for exactly 24 hours from now
    const bookings = await sql`
      SELECT 
        b.*,
        c.first_name as customer_first_name,
        c.last_name as customer_last_name,
        c.email as customer_email,
        c.phone as customer_phone,
        s.first_name as staff_first_name,
        s.last_name as staff_last_name,
        sv.name as service_name,
        sv.category as service_category,
        sv.price as service_price,
        sv.duration as service_duration
      FROM bookings b
      LEFT JOIN profiles c ON b.customer_id = c.id
      LEFT JOIN profiles s ON b.staff_id = s.id
      LEFT JOIN services sv ON b.service_id = sv.id
      WHERE b.booking_date = ${targetDateStr}
        AND b.status = 'scheduled'
        AND b.reminder_sent IS NULL
    `;

    if (!bookings) {
      console.error('Error fetching bookings for reminders: No data returned');
      return;
    }

    console.log(`📅 Found ${bookings?.length || 0} appointments needing reminders`);

    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        try {
          // Call the booking reminder endpoint
          const response = await axios.post(
            `http://localhost:${PORT}/api/notifications/booking-reminder`,
            {
              booking_id: booking.id,
              hours_before: 24
            },
            {
              headers: {
                'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );

          // Mark reminder as sent in the database
          await sql`
            UPDATE bookings 
            SET reminder_sent = ${new Date().toISOString()}
            WHERE id = ${booking.id}
          `;

          console.log(`✅ Sent 24-hour reminder for booking ${booking.id}`);
        } catch (bookingError) {
          console.error(`❌ Failed to send reminder for booking ${booking.id}:`, bookingError.message);
        }
      }
    }
  } catch (error) {
    console.error('Error in automated reminder system:', error);
  }
}

// Schedule the reminder task to run daily at 9:00 AM
cron.schedule('0 9 * * *', () => {
  console.log('⏰ Running daily reminder check...');
  send24HourReminders();
});

app.listen(PORT, () => {
  console.log(`🚀 Vonne X2x Management System API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('⏰ Automated email reminders scheduled to run daily at 9:00 AM');
});

export default app;