const CACHE_NAME = 'kakeibo-v4'
const STATIC_ASSETS = [
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Only handle GET requests - POST/PUT/DELETE cannot be cached
  if (event.request.method !== 'GET') {
    return
  }

  // Only handle http/https requests
  if (!event.request.url.startsWith('http')) {
    return
  }

  // Never cache navigation requests (HTML pages) — always fetch fresh after deploy
  if (event.request.mode === 'navigate') {
    return
  }

  // Do not cache: API calls, Next.js build artifacts, HMR
  const url = event.request.url
  if (
    url.includes('/rest/') ||
    url.includes('/auth/') ||
    url.includes('/functions/') ||
    url.includes('/_next/') ||
    url.includes('/__nextjs')
  ) {
    return
  }

  // Cache first for static assets (manifest, icons, etc.)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request, { redirect: 'follow' }).then((response) => {
        if (response.status === 200 && response.type !== 'opaqueredirect') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
