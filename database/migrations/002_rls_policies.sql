-- Row Level Security Policies for Vonne X2x Management System
-- This file contains all RLS policies to secure data access based on user roles

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is staff or admin
CREATE OR REPLACE FUNCTION is_staff_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() IN ('staff', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES TABLE POLICIES
-- Users can view their own profile, staff can view customer profiles, admins can view all
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Staff can view customer profiles" ON profiles
    FOR SELECT USING (
        is_staff_or_admin() AND 
        (role = 'customer' OR auth.uid() = id)
    );

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (is_admin());

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "Admins can update any profile" ON profiles
    FOR UPDATE USING (is_admin());

-- Only admins can insert new profiles (staff registration)
CREATE POLICY "Admins can insert profiles" ON profiles
    FOR INSERT WITH CHECK (is_admin());

-- Only admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON profiles
    FOR DELETE USING (is_admin());

-- SERVICE CATEGORIES POLICIES
-- Everyone can view active service categories
CREATE POLICY "Everyone can view active service categories" ON service_categories
    FOR SELECT USING (is_active = true OR is_staff_or_admin());

-- Only admins can modify service categories
CREATE POLICY "Admins can modify service categories" ON service_categories
    FOR ALL USING (is_admin());

-- SERVICES POLICIES
-- Everyone can view active services
CREATE POLICY "Everyone can view active services" ON services
    FOR SELECT USING (is_active = true OR is_staff_or_admin());

-- Only admins can modify services
CREATE POLICY "Admins can modify services" ON services
    FOR ALL USING (is_admin());

-- PRODUCT CATEGORIES POLICIES
-- Everyone can view active product categories
CREATE POLICY "Everyone can view active product categories" ON product_categories
    FOR SELECT USING (is_active = true OR is_staff_or_admin());

-- Only admins can modify product categories
CREATE POLICY "Admins can modify product categories" ON product_categories
    FOR ALL USING (is_admin());

-- PRODUCTS POLICIES
-- Everyone can view active products
CREATE POLICY "Everyone can view active products" ON products
    FOR SELECT USING (is_active = true OR is_staff_or_admin());

-- Staff and admins can update products (for inventory management)
CREATE POLICY "Staff can update products" ON products
    FOR UPDATE USING (is_staff_or_admin());

-- Only admins can insert/delete products
CREATE POLICY "Admins can insert products" ON products
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can delete products" ON products
    FOR DELETE USING (is_admin());

-- BOOKINGS POLICIES
-- Customers can view their own bookings
CREATE POLICY "Customers can view own bookings" ON bookings
    FOR SELECT USING (customer_id = auth.uid());

-- Staff can view bookings assigned to them
CREATE POLICY "Staff can view assigned bookings" ON bookings
    FOR SELECT USING (staff_id = auth.uid() AND is_staff_or_admin());

-- Admins can view all bookings
CREATE POLICY "Admins can view all bookings" ON bookings
    FOR SELECT USING (is_admin());

-- Customers can create their own bookings
CREATE POLICY "Customers can create bookings" ON bookings
    FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Staff can create bookings for customers
CREATE POLICY "Staff can create bookings" ON bookings
    FOR INSERT WITH CHECK (is_staff_or_admin());

-- Customers can update their own pending bookings
CREATE POLICY "Customers can update own pending bookings" ON bookings
    FOR UPDATE USING (
        customer_id = auth.uid() AND 
        status IN ('pending', 'confirmed')
    );

-- Staff can update bookings assigned to them or any booking if admin
CREATE POLICY "Staff can update assigned bookings" ON bookings
    FOR UPDATE USING (
        is_staff_or_admin() AND 
        (staff_id = auth.uid() OR is_admin())
    );

-- Only admins can delete bookings
CREATE POLICY "Admins can delete bookings" ON bookings
    FOR DELETE USING (is_admin());

-- ATTENDANCE POLICIES
-- Staff can view their own attendance
CREATE POLICY "Staff can view own attendance" ON attendance
    FOR SELECT USING (staff_id = auth.uid() AND is_staff_or_admin());

-- Admins can view all attendance
CREATE POLICY "Admins can view all attendance" ON attendance
    FOR SELECT USING (is_admin());

-- Staff can create/update their own attendance
CREATE POLICY "Staff can manage own attendance" ON attendance
    FOR ALL USING (staff_id = auth.uid() AND is_staff_or_admin());

-- Admins can manage all attendance
CREATE POLICY "Admins can manage all attendance" ON attendance
    FOR ALL USING (is_admin());

-- TRANSACTIONS POLICIES
-- Customers can view their own transactions
CREATE POLICY "Customers can view own transactions" ON transactions
    FOR SELECT USING (customer_id = auth.uid());

-- Staff can view transactions they processed
CREATE POLICY "Staff can view processed transactions" ON transactions
    FOR SELECT USING (staff_id = auth.uid() AND is_staff_or_admin());

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions" ON transactions
    FOR SELECT USING (is_admin());

-- Staff and admins can create transactions
CREATE POLICY "Staff can create transactions" ON transactions
    FOR INSERT WITH CHECK (is_staff_or_admin());

-- Staff can update transactions they created, admins can update any
CREATE POLICY "Staff can update own transactions" ON transactions
    FOR UPDATE USING (
        is_staff_or_admin() AND 
        (staff_id = auth.uid() OR is_admin())
    );

-- Only admins can delete transactions
CREATE POLICY "Admins can delete transactions" ON transactions
    FOR DELETE USING (is_admin());

-- TRANSACTION ITEMS POLICIES
-- Follow same rules as transactions through JOIN
CREATE POLICY "View transaction items based on transaction access" ON transaction_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM transactions t 
            WHERE t.id = transaction_id AND (
                t.customer_id = auth.uid() OR 
                (t.staff_id = auth.uid() AND is_staff_or_admin()) OR 
                is_admin()
            )
        )
    );

