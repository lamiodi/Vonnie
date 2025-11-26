-- Migration to add specialty field to users table
-- This enables storing worker specialties for better assignment decisions

ALTER TABLE public.users 
ADD COLUMN specialty character varying(255);

-- Create index for efficient specialty-based queries
CREATE INDEX IF NOT EXISTS idx_users_specialty ON public.users(specialty) 
WHERE role IN ('staff', 'manager') AND is_active = true;

-- Add comment for documentation
COMMENT ON COLUMN public.users.specialty IS 'Worker specialty/skill area for assignment optimization';