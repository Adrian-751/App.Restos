/* Simple Service Worker (PWA)
 * - Cachea estáticos del mismo dominio (assets) para carga rápida
 * - No cachea llamadas a /api
 * - Para SPA: fallback a /index.html en navegación si no hay cache
 */

// IMPORTANT: Bump this when deploying changes to ensure clients drop old cached assets.
const CACHE_NAME = 'app-restos-v4'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        '/',
        '/index.html',
        '/manifest.webmanifest',
        // Iconos actuales (mismo logo que Login/Register)
        '/pwa-192x192-2.png',
        '/pwa-512x512-2.png'
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

  // 1) Nunca cachear requests cross-origin (típico: API en otro dominio)
  // 2) Nunca cachear API (aunque sea mismo origen)
  // 3) Nunca cachear JSON (evita listas viejas en producción)
  const accept = req.headers.get('accept') || ''
  const isJson = accept.includes('application/json')
  const isApi = url.pathname.startsWith('/api/') || url.pathname === '/api'
  const isCrossOrigin = url.origin !== self.location.origin

  if (isCrossOrigin || isApi || isJson) {
    // Forzar red y evitar cache HTTP (304/ETag) en APIs/listas
    event.respondWith(fetch(new Request(req, { cache: 'no-store' })))
    return
  }

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

