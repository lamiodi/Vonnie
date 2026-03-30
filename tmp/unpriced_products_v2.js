import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString
});

async function findUnpricedProducts() {
  await client.connect();
  try {
    const res = await client.query(
      "SELECT id, name, sku, price, stock_level, category FROM products WHERE price <= 0 AND is_active = true ORDER BY category, name"
    );
    
    if (res.rows.length === 0) {
      console.log("No active products with ₦0 price found.");
    } else {
      console.log(`UNPRICED_PRODUCTS_START`);
      console.log(JSON.stringify(res.rows, null, 2));
      console.log(`UNPRICED_PRODUCTS_END`);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  await client.end();
}

findUnpricedProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
