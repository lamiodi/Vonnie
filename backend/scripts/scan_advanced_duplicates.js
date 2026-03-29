import { query } from '../src/config/database.js';

async function scanAdvancedDuplicates() {
    try {
        console.log('🔍 Scanning for potential duplicates (Keyword Similarity)...');

        const result = await query('SELECT id, name, sku FROM products WHERE is_active = true');
        const products = result.rows;

        // Stop words to exclude during overlap check
        const stopWords = new Set(['and', 'with', 'the', 'for', 'of', 'in', '-', '(', ')', '/', '&']);

        const processName = (name) => {
            return name
                .toLowerCase()
                .replace(/[()\-/,]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 2 && !stopWords.has(w));
        };

        const analyzed = products.map(p => ({
            ...p,
            keywords: processName(p.name),
            keywordSet: new Set(processName(p.name))
        }));

        const potentialDuplicates = [];
        const usedIds = new Set();

        for (let i = 0; i < analyzed.length; i++) {
            const p1 = analyzed[i];

            for (let j = i + 1; j < analyzed.length; j++) {
                const p2 = analyzed[j];

                // Check for keyword overlap
                const intersection = [...p1.keywordSet].filter(w => p2.keywordSet.has(w));
                const overlapRatio = intersection.length / Math.max(p1.keywords.length, p2.keywords.length);

                // If they share most words (e.g. 70% or at least 3 significant words)
                // Adjusting threshold based on user example: 
                // "Duffle Bags (Mini) - Jet Black" (4 keys: duffle, bags, mini, black, jet)
                // "Mini X2x Fur Duffle Bag - Jet Black" (6 keys: mini, x2x, fur, duffle, bag, jet, black)
                // Overlap: mini, duffle, bag, jet, black. (5 out of 7) -> ~71%

                if (overlapRatio > 0.6 || (intersection.length >= 3 && overlapRatio > 0.4)) {
                    potentialDuplicates.push({
                        p1, p2, overlap: intersection, ratio: overlapRatio
                    });
                }
            }
        }

        if (potentialDuplicates.length === 0) {
            console.log('✅ No obvious keyword-overlap duplicates found.');
        } else {
            console.log(`⚠️ Found ${potentialDuplicates.length} potential duplicate pairs based on keyword similarity:`);
            potentialDuplicates.sort((a, b) => b.ratio - a.ratio).forEach((match, index) => {
                console.log(`${index + 1}. Match Similarity: ${(match.ratio * 100).toFixed(0)}%`);
                console.log(`   🔸 [${match.p1.sku || 'No SKU'}] "${match.p1.name}"`);
                console.log(`   🔹 [${match.p2.sku || 'No SKU'}] "${match.p2.name}"`);
                console.log(`   Overlap: [${match.overlap.join(', ')}]`);
                console.log('');
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error scanning duplicates:', error);
        process.exit(1);
    }
}

scanAdvancedDuplicates();
