// Serves the production build (dist/) locally under the same path as on GitHub Pages.
// Usage: node scripts/serve.mjs [--open]      (no dependencies)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { exec } from 'node:child_process';

const DIST = resolve('dist');
const BASE = (process.env.BASE_PATH || '/lernapps/').replace(/\/?$/, '/');
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

async function fileFor(urlPath) {
  const rel = decodeURIComponent(urlPath.slice(BASE.length - 1));
  let file = normalize(join(DIST, rel));
  if (!file.startsWith(DIST)) return null;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/' || pathname === BASE.slice(0, -1)) {
    res.writeHead(302, { Location: BASE });
    return res.end();
  }
  if (!pathname.startsWith(BASE)) {
    res.writeHead(404);
    return res.end('Nicht gefunden');
  }
  const file = await fileFor(pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Nicht gefunden');
  }
  const body = await readFile(file);
  const immutable = pathname.includes('/assets/');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  res.end(body);
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}${BASE}`;
  console.log(`\n  Lernapps laufen auf ${url}\n  Beenden mit Strg+C\n`);
  if (process.argv.includes('--open')) exec(process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`);
});
