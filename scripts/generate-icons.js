const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const outDir = path.join(__dirname, '..', 'public');

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Green rounded rect background
  const r = size * 0.234; // corner radius ~120/512
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fillStyle = '#10B981';
  ctx.fill();

  // White chart line
  const w = size / 4;
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.094;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Upward trend line
  ctx.beginPath();
  ctx.moveTo(size * 0.25, size * 0.75);
  ctx.lineTo(size * 0.4375, size * 0.5625);
  ctx.lineTo(size * 0.5625, size * 0.6875);
  ctx.lineTo(size * 0.8125, size * 0.4375);
  ctx.stroke();

  // Arrow
  ctx.beginPath();
  ctx.moveTo(size * 0.625, size * 0.4375);
  ctx.lineTo(size * 0.8125, size * 0.4375);
  ctx.lineTo(size * 0.8125, size * 0.625);
  ctx.stroke();

  const buf = canvas.toBuffer('image/png');
  const outPath = path.join(outDir, `icon-${size}x${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`Generated: ${outPath} (${buf.length} bytes)`);
}
