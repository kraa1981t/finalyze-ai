const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const outDir = path.join(__dirname, 'public');

// Generate minimal PNG using pure Node.js
function createPNG(width, height, r, g, b) {
  const { createDeflateRaw } = require('zlib');
  
  // Build raw pixel data (RGBA)
  const rawData = Buffer.alloc(height * (1 + width * 4)); // filter byte + RGBA per pixel
  const cornerR = Math.floor(width * 0.234);
  
  for (let y = 0; y < height; y++) {
    const filterByte = y * (1 + width * 4);
    rawData[filterByte] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const px = filterByte + 1 + x * 4;
      // Check if pixel is in rounded rect
      const inRect = x >= 0 && x < width && y >= 0 && y < height;
      if (inRect) {
        rawData[px] = r;
        rawData[px + 1] = g;
        rawData[px + 2] = b;
        rawData[px + 3] = 255;
      }
    }
  }
  
  // For simplicity, just create a solid green icon
  // The SVG will be used for actual rendering on device
  const rawFull = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawFull[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const px = y * (1 + width * 4) + 1 + x * 4;
      rawFull[px] = r;
      rawFull[px + 1] = g;
      rawFull[px + 2] = b;
      rawFull[px + 3] = 255;
    }
  }
  
  return new Promise((resolve, reject) => {
    // Use zlib to compress
    const zlib = require('zlib');
    zlib.deflate(rawFull, (err, compressed) => {
      if (err) return reject(err);
      
      // Build PNG file
      const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      
      function chunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const typeB = Buffer.from(type);
        const crcData = Buffer.concat([typeB, data]);
        
        // Simple CRC32
        let crc = 0xFFFFFFFF;
        const table = [];
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          }
          table[i] = c;
        }
        for (let i = 0; i < crcData.length; i++) {
          crc = table[(crc ^ crcData[i]) & 0xFF] ^ (crc >>> 8);
        }
        crc = (crc ^ 0xFFFFFFFF) >>> 0;
        
        const crcB = Buffer.alloc(4);
        crcB.writeUInt32BE(crc);
        return Buffer.concat([len, typeB, data, crcB]);
      }
      
      // IHDR
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(width, 0);
      ihdr.writeUInt32BE(height, 4);
      ihdr[8] = 8; // bit depth
      ihdr[9] = 6; // color type RGBA
      ihdr[10] = 0; // compression
      ihdr[11] = 0; // filter
      ihdr[12] = 0; // interlace
      
      const png = Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', compressed),
        chunk('IEND', Buffer.alloc(0))
      ]);
      
      resolve(png);
    });
  });
}

async function main() {
  // Green color from icon: #10B981
  for (const size of sizes) {
    const png = await createPNG(size, size, 0x10, 0xB9, 0x81);
    const outPath = path.join(outDir, `icon-${size}x${size}.png`);
    fs.writeFileSync(outPath, png);
    console.log(`Created: icon-${size}x${size}.png (${png.length} bytes)`);
  }
}

main().catch(console.error);
