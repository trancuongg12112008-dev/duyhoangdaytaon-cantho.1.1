const CACHE = 'htql-v2';
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

// Cài đặt: cache các file tĩnh
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Kích hoạt: xóa cache cũ
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: ưu tiên mạng, fallback cache
self.addEventListener('fetch', e => {
  // Bỏ qua request đến Supabase (luôn cần mạng thật)
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache lại response mới nhất cho file tĩnh
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
