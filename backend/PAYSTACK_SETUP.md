# Paystack Payment Integration Setup

## ✅ Current Implementation Status

The Paystack payment integration has been successfully implemented in the POS route with the following features:

### 🔧 What's Already Working
1. **Payment Initialization** - `/payment/initialize` endpoint
2. **Payment Verification** - `/payment/verify` endpoint  
3. **Database Integration** - Updates transaction records with payment details
4. **Environment Configuration** - PAYSTACK_SECRET_KEY and PAYSTACK_PUBLIC_KEY variables

### 📋 Setup Instructions

#### 1. Get Your Paystack API Keys
1. Sign up for a Paystack account at [https://paystack.com](https://paystack.com)
2. Go to your Paystack dashboard
3. Navigate to Settings → API Keys & Webhooks
4. Copy your:
   - **Test Secret Key** (starts with `sk_test_`)
   - **Test Public Key** (starts with `pk_test_`)
   - **Live Secret Key** (for production)
   - **Live Public Key** (for production)

#### 2. Update Environment Variables

Update your `.env` file with your actual Paystack keys:

```bash
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_actual_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_actual_public_key_here

# Frontend URL for callback
FRONTEND_URL=http://localhost:5173
```

#### 3. Test the Integration

##### Initialize Payment (Test)
```bash
curl -X POST http://localhost:5000/api/pos/payment/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "email": "customer@example.com",
    "amount": 5000,
    "booking_number": "BOOK123"
  }'
```

##### Verify Payment (Test)
```bash
curl -X POST http://localhost:5000/api/pos/payment/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "reference": "BOOK123_1234567890"
  }'
```

### 🎯 API Endpoints

#### Initialize Payment
- **URL**: `POST /api/pos/payment/initialize`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Body**:
  ```json
  {
    "email": "customer@example.com",
    "amount": 5000, // Amount in Naira
    "booking_number": "BOOK123"
  }
  ```

#### Verify Payment
- **URL**: `POST /api/pos/payment/verify`
- **Headers**: `Authorization: Bearer <JWT_TOKEN>`
- **Body**:
  ```json
  {
    "reference": "payment_reference_from_paystack"
  }
  ```

### 🔒 Security Notes

1. **Never commit actual API keys** to version control
2. **Use environment variables** for all sensitive data
3. **Test with test keys** during development
4. **Switch to live keys** only in production
5. **Validate webhook signatures** for production use

### 🚀 Production Deployment

For production deployment:

1. **Update environment variables** with live keys:
   ```bash
   PAYSTACK_SECRET_KEY=sk_live_your_live_secret_key
   PAYSTACK_PUBLIC_KEY=pk_live_your_live_public_key
   ```

2. **Configure webhooks** in Paystack dashboard:
   - URL: `https://your-backend-domain.com/api/pos/payment/webhook`
   - Events: `charge.success`, `transfer.success`

3. **Update frontend callback URL**:
   ```bash
   FRONTEND_URL=https://your-frontend-domain.com
   ```

### 🐛 Troubleshooting

#### Common Issues:

1. **"Invalid API Key" error**
   - Check that your API key is correctly set in environment variables
   - Verify the key starts with `sk_test_` for test mode

2. **CORS issues**
   - Ensure frontend URL is correctly set in `FRONTEND_URL`
   - Check CORS configuration in your backend

3. **Payment verification fails**
   - Verify the payment reference is correct
   - Check that the transaction was successful in Paystack dashboard

#### Test Cards:

Use these test cards for development:

- **Card Number**: 408 408 408 408 408 1
- **CVV**: 408
- **Expiry**: Any future date
- **PIN**: 0000 (for Nigerian cards) or 1234 (for international cards)

### 📞 Support

- Paystack Documentation: https://paystack.com/docs
- Paystack API Reference: https://paystack.com/docs/api
- Paystack Support: support@paystack.com

---

**Next Steps**: After setting up Paystack keys, test the payment flow with test cards to ensure everything works correctly.