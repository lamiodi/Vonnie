# Vonne X2X Deployment Guide for Render

## Environment Variables Required

### Backend Environment Variables (vonne-x2x-backend)

**Required:**
- `DATABASE_URL` - Your PostgreSQL database connection string
- `JWT_SECRET` - Secret key for JWT token generation
- `PORT` - Set to 10000 for Render (already configured in render.yaml)

**Payment Gateway:**
- `PAYSTACK_SECRET_KEY` - Your Paystack secret key
- `PAYSTACK_PUBLIC_KEY` - Your Paystack public key

**Email Service:**
- `EMAIL_HOST` - SMTP host (e.g., smtp.gmail.com)
- `EMAIL_PORT` - SMTP port (e.g., 587)
- `EMAIL_USER` - Email username
- `EMAIL_PASS` - Email password

**WhatsApp Integration:**
- `WHATSAPP_API_TOKEN` - WhatsApp Business API token
- `WHATSAPP_PHONE_NUMBER_ID` - WhatsApp phone number ID

### Frontend Environment Variables (vonne-x2x-frontend)

**Required:**
- `VITE_API_URL` - Your backend API URL (e.g., https://your-backend.onrender.com/api)

**Payment Gateway:**
- `VITE_PAYSTACK_PUBLIC_KEY` - Your Paystack public key

## Deployment Steps

1. **Create Web Services on Render:**
   - Create a new Web Service for the backend using the render.yaml blueprint
   - Create a new Static Site for the frontend using the render.yaml blueprint

2. **Set Environment Variables:**
   - Add all required environment variables in the Render dashboard for each service
   - Make sure to use your actual production values, not the test values

3. **Database Setup:**
   - Create a PostgreSQL database on Render
   - Copy the connection string to the DATABASE_URL environment variable
   - Run your schema.sql file to set up the database tables

4. **Domain Configuration:**
   - Once deployed, update the frontend VITE_API_URL to point to your backend URL
   - Update any webhook URLs in your payment gateway settings

## Important Notes

- The backend runs on port 10000 (Render's requirement)
- The frontend is built as a static site and served from the dist folder
- Make sure all environment variables are set before deploying
- Test your payment webhooks after deployment

## Troubleshooting

If you encounter deployment issues:
1. Check the Render logs for specific error messages
2. Verify all environment variables are correctly set
3. Ensure your database is properly configured
4. Check that your Paystack keys are valid for production