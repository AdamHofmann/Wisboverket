'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ORDER_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/offerter', label: 'Offert' },
  { href: '/ordrar', label: 'Order' },
  { href: '/fastighetsoversikt', label: 'Fastigheter' },
  { href: '/kunder', label: 'Kunder' },
  { href: '/leverantorer', label: 'Leverantör' },
  { href: '/medarbetare', label: 'Kalender' },
  { href: '/statistik', label: 'Statistik' },
  { href: '/fakturering', label: 'Fakturor' },
  { href: '/mal', label: 'Mål' },
  { href: '/installningar', label: 'Admin' },
]

const S: Record<string, React.CSSProperties> = {
  nav: { background: '#141414', borderBottom: '1px solid #222', position: 'sticky', top: 0, zIndex: 100 },
  inner: { display: 'flex', alignItems: 'center', gap: 0, padding: '0 16px', height: 56, overflowX: 'auto' },
  logoWrap: { display: 'flex', alignItems: 'center', gap: 10, marginRight: 20, flexShrink: 0, textDecoration: 'none' },
  logoText: { display: 'flex', flexDirection: 'column' as const, lineHeight: 1.1 },
  logoName: { fontWeight: 800, fontSize: 13, color: '#E8C96A', letterSpacing: 2 },
  logoSub: { fontSize: 8, color: '#666', letterSpacing: 1.5, fontWeight: 600 },
  divider: { width: 1, height: 20, background: '#2a2a2a', margin: '0 10px', flexShrink: 0 },
  link: { padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: '#888', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.1s' },
  linkActive: { color: '#E8C96A', background: 'rgba(232,201,106,0.08)' },
  spacer: { flex: 1 },
  logoutBtn: { fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', flexShrink: 0 },
}

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [inkorgCount, setInkorgCount] = useState(0)

  useEffect(() => {
    const fetchCount = () => {
      Promise.all([
        supabase.from('forfragningar').select('id', { count: 'exact', head: true }).eq('status', 'ny'),
        supabase.from('felanmalningar').select('id', { count: 'exact', head: true }).eq('status', 'ny'),
      ]).then(([f, fe]) => setInkorgCount((f.count || 0) + (fe.count || 0)))
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  // Inne i den nya fastighet-appen (INTE order-appens /fastighetsoversikt)
  const inFastighetApp = pathname === '/fastigheter' || pathname.startsWith('/fastigheter/')

  // I fastighet-appen ersätts HELA order-baren av fastighet-modulens egen rad (Subnav)
  if (inFastighetApp) return null

  return (
    <nav style={S.nav}>
      <div style={S.inner}>
        <Link href="/dashboard" style={S.logoWrap}>
          <Image src="/logo.png" alt="Wisboverket" width={36} height={36} style={{ borderRadius: '50%' }} />
          <div style={S.logoText}>
            <span style={S.logoName}>WISBOVERKET</span>
            <span style={S.logoSub}>FASTIGHETER & FÖRVALTNING</span>
          </div>
        </Link>

        {ORDER_LINKS.map(l => (
          <Link key={l.href} href={l.href} style={{ ...S.link, ...(isActive(l.href) ? S.linkActive : {}), display: 'flex', alignItems: 'center', gap: 6 }}>
            {l.label}
            {l.href === '/installningar' && inkorgCount > 0 && (
              <span style={{ background: '#E8C96A', color: '#000', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 6px', lineHeight: 1.4 }}>{inkorgCount}</span>
            )}
          </Link>
        ))}

        <div style={S.spacer} />
        <Link
          href="/fastigheter"
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            background: 'transparent', color: '#E8C96A',
            border: '1px solid #E8C96A', textDecoration: 'none', marginRight: 12,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          🏢 Fastigheter
        </Link>
        <button onClick={handleLogout} style={S.logoutBtn}>Logga ut</button>
      </div>
    </nav>
  )
}
