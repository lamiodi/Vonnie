import React, { useState, useEffect } from 'react';
import JsBarcode from 'jsbarcode';

/**
 * Barcode Display Component
 * This component can be used to display barcodes for products
 * You can remove this after generating the barcode images
 */
const BarcodeDisplay = ({ sku, productName, width = 300, height = 120 }) => {
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');

  useEffect(() => {
    if (sku) {
      generateBarcode();
    }
  }, [sku]);

  const generateBarcode = () => {
    try {
      // Create canvas element
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      // Generate barcode
      JsBarcode(canvas, sku, {
        format: 'CODE128',
        width: 2.5,
        height: 80,
        displayValue: true,
        fontSize: 14,
        textMargin: 6,
        margin: 12,
        background: '#ffffff',
        lineColor: '#7c3aed' // Purple theme
      });
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      setBarcodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating barcode:', error);
    }
  };

  if (!sku) return null;

  return (
    <div className="barcode-container bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="text-center mb-2">
        <p className="text-sm font-medium text-gray-700">{productName}</p>
        <p className="text-xs text-gray-500">SKU: {sku}</p>
      </div>
      {barcodeDataUrl && (
        <img 
          src={barcodeDataUrl} 
          alt={`Barcode for ${sku}`}
          className="w-full h-auto"
        />
      )}
      <div className="text-center mt-2">
        <p className="text-xs font-mono text-gray-600">{sku}</p>
      </div>
    </div>
  );
};

/**
 * Barcode Generator Utility for Frontend
 * Use this to generate barcode data URLs for products
 */
export const generateBarcodeDataUrl = (sku, options = {}) => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = options.width || 300;
    canvas.height = options.height || 120;
    
    JsBarcode(canvas, sku, {
      format: 'CODE128',
      width: 2.5,
      height: 80,
      displayValue: true,
      fontSize: 14,
      textMargin: 6,
      margin: 12,
      background: '#ffffff',
      lineColor: '#7c3aed',
      ...options
    });
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    return '';
  }
};

export default BarcodeDisplay;