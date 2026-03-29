import { query } from '../src/config/database.js';

/**
 * HEALTH CHECK SCRIPT: Scan Products and Services for potential issues
 * - Overlapping names between Products & Services
 * - Duplicate names within same table
 * - Items with Zero/Invalid Price
 * - Low/Zero Stock
 * - Missing Categories or SKUs
 */

async function runHealthCheck() {
    try {
        console.log('🛡️  Starting System Health Check (Products & Services)\n');

        // 1. Overlapping Names Check
        console.log('🔍 Checking for Product-Service overlaps...');
        const overlaps = await query(`
      SELECT p.name, p.id as product_id, s.id as service_id
      FROM products p
      JOIN services s ON LOWER(TRIM(p.name)) = LOWER(TRIM(s.name))
      WHERE p.is_active = true AND s.is_active = true
    `);

        if (overlaps.rows.length > 0) {
            console.log(`⚠️  FOUND ${overlaps.rows.length} items that exist as both a Product AND a Service:`);
            overlaps.rows.forEach(row => console.log(`   - "${row.name}"`));
        } else {
            console.log('✅ No active overlaps found.');
        }

        // 2. Zeroth Price Check
        console.log('\n🔍 Checking for Zero/Invalid Prices...');
        const zeroPriceProducts = await query('SELECT name, id FROM products WHERE is_active = true AND (price <= 0 OR price IS NULL)');
        const zeroPriceServices = await query('SELECT name, id FROM services WHERE is_active = true AND (price <= 0 OR price IS NULL)');

        if (zeroPriceProducts.rows.length > 0) {
            console.log(`⚠️  Found ${zeroPriceProducts.rows.length} Products with zero/null price:`);
            zeroPriceProducts.rows.forEach(p => console.log(`   - "${p.name}" (ID: ${p.id})`));
        }
        if (zeroPriceServices.rows.length > 0) {
            console.log(`⚠️  Found ${zeroPriceServices.rows.length} Services with zero/null price:`);
            zeroPriceServices.rows.forEach(s => console.log(`   - "${s.name}" (ID: ${s.id})`));
        }

        // 3. Duplicate Names within tables
        console.log('\n🔍 Checking for exact name duplicates in the same table...');
        const dupProducts = await query(`
      SELECT name, COUNT(*) FROM products 
      WHERE is_active = true GROUP BY name HAVING COUNT(*) > 1
    `);
        const dupServices = await query(`
      SELECT name, COUNT(*) FROM services 
      WHERE is_active = true GROUP BY name HAVING COUNT(*) > 1
    `);

        if (dupProducts.rows.length > 0) {
            console.log(`⚠️  Found ${dupProducts.rows.length} Duplicate names in Products table.`);
        }
        if (dupServices.rows.length > 0) {
            console.log(`⚠️  Found ${dupServices.rows.length} Duplicate names in Services table.`);
        }

        // 4. Low/Zero Stock
        console.log('\n🔍 Checking for Zero/Negative Stock Levels...');
        const zeroStock = await query(`
      SELECT name, stock_level FROM products 
      WHERE is_active = true AND (stock_level <= 0 OR stock_level IS NULL)
    `);
        if (zeroStock.rows.length > 0) {
            console.log(`📊 Found ${zeroStock.rows.length} Products with Zero/No stock.`);
        }

        // 5. Missing SKU
        console.log('\n🔍 Checking for Products missing SKUs (Barcodes)...');
        const missingSku = await query('SELECT name FROM products WHERE is_active = true AND (sku IS NULL OR sku = \'\')');
        if (missingSku.rows.length > 0) {
            console.log(`📊 Found ${missingSku.rows.length} Products with no SKU assigned.`);
        }

        console.log('\n--- HEALTH CHECK COMPLETE ---');
        process.exit(0);

    } catch (error) {
        console.error('❌ Health check failed:', error);
        process.exit(1);
    }
}

runHealthCheck();
