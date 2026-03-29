import { query } from '../src/config/database.js';

async function scanDuplicates() {
    try {
        console.log('🔍 Scanning for duplicate/nested product names...');

        const result = await query('SELECT id, name, sku, is_active FROM products WHERE is_active = true ORDER BY LENGTH(name) ASC');
        const products = result.rows;

        const nestedGroups = {};
        const handledIds = new Set();

        // For each product, check if its name is a prefix or base for others
        for (let i = 0; i < products.length; i++) {
            const current = products[i];
            if (handledIds.has(current.id)) continue;

            const baseName = current.name.trim().toLowerCase();
            const group = [current];

            for (let j = i + 1; j < products.length; j++) {
                const target = products[j];
                const targetName = target.name.trim().toLowerCase();

                // If it starts with the same name or contains it with a dash/space
                if (targetName.startsWith(baseName) && target.id !== current.id) {
                    group.push(target);
                    handledIds.add(target.id);
                }
            }

            if (group.length > 1) {
                nestedGroups[current.name] = group;
            }
        }

        const reports = Object.entries(nestedGroups);

        if (reports.length === 0) {
            console.log('✅ No obvious duplicate/nested names found.');
        } else {
            console.log(`⚠️ Found ${reports.length} potential duplicate/variant groups:`);
            reports.forEach(([base, group], index) => {
                console.log(`${index + 1}. Base Entry: "${base}" (${group.length} entries)`);
                group.forEach(p => {
                    console.log(`   - Name: "${p.name}", SKU: ${p.sku || 'N/A'}, ID: ${p.id}`);
                });
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error scanning duplicates:', error);
        process.exit(1);
    }
}

scanDuplicates();
