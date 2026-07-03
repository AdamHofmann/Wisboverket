'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useBolag } from './BolagContext'
import { C, inp, fo, fb } from './styles'

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
  wrap: { background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' },
  link: { padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: C.muted, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 },
  linkActive: { color: C.gold, background: C.goldSoft, fontWeight: 700 },
  spacer: { flex: 1, minWidth: 12 },
}

export default function FastigheterSubnav() {
  const pathname = usePathname()
  const { bolagLista, valtBolagId, setValtBolagId } = useBolag()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')

  return (
    <div style={S.wrap}>
      {LINKS.map(l => (
        <Link
          key={l.href}
          href={l.href}
          style={{ ...S.link, ...(isActive(l.href, l.exact) ? S.linkActive : {}) }}
        >
          {l.label}
        </Link>
      ))}
      <div style={S.spacer} />
      <select
        value={valtBolagId ?? ''}
        onChange={e => setValtBolagId(e.target.value || null)}
        onFocus={fo}
        onBlur={fb}
        style={{ ...inp, width: 'auto', minWidth: 160, flexShrink: 0, fontWeight: 600 }}
        title="Filtrera på bolag"
      >
        <option value="">Alla bolag</option>
        {bolagLista.map(b => (
          <option key={b.id} value={b.id}>{b.namn}</option>
        ))}
      </select>
    </div>
  )
}
