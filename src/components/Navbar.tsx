'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ORDER_LINKS = [
  { href: '/ordrar', label: 'Ordrar' },
  { href: '/offerter', label: 'Offerter' },
  { href: '/kunder', label: 'Kunder' },
  { href: '/artiklar', label: 'Artiklar' },
  { href: '/kalender', label: 'Kalender' },
  { href: '/fakturering', label: 'Fakturering' },
]

const FASTIGHET_LINKS = [
  { href: '/fastigheter', label: 'Fastigheter' },
  { href: '/hyresgaster', label: 'Hyresgäster' },
  { href: '/hyresavtal', label: 'Hyresavtal' },
  { href: '/underhall', label: 'Underhåll' },
]

const S: Record<string, React.CSSProperties> = {
  nav: { background: '#141414', borderBottom: '1px solid #222', position: 'sticky', top: 0, zIndex: 100 },
  inner: { display: 'flex', alignItems: 'center', gap: 0, padding: '0 16px', height: 52, overflowX: 'auto' },
  logo: { fontWeight: 800, fontSize: 16, color: '#E8C96A', letterSpacing: 1, marginRight: 24, flexShrink: 0, textDecoration: 'none' },
  divider: { width: 1, height: 20, background: '#2a2a2a', margin: '0 12px', flexShrink: 0 },
  moduleLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginRight: 8, flexShrink: 0 },
  link: { padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: '#888', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.1s' },
  linkActive: { color: '#E8C96A', background: 'rgba(232,201,106,0.08)' },
  spacer: { flex: 1 },
  logoutBtn: { fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', flexShrink: 0 },
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav style={S.nav}>
      <div style={S.inner}>
        <Link href="/ordrar" style={S.logo}>WV</Link>

        <span style={S.moduleLabel}>ORDER</span>
        {ORDER_LINKS.map(l => (
          <Link key={l.href} href={l.href} style={{ ...S.link, ...(pathname.startsWith(l.href) ? S.linkActive : {}) }}>
            {l.label}
          </Link>
        ))}

        <div style={S.divider} />

        <span style={S.moduleLabel}>FASTIGHETER</span>
        {FASTIGHET_LINKS.map(l => (
          <Link key={l.href} href={l.href} style={{ ...S.link, ...(pathname.startsWith(l.href) ? S.linkActive : {}) }}>
            {l.label}
          </Link>
        ))}

        <div style={S.spacer} />
        <button onClick={handleLogout} style={S.logoutBtn}>Logga ut</button>
      </div>
    </nav>
  )
}
