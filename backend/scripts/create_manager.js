
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from backend root
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;

// Retry configuration
const MAX_RETRIES = 20;
const RETRY_DELAY = 15000; // 15 seconds

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000 // Short timeout for faster retry cycles
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createManager() {
  const email = process.argv[2] || 'manager@vonnex2x.com';
  const password = process.argv[3] || 'password';
  const name = process.argv[4] || 'General Manager';

  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      console.log(`[Attempt ${retries + 1}/${MAX_RETRIES}] Connecting to database...`);
      
      // Test connection first
      const client = await pool.connect();
      console.log('✅ Connected successfully!');
      
      try {
        console.log(`Creating/Updating manager user: ${email}`);
        
        // Check if user exists
        const checkRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        
        if (checkRes.rows.length > 0) {
          console.log('User already exists. Updating role to manager...');
          const hashedPassword = await bcrypt.hash(password, 10);
          await client.query('UPDATE users SET role = $1, password_hash = $2 WHERE email = $3', ['manager', hashedPassword, email]);
          console.log('✅ Role and password updated successfully.');
        } else {
          const hashedPassword = await bcrypt.hash(password, 10);
          await client.query(
            'INSERT INTO users (name, email, password_hash, role, current_status) VALUES ($1, $2, $3, $4, $5)',
            [name, email, hashedPassword, 'manager', 'available']
          );
          console.log('✅ Manager user created successfully.');
        }
        return; // Success, exit function
        
      } finally {
        client.release();
      }
      
    } catch (err) {
      console.error(`❌ Connection failed: ${err.message}`);
      if (retries < MAX_RETRIES - 1) {
        console.log(`Waiting ${RETRY_DELAY/1000}s before retrying...`);
        await sleep(RETRY_DELAY);
      }
    }
    retries++;
  }
  
  console.error('❌ Max retries reached. Could not connect to database.');
  process.exit(1);
}

createManager()
  .then(() => pool.end())
  .catch(err => {
    console.error('Fatal error:', err);
    pool.end();
  });
