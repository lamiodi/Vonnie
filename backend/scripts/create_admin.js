
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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'System Admin';

  if (!email || !password) {
    console.error('Usage: node scripts/create_admin.js <email> <password> [name]');
    process.exit(1);
  }

  try {
    console.log(`Creating admin user: ${email}`);
    
    // Check if user exists
    const checkRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (checkRes.rows.length > 0) {
      console.log('User already exists. Updating role to admin...');
      await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['admin', email]);
      console.log('Role updated.');
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO users (name, email, password_hash, role, current_status) VALUES ($1, $2, $3, $4, $5)',
        [name, email, hashedPassword, 'admin', 'available']
      );
      console.log('Admin user created successfully.');
    }
  } catch (err) {
    console.error('Error creating admin:', err);
  } finally {
    await pool.end();
  }
}

createAdmin();
