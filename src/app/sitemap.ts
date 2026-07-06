import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// Publika, indexerbara sidor. Integritetspolicyn är avsiktligt noindex och listas inte.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
