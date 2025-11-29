#!/usr/bin/env node

/**
 * Standalone Barcode Generator for Product SKUs
 * Run this script once to generate barcode images for all products
 * Then remove this script and the barcode logic from the system
 */

import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { query } from './src/config/db.js';

// Create output directory for barcodes
const OUTPUT_DIR = './generated_barcodes';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate barcode image from SKU
 * @param {string} sku - Product SKU
 * @param {string} productName - Product name for filename
 * @returns {string} - File path of generated barcode
 */
function generateBarcodeImage(sku, productName) {
  try {
    // Create canvas for barcode
    const canvas = createCanvas(300, 120);
    
    // Generate barcode with salon styling
    JsBarcode(canvas, sku, {
      format: 'CODE128',
      width: 2.5,
      height: 80,
      displayValue: true,
      fontSize: 14,
      textMargin: 6,
      margin: 12,
      background: '#ffffff',
      lineColor: '#000000' // Black color
    });
    
    // Create filename (sanitize product name)
    const sanitizedName = productName.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sku}_${sanitizedName}.png`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    // Save barcode image
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    
    console.log(`✅ Generated barcode: ${filename}`);
    return filepath;
  } catch (error) {
    console.error(`❌ Failed to generate barcode for SKU ${sku}:`, error.message);
    return null;
  }
}

/**
 * Generate barcodes for all products in database
 */
async function generateAllProductBarcodes() {
  try {
    console.log('🚀 Starting barcode generation for all products...');
    
    // Fetch all products from database
    const result = await query('SELECT id, name, sku FROM products WHERE sku IS NOT NULL AND sku != \'\'');
    const products = result.rows;
    
    console.log(`📦 Found ${products.length} products with SKUs`);
    
    if (products.length === 0) {
      console.log('⚠️  No products with SKUs found in database');
      return;
    }
    
    // Generate barcodes for each product
    const generatedBarcodes = [];
    for (const product of products) {
      const barcodePath = generateBarcodeImage(product.sku, product.name);
      if (barcodePath) {
        generatedBarcodes.push({
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcodePath: barcodePath
        });
      }
    }
    
    // Create summary report
    const summary = {
      totalProducts: products.length,
      generatedBarcodes: generatedBarcodes.length,
      timestamp: new Date().toISOString(),
      barcodes: generatedBarcodes
    };
    
    // Save summary report
    const summaryPath = path.join(OUTPUT_DIR, 'barcode_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log('\n📊 Barcode Generation Summary:');
    console.log(`Total Products: ${products.length}`);
    console.log(`Generated Barcodes: ${generatedBarcodes.length}`);
    console.log(`Failed: ${products.length - generatedBarcodes.length}`);
    console.log(`\n📁 Barcodes saved to: ${OUTPUT_DIR}`);
    console.log(`📋 Summary saved to: ${summaryPath}`);
    
    // Create CSV for easy reference
    const csvContent = generatedBarcodes.map(item => 
      `"${item.sku}","${item.name}","${path.basename(item.barcodePath)}"`
    ).join('\n');
    
    const csvPath = path.join(OUTPUT_DIR, 'barcode_inventory.csv');
    fs.writeFileSync(csvPath, 'SKU,Product Name,Barcode File\n' + csvContent);
    console.log(`📄 CSV inventory saved to: ${csvPath}`);
    
    console.log('\n✅ Barcode generation completed successfully!');
    console.log('\n⚠️  IMPORTANT: Remember to remove this script and barcode logic from the system!');
    console.log('Run: rm generate_barcodes.js');
    console.log('Then remove barcode logic from backend routes and frontend components.');
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
}

// Run the barcode generation
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllProductBarcodes()
    .then(() => {
      console.log('\n🏁 Script completed. You can now remove this file.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { generateBarcodeImage, generateAllProductBarcodes };