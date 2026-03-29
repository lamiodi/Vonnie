import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Try to find the DB connection string from the environment or a config file
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/vonnex2x';

const client = new Client({
    connectionString
});

async function main() {
    await client.connect();
    const res = await client.query(`
    SELECT 
      day_of_week, 
      MIN(start_time) as first_resumption, 
      MAX(end_time) as last_closing 
    FROM worker_schedules 
    WHERE is_available = true 
    GROUP BY day_of_week 
    ORDER BY day_of_week
  `);
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
