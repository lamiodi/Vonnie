const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });

// Import the existing database connection
const postgres = require('postgres');

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require'
});

async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...');
    console.log('📡 Connecting to Supabase...');
    
    // Test connection first
    const testResult = await sql`SELECT NOW() as current_time`;
    console.log('✅ Database connection successful:', testResult[0].current_time);
    
    // Create tables one by one with proper error handling
    console.log('\n📋 Creating tables...');
    
    // 1. Enable UUID extension
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
      console.log('✅ UUID extension enabled');
    } catch (error) {
      console.log('ℹ️  UUID extension already exists');
    }
    
    // 2. Create users table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          phone VARCHAR(20),
          role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'customer')),
          is_active BOOLEAN DEFAULT true,
          email_verified BOOLEAN DEFAULT false,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      console.log('✅ Users table created');
    } catch (error) {
      console.log('ℹ️  Users table already exists');
    }
    
    // 3. Create departments table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS departments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          manager_id UUID REFERENCES users(id),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      console.log('✅ Departments table created');
    } catch (error) {
      console.log('ℹ️  Departments table already exists');
    }
    
    // 4. Create profiles table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          specialization VARCHAR(255),
          experience VARCHAR(100),
          employee_id VARCHAR(50) UNIQUE,
          hire_date DATE,
          salary DECIMAL(12,2),
          commission_rate DECIMAL(5,2) DEFAULT 0.00,
          address TEXT,
          emergency_contact VARCHAR(255),
          emergency_phone VARCHAR(20),
          skills TEXT,
          notes TEXT,
          avatar_url VARCHAR(500),
          department_id UUID REFERENCES departments(id),
          position VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      console.log('✅ Profiles table created');
    } catch (error) {
      console.log('ℹ️  Profiles table already exists');
    }
    
    // 5. Create guest_customers table
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS guest_customers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(20) NOT NULL,
          address TEXT,
          date_of_birth DATE,
          gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
          notes TEXT,
          loyalty_points INTEGER DEFAULT 0,
          total_visits INTEGER DEFAULT 0,
          total_spent DECIMAL(12,2) DEFAULT 0.00,
          last_visit TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;
      console.log('✅ Guest customers table created');
    } catch (error) {
      console.log('ℹ️  Guest customers table already exists');
    }
    
    // 6. Insert demo departments
    console.log('\n🏢 Creating demo departments...');
    try {
      await sql`
        INSERT INTO departments (name, description, is_active) VALUES
        ('Hair Styling', 'Hair cutting, styling, and treatments', true),
        ('Nail Care', 'Manicure, pedicure, and nail art services', true),
        ('Skin Care', 'Facial treatments and skin care services', true),
        ('Massage Therapy', 'Relaxation and therapeutic massage services', true),
        ('Administration', 'Management and administrative staff', true)
        ON CONFLICT (name) DO NOTHING
      `;
      console.log('✅ Demo departments created');
    } catch (error) {
      console.log('ℹ️  Demo departments already exist');
    }
    
    // 7. Insert demo admin account
    console.log('\n👤 Creating demo admin account...');
    try {
      // Password: Admin@2024 (hashed with bcrypt)
      const adminResult = await sql`
        INSERT INTO users (email, password_hash, full_name, phone, role, is_active, email_verified) VALUES
        ('admin@vonnex2x.com', '$2b$12$LQv3c1yqBwEHXjp.RweHNe1fF0XgMhOxp5dMChWnkUOib1h.kNjSW', 'Admin Demo', '+2348012345678', 'admin', true, true)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;
      
      if (adminResult.length > 0) {
        console.log('✅ Admin account created');
        
        // Create admin profile
        const adminDept = await sql`SELECT id FROM departments WHERE name = 'Administration' LIMIT 1`;
        if (adminDept.length > 0) {
          await sql`
            INSERT INTO profiles (
              user_id, first_name, last_name, specialization, experience, 
              employee_id, hire_date, position, department_id
            ) VALUES (
              ${adminResult[0].id}, 'Admin', 'Demo', 'System Administration', 'Expert Level',
              'EMP001', CURRENT_DATE - INTERVAL '2 years', 'System Administrator', ${adminDept[0].id}
            )
            ON CONFLICT DO NOTHING
          `;
          console.log('✅ Admin profile created');
        }
      } else {
        console.log('ℹ️  Admin account already exists');
      }
    } catch (error) {
      console.log('ℹ️  Admin account already exists');
    }
    
    // 8. Insert demo staff account
    console.log('\n👤 Creating demo staff account...');
    try {
      // Password: Staff@2024 (hashed with bcrypt)
      const staffResult = await sql`
        INSERT INTO users (email, password_hash, full_name, phone, role, is_active, email_verified) VALUES
        ('staff@vonnex2x.com', '$2b$12$8Y.VPZaN7pmYpHgeJAoH4.WiAy8qfNjH/Oy6aJqO8qfNjH/Oy6aJqO', 'Staff Demo', '+2348087654321', 'staff', true, true)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `;
      
      if (staffResult.length > 0) {
        console.log('✅ Staff account created');
        
        // Create staff profile
        const hairDept = await sql`SELECT id FROM departments WHERE name = 'Hair Styling' LIMIT 1`;
        if (hairDept.length > 0) {
          await sql`
            INSERT INTO profiles (
              user_id, first_name, last_name, specialization, experience, 
              employee_id, hire_date, salary, commission_rate, position, department_id
            ) VALUES (
              ${staffResult[0].id}, 'Staff', 'Demo', 'Hair Styling & Treatment', 'Intermediate Level',
              'EMP002', CURRENT_DATE - INTERVAL '1 year', 150000.00, 15.00, 'Senior Hair Stylist', ${hairDept[0].id}
            )
            ON CONFLICT DO NOTHING
          `;
          console.log('✅ Staff profile created');
        }
      } else {
        console.log('ℹ️  Staff account already exists');
      }
    } catch (error) {
      console.log('ℹ️  Staff account already exists');
    }
    
    // 9. Insert demo guest customers
    console.log('\n👥 Creating demo guest customers...');
    try {
      await sql`
        INSERT INTO guest_customers (first_name, last_name, email, phone, address, gender, loyalty_points, total_visits, total_spent, last_visit) VALUES
        ('Sarah', 'Johnson', 'sarah.johnson@email.com', '+2348123456789', '123 Victoria Island, Lagos', 'female', 450, 8, 680000.00, NOW() - INTERVAL '3 days'),
        ('Michael', 'Adebayo', 'michael.adebayo@email.com', '+2348134567890', '456 Ikeja GRA, Lagos', 'male', 280, 5, 420000.00, NOW() - INTERVAL '1 week'),
        ('Fatima', 'Ibrahim', 'fatima.ibrahim@email.com', '+2348145678901', '789 Abuja Central, FCT', 'female', 320, 6, 510000.00, NOW() - INTERVAL '5 days'),
        ('David', 'Okafor', 'david.okafor@email.com', '+2348156789012', '321 Port Harcourt, Rivers', 'male', 180, 3, 285000.00, NOW() - INTERVAL '2 weeks')
        ON CONFLICT DO NOTHING
      `;
      console.log('✅ Demo guest customers created');
    } catch (error) {
      console.log('ℹ️  Demo guest customers already exist');
    }
    
    // Verification
    console.log('\n🔍 Verifying database setup...');
    
    // Check tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'profiles', 'guest_customers', 'departments')
      ORDER BY table_name
    `;
    
    console.log('\n📋 Created tables:');
    tables.forEach(table => {
      console.log(`  ✓ ${table.table_name}`);
    });
    
    // Check demo accounts
    const demoUsers = await sql`
      SELECT email, full_name, role, is_active 
      FROM users 
      WHERE email IN ('admin@vonnex2x.com', 'staff@vonnex2x.com')
      ORDER BY role DESC
    `;
    
    console.log('\n👥 Demo accounts:');
    demoUsers.forEach(user => {
      console.log(`  ✓ ${user.email} (${user.role}) - ${user.full_name}`);
    });
    
    // Check departments
    const departments = await sql`
      SELECT name, description 
      FROM departments 
      WHERE is_active = true
      ORDER BY name
    `;
    
    console.log('\n🏢 Departments:');
    departments.forEach(dept => {
      console.log(`  ✓ ${dept.name}`);
    });
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Demo Account Credentials:');
    console.log('   Admin: admin@vonnex2x.com / Admin@2024');
    console.log('   Staff: staff@vonnex2x.com / Staff@2024');
    
  } catch (error) {
    console.error('💥 Fatal error during database setup:', error);
    process.exit(1);
  } finally {
    await sql.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the setup
setupDatabase().catch(console.error);