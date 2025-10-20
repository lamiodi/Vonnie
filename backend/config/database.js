import postgres from 'postgres';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

// Create PostgreSQL connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const sql = postgres(connectionString, {
  ssl: 'require', // Always require SSL for Supabase
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Test connection on startup
try {
  await sql`SELECT NOW() as current_time`;
  console.log('✅ Database connected successfully to Supabase');
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
  process.exit(1); // Exit if database connection fails
}

export { sql };