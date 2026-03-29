import { query, getClient } from '../src/config/database.js';

/**
 * MIGRATION SCRIPT: Update Services Prices and Product Stock levels 
 * based on update.md
 * 
 * INSTRUCTIONS:
 * 1. Review the data arrays below.
 * 2. Run with: node scripts/apply_stock_update.js
 */

const SERVICE_UPDATES = [
    // Braids
    { name: 'Long knotless braids, (small)', price: 60000 },
    { name: 'Long knotless braids, (medium)', price: 40000 },
    { name: 'Short knotless braids, small', price: 40000 },
    { name: 'Short knotless braids, big', price: 30000 },
    { name: 'Jumbo box braids', price: 30000 },
    { name: 'Patewo braids', price: 40000 },
    { name: 'Lemonade braids', price: 55000 },
    { name: 'Bald braids', price: 30000 },
    { name: 'Bantu knots', price: 35000 },
    { name: 'All back braids (small)', price: 30000 },
    { name: 'All back braids (big)', price: 20000 },
    { name: 'Double brush braids', price: 20000 },
    { name: 'Two steps, long length', price: 40000 },
    { name: 'Two steps, short length', price: 35000 },
    { name: 'Kinky braids, long length', price: 40000 },
    { name: 'Kinky braids, short length', price: 30000 },
    { name: 'Short French curls', price: 45000 },
    { name: 'Layered French curls', price: 60000 },
    // Hybrid
    { name: 'Tyla hybrid braids', price: 45000 },
    { name: 'Half hybrid braids', price: 50000 },
    { name: 'Center part hybrid braid', price: 50000 },
    { name: 'Side hybrid braid', price: 50000 },
    { name: '360 hybrid braid', price: 60000 },
    // Care
    { name: 'Hair Wash - Regular', price: 5000 },
    { name: 'Hair Treatment - Intense Care', price: 15000 },
    // Ponytail
    { name: 'Bun', price: 20000 },
    { name: 'Two Buns', price: 25000 },
    { name: 'Ponytail with Extension', price: 25000 },
    { name: 'Two Ponytail', price: 30000 },
    { name: 'Pigtail', price: 30000 },
    // Nails - Stick-on
    { name: 'Stick On - Plain Short', price: 15000 },
    { name: 'Stick On - French Tip Short', price: 18000 },
    { name: 'Stick On - Chrome Short', price: 18000 },
    { name: 'Stick On - Plain Long', price: 20000 },
    { name: 'Stick On - French Tip Long', price: 23000 },
    { name: 'Gel Polish on Nails', price: 7000 },
    // Toes
    { name: 'Gel Polish - Toes', price: 5000 },
    { name: 'Acrylic Toes - Plain/Frenchtip', price: 15000 },
    { name: 'Chrome Frenchtip - Toes', price: 15000 },
    { name: 'Fixing & Polish - All Toes', price: 10000 },
    { name: 'Fixing & Polish - Big Toes', price: 7000 },
    { name: 'Acrylic & Polish - Big Toes', price: 8000 },
    { name: 'Cat Eye - Toes', price: 8000 },
    { name: 'Soak Off', price: 5000 }
];

