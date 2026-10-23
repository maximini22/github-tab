// Tiny static server for the tests: serves the repo under /github-tab/ (the same path as GitHub Pages).
// Run on its own to click around locally: node tests/serve.mjs  ->  http://127.0.0.1:<port>/github-tab/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8' };

export function startServer(port = 0) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!u.startsWith('/github-tab/')) { res.writeHead(404); return res.end('not found'); }
      let f = path.join(ROOT, u.slice('/github-tab/'.length));
      if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
        if (!u.endsWith('/')) { res.writeHead(301, { Location: u + '/' }); return res.end(); }
        f = path.join(f, 'index.html');
      }
      fs.readFile(f, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(port, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}/github-tab/` }));
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { base } = await startServer(Number(process.env.PORT || 8080));
  console.log('Serving ' + ROOT + ' at ' + base);
}
