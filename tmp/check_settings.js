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
    const res = await client.query('SELECT * FROM admin_settings');
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
