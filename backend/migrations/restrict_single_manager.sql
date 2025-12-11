-- Restrict to only one manager
CREATE UNIQUE INDEX IF NOT EXISTS unique_manager_role ON public.users (role) WHERE role = 'manager';
