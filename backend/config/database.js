const pkg = require('pg');
const { Pool } = pkg;

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // how long to wait for a connection from the pool
});

// Test the database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database via Supabase');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
  process.exit(-1);
});

// Helper function to execute queries
const query = (text, params) => {
  return pool.query(text, params);
};

// Helper function to get a client from the pool
const getClient = () => {
  return pool.connect();
};

module.exports = {
  pool,
  query,
  getClient
};