CREATE TABLE public.booking_misc_charges (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  booking_id uuid NOT NULL,
  name character varying NOT NULL,
  amount numeric NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT booking_misc_charges_pkey PRIMARY KEY (id),
  CONSTRAINT booking_misc_charges_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE,
  CONSTRAINT booking_misc_charges_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Add a column to bookings to track the total misc charges?
-- Or we can just sum it up dynamically. It's better to add `misc_charges_amount` to bookings for easier querying, or just compute it. Let's add `misc_charges_amount` numeric DEFAULT 0 to bookings.

ALTER TABLE public.bookings ADD COLUMN misc_charges_amount numeric DEFAULT 0;
