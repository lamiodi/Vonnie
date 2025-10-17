-- Sample data for Vonne X2x Management System
-- This file contains sample data for testing and demonstration

-- Insert sample services
INSERT INTO services (category_id, name, description, price, duration_minutes, is_active) VALUES
-- Nails services
((SELECT id FROM service_categories WHERE name = 'Nails'), 'Classic Manicure', 'Basic nail care with polish application', 3500.00, 45, true),
((SELECT id FROM service_categories WHERE name = 'Nails'), 'Gel Manicure', 'Long-lasting gel polish manicure', 5500.00, 60, true),
((SELECT id FROM service_categories WHERE name = 'Nails'), 'Nail Art Design', 'Custom nail art and decorations', 7500.00, 90, true),
((SELECT id FROM service_categories WHERE name = 'Nails'), 'Acrylic Nails', 'Full set acrylic nail extensions', 12000.00, 120, true),

-- Pedicure services
((SELECT id FROM service_categories WHERE name = 'Pedicure'), 'Classic Pedicure', 'Basic foot care and polish', 4000.00, 60, true),
((SELECT id FROM service_categories WHERE name = 'Pedicure'), 'Spa Pedicure', 'Luxurious foot treatment with massage', 6500.00, 75, true),
((SELECT id FROM service_categories WHERE name = 'Pedicure'), 'Gel Pedicure', 'Long-lasting gel polish for toes', 5500.00, 60, true),

-- Braids services
((SELECT id FROM service_categories WHERE name = 'Braids'), 'Box Braids', 'Protective box braiding style', 15000.00, 240, true),
((SELECT id FROM service_categories WHERE name = 'Braids'), 'Cornrows', 'Traditional cornrow braiding', 8000.00, 120, true),
((SELECT id FROM service_categories WHERE name = 'Braids'), 'Ghana Braids', 'Stylish Ghana weaving braids', 12000.00, 180, true),
((SELECT id FROM service_categories WHERE name = 'Braids'), 'Twist Braids', 'Protective twist braiding', 10000.00, 150, true),

-- Makeup services
((SELECT id FROM service_categories WHERE name = 'Makeup'), 'Bridal Makeup', 'Complete bridal makeup package', 25000.00, 120, true),
((SELECT id FROM service_categories WHERE name = 'Makeup'), 'Party Makeup', 'Glamorous party makeup', 15000.00, 90, true),
((SELECT id FROM service_categories WHERE name = 'Makeup'), 'Natural Makeup', 'Everyday natural makeup look', 8000.00, 60, true),

-- Skincare services
((SELECT id FROM service_categories WHERE name = 'Skincare'), 'Deep Cleansing Facial', 'Thorough facial cleansing treatment', 12000.00, 90, true),
((SELECT id FROM service_categories WHERE name = 'Skincare'), 'Anti-Aging Facial', 'Anti-aging skincare treatment', 18000.00, 105, true),
((SELECT id FROM service_categories WHERE name = 'Skincare'), 'Acne Treatment', 'Specialized acne treatment facial', 15000.00, 75, true),

-- Hair services
((SELECT id FROM service_categories WHERE name = 'Hair'), 'Hair Wash & Blow Dry', 'Professional hair washing and styling', 5000.00, 45, true),
((SELECT id FROM service_categories WHERE name = 'Hair'), 'Hair Relaxing', 'Chemical hair relaxing treatment', 12000.00, 120, true),
((SELECT id FROM service_categories WHERE name = 'Hair'), 'Hair Coloring', 'Professional hair coloring service', 20000.00, 150, true);

-- Insert actual products from client inventory
INSERT INTO products (category_id, name, description, sku, price, cost_price, stock_quantity, min_stock_level, size, color, brand, is_active, is_featured) VALUES
-- New Drop: Mini X2x fur duffle bags
((SELECT id FROM product_categories WHERE name = 'Fur Bags'), 'Mini X2x Fur Duffle Bag - Bubble Gum', 'Premium mini fur duffle bag in bubble gum pink', 'X2X-MINI-BG', 104000.00, 65000.00, 10, 3, 'Mini', 'Bubble Gum Pink', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Fur Bags'), 'Mini X2x Fur Duffle Bag - Sunrise Yellow', 'Premium mini fur duffle bag in sunrise yellow', 'X2X-MINI-SY', 104000.00, 65000.00, 10, 3, 'Mini', 'Sunrise Yellow', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Fur Bags'), 'Mini X2x Fur Duffle Bag - Burgundy', 'Premium mini fur duffle bag in burgundy red', 'X2X-MINI-BU', 104000.00, 65000.00, 10, 3, 'Mini', 'Burgundy', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Fur Bags'), 'Mini X2x Fur Duffle Bag - Jet Black', 'Premium mini fur duffle bag in jet black', 'X2X-MINI-JB', 104000.00, 65000.00, 10, 3, 'Mini', 'Jet Black', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Fur Bags'), 'Mini X2x Fur Duffle Bag - Purple Daisy', 'Premium mini fur duffle bag in purple daisy', 'X2X-MINI-PD', 104000.00, 65000.00, 10, 3, 'Mini', 'Purple Daisy', 'Vonne X2x', true, true),

