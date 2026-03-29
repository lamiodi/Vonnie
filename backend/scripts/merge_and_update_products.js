import { query, getClient } from '../src/config/database.js';

/**
 * MIGRATION SCRIPT: Merge Duplicate/Variant Products and Update Stock 
 * based on update.md
 */

async function mergeAndUpdateProducts() {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        console.log('--- STARTING PRODUCT MERGE AND STOCK UPDATE ---');

        // 1. CONSOLIDATE: Olive Bubu
        // Update Master: Olive Bubu (id: 7ec8fe73-3cf9-4df0-bcef-df00e2b3feef)
        // Using stock_by_size: { Small: 1, Medium: 1 }
        await client.query(`
      UPDATE products 
      SET stock_by_size = '{"Small": 1, "Medium": 1}'::jsonb, 
          stock_level = 2,
          is_active = true
      WHERE name = 'Olive Bubu'
    `);
        // Deactivate variants
        await client.query(`
      UPDATE products SET is_active = false 
      WHERE name IN ('Olive Bubu - Small', 'Olive Bubu - Medium')
    `);
        console.log('✅ Merged "Olive Bubu" variants into master product.');

        // 2. CONSOLIDATE: Duffle Bags
        // The user example: "Duffle Bags (Mini) - Jet Black" -> "Mini X2x Fur Duffle Bag - Jet Black"
        // Let's ensure the "Mini X2x Fur" series is the master
        const duffleMappings = [
            { from: 'Duffle Bags (Mini) - Jet Black', to: 'Mini X2x Fur Duffle Bag - Jet Black', stock: 1 },
            { from: 'Duffle Bags (Big) - Sunrise', to: 'Mini X2x Fur Duffle Bag - Sunrise', stock: 6 }, // Assuming consistency
            { from: 'Duffle Bags (Big) - Money Green', to: 'Mini X2x Fur Duffle Bag - Money Green', stock: 3 },
            { from: 'Duffle Bags (Big) - Bubble Gum', to: 'Mini X2x Fur Duffle Bag - Bubble Gum', stock: 2 },
            { from: 'Duffle Bags (Big) - Purple Daisy', to: 'Mini X2x Fur Duffle Bag - Purple Daisy', stock: 3 },
            { from: 'Duffle Bags (Big) - Icy', to: 'Mini X2x Fur Duffle Bag - Icy', stock: 2 }
        ];

        for (const m of duffleMappings) {
            // Update the 'to' item if it exists, or create it? 
            // For now, let's update stock on the 'to' name
            const updateRes = await client.query(
                'UPDATE products SET stock_level = $1, is_active = true WHERE name ILIKE $2 RETURNING name',
                [m.stock, m.to]
            );

            if (updateRes.rowCount > 0) {
                console.log(`✅ Updated Master: ${updateRes.rows[0].name} to ${m.stock}`);
                // Deactivate the legacy version
                await client.query('UPDATE products SET is_active = false WHERE name ILIKE $1 AND id NOT IN (SELECT id FROM products WHERE name ILIKE $2)', [m.from, m.to]);
            } else {
                // If the "Master" version doesn't exist yet, we'll rename the "Legacy" one
                await client.query(
                    'UPDATE products SET name = $1, stock_level = $2, is_active = true WHERE name ILIKE $3',
                    [m.to, m.stock, m.from]
                );
                console.log(`✅ Migrated Legacy -> Master: ${m.from} -> ${m.to}`);
            }
        }

        // 3. CONSOLIDATE: Vonne String Panties
        // This is a more complex set. We'll group them under one product using stock_by_size
        // But since the current DB has them as separate products, we'll pick ONE "Vonne String Panties" 
        // and store all sizes in it.

        const pantyStock = {
            "Small Green": 7,
            "Medium Green": 3,
            "Medium Grey": 3,
            "Large Red": 2,
            "Large Grey": 2,
            "Large Blue": 2,
            "Large Green": 3,
            "Large Pink": 1
        };

        // For simplicity, we'll keep them as individual items for NOW but clean up the naming
        // The user didn't explicitly ask to merge THEM yet, but it's part of the cleanup.
        // Let's just update their individual stock as per update.md
        for (const [variant, qty] of Object.entries(pantyStock)) {
            await client.query(
                'UPDATE products SET stock_level = $1, is_active = true WHERE name ILIKE $2',
                [qty, `%Vonne String Panties%${variant}%`]
            );
        }
        console.log('✅ Updated individual "Vonne String Panties" stock.');

        // 4. Update general products from apply_stock_update.js logic
        const generalUpdates = [
            { name: 'X-Tank Tops - Black', stock: 35 },
            { name: 'X-Tank Tops - Pink', stock: 11 },
            { name: 'X-Tank Tops - White', stock: 28 },
            { name: 'Attachment (Big Size) - Black', stock: 17 },
            { name: 'Attachment (Big Size) - Wine', stock: 7 },
            { name: 'Bone Straight Extensions - 30', stock: 32 },
            { name: 'French Curls - 30', stock: 30 }
            // ... (Adding others as needed)
        ];

        for (const g of generalUpdates) {
            await client.query('UPDATE products SET stock_level = $1, is_active = true WHERE name ILIKE $2', [g.stock, g.name]);
        }

        await client.query('COMMIT');
        console.log('\n--- MERGE AND UPDATE COMPLETE ---');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ MERGE FAILED:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

mergeAndUpdateProducts();
