import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString
});

async function clearRecords() {
  await client.connect();
  console.log("Preparing to clear attendance and transaction records...");
  
  try {
    await client.query('BEGIN');

    // Attendance records
    const attendanceRes = await client.query('TRUNCATE TABLE attendance RESTART IDENTITY CASCADE');
    console.log("Attendance records cleared.");

    // Transaction records
    // Note: order is important because of dependencies
    await client.query('TRUNCATE TABLE pos_transaction_items RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE pos_transactions RESTART IDENTITY CASCADE');
    console.log("POS Transaction records cleared.");
    
    // Payment records
    await client.query('TRUNCATE TABLE payments RESTART IDENTITY CASCADE');
    await client.query('TRUNCATE TABLE payment_confirmation_logs RESTART IDENTITY CASCADE');
    console.log("Payment and log records cleared.");

    // Optional: Inventory movements (since they are related to transactions)
    // Uncomment these if you also want to clear stock adjustment history
    // await client.query('TRUNCATE TABLE inventory_movements RESTART IDENTITY CASCADE');
    // console.log("Inventory movement records cleared.");

    await client.query('COMMIT');
    console.log("\nSuccess! All attendance and transaction data has been cleared.");
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error clearing records:', err.message);
  }
  
  await client.end();
}

clearRecords().catch(err => {
  console.error(err);
  process.exit(1);
});
