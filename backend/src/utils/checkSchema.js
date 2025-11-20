import { query } from '../config/database.js';

async function checkUsersTableSchema() {
  try {
    // Get table schema
    const result = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Users table schema:');
    console.table(result.rows);
    
    // Check if we have any data
    const sampleData = await query('SELECT * FROM users LIMIT 1');
    console.log('\n📊 Sample user data (first row):');
    if (sampleData.rows.length > 0) {
      console.log(sampleData.rows[0]);
    } else {
      console.log('No users found in the database');
    }
    
  } catch (error) {
    console.error('Error checking schema:', error.message);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkUsersTableSchema().catch(console.error);
}

export { checkUsersTableSchema };