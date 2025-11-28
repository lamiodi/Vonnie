-- Clear all existing staff (admin, manager, staff roles)
DELETE FROM users WHERE role IN ('admin', 'manager', 'staff');

-- Insert new staff members
INSERT INTO users (id, name, email, password, role, phone, is_active, created_at, updated_at) VALUES
-- Admin users
('admin-001', 'System Administrator', 'admin@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '+234-800-000-0001', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Manager users  
('manager-001', 'General Manager', 'manager@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'manager', '+234-800-000-0002', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Staff users (Hairstylists, Beauticians, etc.)
('staff-001', 'Grace Hairstylist', 'grace@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', '+234-800-000-0003', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('staff-002', 'Sarah Beautician', 'sarah@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', '+234-800-000-0004', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('staff-003', 'Joy Nail Tech', 'joy@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', '+234-800-000-0005', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('staff-004', 'Amaka Braids Specialist', 'amaka@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', '+234-800-000-0006', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('staff-005', 'Chioma Massage Therapist', 'chioma@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', '+234-800-000-0007', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('staff-006', 'Tola Skincare Specialist', 'tola@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', '+234-800-000-0008', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Note: The password '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' is the bcrypt hash for 'password'
-- You should change these passwords after creation