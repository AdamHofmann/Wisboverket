'use client'

import { useEffect } from 'react'

// Registrerar service workern (/sw.js) så appen blir installerbar (PWA).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
