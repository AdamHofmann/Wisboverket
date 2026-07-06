// Central plats för domän, e-post och avsändaruppgifter.
// Vid domänbytet till wisboverket.se: sätt env-variablerna nedan (eller ändra fallback här).
// Fallbacken pekar på hofmannsab.se tills bytet är klart.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://hofmannsab.se'
export const SITE_EMAIL = process.env.NEXT_PUBLIC_SITE_EMAIL || 'info@hofmannsab.se'
export const SITE_NAME = 'Wisboverket'

// Avsändaradress för systemutskick (server-side, t.ex. meddelanden/påminnelser)
export const MAIL_FROM = process.env.MAIL_FROM || 'noreply@hofmannsab.se'

// ── Google Analytics 4 + Google Ads ──
// Sätts när kontona finns. Utan värden laddas INGET (allt vilande) → säkert att deploya i förväg.
// GA4 mätnings-ID (G-XXXXXXXXXX), Google Ads konverterings-ID (AW-XXXXXXXXX).
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || ''
export const ADS_ID = process.env.NEXT_PUBLIC_ADS_ID || ''
export const ANALYTICS_ENABLED = Boolean(GA_ID || ADS_ID)
