// node tools/montage.mjs out.png a.png b.png ...   (crops the model area, 3-4 per row)
import sharp from 'sharp';
const [out, ...files] = process.argv.slice(2);
const W = 390, H = 520, cols = Math.min(files.length, 4);
const tiles = await Promise.all(files.map((f) => sharp(f).extract({ left: 0, top: 150, width: 780, height: 1040 }).resize(W, H).toBuffer()));
const rows = Math.ceil(files.length / cols);
await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#000' } })
  .composite(tiles.map((b, i) => ({ input: b, left: (i % cols) * W, top: Math.floor(i / cols) * H }))).png().toFile(out);
