import type { Metadata } from 'next'
import './site.css'
import CookieBanner from './CookieBanner'
import { SITE_URL, SITE_EMAIL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  title: 'Wisboverket – Fastighet & Skötsel',
  description:
    'Wisboverket är ett familjeägt fastighetsbolag i Södermanland. Vi tar hand om din fastighet löpande eller vid specifika tillfällen – gräsklippning, reparationer, rondering och mer.',
  keywords:
    'fastighetsförvaltning, fastighetsskötsel, Södermanland, Gnesta, Eskilstuna, Trosa, Strängnäs, Vagnhärad, underhåll, rondering, reparationer',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    title: 'Wisboverket – Fastighet & Skötsel i Södermanland',
    description:
      'Familjeägt fastighetsbolag i Södermanland. Vi tar hand om din fastighet löpande eller vid specifika tillfällen – med precision och omsorg.',
    locale: 'sv_SE',
  },
  twitter: {
    card: 'summary',
    title: 'Wisboverket – Fastighet & Skötsel',
    description:
      'Familjeägt fastighetsbolag i Södermanland. Löpande underhåll, rondering och reparationer.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Wisboverket',
  description: 'Familjeägt fastighetsbolag i Södermanland – löpande fastighetsskötsel, underhåll, rondering och reparationer.',
  url: SITE_URL,
  email: SITE_EMAIL,
  telephone: '+46705540924',
  areaServed: ['Gnesta', 'Eskilstuna', 'Trosa', 'Strängnäs', 'Vagnhärad', 'Södermanland'],
  address: {
    '@type': 'PostalAddress',
    addressRegion: 'Södermanland',
    addressCountry: 'SE',
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Jost:wght@300;400;500;600&display=swap"
        rel="stylesheet"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="hab">
        {children}
        <CookieBanner />
      </div>
    </>
  )
}
