// Wisboverket service worker — gör appen installerbar (PWA) + enkel offline-fallback.
// Runtime-cache, network-first: online ger alltid färsk data, offline faller vi tillbaka
// på cache. Endast SAME-ORIGIN GET cachas — externa anrop (Supabase m.fl.) går direkt
// till nätet och cachas aldrig.
const CACHE = 'wisboverket-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // låt Supabase/externa gå direkt till nätet

  // HTML-dokument (sid-navigering): ALLTID nätet, aldrig cache. Annars kan appen
  // fastna på gammal kod efter en deploy. Cache används bara som offline-fallback.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(req)))
    return
  }

  // Övrigt same-origin GET (statiska filer): network-first med cache-fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req))
  )
})
