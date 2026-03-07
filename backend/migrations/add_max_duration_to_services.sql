
-- Migration: Add max_duration to services table to support variable service times
-- If duration is fixed, max_duration will be NULL
-- If duration is a range, 'duration' is the minimum and 'max_duration' is the maximum

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS max_duration INTEGER DEFAULT NULL;

-- Comment on column for clarity
COMMENT ON COLUMN services.duration IS 'Minimum duration in minutes';
COMMENT ON COLUMN services.max_duration IS 'Maximum duration in minutes (if applicable)';
