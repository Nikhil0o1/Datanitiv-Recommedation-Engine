import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = process.argv[2];
if (!htmlPath) {
  console.error('Usage: node extract-v4-logo.mjs <path-to-html>');
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/class="dn-logo" src="(data:image\/jpeg;base64,[^"]+)"/);
if (!match) {
  console.error('Logo not found in HTML');
  process.exit(1);
}

const out = path.join(__dirname, '../src/assets/v4DnLogo.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `export default ${JSON.stringify(match[1])};\n`);
console.log('Wrote', out, 'length', match[1].length);
