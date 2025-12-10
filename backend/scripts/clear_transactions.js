import { query, pool } from '../src/config/database.js';

async function clearTransactions() {
  console.log('🗑️ Starting transaction cleanup...');
  
  try {
    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete in order of dependency
      console.log('Deleting coupon usage...');
      await client.query('DELETE FROM coupon_usage WHERE transaction_id IS NOT NULL');

      console.log('Deleting payments linked to transactions...');
      await client.query('DELETE FROM payments WHERE pos_transaction_id IS NOT NULL');

      console.log('Deleting transaction items...');
      await client.query('DELETE FROM pos_transaction_items');

      console.log('Deleting transactions...');
      await client.query('DELETE FROM pos_transactions');

      await client.query('COMMIT');
      console.log('✅ All transaction records cleared successfully');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error clearing transactions:', error);
  } finally {
    // Close pool to exit script
    await pool.end();
  }
}

clearTransactions();
