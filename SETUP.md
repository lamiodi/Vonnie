# Vonne X2x Management System - Setup Guide

## 🚀 Quick Start

This guide will help you set up the Vonne X2x Management System with all required services.

## 📋 Prerequisites

- Node.js 18+ installed
- Git installed
- A Supabase account (free tier available)
- A Paystack account for payments (optional for development)

## 🗄️ Database Setup (Supabase)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `vonne-x2x-management`
   - **Database Password**: Choose a strong password
   - **Region**: Select closest to your location
5. Click "Create new project"

### 2. Get Your Project Credentials

1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL** (looks like: `https://abcdefghijklmnop.supabase.co`)
   - **Project API Keys** → **anon public** key

### 3. Set Up Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Run the migration files in order:
   - Copy content from `database/migrations/001_initial_schema.sql`
   - Paste and run in SQL Editor
   - Copy content from `database/migrations/002_rls_policies.sql`
   - Paste and run in SQL Editor

### 4. Seed Sample Data (Optional)

1. In SQL Editor, copy content from `database/seeds/001_sample_data.sql`
2. Paste and run to add sample data for testing

## ⚙️ Environment Configuration

### Frontend Setup

1. Navigate to the `frontend` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your credentials:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
   
   # Paystack Configuration (for payments)
   VITE_PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
   VITE_PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
   ```

### Backend Setup

1. Navigate to the `backend` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. Update with your Supabase credentials and other settings

## 💳 Payment Setup (Paystack)

### 1. Create Paystack Account

1. Go to [paystack.com](https://paystack.com) and sign up
2. Complete business verification
3. Go to **Settings** → **API Keys & Webhooks**

### 2. Get API Keys

- **Test Keys** (for development):
  - Public Key: `pk_test_...`
  - Secret Key: `sk_test_...`
- **Live Keys** (for production):
  - Public Key: `pk_live_...`
  - Secret Key: `sk_live_...`

### 3. Configure Webhooks (Optional)

1. In Paystack dashboard, go to **Settings** → **API Keys & Webhooks**
2. Add webhook URL: `https://your-backend-url.com/api/webhooks/paystack`
3. Select events: `charge.success`, `charge.failed`

## 🏃‍♂️ Running the Application

### Frontend Development Server

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at: `http://localhost:3002`

### Backend Development Server

```bash
cd backend
npm install
npm run dev
```

The backend will be available at: `http://localhost:5000`

## 👥 Default User Accounts

After running the seed data, you can login with:

### Admin Account
- **Email**: `admin@vonnex2x.com`
- **Password**: `admin123`
- **Role**: Administrator

### Staff Account
- **Email**: `staff@vonnex2x.com`
- **Password**: `staff123`
- **Role**: Staff Member

### Customer Account
- **Email**: `customer@vonnex2x.com`
- **Password**: `customer123`
- **Role**: Customer

## 🔧 Troubleshooting

### Common Issues

1. **"net::ERR_NAME_NOT_RESOLVED" for Supabase**
   - Check that your `VITE_SUPABASE_URL` is correct
   - Ensure your Supabase project is active
   - Verify the URL format: `https://[project-ref].supabase.co`

2. **Authentication not working**
   - Verify your `VITE_SUPABASE_ANON_KEY` is correct
   - Check that RLS policies are properly set up
   - Ensure your Supabase project has the auth schema

3. **Payment errors**
   - Verify Paystack keys are correct
   - Check that you're using test keys for development
   - Ensure your domain is whitelisted in Paystack dashboard

4. **Database connection issues**
   - Check your Supabase project status
   - Verify database password is correct
   - Ensure migrations have been run successfully

### Getting Help

- Check the browser console for detailed error messages
- Review the network tab for failed API requests
- Verify all environment variables are set correctly
- Ensure all dependencies are installed (`npm install`)

## 🚀 Deployment

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Backend (Railway/Render)

1. Connect your GitHub repository
2. Set environment variables
3. Configure build and start commands

## 📝 Additional Notes

- Always use test credentials during development
- Keep your API keys secure and never commit them to version control
- Regularly backup your Supabase database
- Monitor your Paystack dashboard for transaction status

---

**Need help?** Check the troubleshooting section above or review the error messages in your browser console.