CREATE POLICY "Staff can manage transaction items" ON transaction_items
    FOR ALL USING (is_staff_or_admin());

-- INVENTORY HISTORY POLICIES
-- Only staff and admins can view inventory history
CREATE POLICY "Staff can view inventory history" ON inventory_history
    FOR SELECT USING (is_staff_or_admin());

-- Staff and admins can create inventory records
CREATE POLICY "Staff can create inventory records" ON inventory_history
    FOR INSERT WITH CHECK (is_staff_or_admin());

-- Only admins can update/delete inventory history
CREATE POLICY "Admins can modify inventory history" ON inventory_history
    FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete inventory history" ON inventory_history
    FOR DELETE USING (is_admin());

-- NOTIFICATIONS POLICIES
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (recipient_id = auth.uid());

-- Staff and admins can view all notifications
CREATE POLICY "Staff can view all notifications" ON notifications
    FOR SELECT USING (is_staff_or_admin());

-- Staff and admins can create notifications
CREATE POLICY "Staff can create notifications" ON notifications
    FOR INSERT WITH CHECK (is_staff_or_admin());

-- Staff and admins can update notifications
CREATE POLICY "Staff can update notifications" ON notifications
    FOR UPDATE USING (is_staff_or_admin());

-- Only admins can delete notifications
CREATE POLICY "Admins can delete notifications" ON notifications
    FOR DELETE USING (is_admin());

-- NOTIFICATION TEMPLATES POLICIES
-- Staff can view templates
CREATE POLICY "Staff can view notification templates" ON notification_templates
    FOR SELECT USING (is_staff_or_admin());

-- Only admins can modify templates
CREATE POLICY "Admins can modify notification templates" ON notification_templates
    FOR ALL USING (is_admin());

-- BUSINESS SETTINGS POLICIES
-- Everyone can view public settings
CREATE POLICY "Everyone can view public settings" ON business_settings
    FOR SELECT USING (is_public = true);

-- Staff can view all settings
CREATE POLICY "Staff can view all settings" ON business_settings
    FOR SELECT USING (is_staff_or_admin());

-- Only admins can modify settings
CREATE POLICY "Admins can modify settings" ON business_settings
    FOR ALL USING (is_admin());

-- Note: handle_new_user function and trigger are defined in 003_auth_triggers.sql
-- This avoids duplicate function definitions that can cause conflicts

-- Function to update product stock after transaction
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    -- Only process completed transactions
    IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
        -- Update stock for each product in the transaction
        FOR item IN 
            SELECT ti.product_id, ti.quantity, p.stock_quantity
            FROM transaction_items ti
            JOIN products p ON p.id = ti.product_id
            WHERE ti.transaction_id = NEW.id AND ti.product_id IS NOT NULL
        LOOP
            -- Decrease stock quantity
            UPDATE products 
            SET stock_quantity = stock_quantity - item.quantity
            WHERE id = item.product_id;
            
            -- Log inventory change
            INSERT INTO inventory_history (
                product_id, transaction_id, change_type, 
                quantity_change, previous_quantity, new_quantity
            ) VALUES (
                item.product_id, NEW.id, 'sale',
                -item.quantity, item.stock_quantity, item.stock_quantity - item.quantity
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update stock when transaction is completed
CREATE TRIGGER update_stock_on_transaction
    AFTER UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- Function to check low stock and send alerts
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
DECLARE
    admin_ids UUID[];
BEGIN
    -- Check if stock is now below minimum level
    IF NEW.stock_quantity <= NEW.min_stock_level AND OLD.stock_quantity > NEW.min_stock_level THEN
        -- Get all admin user IDs
        SELECT ARRAY_AGG(id) INTO admin_ids
        FROM profiles 
        WHERE role = 'admin' AND is_active = true;
        
        -- Send notification to each admin
        IF admin_ids IS NOT NULL THEN
            INSERT INTO notifications (recipient_id, type, subject, message, template_name, template_data)
            SELECT 
                admin_id,
                'email',
                'Low Stock Alert - ' || NEW.name,
                'Product "' || NEW.name || '" is running low. Current stock: ' || NEW.stock_quantity || '. Minimum level: ' || NEW.min_stock_level || '.',
                'low_stock_alert',
                json_build_object(
                    'product_name', NEW.name,
                    'current_stock', NEW.stock_quantity,
                    'min_level', NEW.min_stock_level
                )
            FROM UNNEST(admin_ids) AS admin_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to check low stock when product quantity changes
CREATE TRIGGER check_low_stock_trigger
    AFTER UPDATE OF stock_quantity ON products
    FOR EACH ROW EXECUTE FUNCTION check_low_stock();

COMMIT;