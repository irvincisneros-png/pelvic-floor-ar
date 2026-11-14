// Minimal static file server (dev/test helper). Usage: node tools/static-server.mjs [port] [rootDir]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mind': 'application/octet-stream', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json' };

export function startServer(port = 8141, root = ROOT) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404).end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 8141);
  await startServer(port, process.argv[3] ? path.resolve(process.argv[3]) : ROOT);
  console.log(`serving on http://127.0.0.1:${port}/`);
}
