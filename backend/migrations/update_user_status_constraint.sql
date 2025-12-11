-- Update users table constraint to include 'absent' status
ALTER TABLE public.users DROP CONSTRAINT users_current_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_current_status_check CHECK (current_status::text = ANY (ARRAY['available'::text, 'busy'::text, 'offline'::text, 'absent'::text, 'on_break'::text, 'unavailable'::text]));
