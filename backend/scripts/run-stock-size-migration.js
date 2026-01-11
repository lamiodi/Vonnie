import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('Starting migration...');
    
    const migrationPath = path.join(__dirname, '../migrations/add_stock_by_size.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing SQL:');
    console.log(migrationSql);
    
    await query(migrationSql);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
