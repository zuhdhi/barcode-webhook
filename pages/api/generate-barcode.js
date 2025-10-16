import bwipjs from 'bwip-js';
import { registerFont } from 'canvas';
import path from 'path';

// Register font ONCE at the top
registerFont(path.join(process.cwd(), './public/fonts/Arial.ttf'), { 
  family: 'Arial' 
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
    const { productCode, salesPrice, purchasePrice, hashingFormat, billId } = req.body;

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
      hashedPurchase
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

async function addCustomTextToBarcode(barcodeBuffer, hashedSales, hashedPurchase) {
  const { createCanvas, loadImage } = require('canvas');
  
  const barcodeImg = await loadImage(barcodeBuffer);
  const canvas = createCanvas(barcodeImg.width, barcodeImg.height + 70);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(barcodeImg, 0, 0);
  
  ctx.font = 'bold 14px Arial';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  
  const centerX = canvas.width / 2;
  const textStartY = barcodeImg.height + 25;
  
  ctx.fillText(`Sales: ${hashedSales}`, centerX, textStartY);
  ctx.fillText(`Purchase: ${hashedPurchase}`, centerX, textStartY + 25);
  
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
    hashedValue += hashMap[char] || char; // Use mapping or keep original char if not in map
  }
  
  return hashedValue;
}
