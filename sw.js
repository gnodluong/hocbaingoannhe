/**
 * sw.js — Service worker giúp app mở được khi KHÔNG có mạng, giống bản desktop.
 *
 * Chiến lược:
 *   · install : tải sẵn toàn bộ "vỏ" app (html/css/js/font/logo) + mọi đề mẫu
 *               trong samples/ vào cache.
 *   · fetch   : trả từ cache ngay (nhanh, không cần mạng), đồng thời lấy bản
 *               mới trên mạng để cập nhật cache cho lần sau. Không có mạng
 *               thì vẫn chạy bằng bản trong cache.
 *   · activate: xoá cache của phiên bản cũ.
 */
'use strict';

const VERSION = '1.1.3-web2';
const CACHE = `tracnghiem-web-v${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'web.css',
  'styles.css',
  'desktop-theme.css',
  'theme-init.js',
  'quiz-core.js',
  'candidate.js',
  'store.js',
  'api.js',
  'desktop-web.js',
  'icons.js',
  'ui.js',
  'theme-switcher.js',
  'screens.mcq.js',
  'screens.fill.js',
  'screens.banks.js',
  'screens.hub.js',
  'screens.guide.js',
  'screens.grades.js',
  'screens.sync.js',
  'app.js',
  'logo.png',
  'manifest.webmanifest',
  'samples/manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/favicon.png',
];

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
  // Đề mẫu: đọc danh sách trong samples/manifest.json rồi cache từng tệp.
  try {
    const res = await fetch('samples/manifest.json', { cache: 'reload' });
    if (res.ok) {
      const list = await res.json();
      const files = (list || [])
        .map((item) => (typeof item === 'string' ? item : item.file))
        .filter(Boolean)
        .map((f) => `samples/${encodeURIComponent(f)}`);
      if (files.length) await cache.addAll(files.map((url) => new Request(url, { cache: 'reload' })));
    }
  } catch (err) {
    // Không cache được đề mẫu vẫn phải cài worker: phần còn lại đã có trong cache.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Trả bản trong cache ngay; bản mới (nếu có) được ghi lại cho lần sau.
        event.waitUntil(network.catch(() => null));
        return cached;
      }
      const fresh = await network;
      if (fresh) return fresh;
      if (request.mode === 'navigate') {
        const fallback = await cache.match('index.html');
        if (fallback) return fallback;
      }
      return new Response('Không có mạng và tệp này chưa được lưu để dùng offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    })()
  );
});
