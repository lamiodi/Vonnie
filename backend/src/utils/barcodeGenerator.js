import JsBarcode from 'jsbarcode';
import { createCanvas } from 'canvas';

/**
 * Generate barcode image from SKU or text
 * @param {string} text - The text to encode in the barcode
 * @param {Object} options - Barcode generation options
 * @returns {string} - Base64 encoded barcode image
 */
export const generateBarcode = (text, options = {}) => {
  const defaultOptions = {
    format: 'CODE128',
    width: 2,
    height: 100,
    displayValue: true,
    fontSize: 12,
    textMargin: 2,
    margin: 10,
    background: '#ffffff',
    lineColor: '#000000',
    ...options
  };

  try {
    // Create canvas for barcode generation
    const canvas = createCanvas(300, 150);
    
    // Generate barcode
    JsBarcode(canvas, text, defaultOptions);
    
    // Convert to base64
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Barcode generation error:', error);
    throw new Error(`Failed to generate barcode: ${error.message}`);
  }
};

/**
 * Generate barcode for product SKU
 * @param {string} sku - Product SKU
 * @param {Object} options - Barcode generation options
 * @returns {Object} - Barcode data including image and SKU
 */
export const generateProductBarcode = (sku, options = {}) => {
  if (!sku || typeof sku !== 'string') {
    throw new Error('Valid SKU is required for barcode generation');
  }

  const barcodeData = generateBarcode(sku, {
    format: 'CODE128',
    width: 2,
    height: 80,
    displayValue: true,
    fontSize: 14,
    textMargin: 4,
    margin: 8,
    ...options
  });

  return {
    sku,
    barcode: barcodeData,
    generatedAt: new Date().toISOString()
  };
};

/**
 * Generate barcodes for multiple products
 * @param {Array} products - Array of product objects with SKU
 * @param {Object} options - Barcode generation options
 * @returns {Array} - Array of barcode data
 */
export const generateProductBarcodes = (products, options = {}) => {
  if (!Array.isArray(products)) {
    throw new Error('Products must be an array');
  }

  return products.map(product => {
    if (!product.sku) {
      console.warn(`Product ${product.name || product.id} has no SKU, skipping barcode generation`);
      return null;
    }

    try {
      return generateProductBarcode(product.sku, options);
    } catch (error) {
      console.error(`Failed to generate barcode for product ${product.sku}:`, error);
      return null;
    }
  }).filter(Boolean);
};

/**
 * Validate SKU format for barcode generation
 * @param {string} sku - SKU to validate
 * @returns {boolean} - Whether SKU is valid
 */
export const validateSKU = (sku) => {
  if (!sku || typeof sku !== 'string') {
    return false;
  }

  // SKU should be alphanumeric with optional dashes or underscores
  const skuRegex = /^[A-Za-z0-9-_]+$/;
  return skuRegex.test(sku) && sku.length >= 3 && sku.length <= 50;
};

/**
 * Generate barcode with custom styling for salon products
 * @param {string} sku - Product SKU
 * @returns {string} - Base64 encoded barcode image with salon styling
 */
export const generateSalonBarcode = (sku) => {
  return generateProductBarcode(sku, {
    width: 2.5,
    height: 90,
    fontSize: 16,
    textMargin: 6,
    margin: 12,
    background: '#ffffff',
    lineColor: '#7c3aed' // Purple color matching salon theme
  });
};