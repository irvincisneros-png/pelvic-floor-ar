// QR codes for QR_URL (tools/config.mjs). Local `qrcode` package only - no online service.
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { ROOT, QR_URL } from './config.mjs';

const MARGIN = 4; // quiet zone in modules (spec minimum 4)
const outDir = path.join(ROOT, 'markers');
fs.mkdirSync(outDir, { recursive: true });
const qr = QRCode.create(QR_URL, { errorCorrectionLevel: 'M' });
const modules = qr.modules.size;

async function make(file, minPx) {
  // integer pixel-per-module scale so modules stay crisp
  const scale = Math.ceil(minPx / (modules + 2 * MARGIN));
  await QRCode.toFile(path.join(outDir, file), QR_URL, { errorCorrectionLevel: 'M', margin: MARGIN, scale, color: { dark: '#000000', light: '#ffffff' } });
  console.log(`${file}: ${modules} modules, ${(modules + 2 * MARGIN) * scale} px, EC M, quiet zone ${MARGIN}`);
}
await make('qr-slide.png', 1800);
await make('qr-sheet.png', 600);
