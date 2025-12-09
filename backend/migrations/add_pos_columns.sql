-- Add POS payment columns to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS physical_pos_reference VARCHAR(100),
ADD COLUMN IF NOT EXISTS physical_pos_initiated_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS physical_pos_initiated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_physical_pos_reference ON bookings(physical_pos_reference);
