import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString
});

async function getAllZeroPriceProducts() {
  await client.connect();
  try {
    const res = await client.query(
      "SELECT id, name, sku, price, stock_level, category FROM products WHERE price <= 0 AND is_active = true ORDER BY name"
    );
    
    console.log(`FULL_ZERO_PRICE_LIST_START`);
    console.log(JSON.stringify(res.rows, null, 2));
    console.log(`FULL_ZERO_PRICE_LIST_END`);
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  await client.end();
}

getAllZeroPriceProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
