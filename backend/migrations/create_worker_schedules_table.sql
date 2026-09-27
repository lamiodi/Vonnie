-- Migration: Create worker_schedules table
-- Stores weekly working schedules for staff/managers to enable per-worker availability and lateness checks

CREATE TABLE IF NOT EXISTS public.worker_schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  worker_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time varchar(10) NOT NULL DEFAULT '09:00',
  end_time varchar(10) NOT NULL DEFAULT '17:00',
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT worker_schedules_pkey PRIMARY KEY (id),
  CONSTRAINT worker_schedules_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT worker_schedules_unique_worker_day UNIQUE (worker_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_worker_schedules_worker_day ON public.worker_schedules(worker_id, day_of_week);