-- New Drop: X2x Fur Duffle Bag new colors
((SELECT id FROM product_categories WHERE name = 'Fur Bags'), 'X2x Fur Duffle Bag - Ice Blue', 'Premium fur duffle bag in ice blue', 'X2X-DUFFLE-IB', 210000.00, 130000.00, 8, 2, 'Regular', 'Ice Blue', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Fur Bags'), 'X2x Fur Duffle Bag - Capuchino', 'Premium fur duffle bag in capuchino brown', 'X2X-DUFFLE-CP', 210000.00, 130000.00, 8, 2, 'Regular', 'Capuchino', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Fur Bags'), 'X2x Fur Duffle Bag - Money Green', 'Premium fur duffle bag in money green', 'X2X-DUFFLE-MG', 210000.00, 130000.00, 8, 2, 'Regular', 'Money Green', 'Vonne X2x', true, true),

-- New Drop: Tank tops
((SELECT id FROM product_categories WHERE name = 'Tops'), 'Strip X Tank Top - Pink', 'Stylish striped tank top in pink', 'X2X-TANK-SP', 22000.00, 14000.00, 15, 5, 'M/L', 'Pink', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Tops'), 'Strip X Tank Top - Black', 'Stylish striped tank top in black', 'X2X-TANK-SB', 22000.00, 14000.00, 15, 5, 'M/L', 'Black', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Tops'), 'Strip X Tank Top - White', 'Stylish striped tank top in white', 'X2X-TANK-SW', 22000.00, 14000.00, 15, 5, 'M/L', 'White', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Tops'), 'X Tank Top (Plain) - Black', 'Classic plain X tank top in black', 'X2X-TANK-PB', 20000.00, 12000.00, 12, 4, 'M/L', 'Black', 'Vonne X2x', true, false),

-- New Drop: African prints
((SELECT id FROM product_categories WHERE name = 'Bottoms'), 'Jumbo African Print Pants', 'Bold jumbo African print pants in various prints', 'X2X-JUMBO-P', 40000.00, 25000.00, 20, 6, 'M/L/XL', 'Various Prints', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Dresses'), 'Olive Bubu Dress', 'Traditional olive green bubu dress', 'X2X-BUBU-OL', 65000.00, 40000.00, 8, 3, 'M/L', 'Olive Green', 'Vonne X2x', true, true),

-- Already launched: Rich Energy set
((SELECT id FROM product_categories WHERE name = 'Sets'), 'Rich Energy Set - Milk', 'Complete Rich Energy set in milk brown', 'X2X-RICH-MK', 80000.00, 50000.00, 10, 3, 'M/L', 'Milk Brown', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Sets'), 'Rich Energy Set - Sapphire', 'Complete Rich Energy set in sapphire blue', 'X2X-RICH-SB', 80000.00, 50000.00, 10, 3, 'M/L', 'Sapphire Blue', 'Vonne X2x', true, true),

-- Already launched: X-clave set
((SELECT id FROM product_categories WHERE name = 'Dresses'), 'Magnolia Dress', 'Elegant magnolia pink dress', 'X2X-MAGNOLIA', 80000.00, 50000.00, 6, 2, 'M/L', 'Magnolia Pink', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Dresses'), 'Money Dress', 'Sophisticated money green dress', 'X2X-MONEY-D', 85000.00, 55000.00, 6, 2, 'M/L', 'Money Green', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Dresses'), 'Moment Dress', 'Timeless moment dress', 'X2X-MOMENT', 80000.00, 50000.00, 6, 2, 'M/L', 'Classic', 'Vonne X2x', true, true),
((SELECT id FROM product_categories WHERE name = 'Sets'), 'Blue Ocean Skirt Set', 'Beautiful blue ocean themed skirt set', 'X2X-BLUE-SET', 45000.00, 28000.00, 8, 3, 'M/L', 'Blue Ocean', 'Vonne X2x', true, true),

-- Already launched: Vonne string panties
((SELECT id FROM product_categories WHERE name = 'Lingerie'), 'Vonne String Panties - Red', 'Comfortable string panties in red', 'X2X-PANTY-RD', 18000.00, 10000.00, 20, 8, 'S/M/L', 'Red', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Lingerie'), 'Vonne String Panties - Pink', 'Comfortable string panties in pink', 'X2X-PANTY-PK', 18000.00, 10000.00, 20, 8, 'S/M/L', 'Pink', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Lingerie'), 'Vonne String Panties - White', 'Comfortable string panties in white', 'X2X-PANTY-WT', 18000.00, 10000.00, 20, 8, 'S/M/L', 'White', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Lingerie'), 'Vonne String Panties - Grey', 'Comfortable string panties in grey', 'X2X-PANTY-GY', 18000.00, 10000.00, 20, 8, 'S/M/L', 'Grey', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Lingerie'), 'Vonne String Panties - Brown', 'Comfortable string panties in brown', 'X2X-PANTY-BR', 18000.00, 10000.00, 20, 8, 'S/M/L', 'Brown', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Lingerie'), 'Vonne String Panties - Green', 'Comfortable string panties in green', 'X2X-PANTY-GN', 18000.00, 10000.00, 20, 8, 'S/M/L', 'Green', 'Vonne X2x', true, false),
((SELECT id FROM product_categories WHERE name = 'Lingerie'), 'Vonne String Panties - Blue', 'Comfortable string panties in blue', 'X2X-PANTY-BL', 18000.00, 10000.00, 20, 8, 'S/M/L', 'Blue', 'Vonne X2x', true, false);

