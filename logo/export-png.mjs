import sharp from 'sharp';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgBuffer = readFileSync(join(__dirname, 'logo.svg'));

await sharp(svgBuffer)
  .resize(2000, 2000)
  .png({ compressionLevel: 9 })
  .toFile(join(__dirname, 'aquacert-logo-2000x2000.png'));

console.log('✅ aquacert-logo-2000x2000.png exported successfully');
