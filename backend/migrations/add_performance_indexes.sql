-- Add indexes to improve query performance and address schema gaps

-- 1. Bookings Indexes
-- Used for availability checks and range queries
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_time ON public.bookings(scheduled_time);
-- Used for filtering by status (e.g. dashboard, queue)
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
-- Used for retrieving user booking history
CREATE INDEX IF NOT EXISTS idx_bookings_worker_id ON public.bookings(worker_id);
-- Used for sorting and date-range reports
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at);
-- Used for fast lookups by booking number
CREATE INDEX IF NOT EXISTS idx_bookings_booking_number ON public.bookings(booking_number);

-- 2. Booking Workers Indexes
-- Critical for conflict detection (JOIN operations)
CREATE INDEX IF NOT EXISTS idx_booking_workers_worker_id ON public.booking_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_booking_workers_booking_id ON public.booking_workers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_workers_status ON public.booking_workers(status);

-- 3. Booking Services Indexes
-- Used for retrieving booking details
CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id ON public.booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_service_id ON public.booking_services(service_id);

-- 4. POS Transactions Indexes
-- Used for reporting and analytics
CREATE INDEX IF NOT EXISTS idx_pos_transactions_created_at ON public.pos_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_booking_id ON public.pos_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_transaction_number ON public.pos_transactions(transaction_number);

-- 5. Attendance Indexes
-- Used for payroll and history
CREATE INDEX IF NOT EXISTS idx_attendance_worker_id ON public.attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);

-- 6. Users Indexes
-- Email is already UNIQUE (indexed), adding role for filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
-- Used for "active" staff filtering
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);

-- 7. Products/Services Indexes
-- Used for search and categorization
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);

-- 8. Inventory Movements
-- Used for audit logs
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON public.inventory_movements(created_at);
