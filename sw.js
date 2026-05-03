const CACHE = 'htql-v33';
const BASE = '/duyhoangdaytaon-cantho.1.1';
const STATIC = [
  `${BASE}/index.html`,
  `${BASE}/login.html`,
  `${BASE}/admin.html`,
  `${BASE}/student.html`,
  `${BASE}/style.css`,
  `${BASE}/app.js`,
  `${BASE}/admin.js`,
  `${BASE}/student.js`,
  `${BASE}/supabase.js`,
  `${BASE}/manifest.json`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`
];

// Cài đặt: cache file tĩnh + skipWaiting để kích hoạt ngay
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Kích hoạt: xóa cache cũ + claim clients ngay lập tức
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Thông báo tất cả tab đang mở để reload
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
        });
      })
  );
});

// Fetch: ưu tiên mạng, fallback cache
self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
