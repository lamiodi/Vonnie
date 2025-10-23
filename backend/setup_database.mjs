import pg from 'pg';
import dotenv from 'dotenv';

const { Client } = pg;
dotenv.config();

// Create a PostgreSQL client instance
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  console.log('💡 Please set DATABASE_URL in your .env file with a valid PostgreSQL connection string');
  console.log('💡 Example for local PostgreSQL: postgresql://username:password@localhost:5432/vonne_x2x');
  console.log('💡 Example for cloud PostgreSQL: postgresql://username:password@hostname:5432/database');
  process.exit(1);
}



async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...');
    console.log('📡 Connecting to database...');
    
    // Connect to the database first
    await client.connect();
    console.log('✅ Connected to database');
    
    // Test connection first
    const testResult = await client.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful:', testResult.rows[0].current_time);
    
    // Create tables one by one with proper error handling
    console.log('\n📋 Creating tables...');
    
    // 1. Enable UUID extension
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ UUID extension enabled');
    } catch (error) {
      console.log('ℹ️  UUID extension already exists');
    }
    
    // 2. Create users table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          phone TEXT,
          role TEXT DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'customer')),
          department_id UUID,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('✅ Users table created');
    } catch (error) {
      console.log('ℹ️  Users table already exists');
    }
    
    // 3. Create departments table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS departments (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name TEXT NOT NULL,
          description TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('✅ Departments table created');
    } catch (error) {
      console.log('ℹ️  Departments table already exists');
    }
    
    // 4. Create profiles table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS profiles (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          avatar_url TEXT,
          address TEXT,
          city TEXT,
          state TEXT,
          zip_code TEXT,
          country TEXT DEFAULT 'Nigeria',
          date_of_birth DATE,
          gender TEXT CHECK (gender IN ('male', 'female', 'other')),
          emergency_contact_name TEXT,
          emergency_contact_phone TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        )
      `);
      console.log('✅ Profiles table created');
    } catch (error) {
      console.log('ℹ️  Profiles table already exists');
    }
    
    // 5. Create guest_customers table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS guest_customers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('✅ Guest customers table created');
    } catch (error) {
      console.log('ℹ️  Guest customers table already exists');
    }
    
    // 6. Insert demo departments
    console.log('\n🏢 Creating demo departments...');
    try {
      await client.query(`
        INSERT INTO departments (name, description, is_active) VALUES
        ('Hair Styling', 'Professional hair styling and braiding services', true),
        ('Nail Care', 'Manicure, pedicure, and nail art services', true),
        ('Skin Care', 'Facial treatments and skin care services', true),
        ('Beauty', 'Makeup, lash extensions, and beauty treatments', true),
        ('Fashion', 'Fashion accessories and clothing sales', true)
        ON CONFLICT (name) DO NOTHING
      `);
      console.log('✅ Demo departments created');
    } catch (error) {
      console.log('ℹ️  Demo departments already exist');
    }
    
    // 7. Create admin account
    console.log('\n👑 Creating admin account...');
    try {
      await client.query(`
        INSERT INTO users (email, password, first_name, last_name, phone, role, is_active) VALUES
        ('admin@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Administrator', '+234-810-000-0000', 'admin', true)
        ON CONFLICT (email) DO NOTHING
      `);
      console.log('✅ Admin account created');
    } catch (error) {
      console.log('ℹ️  Admin account already exists');
    }
    
    // 8. Create staff accounts
    console.log('\n👥 Creating staff accounts...');
    try {
      await client.query(`
        INSERT INTO users (email, password, first_name, last_name, phone, role, is_active) VALUES
        ('stylist@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Hair', 'Stylist', '+234-810-000-0001', 'staff', true),
        ('nailtech@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Nail', 'Technician', '+234-810-000-0002', 'staff', true),
        ('beautician@vonnex2x.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Beauty', 'Specialist', '+234-810-000-0003', 'staff', true)
        ON CONFLICT (email) DO NOTHING
      `);
      console.log('✅ Staff accounts created');
    } catch (error) {
      console.log('ℹ️  Staff accounts already exist');
    }
    
    // 9. Create demo guest customers
    console.log('\n👥 Creating demo guest customers...');
    try {
      await client.query(`
        INSERT INTO guest_customers (first_name, last_name, phone, email) VALUES
        ('Guest', 'Customer', '+234-810-123-4567', 'guest@example.com'),
        ('Walk-in', 'Client', '+234-810-765-4321', 'walkin@example.com')
        ON CONFLICT (phone) DO NOTHING
      `);
      console.log('✅ Demo guest customers created');
    } catch (error) {
      console.log('ℹ️  Demo guest customers already exist');
    }

  // 10. Create services table (from prompt.txt specification)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        description TEXT,
        duration INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Services table created');
  } catch (error) {
    console.log('ℹ️  Services table already exists');
  }

  // 11. Create products table (from prompt.txt specification)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        description TEXT,
        sku TEXT UNIQUE NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category TEXT,
        stock_level INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER DEFAULT 5,
        image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Products table created');
  } catch (error) {
    console.log('ℹ️  Products table already exists');
  }

  // 12. Create bookings table (from prompt.txt specification)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID REFERENCES users(id),
        service_id UUID REFERENCES services(id),
        staff_id UUID REFERENCES users(id),
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Bookings table created');
  } catch (error) {
    console.log('ℹ️  Bookings table already exists');
  }

  // 13. Create transactions table (from prompt.txt specification)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type TEXT NOT NULL CHECK (type IN ('service', 'product', 'combined')),
        booking_id UUID REFERENCES bookings(id),
        staff_id UUID REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        payment_method TEXT NOT NULL,
        payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
        payment_reference TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Transactions table created');
  } catch (error) {
    console.log('ℹ️  Transactions table already exists');
  }

  // 14. Create transaction_items table (from prompt.txt specification)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_id UUID REFERENCES transactions(id),
        product_id UUID REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Transaction items table created');
  } catch (error) {
    console.log('ℹ️  Transaction items table already exists');
  }

  // 15. Create inventory_logs table (from prompt.txt specification)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS inventory_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID REFERENCES products(id),
        adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('sale', 'restock', 'adjustment', 'initial')),
        quantity INTEGER NOT NULL,
        notes TEXT,
        staff_id UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Inventory logs table created');
  } catch (error) {
    console.log('ℹ️  Inventory logs table already exists');
  }

  // 16. Create notifications table (from prompt.txt specification)
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        recipient_id UUID REFERENCES users(id),
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Notifications table created');
  } catch (error) {
    console.log('ℹ️  Notifications table already exists');
  }

  // 17. Insert demo services
  console.log('\n💅 Creating demo services...');
  try {
    await client.query(`
      INSERT INTO services (name, description, duration, price, category, is_active) VALUES
      ('Hair Braiding', 'Professional hair braiding with various styles', 120, 15000.00, 'Hair Styling', true),
      ('Manicure', 'Basic manicure with nail polish', 45, 5000.00, 'Nail Care', true),
      ('Pedicure', 'Luxury pedicure with foot massage', 60, 8000.00, 'Nail Care', true),
      ('Facial Treatment', 'Complete facial cleansing and treatment', 90, 12000.00, 'Skin Care', true),
      ('Lash Extensions', 'Professional eyelash extensions', 75, 18000.00, 'Beauty', true)
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Demo services created');
  } catch (error) {
    console.log('ℹ️  Demo services already exist');
  }

  // 18. Insert demo products
  console.log('\n🛍️ Creating demo products...');
  try {
    await client.query(`
      INSERT INTO products (name, description, sku, price, category, stock_level, low_stock_threshold, is_active) VALUES
      ('Fur Duffle Bag', 'Luxury fur duffle bag', 'FUR-DUFFLE-001', 45000.00, 'Fashion', 15, 5, true),
      ('Fur Purse', 'Elegant fur purse', 'FUR-PURSE-001', 28000.00, 'Fashion', 20, 5, true),
      ('2-Piece Shirt Set', 'Unisex 2-piece shirt set', 'SHIRT-SET-001', 15000.00, 'Fashion', 25, 10, true),
      ('Lingerie Set', 'Premium lingerie panties', 'LINGERIE-001', 8000.00, 'Fashion', 30, 10, true),
      ('Bikini Set', 'Stylish bikini set', 'BIKINI-001', 12000.00, 'Fashion', 18, 5, true)
      ON CONFLICT (sku) DO NOTHING
    `);
    console.log('✅ Demo products created');
  } catch (error) {
    console.log('ℹ️  Demo products already exist');
  }
    
    // Verification
    console.log('\n🔍 Verifying database setup...');
    
    // Check tables
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'profiles', 'guest_customers', 'departments')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Created tables:');
    tables.rows.forEach(table => {
      console.log(`  ✓ ${table.table_name}`);
    });
    
    // Check demo accounts - use a simpler query that works with existing table structure
    const demoUsers = await client.query(`
      SELECT email, role, is_active 
      FROM users 
      WHERE email IN ('admin@vonnex2x.com', 'stylist@vonnex2x.com', 'nailtech@vonnex2x.com', 'beautician@vonnex2x.com')
      ORDER BY role DESC
    `);
    
    console.log('\n👥 Demo accounts:');
    demoUsers.rows.forEach(user => {
      console.log(`  ✓ ${user.email} (${user.role})`);
    });
    
    // Check departments
    const departments = await client.query(`
      SELECT name, description 
      FROM departments 
      WHERE is_active = true
      ORDER BY name
    `);
    
    console.log('\n🏢 Departments:');
    departments.rows.forEach(dept => {
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
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the setup
setupDatabase().catch(console.error);