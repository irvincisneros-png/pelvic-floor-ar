// Single source of truth for generated assets. Change here, then run `npm run build:all`.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// URL encoded in every QR code (slide QR and the small QR printed on each sheet).
export const QR_URL = 'https://irvincisneros-png.github.io/pelvic-floor-ar/';

// Tracked art: 180 x 230 mm, rasterised at 8 px/mm.
export const ART_MM = { w: 180, h: 230 };
export const PX_PER_MM = 8;
export const ART_PX = { w: ART_MM.w * PX_PER_MM, h: ART_MM.h * PX_PER_MM }; // 1440 x 1840

export const SHEETS = [
  { id: 'before',    n: 1, title: 'Meet your pelvic floor' },
  { id: 'pregnancy', n: 2, title: 'Nine months of load' },
  { id: 'birth',     n: 3, title: 'Birth and after' },
  { id: 'solutions', n: 4, title: 'Train it back' },
];
