'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useBolag } from './BolagContext'
import { C, inp, fo, fb } from './styles'
import { createClient } from '@/lib/supabase/client'

// Sub-flikar för fastighets-modulen. Route-namn enligt PLAN.md §1a
// (objektlistan ligger på /fastigheter/objekt för att inte krocka med modulroten).
const LINKS = [
  { href: '/fastigheter', label: 'Översikt', exact: true },
  { href: '/fastigheter/objekt', label: 'Fastigheter' },
  { href: '/fastigheter/lokaler', label: 'Lokaler' },
  { href: '/fastigheter/hyresgaster', label: 'Hyresgäster' },
  { href: '/fastigheter/hyresavtal', label: 'Hyresavtal' },
  { href: '/fastigheter/driftskostnader', label: 'Driftskostnader' },
  { href: '/fastigheter/elmatare', label: 'Elmätare' },
  { href: '/fastigheter/fakturering', label: 'Fakturering' },
  { href: '/fastigheter/ekonomi', label: 'Ekonomi' },
  { href: '/fastigheter/underhall', label: 'Underhåll' },
  { href: '/fastigheter/kommunikation', label: 'Kommunikation' },
  { href: '/fastigheter/installningar', label: 'Inställningar' },
]

const S: Record<string, React.CSSProperties> = {
  wrap: { background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 },
  left: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  mid: { display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flex: 1, minWidth: 0 },
  right: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  brand: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: C.gold, letterSpacing: 1, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' },
  divider: { width: 1, height: 20, background: C.borderSoft, flexShrink: 0 },
  link: { padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: C.muted, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
  linkActive: { color: C.gold, background: C.goldSoft, fontWeight: 700 },
  back: { padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: C.gold, background: C.goldSoft, border: `1px solid ${C.gold}44`, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, marginRight: 6 },
  logout: { fontSize: 11, color: C.muted2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', flexShrink: 0, whiteSpace: 'nowrap' },
}

export default function FastigheterSubnav() {
  const pathname = usePathname()
  const router = useRouter()
  const { bolagLista, valtBolagId, setValtBolagId } = useBolag()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={S.wrap}>
      {/* Vänster — alltid synlig */}
      <div style={S.left}>
        <Link href="/dashboard" style={S.back} title="Tillbaka till Order-appen">← Order</Link>
        <Link href="/fastigheter" style={S.brand}>🏢 FASTIGHETER</Link>
      </div>
      <div style={S.divider} />

      {/* Mitten — flikar, scrollar om det inte får plats */}
      <div style={S.mid}>
        {LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            style={{ ...S.link, ...(isActive(l.href, l.exact) ? S.linkActive : {}) }}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div style={S.divider} />

      {/* Höger — alltid synlig */}
      <div style={S.right}>
        <select
          value={valtBolagId ?? ''}
          onChange={e => setValtBolagId(e.target.value || null)}
          onFocus={fo}
          onBlur={fb}
          style={{ ...inp, width: 'auto', minWidth: 150, flexShrink: 0, fontWeight: 600 }}
          title="Filtrera på bolag"
        >
          <option value="">Alla bolag</option>
          {bolagLista.map(b => (
            <option key={b.id} value={b.id}>{b.namn}</option>
          ))}
        </select>
        <button onClick={handleLogout} style={S.logout}>Logga ut</button>
      </div>
    </div>
  )
}
