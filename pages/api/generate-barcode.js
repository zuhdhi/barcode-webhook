import bwipjs from 'bwip-js';
import { createCanvas } from 'canvas';
import '@canvas-fonts/arial'; 

// Disable body parsing - we need JSON
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  

  try {
    const { productCode, salesPrice, purchasePrice, hashingFormat, billId } = req.body;

    // Validate inputs
    if (!productCode || !salesPrice || !purchasePrice) {
      return res.status(400).json({ 
        error: 'Missing required fields: productCode, salesPrice, purchasePrice' 
      });
    }

    // Apply client's hashing algorithm
    const hashedSales = applyHashingFormat(salesPrice, hashingFormat);
    const hashedPurchase = applyHashingFormat(purchasePrice, hashingFormat);

    // Step 1: Generate barcode using bwip-js
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',           // Barcode type
      text: productCode,         // Product code to encode
      scale: 3,                  // 3x scaling
      height: 10,                // Bar height in mm
      includetext: true,         // Show product code below barcode
      textxalign: 'center',
    });

    // Step 2: Create composite image with custom text
    const finalImage = await addCustomTextToBarcode(
      barcodeBuffer,
      hashedSales,
      hashedPurchase
    );

    // Step 3: Return image as response
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="barcode-${productCode}.png"`);
    res.status(200).send(finalImage);

  } catch (error) {
    console.error('Barcode generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate barcode', 
      details: error.message 
    });
  }
}

// Function to add custom text below barcode
async function addCustomTextToBarcode(barcodeBuffer, hashedSales, hashedPurchase) {
  const { createCanvas, loadImage } = require('canvas');
  
  // Load barcode image
  const barcodeImg = await loadImage(barcodeBuffer);
  
  // Create canvas with extra height for text (60px for 2 lines of text)
  const canvas = createCanvas(barcodeImg.width, barcodeImg.height + 70);
  const ctx = canvas.getContext('2d');
  
  // Fill white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw barcode at top
  ctx.drawImage(barcodeImg, 0, 0);
  
  // Configure text style
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  
  const centerX = canvas.width / 2;
  const textStartY = barcodeImg.height + 25;
  
  // Add hashed sales price
  ctx.fillText(`Sales: ${hashedSales}`, centerX, textStartY);
  
  // Add hashed purchase price
  ctx.fillText(`Purchase: ${hashedPurchase}`, centerX, textStartY + 25);
  
  // Return as PNG buffer
  return canvas.toBuffer('image/png');
}

// Apply client's hashing format
function applyHashingFormat(price, format) {
  const priceStr = price.toString();
  
  // Default format if not specified
  if (!format || format === 'base64') {
    return Buffer.from(priceStr).toString('base64');
  }
  
  // Custom masking format
  if (format === 'mask') {
    const len = priceStr.length;
    if (len <= 4) return '***';
    return priceStr.substring(0, 2) + '***' + priceStr.substring(len - 2);
  }
  
  // Character replacement format
  if (format === 'replace') {
    return priceStr
      .replace(/0/g, '#')
      .replace(/5/g, '@')
      .replace(/9/g, '*');
  }
  
  // Default to base64
  return Buffer.from(priceStr).toString('base64');
}
