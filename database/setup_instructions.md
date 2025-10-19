# Vonne X2x Management System - Database Setup Instructions

This document provides comprehensive step-by-step instructions for setting up the Supabase database for the Vonne X2x Management System.

## Prerequisites

- Supabase account and project created
- Access to Supabase SQL Editor
- Backend and frontend environment files configured
- Basic understanding of SQL and database operations

## Database Structure Overview

The Vonne X2x Management System uses a comprehensive database schema that includes:

- **User Management**: Users, roles, and authentication
- **Service Management**: Service categories, services, and pricing
- **Product Management**: Product categories, products, and inventory
- **Appointment System**: Bookings, scheduling, and status tracking
- **Payment Processing**: Payments, transactions, and financial records
- **Staff Management**: Schedules, attendance, and performance tracking
- **Loyalty System**: Customer loyalty points and rewards
- **Notification System**: System and user notifications
- **System Settings**: Configurable business settings

## Setup Process

### Step 1: Run Database Migrations

1. Open your Supabase project dashboard
2. Navigate to the **SQL Editor**
3. Copy and paste the contents of `database/migrations/001_initial_schema.sql`
4. Execute the migration script to create:
   - All database tables with proper relationships
   - Custom PostgreSQL types (enums)
   - Database indexes for performance
   - Row Level Security (RLS) policies
   - Automatic timestamp triggers

**Note**: The migration script includes comprehensive error handling and will create all necessary database structures.

### Step 2: Create Authentication Users

Create the following users in your Supabase Auth dashboard (**Authentication > Users**):

**Admin User:**
- Email: `admin@vonnex2x.com`
- Password: `Admin123!`
- Confirm Password: `Admin123!`

**Staff Users:**
- Email: `sarah.johnson@vonnex2x.com` | Password: `Staff123!`
- Email: `maria.santos@vonnex2x.com` | Password: `Staff123!`
- Email: `aisha.ibrahim@vonnex2x.com` | Password: `Staff123!`

**Customer Users (for testing):**
- Email: `customer1@example.com` | Password: `Customer123!`
- Email: `customer2@example.com` | Password: `Customer123!`

### Step 3: Update Demo Data UUIDs

1. After creating the auth users, copy their UUIDs from the Supabase Auth dashboard
2. Open `database/seeds/001_demo_data.sql`
3. Replace the placeholder UUIDs with the actual user UUIDs:
   - Replace `00000000-0000-0000-0000-000000000001` with the admin user UUID
   - Replace `00000000-0000-0000-0000-000000000002` with Sarah Johnson's UUID
   - Replace `00000000-0000-0000-0000-000000000003` with Maria Santos's UUID
   - Replace `00000000-0000-0000-0000-000000000004` with Aisha Ibrahim's UUID
   - Replace `00000000-0000-0000-0000-000000000005` with customer1 UUID
   - Replace `00000000-0000-0000-0000-000000000006` with customer2 UUID

### Step 4: Run Seeding Script

1. In the Supabase SQL Editor
2. Copy and paste the updated contents of `database/seeds/001_demo_data.sql`
3. Execute the seeding script to populate the database with comprehensive demo data

### Step 5: Verify Setup

After running both scripts, verify the setup by running these queries in the SQL Editor:

```sql
-- Check if all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify user data
SELECT id, email, full_name, role, is_active 
FROM users 
ORDER BY role, full_name;

-- Check service categories and services
SELECT sc.name as category, s.name as service, s.price 
FROM services s 
JOIN service_categories sc ON s.category_id = sc.id 
ORDER BY sc.display_order, s.name;

-- Verify system settings
SELECT category, key, value, description 
FROM system_settings 
WHERE is_public = true 
ORDER BY category, key;

-- Check sample appointments
SELECT 
    u.full_name as customer,
    s.full_name as staff,
    srv.name as service,
    a.appointment_date,
    a.start_time,
    a.status
FROM appointments a
JOIN users u ON a.customer_id = u.id
JOIN users s ON a.staff_id = s.id
JOIN services srv ON a.service_id = srv.id
ORDER BY a.appointment_date, a.start_time;
```

## Demo Accounts

