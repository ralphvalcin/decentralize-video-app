// Service Worker for Decentralized Video Conference PWA
const CACHE_NAME = 'videoconf-v1';
const STATIC_CACHE = 'videoconf-static-v1';
const DYNAMIC_CACHE = 'videoconf-dynamic-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Assets to cache on first use
const RUNTIME_CACHE = [
  '/room',
  '/join'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  self.skipWaiting(); // Force activation
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  self.clients.claim(); // Take control immediately
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and WebRTC/Socket.io traffic
  if (request.method !== 'GET' || 
      url.pathname.includes('/socket.io/') ||
      url.protocol === 'ws:' || 
      url.protocol === 'wss:') {
    return;
  }
  
  // Handle different types of requests
  if (request.destination === 'document') {
    // HTML documents - Network first, cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (request.destination === 'script' || request.destination === 'style') {
    // JS/CSS - Cache first, network fallback
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Other assets - Cache first with network update
    event.respondWith(staleWhileRevalidateStrategy(request));
  }
});

// Network First Strategy (for HTML documents)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch {
    console.log('[SW] Network failed, serving from cache:', request.url);
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Offline', { 
      status: 408,
      statusText: 'Offline' 
    });
  }
}

// Cache First Strategy (for static assets)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch {
    console.log('[SW] Failed to fetch:', request.url);
    return new Response('Resource unavailable', { 
      status: 404,
      statusText: 'Not Found' 
    });
  }
}

// Stale While Revalidate Strategy (for other assets)
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Background Sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  // Handle queued actions when coming back online
  // This could include sending queued messages, etc.
  console.log('[SW] Handling background sync');
}

// Push notifications (for future implementation)
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  const options = {
    body: event.data?.text() || 'New notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'join',
        title: 'Join Meeting',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Video Conference', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  
  event.notification.close();
  
  if (event.action === 'join') {
    event.waitUntil(
      self.clients.openWindow('/join')
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.payload);
      })
    );
  }
});

// Periodic background sync (for future implementation)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'content-sync') {
    event.waitUntil(handlePeriodicSync());
  }
});

async function handlePeriodicSync() {
  // Handle periodic tasks like syncing settings
  console.log('[SW] Handling periodic sync');
}