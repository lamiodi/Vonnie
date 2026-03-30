import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString
});

async function findDuplicateProducts() {
  await client.connect();
  try {
    const res = await client.query('SELECT id, name, sku, stock_level, category FROM products WHERE is_active = true ORDER BY name');
    const products = res.rows;
    
    console.log(`Analyzing ${products.length} active products...\n`);
    
    const potentialDuplicates = [];
    const seenNames = new Set();
    
    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const p1 = products[i];
        const p2 = products[j];
        
        // Strategy 1: Match color suffixes (e.g., "- Purple Daisy")
        const colorMatch1 = p1.name.match(/-\s*([^-]+)$/);
        const colorMatch2 = p2.name.match(/-\s*([^-]+)$/);
        
        if (colorMatch1 && colorMatch2 && colorMatch1[1].trim().toLowerCase() === colorMatch2[1].trim().toLowerCase()) {
          // If colors match, check if the base names are similar
          const base1 = p1.name.split('-')[0].trim().toLowerCase();
          const base2 = p2.name.split('-')[0].trim().toLowerCase();
          
          // Check if key words like "Duffle", "Bag", "Fur", "Mini" overlap significantly
          const words1 = base1.split(/\s+/).filter(w => w.length > 2);
          const words2 = base2.split(/\s+/).filter(w => w.length > 2);
          
          const commonWords = words1.filter(w => words2.includes(w));
          
          if (commonWords.length >= 1) {
            potentialDuplicates.push({
              product1: p1,
              product2: p2,
              reason: `Matching color "${colorMatch1[1].trim()}" and common words: ${commonWords.join(', ')}`
            });
          }
        } else {
          // Strategy 2: Check for fuzzy name similarity without colors
          const words1 = p1.name.toLowerCase().split(/[\s\-\(\)]+/).filter(w => w.length > 2);
          const words2 = p2.name.toLowerCase().split(/[\s\-\(\)]+/).filter(w => w.length > 2);
          
          const commonWords = words1.filter(w => words2.includes(w));
          
          // If they share most of their words, they might be duplicates
          if (commonWords.length >= 3 || (commonWords.length >= 2 && words1.length <= 4)) {
             // Avoid reporting if we already have a color match listed
             potentialDuplicates.push({
               product1: p1,
               product2: p2,
               reason: `High word overlap: ${commonWords.join(', ')}`
             });
          }
        }
      }
    }
    
    if (potentialDuplicates.length === 0) {
      console.log("No obvious fuzzy duplicates found.");
    } else {
      console.log("Found potential duplicates:\n");
      potentialDuplicates.forEach((dup, idx) => {
        console.log(`${idx + 1}. [${dup.product1.id}] ${dup.product1.name} (Stock: ${dup.product1.stock_level})`);
        console.log(`   [${dup.product2.id}] ${dup.product2.name} (Stock: ${dup.product2.stock_level})`);
        console.log(`   Reason: ${dup.reason}\n`);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
  await client.end();
}

findDuplicateProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
