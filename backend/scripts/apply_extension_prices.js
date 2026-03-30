import { query } from '../src/config/database.js';

async function updateExtensionPrices() {
  console.log('Starting price update for Hair Extensions...');
  
  // 1. Update Big Attachments to 10000
  await query(`UPDATE products SET price = 10000 WHERE category = 'Hair Extensions' AND name ILIKE '%Attachment (Big Size)%' AND price = 0`);
  
  // 2. Update Small Attachments to 8000
  await query(`UPDATE products SET price = 8000 WHERE category = 'Hair Extensions' AND name ILIKE '%Attachment (Small Size)%' AND price = 0`);
  
  // 3. Update French Curls to 8500
  await query(`UPDATE products SET price = 8500 WHERE category = 'Hair Extensions' AND name ILIKE '%French Curls%' AND price = 0`);
  
  // 4. Update Bone Straight to 10000
  await query(`UPDATE products SET price = 10000 WHERE category = 'Hair Extensions' AND name ILIKE '%Bone Straight%' AND price = 0`);
  
  // 5. Update Boho Curls to 8000
  await query(`UPDATE products SET price = 8000 WHERE category = 'Hair Extensions' AND name ILIKE '%Boho Curls%' AND price = 0`);
  
  console.log('Hair extensions prices updated successfully!');
  process.exit(0);
}

updateExtensionPrices().catch(console.error);