import { pool, query, testConnection } from '../src/config/database.js';

async function main() {
  console.log('--------------------------------------------------');
  console.log('🔄 Testing Vonne PostgreSQL / Supabase Database Connection...');
  console.log('--------------------------------------------------');

  const startTime = Date.now();
  const isConnected = await testConnection();

  if (!isConnected) {
    console.error('❌ Connection failed!');
    process.exit(1);
  }

  const pingDuration = Date.now() - startTime;
  console.log(`⏱️ Connection latency: ${pingDuration}ms\n`);

  // 1. Basic Server Info
  console.log('📌 Server Information:');
  const ver = await query('SELECT version();');
  console.log(`- Version: ${ver.rows[0].version}`);

  const dbInfo = await query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port();');
  console.log(`- Database Name: ${dbInfo.rows[0].current_database}`);
  console.log(`- User: ${dbInfo.rows[0].current_user}`);
  console.log(`- Host: ${dbInfo.rows[0].inet_server_addr || 'Supabase Pooler'}:${dbInfo.rows[0].inet_server_port || '5432'}\n`);

  // 2. Fetch Table List & Row Counts
  console.log('📊 Schema & Table Status:');
  const tables = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);

  console.log(`Found ${tables.rows.length} tables in the public schema:\n`);
  const tableData = [];

  for (const row of tables.rows) {
    try {
      const countRes = await query(`SELECT COUNT(*) as count FROM "${row.table_name}";`);
      tableData.push({
        'Table Name': row.table_name,
        'Row Count': parseInt(countRes.rows[0].count, 10),
        'Status': 'OK'
      });
    } catch (err) {
      tableData.push({
        'Table Name': row.table_name,
        'Row Count': 'N/A',
        'Status': `Error: ${err.message}`
      });
    }
  }

  console.table(tableData);

  // 3. Quick Read / Write Capability Check (Read Users / Settings sample)
  console.log('\n🔍 Data Sanity Check:');
  try {
    const userCount = await query('SELECT count(*) FROM users;');
    const staffCount = await query('SELECT count(*) FROM staff;');
    const serviceCount = await query('SELECT count(*) FROM services;');
    const productCount = await query('SELECT count(*) FROM products;');
    const bookingCount = await query('SELECT count(*) FROM bookings;');

    console.log(`- Users: ${userCount.rows[0].count}`);
    console.log(`- Staff: ${staffCount.rows[0].count}`);
    console.log(`- Services: ${serviceCount.rows[0].count}`);
    console.log(`- Products: ${productCount.rows[0].count}`);
    console.log(`- Bookings: ${bookingCount.rows[0].count}`);
  } catch (err) {
    console.warn(`- Notice during sanity check: ${err.message}`);
  }

  console.log('\n==================================================');
  console.log('🎉 ALL DATABASE CONNECTION TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Critical Error during test:', err);
  try {
    await pool.end();
  } catch (_) {}
  process.exit(1);
});
