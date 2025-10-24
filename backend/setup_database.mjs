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
          role TEXT DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'manager', 'customer')),
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
    
    console.log('✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the setup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase().catch(console.error);
}