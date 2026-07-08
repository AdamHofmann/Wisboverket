'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useBolag } from './BolagContext'
import { C, inp, fo, fb } from './styles'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useMediaQuery'
import MobileDrawer from '@/components/MobileDrawer'

// Sub-navigering för fastighets-modulen. Grupperad för att hålla nere antalet
// toppnivå-flikar — relaterade sidor ligger under dropdowns.
type NavLink = { href: string; label: string; exact?: boolean }
type NavGroup = { label: string; items: NavLink[] }
type NavEntry = NavLink | NavGroup
const isGroup = (e: NavEntry): e is NavGroup => 'items' in e

const NAV: NavEntry[] = [
  { href: '/fastigheter', label: 'Översikt', exact: true },
  { label: 'Objekt', items: [
    { href: '/fastigheter/objekt', label: 'Fastigheter' },
    { href: '/fastigheter/lokaler', label: 'Lokaler' },
  ] },
  { label: 'Uthyrning', items: [
    { href: '/fastigheter/hyresgaster', label: 'Hyresgäster' },
    { href: '/fastigheter/hyresavtal', label: 'Hyresavtal' },
  ] },
  { label: 'Ekonomi', items: [
    { href: '/fastigheter/fakturering', label: 'Fakturering' },
    { href: '/fastigheter/artiklar', label: 'Artikelregister' },
    { href: '/fastigheter/driftskostnader', label: 'Driftskostnader' },
    { href: '/fastigheter/elmatare', label: 'Elförbrukning' },
    { href: '/fastigheter/ekonomi', label: 'Ekonomi' },
  ] },
  { label: 'Förvaltning', items: [
    { href: '/fastigheter/underhall', label: 'Underhåll' },
    { href: '/fastigheter/kommunikation', label: 'Kommunikation' },
  ] },
  { href: '/fastigheter/installningar', label: 'Inställningar' },
]

