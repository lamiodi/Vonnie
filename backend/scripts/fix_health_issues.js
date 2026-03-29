import { query, getClient } from '../src/config/database.js';

/**
 * FIX SCRIPT: Address Health Check Issues
 * 1. Rename overlapping Products -> " (Product)"
 * 2. Generate unique SKUs for Products missing them
 */

async function fixHealthIssues() {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        console.log('🏁 Starting Database Fix Execution...\n');

        // --- FIX 1: Product-Service Overlaps ---
        console.log('🔍 Identifying Product-Service overlaps...');
        const overlaps = await client.query(`
      SELECT p.id, p.name 
      FROM products p
      JOIN services s ON LOWER(TRIM(p.name)) = LOWER(TRIM(s.name))
      WHERE p.is_active = true AND s.is_active = true
    `);

        if (overlaps.rows.length > 0) {
            console.log(`🛠️  Fixing ${overlaps.rows.length} product/service overlaps...`);
            for (const row of overlaps.rows) {
                const newName = `${row.name} (Product)`;
                await client.query('UPDATE products SET name = $1 WHERE id = $2', [newName, row.id]);
                console.log(`   ✅ Renamed: "${row.name}" -> "${newName}"`);
            }
        } else {
            console.log('✅ No active overlaps found to fix.');
        }

        // --- FIX 3: Missing SKUs ---
        console.log('\n🔍 Identifying products missing SKUs...');
        const missingSkus = await client.query(`
      SELECT id, name 
      FROM products 
      WHERE is_active = true AND (sku IS NULL OR sku = '')
    `);

        if (missingSkus.rows.length > 0) {
            console.log(`🛠️  Generating SKUs for ${missingSkus.rows.length} products...`);
            for (const row of missingSkus.rows) {
                // Generate a clean SKU: Name Prefix (3-5 chars) + Random hex
                const namePrefix = row.name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
                const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
                const newSku = `${namePrefix}-${randomPart}`;

                // Ensure uniqueness check if needed, but for now we'll just try to update
                try {
                    await client.query('UPDATE products SET sku = $1 WHERE id = $2', [newSku, row.id]);
                    console.log(`   ✅ Assigned: "${row.name}" -> SKU: ${newSku}`);
                } catch (e) {
                    // If collision, try with longer random
                    const longSku = `${namePrefix}-${Date.now().toString().slice(-6)}`;
                    await client.query('UPDATE products SET sku = $1 WHERE id = $2', [longSku, row.id]);
                    console.log(`   ✅ Assigned (retry): "${row.name}" -> SKU: ${longSku}`);
                }
            }
        } else {
            console.log('✅ All active products already have SKUs.');
        }

        await client.query('COMMIT');
        console.log('\n✨ All requested fixes applied successfully!');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ FIX FAILED:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

fixHealthIssues();
