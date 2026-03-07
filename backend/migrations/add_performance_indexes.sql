
-- Migration: Add indexes for performance optimization

-- 1. Products Table: Optimize search by category and name
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- 2. Services Table: Optimize search by category
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- 3. Bookings Table: Optimize filtering by status and date range
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_time ON bookings(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_email ON bookings(customer_email);

-- 4. Service Products: Optimize join performance (already added in previous migration, but good to ensure)
CREATE INDEX IF NOT EXISTS idx_service_products_product_id ON service_products(product_id);

-- 5. Payments: Optimize transaction lookups
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 6. POS Transactions: Optimize daily reporting
CREATE INDEX IF NOT EXISTS idx_pos_transactions_created_at ON pos_transactions(created_at);
