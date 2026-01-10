-- Migration to create booking_services table for many-to-many relationship between bookings and services
CREATE TABLE public.booking_services (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  service_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  duration integer NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT booking_services_pkey PRIMARY KEY (id),
  CONSTRAINT booking_services_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT booking_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id),
  CONSTRAINT booking_services_unique_booking_service UNIQUE (booking_id, service_id)
);

-- Create index for better performance
CREATE INDEX idx_booking_services_booking_id ON public.booking_services(booking_id);
CREATE INDEX idx_booking_services_service_id ON public.booking_services(service_id);

-- Add comment to table
COMMENT ON TABLE public.booking_services IS 'Many-to-many relationship table between bookings and services';

-- Migration to update bookings table to remove service_id column (if it exists)
-- Note: This is a placeholder - actual column removal should be done after data migration
-- ALTER TABLE public.bookings DROP COLUMN IF EXISTS service_id;