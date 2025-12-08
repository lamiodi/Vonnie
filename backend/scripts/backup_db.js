
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config({ path: join(__dirname, '../.env') });

const BACKUP_DIR = join(__dirname, '../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = `backup-${timestamp}.sql`;
const filepath = join(BACKUP_DIR, filename);

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

console.log(`Starting backup to ${filepath}...`);

// Note: pg_dump must be installed on the system
const command = `pg_dump "${dbUrl}" -f "${filepath}"`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Backup failed: ${error.message}`);
    return;
  }
  if (stderr) {
    console.log(`pg_dump output: ${stderr}`);
  }
  console.log(`Backup completed successfully: ${filename}`);
});
