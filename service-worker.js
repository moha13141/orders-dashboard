const CACHE_NAME = 'enjoy-gifts-v1';
const urlsToCache = [
    '/orders-dashboard/',
    '/orders-dashboard/index.html',
    '/orders-dashboard/manifest.json',
    '/orders-dashboard/images/icons/icon-192x192.png',
    '/orders-dashboard/images/icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'
];

// تثبيت Service Worker وتخزين الملفات في الكاش
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// تفعيل Service Worker وحذف الكاش القديم
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// اعتراض طلبات الشبكة وإرجاع الملفات من الكاش إذا كانت متاحة
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // إرجاع الملف من الكاش إذا كان موجوداً
                if (response) {
                    return response;
                }

                // إذا لم يكن الملف في الكاش، جلبه من الشبكة
                return fetch(event.request).then(function(response) {
                    // التحقق من صحة الاستجابة
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // نسخ الاستجابة لحفظها في الكاش
                    var responseToCache = response.clone();

                    caches.open(CACHE_NAME)
                        .then(function(cache) {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});

