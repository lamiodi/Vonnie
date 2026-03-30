import { query } from '../src/config/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, '../migrations/add_misc_charges.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await query(sql);
    console.log("Migration successful");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    process.exit();
  }
}
runMigration();