After setup, you can log in with these demo accounts:

### Administrator Account
- **Email**: `admin@vonnex2x.com`
- **Password**: `Admin123!`
- **Access Level**: Full system access, user management, reports, settings

### Staff Accounts
- **Sarah Johnson**: `sarah.johnson@vonnex2x.com` / `Staff123!`
  - Schedule: Monday-Friday 9:00-17:00, Saturday 10:00-16:00
  - Specialties: Nail services, general beauty treatments

- **Maria Santos**: `maria.santos@vonnex2x.com` / `Staff123!`
  - Schedule: Monday-Friday 10:00-18:00, Sunday 11:00-17:00
  - Specialties: Skincare, facial treatments

- **Aisha Ibrahim**: `aisha.ibrahim@vonnex2x.com` / `Staff123!`
  - Schedule: Tuesday-Sunday 8:00-16:00 (varies by day)
  - Specialties: Hair braiding, styling services

### Customer Accounts (for testing)
- **Grace Adebayo**: `customer1@example.com` / `Customer123!`
- **Funmi Okafor**: `customer2@example.com` / `Customer123!`

## Sample Data Included

The seeding script includes comprehensive demo data:

### Services & Categories
- **Nails**: Classic Manicure, Gel Manicure, Acrylic Nails, Nail Art Design
- **Pedicure**: Classic Pedicure, Spa Pedicure, Medical Pedicure
- **Braids**: Box Braids, Cornrows, Twist Braids, Ghana Weaving
- **Makeup**: Bridal Makeup, Event Makeup, Natural Makeup
- **Skincare**: Deep Cleansing Facial, Anti-Aging Facial, Acne Treatment
- **Hair Styling**: Wash and Blow Dry, Hair Relaxing, Hair Coloring

### Products & Inventory
- Hair care products (shampoos, conditioners, treatments)
- Nail products (polishes, tools, accessories)
- Skincare products (cleansers, moisturizers, treatments)
- Makeup products (foundations, lipsticks, eye shadows)
- Professional tools and equipment

### Sample Appointments
- Confirmed appointments for the next few days
- Various services and staff members
- Different appointment statuses and payment methods

### Staff Schedules
- Realistic weekly schedules for all staff members
- Different working hours and break times
- Coverage across all business days

## Environment Configuration

### Backend Environment (.env)
```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Server Configuration
PORT=5001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Payment Configuration (Paystack)
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key

# Email Configuration (Optional)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password

# SMS Configuration (Optional)
SMS_API_KEY=your_sms_api_key
SMS_SENDER_ID=your_sender_id
```

### Frontend Environment (.env)
```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# API Configuration
VITE_API_URL=http://localhost:5001/api

# Payment Configuration
VITE_PAYSTACK_PUBLIC_KEY=your_paystack_public_key

# App Configuration
VITE_APP_NAME=Vonne X2x Management System
VITE_APP_VERSION=1.0.0
```

## Troubleshooting

### Common Issues

1. **UUID Mismatch**: Ensure UUIDs in seeding script match Supabase Auth user IDs
2. **Permission Errors**: Verify Row Level Security policies are properly configured
3. **Foreign Key Errors**: Ensure parent records exist before inserting child records

### Verification Queries

```sql
-- Check user count
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Check service categories
SELECT name, COUNT(*) as service_count 
FROM service_categories sc 
LEFT JOIN services s ON sc.id = s.category_id 
GROUP BY sc.name;

-- Check appointments
SELECT 
    u.full_name as customer,
    s.name as service,
    a.appointment_date,
    a.status
FROM appointments a
JOIN users u ON a.customer_id = u.id
JOIN services s ON a.service_id = s.id
ORDER BY a.appointment_date;
```

## Next Steps

After successful database setup:
1. Start the backend server: `cd backend && npm start`
2. Start the frontend server: `cd frontend && npm run dev`
3. Access the application at `http://localhost:3000`
4. Login with any of the demo accounts to test functionality

## Support

If you encounter issues during setup:
1. Check Supabase logs in the Dashboard
2. Verify all environment variables are set correctly
3. Ensure database connection is working
4. Check browser console for frontend errors