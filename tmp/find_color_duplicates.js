import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString
});

async function findSpecificDuplicates() {
  await client.connect();
  try {
    const res = await client.query('SELECT id, name, sku, stock_level, category FROM products WHERE is_active = true ORDER BY name');
    const products = res.rows;
    
    // Group products by "normalized" category + "color/style suffix"
    const colorGroups = {};
    
    products.forEach(p => {
       const parts = p.name.split('-');
       if (parts.length > 1) {
          const suffix = parts[parts.length - 1].trim().toLowerCase();
          if (!colorGroups[suffix]) colorGroups[suffix] = [];
          colorGroups[suffix].push(p);
       }
    });

    console.log("Groups of products sharing the same color/suffix:");
    for (const [suffix, items] of Object.entries(colorGroups)) {
       if (items.length > 1) {
          // Filter out if they have VERY different names
          // Check if names are actually similar
          console.log(`\nColor Suffix: "${suffix}"`);
          items.forEach(item => {
             console.log(`  - [${item.id}] ${item.name} (${item.stock_level})`);
          });
       }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  await client.end();
}

findSpecificDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