const S: Record<string, React.CSSProperties> = {
  wrap: { background: C.panel2, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 },
  left: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 },
  mid: { display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', flex: 1, minWidth: 0 },
  right: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  brand: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: C.gold, letterSpacing: 1, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' },
  divider: { width: 1, height: 20, background: C.borderSoft, flexShrink: 0 },
  link: { padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: C.muted, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer' },
  linkActive: { color: C.gold, background: C.goldSoft, fontWeight: 700 },
  groupWrap: { position: 'relative', flexShrink: 0 },
  menu: { position: 'fixed', background: C.panel, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: 6, minWidth: 180, zIndex: 1000, boxShadow: '0 12px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 2 },
  menuItem: { padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: C.muted, textDecoration: 'none', whiteSpace: 'nowrap', display: 'block' },
  back: { padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, color: C.gold, background: C.goldSoft, border: `1px solid ${C.gold}44`, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, marginRight: 6 },
  logout: { fontSize: 11, color: C.muted2, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', flexShrink: 0, whiteSpace: 'nowrap' },
  hamburger: { minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: `1px solid ${C.borderSoft}`, borderRadius: 8, color: C.text, fontSize: 20, cursor: 'pointer', flexShrink: 0, lineHeight: 1 },
  drawerSection: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 },
  drawerGroupLabel: { fontSize: 11, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1, padding: '8px 12px 4px' },
  drawerLink: { display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 12px', borderRadius: 8, fontSize: 14, fontWeight: 500, color: C.muted, textDecoration: 'none' },
  drawerSelect: { ...inp, width: '100%', fontWeight: 600, marginBottom: 12 },
  drawerLogout: { display: 'flex', alignItems: 'center', minHeight: 44, width: '100%', padding: '0 12px', borderRadius: 8, fontSize: 14, fontWeight: 600, color: C.muted2, background: 'none', border: `1px solid ${C.borderSoft}`, cursor: 'pointer', marginTop: 4 },
}

export default function FastigheterSubnav() {
  const pathname = usePathname()
  const router = useRouter()
  const { bolagLista, valtBolagId, setValtBolagId } = useBolag()
  const isMobile = useIsMobile()
  const [openGrupp, setOpenGrupp] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  const gruppAktiv = (g: NavGroup) => g.items.some(i => isActive(i.href, i.exact))

  // Stäng dropdown/drawer vid navigering och vid klick utanför
  useEffect(() => { setOpenGrupp(null); setDrawerOpen(false) }, [pathname])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenGrupp(null) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = async () => {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (isMobile) {
    return (
      <>
        <div style={S.wrap}>
          <Link href="/dashboard" style={S.back} title="Tillbaka till Order-appen">←</Link>
          <Link href="/fastigheter" style={{ ...S.brand, flexShrink: 0 }} title="Fastigheter">🏢</Link>
          {/* Bolagsväljare — synlig direkt i toppraden (inte gömd i menyn) */}
          <select
            value={valtBolagId ?? ''}
            onChange={e => setValtBolagId(e.target.value || null)}
            onFocus={fo}
            onBlur={fb}
            style={{ ...inp, flex: 1, minWidth: 0, fontWeight: 600, fontSize: 12, padding: '7px 8px' }}
            title="Filtrera på bolag"
          >
            <option value="">Alla bolag</option>
            {bolagLista.map(b => <option key={b.id} value={b.id}>{b.namn}</option>)}
          </select>
          <button style={S.hamburger} onClick={() => setDrawerOpen(true)} aria-label="Öppna meny">≡</button>
        </div>

        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={<span style={{ ...S.brand, fontSize: 13 }}>🏢 FASTIGHETER</span>}>
          {/* Länkar — grupper som sektioner, alla min 44px tap-yta */}
          {NAV.map(e => {
            if (!isGroup(e)) {
              return (
                <div key={e.href} style={S.drawerSection}>
                  <Link
                    href={e.href}
                    style={{ ...S.drawerLink, ...(isActive(e.href, e.exact) ? S.linkActive : {}) }}
                    onClick={() => setDrawerOpen(false)}
                  >
                    {e.label}
                  </Link>
                </div>
              )
            }
            return (
              <div key={e.label} style={S.drawerSection}>
                <div style={S.drawerGroupLabel}>{e.label}</div>
                {e.items.map(i => (
                  <Link
                    key={i.href}
                    href={i.href}
                    style={{ ...S.drawerLink, ...(isActive(i.href, i.exact) ? S.linkActive : {}) }}
                    onClick={() => setDrawerOpen(false)}
                  >
                    {i.label}
                  </Link>
                ))}
              </div>
            )
          })}

          <button onClick={handleLogout} style={S.drawerLogout}>Logga ut</button>
        </MobileDrawer>
      </>
    )
  }

  return (
    <div ref={wrapRef} style={S.wrap}>
      {/* Vänster — alltid synlig */}
      <div style={S.left}>
        <Link href="/dashboard" style={S.back} title="Tillbaka till Order-appen">← Order</Link>
        <Link href="/fastigheter" style={S.brand}>🏢 FASTIGHETER</Link>
      </div>
      <div style={S.divider} />

      {/* Mitten — flikar och grupper, scrollar om det inte får plats */}
      <div style={S.mid}>
        {NAV.map(e => {
          if (!isGroup(e)) {
            return (
              <Link key={e.href} href={e.href} style={{ ...S.link, ...(isActive(e.href, e.exact) ? S.linkActive : {}) }}>
                {e.label}
              </Link>
            )
          }
          const aktiv = gruppAktiv(e)
          const open = openGrupp === e.label
          return (
            <div key={e.label} style={S.groupWrap}>
              <button
                onClick={ev => {
                  if (open) { setOpenGrupp(null); return }
                  const r = ev.currentTarget.getBoundingClientRect()
                  setMenuPos({ left: r.left, top: r.bottom + 6 })
                  setOpenGrupp(e.label)
                }}
                style={{ ...S.link, ...(aktiv || open ? S.linkActive : {}), display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {e.label}
                <span style={{ fontSize: 9, opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.1s' }}>▼</span>
              </button>
              {open && (
                <div style={{ ...S.menu, left: menuPos.left, top: menuPos.top }}>
                  {e.items.map(i => (
                    <Link
                      key={i.href}
                      href={i.href}
                      style={{ ...S.menuItem, ...(isActive(i.href, i.exact) ? S.linkActive : {}) }}
                      onMouseEnter={ev => { if (!isActive(i.href, i.exact)) ev.currentTarget.style.background = C.field }}
                      onMouseLeave={ev => { if (!isActive(i.href, i.exact)) ev.currentTarget.style.background = 'none' }}
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
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
