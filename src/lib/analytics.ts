// Google Analytics 4 + Google Ads — samtyckesstyrd laddning (Consent Mode v2).
// Inget laddas förrän användaren aktivt godkänt OCH ett mätnings-ID finns i env.
import { GA_ID, ADS_ID } from '@/lib/site'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    dataLayer: any[]
    gtag: (...args: any[]) => void
  }
}

export const CONSENT_KEY = 'wb_consent' // 'granted' | 'denied'

function initGtagStub() {
  window.dataLayer = window.dataLayer || []
  // gtag måste referera arguments-objektet direkt (Googles mönster)
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments)
  }
}

// Läser lagrat samtycke.
export function storedConsent(): 'granted' | 'denied' | null {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(CONSENT_KEY)
  return v === 'granted' || v === 'denied' ? v : null
}

// Laddar Google-taggen och slår på GA4 + Ads. Körs endast vid aktivt samtycke.
export function loadTags() {
  if (typeof window === 'undefined') return
  const primaryId = GA_ID || ADS_ID
  if (!primaryId) return
  if (document.getElementById('gtag-src')) return // redan laddad

  initGtagStub()
  // Consent Mode v2: default nekad, uppdatera till beviljad (användaren har sagt ja här).
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  })

  const s = document.createElement('script')
  s.id = 'gtag-src'
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`
  document.head.appendChild(s)

  window.gtag('js', new Date())
  window.gtag('consent', 'update', {
    ad_storage: 'granted',
    analytics_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  })
  if (GA_ID) window.gtag('config', GA_ID)
  if (ADS_ID) window.gtag('config', ADS_ID)
}

// Sätter samtycke och (av)aktiverar taggarna därefter.
export function setConsent(granted: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
  if (granted) loadTags()
}

// Skickar ett konverteringsevent till GA4 (markeras som nyckelhändelse i GA4 och
// importeras till Google Ads som konvertering). No-op om taggen inte laddats.
export function trackConversion(namn: string, params: Record<string, any> = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', namn, params)
}
