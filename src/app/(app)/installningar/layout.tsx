'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/installningar/inkorg', label: 'Inkorg' },
  { href: '/installningar/uthyrning', label: 'Uthyrning' },
  { href: '/installningar/artiklar', label: 'Artiklar' },
  { href: '/installningar/anvandare', label: 'Användare' },
  { href: '/installningar/integration', label: 'Integration' },
  { href: '/installningar/kontoplan', label: 'Kontoplan' },
  { href: '/installningar/moms', label: 'Moms' },
]

export default function InstallningarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A', marginBottom: 16 }}>Admin</div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1e1e1e', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = isActive(t.href)
          return (
            <Link key={t.href} href={t.href}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
                color: active ? '#E8C96A' : '#888',
                borderBottom: `2px solid ${active ? '#E8C96A' : 'transparent'}`,
                marginBottom: -1,
              }}>
              {t.label}
            </Link>
          )
        })}
      </div>
      {children}
    </div>
  )
}
