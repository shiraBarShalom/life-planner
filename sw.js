// Service worker: precaches the app shell for offline use and caches Google Fonts at runtime.
const VERSION = 'v1.0.0';
const SHELL = `planner-shell-${VERSION}`;
const FONTS = 'planner-fonts-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/store.js', './js/db.js', './js/seed.js', './js/engine.js', './js/date.js', './js/ui.js',
  './js/editors.js', './js/export.js', './js/quotes.js', './js/timegrid.js', './js/theme.js',
  './js/views/common.js', './js/views/dashboard.js', './js/views/month.js', './js/views/week.js', './js/views/day.js',
  './js/views/goals.js', './js/views/uni.js', './js/views/tasks.js', './js/views/settings.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('planner-shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()).catch(() => {}); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }
  // Cache-first for app files, refreshed in the background.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => {
    const net = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
