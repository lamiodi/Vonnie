# Vonne X2X Management System

A comprehensive full-stack management system for Vonne X2X, integrating fashion retail and beauty services.

## 🚀 Features

- **Booking Management**: Calendar-based booking, reminders, and staff assignment.
- **POS System**: Unified point-of-sale for products and services with barcode support.
- **Inventory Management**: Real-time stock tracking with low-stock alerts.
- **Worker Management**: Staff roles, scheduling, and attendance tracking (GPS-verified).
- **Reports & Analytics**: Sales, attendance, and inventory reports.
- **Coupons & Discounts**: Manage marketing campaigns.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (Supabase)
- **Services**: Paystack (Payments), Resend (Emails)

## 📦 Setup & Installation

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database

### Backend Setup
1. Navigate to `backend/`
2. Install dependencies: `npm install`
3. Configure `.env` (see `.env.example`)
4. Run migrations: `npm run migrate` (or execute `schema.sql`)
5. Start server: `npm start`

### Frontend Setup
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Configure `.env`
4. Start dev server: `npm run dev`

## 🔐 Production Readiness

### 1. Database Backups
A backup script is provided in `backend/scripts/backup_db.js`.
- **Usage**: `node backend/scripts/backup_db.js`
- **Recommendation**: Set up a cron job to run this daily.

### 2. Admin User Creation
To create the initial admin user in a production environment:
- **Usage**: `node backend/scripts/create_admin.js <email> <password> [name]`
- **Example**: `node backend/scripts/create_admin.js admin@vonne.com SecurePass123! "Super Admin"`

### 3. Security
- **Hardcoded Passwords**: Removed. New workers receive auto-generated secure passwords via email.
- **Signup Control**: Admin can enable/disable public worker signups via the Admin Settings page.
- **PCI Compliance**: System uses Paystack Standard/Popup (SAQ A), so raw card data is never processed on our servers.

### 4. Monitoring & Logging
- Basic structured logging is implemented in `src/utils/logger.js`.
- **Recommendation**: For high-scale production, integrate Sentry for error tracking and upgrade to Winston/Pino for logging.

## 📄 Documentation
- [API Documentation](backend/docs) (if available)
- [Deployment Report](DEPLOYMENT_READINESS_REPORT.md)
