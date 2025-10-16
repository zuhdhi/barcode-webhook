import bwipjs from 'bwip-js';
import { registerFont } from 'canvas';
import path from 'path';

// Register fonts
registerFont(path.join(process.cwd(), './public/fonts/Arial.ttf'), { 
  family: 'Arial' 
});
registerFont(path.join(process.cwd(), './public/fonts/Poppins-Bold.ttf'), { 
  family: 'Poppins',
  weight: 'bold'
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productCode, productName, salesPrice, purchasePrice, hashingFormat, billId } = req.body;

    if (!productCode || !salesPrice || !purchasePrice) {
      return res.status(400).json({ 
        error: 'Missing required fields: productCode, salesPrice, purchasePrice' 
      });
    }

    // Apply custom hashing to prices
    const hashedSales = applyCustomHash(salesPrice);
    const hashedPurchase = applyCustomHash(purchasePrice);

    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: productCode,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
    });

    const finalImage = await addCustomTextToBarcode(
      barcodeBuffer,
      hashedSales,
      hashedPurchase,
      productName || ''
    );

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

async function addCustomTextToBarcode(barcodeBuffer, hashedSales, hashedPurchase, productName) {
  const { createCanvas, loadImage } = require('canvas');
  
  const barcodeImg = await loadImage(barcodeBuffer);
  
  // Truncate product name to 40 characters
  const truncatedName = productName.length > 40 
    ? productName.substring(0, 40) + '...' 
    : productName;
  
  // Canvas dimensions
  const headerHeight = 80;
  const productNameHeight = 40;
  const priceRowHeight = 40;
  const totalHeight = headerHeight + productNameHeight + barcodeImg.height + priceRowHeight;
  const canvas = createCanvas(barcodeImg.width, totalHeight);
  const ctx = canvas.getContext('2d');
  
  const borderRadius = 9;
  
  // Create rounded rectangle clipping path
  ctx.beginPath();
  ctx.moveTo(borderRadius, 0);
  ctx.lineTo(canvas.width - borderRadius, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, borderRadius);
  ctx.lineTo(canvas.width, canvas.height - borderRadius);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - borderRadius, canvas.height);
  ctx.lineTo(borderRadius, canvas.height);
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - borderRadius);
  ctx.lineTo(0, borderRadius);
  ctx.quadraticCurveTo(0, 0, borderRadius, 0);
  ctx.closePath();
  ctx.clip();
  
  // Fill white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // === HEADER SECTION ===
  // Draw header background (#593456)
  ctx.fillStyle = '#593456';
  ctx.fillRect(0, 0, canvas.width, headerHeight);
  
  // Split header into two columns
  const colWidth = canvas.width / 2;
  
  // LEFT COLUMN - Company Name (Poppins Bold)
  ctx.fillStyle = 'white';
  ctx.textAlign = 'left';
  
  // "AL NOON" - large text with Poppins Bold
  ctx.font = 'bold 22px Poppins';
  ctx.fillText('AL NOON', 10, 32);
  
  // "INTERNATIONAL TRADING LLC" - smaller text
  ctx.font = '10px Arial';
  ctx.fillText('INTERNATIONAL TRADING LLC', 10, 52);
  
  // RIGHT COLUMN - Contact Info
  ctx.textAlign = 'right';
  const rightX = canvas.width - 10;
  
  // "Since 1981"
  ctx.font = 'italic 12px Arial';
  ctx.fillText('Since 1981', rightX, 20);
  
  // WhatsApp number
  ctx.font = '11px Arial';
  ctx.fillText('📱 +971 56 4120 421', rightX, 42);
  
  // Website
  ctx.font = '10px Arial';
  ctx.fillText('www.toughstuffs.com', rightX, 62);
  
  // === PRODUCT NAME SECTION ===
  const productNameY = headerHeight + 25;
  ctx.fillStyle = '#333333';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(truncatedName, canvas.width / 2, productNameY);
  
  // === BARCODE SECTION ===
  // Draw barcode below product name
  const barcodeY = headerHeight + productNameHeight;
  ctx.drawImage(barcodeImg, 0, barcodeY);
  
  // === PRICE SECTION ===
  const priceY = barcodeY + barcodeImg.height;
  
  // Draw white background for price row
  ctx.fillStyle = 'white';
  ctx.fillRect(0, priceY, canvas.width, priceRowHeight);
  
  const priceTextY = priceY + 25;
  const centerX = canvas.width / 2;
  const spacing = 40; // Space from center for each price (closer together)
  
  // Hashed Sales Price (left of center) - BLACK COLOR
  ctx.fillStyle = 'black';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(hashedSales, centerX - spacing, priceTextY);
  
  // Slash in the CENTER
  ctx.textAlign = 'center';
  ctx.fillText('/', centerX, priceTextY);
  
  // Hashed Purchase Price (right of center) - BLACK COLOR
  ctx.textAlign = 'left';
  ctx.fillText(hashedPurchase, centerX + spacing, priceTextY);
  
  // === OUTER BORDER with rounded corners ===
  ctx.strokeStyle = '#593456';
  ctx.lineWidth = 6;
  
  const offset = 3;
  
  // Draw rounded rectangle border
  ctx.beginPath();
  ctx.moveTo(borderRadius + offset, offset);
  ctx.lineTo(canvas.width - borderRadius - offset, offset);
  ctx.quadraticCurveTo(canvas.width - offset, offset, canvas.width - offset, borderRadius + offset);
  ctx.lineTo(canvas.width - offset, canvas.height - borderRadius - offset);
  ctx.quadraticCurveTo(canvas.width - offset, canvas.height - offset, canvas.width - borderRadius - offset, canvas.height - offset);
  ctx.lineTo(borderRadius + offset, canvas.height - offset);
  ctx.quadraticCurveTo(offset, canvas.height - offset, offset, canvas.height - borderRadius - offset);
  ctx.lineTo(offset, borderRadius + offset);
  ctx.quadraticCurveTo(offset, offset, borderRadius + offset, offset);
  ctx.closePath();
  ctx.stroke();
  
  return canvas.toBuffer('image/png');
}

// Custom hashing function with letter substitution
function applyCustomHash(price) {
  const priceStr = price.toString();
  
  // Mapping: 1→O, 2→W, 3→H, 4→R, 5→F, 6→X, 7→S, 8→E, 9→N, 0→T, .→Z
  const hashMap = {
    '1': 'O',
    '2': 'W',
    '3': 'H',
    '4': 'R',
    '5': 'F',
    '6': 'X',
    '7': 'S',
    '8': 'E',
    '9': 'N',
    '0': 'T',
    '.': 'Z'
  };
  
  let hashedValue = '';
  
  for (let i = 0; i < priceStr.length; i++) {
    const char = priceStr[i];
    hashedValue += hashMap[char] || char;
  }
  
  return hashedValue;
}
