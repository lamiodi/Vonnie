const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

// Initialize Supabase client
const { supabase } = require('./config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Vonne X2x Management System API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/services', require('./routes/services'));
app.use('/api/products', require('./routes/products'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));

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
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:profiles!customer_id(first_name, last_name, email, phone),
        staff:profiles!staff_id(first_name, last_name),
        service:services(name, category, price, duration)
      `)
      .eq('booking_date', targetDateStr)
      .eq('status', 'scheduled')
      .is('reminder_sent', null);

    if (error) {
      console.error('Error fetching bookings for reminders:', error);
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
          await supabase
            .from('bookings')
            .update({ reminder_sent: new Date().toISOString() })
            .eq('id', booking.id);

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

module.exports = app;