import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString
});

async function findZeroPriceProducts() {
  await client.connect();
  try {
    const res = await client.query(
      "SELECT id, name, sku, price, stock_level FROM products WHERE price <= 0 AND is_active = true ORDER BY name"
    );
    
    if (res.rows.length === 0) {
      console.log("No active products with zero or negative prices found.");
    } else {
      console.log(`Found ${res.rows.length} products with ₦0 price:\n`);
      res.rows.forEach(p => {
        console.log(`- [${p.id}] ${p.name} (SKU: ${p.sku}) | Stock: ${p.stock_level}`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  await client.end();
}

findZeroPriceProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
