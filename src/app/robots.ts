import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Indexera den publika hemsidan; blockera det interna systemet + API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/login',
        '/dashboard',
        '/fakturering',
        '/fastigheter',
        '/fastighetsoversikt',
        '/installningar',
        '/kunder',
        '/leverantorer',
        '/mal',
        '/medarbetare',
        '/offerter',
        '/ordrar',
        '/statistik',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