const PRODUCT_UPDATES = [
    // Attachments
    { name: 'Attachment (Big Size) - Black', stock: 17 },
    { name: 'Attachment (Big Size) - Wine', stock: 7 },
    { name: 'Attachment (Small Size) - 350', stock: 2 },
    { name: 'Attachment (Small Size) - 613', stock: 1 },
    { name: 'Attachment (Small Size) - Ginger', stock: 2 },
    { name: 'Attachment (Small Size) - 27', stock: 2 },
    { name: 'Attachment (Small Size) - 33', stock: 6 },
    // Bone Straight
    { name: 'Bone Straight Extensions - 30', stock: 32 },
    { name: 'Bone Straight Extensions - 33', stock: 30 },
    { name: 'Bone Straight Extensions - Black', stock: 29 },
    { name: 'Bone Straight Extensions - 30/613', stock: 8 },
    { name: 'Bone Straight Extensions - 613', stock: 13 },
    { name: 'Bone Straight Extensions - 33/27', stock: 5 },
    { name: 'Bone Straight Extensions - Wine', stock: 27 },
    { name: 'Bone Straight Extensions - 27', stock: 5 },
    // Curls
    { name: 'Boho Curls - Black', stock: 15 },
    { name: 'Boho Curls - Wine', stock: 3 },
    { name: 'French Curls - Ginger', stock: 7 },
    { name: 'French Curls - 30', stock: 30 },
    { name: 'French Curls - Wine', stock: 28 },
    { name: 'French Curls - Black', stock: 16 },
    { name: 'French Curls - 613/30', stock: 4 },
    { name: 'French Curls - 33', stock: 12 },
    // Clothing
    { name: 'Rich Energy Shirt Set - Saphire (Blue) - Large', stock: 1 },
    { name: 'Rich Energy Shirt Set - Milk (Cream) - Medium', stock: 3 },
    { name: 'Olive Bubu - Small', stock: 1 },
    { name: 'Olive Bubu - Medium', stock: 1 },
    { name: 'Vonne String Panties - Small Green', stock: 7 },
    { name: 'Vonne String Panties - Medium Green', stock: 3 },
    { name: 'Vonne String Panties - Medium Grey', stock: 3 },
    { name: 'Vonne String Panties - Large Red', stock: 2 },
    { name: 'Vonne String Panties - Large Grey', stock: 2 },
    { name: 'Vonne String Panties - Large Blue', stock: 2 },
    { name: 'Vonne String Panties - Large Green', stock: 3 },
    { name: 'Vonne String Panties - Large Pink', stock: 1 },
    // Tank Tops
    { name: 'X-Tank Tops - Black', stock: 35 },
    { name: 'X-Tank Tops - Pink', stock: 11 },
    { name: 'X-Tank Tops - White', stock: 28 },
    { name: 'AFRICA PRINT Jumbo PANTS', stock: 5 },
    // Bags
    { name: 'Mini X2x Fur Duffle Bag - Jet Black', stock: 1 },
    { name: 'Duffle Bags (Big) - Sunrise', stock: 6 },
    { name: 'Duffle Bags (Big) - Money Green', stock: 3 },
    { name: 'Duffle Bags (Big) - Bubble Gum', stock: 2 },
    { name: 'Duffle Bags (Big) - Purple Daisy', stock: 3 },
    { name: 'Duffle Bags (Big) - Icy', stock: 2 },
    { name: 'Cross Bags - Jet Black', stock: 2 },
    { name: 'Cross Bags - Bubble Gum Pink', stock: 6 },
    { name: 'Cross Bags - Turquoise Blue', stock: 4 },
    { name: 'Cross Bags - Golden Brown', stock: 1 },
    // Butter
    { name: 'Body Butter (Cookie Dream) - Small', stock: 14 },
    { name: 'Body Butter (Cookie Dream) - Big', stock: 5 }
];

async function applyUpdates() {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        console.log('--- STARTING DATABASE UPDATE ---');

        console.log('\n🔹 Updating Services (Prices)...');
        let serviceUpdatedCount = 0;
        let serviceMissing = [];

        for (const s of SERVICE_UPDATES) {
            // Fuzzy match attempt: Exactly or similar pattern
            const res = await client.query(
                'UPDATE services SET price = $1 WHERE name ILIKE $2 RETURNING name, price',
                [s.price, s.name]
            );

            if (res.rowCount > 0) {
                console.log(`✅ Updated: ${res.rows[0].name} -> ₦${res.rows[0].price}`);
                serviceUpdatedCount++;
            } else {
                serviceMissing.push(s.name);
            }
        }

        console.log('\n🔸 Updating Products (Stock Levels)...');
        let productUpdatedCount = 0;
        let productMissing = [];

        for (const p of PRODUCT_UPDATES) {
            const res = await client.query(
                'UPDATE products SET stock_level = $1 WHERE name ILIKE $2 RETURNING name, stock_level',
                [p.stock, p.name]
            );

            if (res.rowCount > 0) {
                console.log(`✅ Updated: ${res.rows[0].name} -> ${res.rows[0].stock_level}`);
                productUpdatedCount++;
            } else {
                productMissing.push(p.name);
            }
        }

        await client.query('COMMIT');
        console.log('\n--- UPDATE COMPLETE ---');
        console.log(`Services Successfully Updated: ${serviceUpdatedCount}`);
        console.log(`Products Successfully Updated: ${productUpdatedCount}`);

        if (serviceMissing.length > 0) {
            console.log('\n⚠️ Services not found (Check name exactness):');
            serviceMissing.forEach(name => console.log(` - ${name}`));
        }

        if (productMissing.length > 0) {
            console.log('\n⚠️ Products not found (Check name exactness):');
            productMissing.forEach(name => console.log(` - ${name}`));
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ MIGRATION FAILED:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

applyUpdates();
