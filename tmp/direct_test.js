import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
    connectionString
});

async function main() {
    await client.connect();
    try {
        const res = await client.query('SELECT * FROM worker_schedules LIMIT 1');
        console.log('Table exists, one row:', res.rows[0]);
    } catch (err) {
        console.error('Table query failed:', err.message);
    }
    await client.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
