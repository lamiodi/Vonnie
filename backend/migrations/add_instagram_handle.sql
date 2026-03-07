
-- Migration: Add instagram_handle to bookings table
-- This allows capturing the customer's Instagram handle for better identification

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(255);

COMMENT ON COLUMN bookings.instagram_handle IS 'Customer Instagram handle for identification';
