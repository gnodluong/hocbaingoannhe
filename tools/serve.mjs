/**
 * serve.mjs — Máy chủ tĩnh siêu nhỏ để chạy thử webapp (không phụ thuộc gói nào).
 *
 *   node tools/serve.mjs            -> http://127.0.0.1:8080
 *   node tools/serve.mjs 5000       -> đổi cổng
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

export function createServer(root = ROOT) {
  return http.createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (err) {
      res.writeHead(400).end('Bad request');
      return;
    }
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    const target = path.join(root, urlPath);
    if (!target.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.stat(target, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Không tìm thấy: ' + urlPath);
        return;
      }
      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache',
        'Service-Worker-Allowed': '/',
      });
      fs.createReadStream(target).pipe(res);
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.argv[2] || 8080);
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`TracNghiem-Web đang chạy tại http://127.0.0.1:${port}`);
  });
}
