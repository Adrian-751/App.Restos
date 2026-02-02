/* Simple Service Worker (PWA)
 * - Cachea estáticos del mismo dominio (assets) para carga rápida
 * - No cachea llamadas a /api
 * - Para SPA: fallback a /index.html en navegación si no hay cache
 */

const CACHE_NAME = 'app-restos-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/',
        '/index.html',
        '/logo.svg',
        '/manifest.webmanifest',
        '/pwa-192x192.png',
        '/pwa-512x512.png'
      ])
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Solo GET
  if (req.method !== 'GET') return

  // No cachear API
  if (url.pathname.startsWith('/api/')) return

  // Navegaciones: network-first con fallback a cache (SPA)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Assets: cache-first con fallback a red
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))
        return res
      })
    })
  )
})

