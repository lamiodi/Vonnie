# Database Setup Guide for Vonne X2x Management System

## Current Issue
The backend API is failing with `PGRST002` errors because the database schema has not been set up in Supabase. This guide will walk you through the complete setup process.

## Prerequisites
- Supabase project created and accessible
- Environment variables configured in your backend

## Step-by-Step Setup Process

### 1. Verify Supabase Configuration
First, ensure your backend has the correct Supabase credentials:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)

### 2. Run Database Migrations

#### Option A: Using Supabase Dashboard (Recommended)
1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the entire contents of `database/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute the migration

#### Option B: Using Supabase CLI (Alternative)
```bash
# If you have Supabase CLI installed
supabase db reset
supabase db push
```

### 3. Verify Schema Creation
After running the migration, verify the tables were created:

```sql
-- Run this query in Supabase SQL Editor to verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- users
- guest_customers
- service_categories
- services
- product_categories
- products
- appointments
- payments
- transactions
- transaction_items
- staff_schedules
- staff_attendance
- notifications
- system_settings
- loyalty_points
- inventory_movements

### 4. Create Authentication Users (Optional for Testing)
If you want to test with demo data, create these users in Supabase Auth:

**Admin User:**
- Email: `admin@vonnex2x.com`
- Password: `Admin123!`

**Staff Users:**
- Email: `sarah.johnson@vonnex2x.com` | Password: `Staff123!`
- Email: `maria.santos@vonnex2x.com` | Password: `Staff123!`

### 5. Run Demo Data (Optional)
If you created the auth users, you can populate the database with demo data:
1. Update UUIDs in `database/seeds/001_demo_data.sql` with actual user IDs
2. Run the seed script in Supabase SQL Editor

### 6. Test Database Connection
After setup, restart your backend server and test the API endpoints.

## Troubleshooting

### Common Issues:
1. **PGRST002 Error**: Database schema not set up - run migrations
2. **Connection refused**: Check Supabase URL and keys
3. **Permission denied**: Verify service role key is correct
4. **Table doesn't exist**: Ensure migration ran successfully

### Verification Commands:
```bash
# Test health endpoint
curl -X GET http://localhost:5001/health

# Test API endpoint (should work after setup)
curl -X GET http://localhost:5001/api/products
```

## Next Steps
Once the database is set up:
1. Restart the backend server
2. Test all API endpoints
3. Verify frontend connectivity
4. Run comprehensive system tests