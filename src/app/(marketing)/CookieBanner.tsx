'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ANALYTICS_ENABLED } from '@/lib/site'
import { storedConsent, setConsent, loadTags } from '@/lib/analytics'

// Två lägen:
//  • Analytics aktivt (GA/Ads-ID satt i env) → riktigt opt-in-samtycke. Inget
//    laddas förrän användaren väljer "Godkänn". Consent Mode v2 hanteras i analytics.ts.
//  • Inget analytics → enkel informativ notis (sajten sätter då inga spårningscookies).
export default function CookieBanner() {
  const [visa, setVisa] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (ANALYTICS_ENABLED) {
      const val = storedConsent()
      if (val === 'granted') loadTags() // återkommande besökare som redan sagt ja
      if (val === null) setVisa(true) // inget val gjort → fråga
    } else {
      if (!localStorage.getItem('hab_cookie_ok')) setVisa(true)
    }
  }, [])

  if (!visa) return null

  // ── Samtyckesläge ──
  if (ANALYTICS_ENABLED) {
    return (
      <div className="hab-cookie" role="dialog" aria-label="Samtycke till cookies">
        <p>
          Vi använder cookies för besöksstatistik och annonsmätning (Google Analytics och Google Ads) – endast om du godkänner. Nödvändiga cookies används alltid.{' '}
          <Link href="/integritetspolicy">Läs mer</Link>.
        </p>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            className="hab-cookie-btn"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.35)' }}
            onClick={() => { setConsent(false); setVisa(false) }}
          >
            Endast nödvändiga
          </button>
          <button className="hab-cookie-btn" onClick={() => { setConsent(true); setVisa(false) }}>
            Godkänn
          </button>
        </div>
      </div>
    )
  }

  // ── Informativt läge (inget analytics aktivt) ──
  return (
    <div className="hab-cookie" role="dialog" aria-label="Cookie-information">
      <p>
        Vi använder inga spårningscookies. Ett litet lagringsvärde används endast för att komma ihåg detta val.{' '}
        <Link href="/integritetspolicy">Läs mer</Link>.
      </p>
      <button className="hab-cookie-btn" onClick={() => { localStorage.setItem('hab_cookie_ok', '1'); setVisa(false) }}>
        OK
      </button>
    </div>
  )
}
