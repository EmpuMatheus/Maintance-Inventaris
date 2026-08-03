// Generates installer/office-inventory.ico (a 32x32 PNG inside an ICO container).
import { deflateSync, crc32 } from 'zlib';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, '..', 'installer', 'office-inventory.ico');

const SIZE = 32;
// RGBA pixel grid: indigo background, white rounded-ish box outline.
const pixels = Buffer.alloc(SIZE * SIZE * 4);
const indigo = [99, 102, 241, 255];
const white = [255, 255, 255, 255];
const transparent = [0, 0, 0, 0];

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const i = (y * SIZE + x) * 4;
    const onOutline = x < 2 || x >= SIZE - 2 || y < 2 || y >= SIZE - 2;
    const onBorder = x >= 4 && x < SIZE - 4 && y >= 4 && y < SIZE - 4 && (x < 6 || x >= SIZE - 6 || y < 6 || y >= SIZE - 6);
    const onCenter = x >= 12 && x < 20 && y >= 12 && y < 20;
    if (onOutline) {
      pixels.set(transparent, i);
    } else if (onBorder || onCenter) {
      pixels.set(white, i);
    } else {
      pixels.set(indigo, i);
    }
  }
}

// PNG encoding.
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
  return Buffer.concat([len, typeBuf, data, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
// scanlines: filter byte 0 + row pixels
const scanlines = Buffer.alloc(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y += 1) {
  scanlines[y * (1 + SIZE * 4)] = 0;
  pixels.copy(scanlines, y * (1 + SIZE * 4) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = deflateSync(scanlines);

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

// ICO container with a single PNG entry.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = SIZE >= 256 ? 0 : SIZE;
entry[1] = SIZE >= 256 ? 0 : SIZE;
entry[2] = 0;
entry[3] = 0;
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);

writeFileSync(out, Buffer.concat([header, entry, png]));
console.log(`Wrote ${out} (${(22 + png.length).toLocaleString()} bytes)`);
