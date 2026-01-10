-- Fix admin_settings table by adding missing enable_maintenance_mode column
-- This script adds the missing column that the backend expects

-- Check if the column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_settings' 
        AND column_name = 'enable_maintenance_mode'
    ) THEN
        -- Add the missing column
        ALTER TABLE public.admin_settings 
        ADD COLUMN enable_maintenance_mode BOOLEAN DEFAULT false;
        
        -- Update existing records to set default value
        UPDATE public.admin_settings 
        SET enable_maintenance_mode = false 
        WHERE enable_maintenance_mode IS NULL;
        
        RAISE NOTICE 'Added enable_maintenance_mode column to admin_settings table';
    ELSE
        RAISE NOTICE 'enable_maintenance_mode column already exists in admin_settings table';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'admin_settings' 
ORDER BY ordinal_position;