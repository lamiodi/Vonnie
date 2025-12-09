-- Fix payment schema: Add webhooks table and missing booking columns

-- 1. Create payment_webhooks table for audit and fallback verification
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event VARCHAR(100) NOT NULL,
  reference VARCHAR(100),
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_reference ON payment_webhooks(reference);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_event ON payment_webhooks(event);

-- 2. Add missing payment columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE;

-- Index for payment reference lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_reference ON bookings(payment_reference);