-- Generate 1D scanner compatible barcodes (12-digit numeric barcodes)
-- Using a sequential approach since window functions aren't allowed in UPDATE
UPDATE products SET barcode = '880' || LPAD((id)::text, 9, '0')
WHERE barcode IS NULL;

-- Insert sample notification templates (additional ones)
INSERT INTO notification_templates (name, type, subject, template, variables, is_active) VALUES
('welcome_customer', 'email', 'Welcome to Vonne X2x!', 'Hi {{customer_name}}, welcome to Vonne X2x Fashion & Beauty! We''re excited to serve you. Book your first appointment and get 10% off!', '["customer_name"]', true),
('appointment_cancelled', 'sms', 'Appointment Cancelled', 'Your {{service_name}} appointment for {{booking_date}} has been cancelled. Please call us to reschedule. - Vonne X2x', '["service_name", "booking_date"]', true),
('birthday_wishes', 'whatsapp', 'Happy Birthday!', 'Happy Birthday {{customer_name}}! 🎉 Celebrate with us - enjoy 15% off any service this month. Book now!', '["customer_name"]', true),
('staff_shift_reminder', 'sms', 'Shift Reminder', 'Hi {{staff_name}}, reminder that your shift starts at {{shift_time}} tomorrow. See you then!', '["staff_name", "shift_time"]', true),
('inventory_restock', 'email', 'Inventory Restocked', 'Good news! {{product_name}} has been restocked. New quantity: {{new_stock}}. Previous: {{old_stock}}.', '["product_name", "new_stock", "old_stock"]', true);

-- Insert additional business settings
INSERT INTO business_settings (key, value, description, is_public) VALUES
('loyalty_program_enabled', 'true', 'Enable customer loyalty program', false),
('points_per_naira', '0.01', 'Loyalty points earned per naira spent', false),
('birthday_discount_percent', '15', 'Birthday discount percentage', false),
('referral_bonus_amount', '1000', 'Referral bonus amount in naira', false),
('minimum_booking_notice_hours', '2', 'Minimum hours notice required for booking', false),
('late_cancellation_fee', '2000', 'Fee for cancellations within cancellation window', false),
('no_show_fee', '5000', 'Fee charged for no-shows', false),
('deposit_percentage', '30', 'Deposit percentage required for bookings', false),
('instagram_handle', '"@vonnex2x"', 'Business Instagram handle', true),
('whatsapp_number', '"+234-XXX-XXX-XXXX"', 'Business WhatsApp number', true),
('facebook_page', '"Vonne X2x Fashion & Beauty"', 'Business Facebook page', true),
('website_url', '"https://vonnex2x.com"', 'Business website URL', true);

COMMIT;

-- Note: Staff and customer profiles will be created when users register through the application
-- The following would be sample data if we were to create test users:

/*
-- Sample admin user (would be created through Supabase Auth)
INSERT INTO profiles (id, email, full_name, role, phone, is_active, hire_date, salary) VALUES
('admin-uuid-here', 'admin@vonnex2x.com', 'Vonne Admin', 'admin', '+234-XXX-XXX-XXXX', true, '2024-01-01', 150000.00);

-- Sample staff users
INSERT INTO profiles (id, email, full_name, role, phone, is_active, hire_date, salary, commission_rate) VALUES
('staff1-uuid-here', 'sarah@vonnex2x.com', 'Sarah Johnson', 'staff', '+234-XXX-XXX-XXX1', true, '2024-01-15', 80000.00, 10.00),
('staff2-uuid-here', 'grace@vonnex2x.com', 'Grace Adebayo', 'staff', '+234-XXX-XXX-XXX2', true, '2024-02-01', 75000.00, 12.00),
('staff3-uuid-here', 'faith@vonnex2x.com', 'Faith Okafor', 'staff', '+234-XXX-XXX-XXX3', true, '2024-02-15', 70000.00, 8.00);

-- Sample customer users
INSERT INTO profiles (id, email, full_name, role, phone, date_of_birth, address) VALUES
('customer1-uuid-here', 'customer1@example.com', 'Adunni Bakare', 'customer', '+234-XXX-XXX-XXX4', '1995-06-15', 'Victoria Island, Lagos'),
('customer2-uuid-here', 'customer2@example.com', 'Chioma Okwu', 'customer', '+234-XXX-XXX-XXX5', '1992-03-22', 'Lekki, Lagos'),
('customer3-uuid-here', 'customer3@example.com', 'Blessing Eze', 'customer', '+234-XXX-XXX-XXX6', '1998-11-08', 'Ikeja, Lagos');
*/