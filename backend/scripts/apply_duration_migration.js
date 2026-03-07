
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
  const client = await pool.connect();
  try {
    // Correct path relative to backend/scripts
    const migrationPath = path.join(__dirname, '../migrations/add_max_duration_to_services.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration...');
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying migration:', error);
  } finally {
    client.release();
    // End the pool to allow the script to exit
    await pool.end();
  }
}

applyMigration();
