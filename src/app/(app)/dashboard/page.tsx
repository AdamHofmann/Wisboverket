'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order } from '@/types'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/useMediaQuery'

// Bara de fält dashboarden faktiskt hämtar + renderar (matchar select nedan).
type DashOrder = Pick<Order, 'id' | 'status' | 'bokad_datum' | 'fakturerat' | 'faktureras_inte' | 'tilldelad' | 'titel' | 'fastighet' | 'pris' | 'created_at'>
// Order-fakturorna ligger i tabellen fakturor.
type DashFaktura = { id: string; fakturanummer: string; totalt: number; created_at: string; status: string; typ: string; forfallodatum: string | null; order_id: string | null }

const S: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  card: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '20px 22px', position: 'relative', overflow: 'hidden' },
  cardLabel: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#666', marginBottom: 8, textTransform: 'uppercase' },
  cardValue: { fontSize: 32, fontWeight: 800, color: '#e0e0e0', lineHeight: 1 },
  cardSub: { fontSize: 12, color: '#555', marginTop: 6 },
  cardAccent: { position: 'absolute', top: 0, right: 0, width: 80, height: 80, borderRadius: '0 12px 0 80px', opacity: 0.15 },
  kbRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  kbCol: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' },
  kbHeader: { padding: '12px 16px', borderBottom: '1px solid #1e1e1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  kbTitle: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#888' },
  kbBadge: { fontSize: 11, fontWeight: 700, background: '#2a2a2a', color: '#888', borderRadius: 10, padding: '2px 8px' },
  kbItem: { padding: '12px 16px', borderBottom: '1px solid #1a1a1a', cursor: 'pointer', transition: 'background 0.1s' },
  kbItemTitle: { fontSize: 13, fontWeight: 600, color: '#d0d0d0', marginBottom: 2 },
  kbItemSub: { fontSize: 11, color: '#555' },
  kbItemAmount: { fontSize: 12, fontWeight: 700, color: '#E8C96A', marginTop: 4 },
  kbEmpty: { padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#444' },
}

const fmt = (n: number) => Math.round(n).toLocaleString('sv-SE') + ' kr'
const fmtDate = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

export default function DashboardPage() {
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState<DashOrder[]>([])
  const [fakturor, setFakturor] = useState<DashFaktura[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      // Bara de fält dashboarden renderar — undvik select('*') som drar hela raden.
      supabase.from('orders')
        .select('id, status, bokad_datum, fakturerat, faktureras_inte, tilldelad, titel, fastighet, pris, created_at')
        .order('created_at', { ascending: false }),
      supabase.from('fakturor')
        .select('id, fakturanummer, totalt, created_at, status, typ, forfallodatum, order_id')
        .order('created_at', { ascending: false }),
    ]).then(([{ data: o }, { data: i }]) => {
      setOrders((o || []) as DashOrder[])
      setFakturor((i || []) as DashFaktura[])
      setLoading(false)
    })
  }, [])

  const aktiva = orders.filter(o => o.status === 'ny' || o.status === 'pågående')
  const ejPlanerade = orders.filter(o => (o.status === 'ny' || o.status === 'pågående') && !o.bokad_datum)
  // Planerade jobb (har datum) men saknar tilldelad resurs
  const ejTilldelad = orders.filter(o => (o.status === 'ny' || o.status === 'pågående') && o.bokad_datum && (!o.tilldelad || o.tilldelad.length === 0))
  const attFakturera = orders.filter(o => o.status === 'klar' && !o.fakturerat && !o.faktureras_inte)
  const idag = new Date().toISOString().split('T')[0]
  // Bara riktiga fakturor (ej kreditnotor) räknas som "fakturerat".
  const fakturerade = fakturor.filter(i => i.typ === 'faktura')
  const faktureratIdag = fakturerade.filter(i => i.created_at?.startsWith(idag)).reduce((s, i) => s + (i.totalt || 0), 0)
  const manad = new Date().toLocaleString('sv-SE', { month: 'short' }).toUpperCase()
  const faktureratManad = fakturerade
    .filter(i => i.created_at?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, i) => s + (i.totalt || 0), 0)

  // Förfallna: skickade fakturor vars förfallodatum passerat (ej betalda/krediterade).
  const forfallna = fakturerade.filter(i => i.status === 'skickad' && i.forfallodatum && i.forfallodatum < idag)
  const forfallnaBelopp = forfallna.reduce((s, i) => s + (i.totalt || 0), 0)

  const senastFakturerade = fakturerade.slice(0, 5)

  const statCards = [
    { label: 'Öppna ordrar', value: aktiva.length, sub: `${ejPlanerade.length} nya`, color: '#60a5fa', href: '/ordrar?status=aktiva' },
    { label: 'Ej planerade', value: ejPlanerade.length, sub: 'saknar datum', color: '#f59e0b', href: '/ordrar?status=aktiva' },
    { label: 'Ej tilldelad', value: ejTilldelad.length, sub: 'planerat, saknar resurs', color: '#f87171', href: '/ordrar?status=aktiva' },
    { label: 'Att fakturera', value: attFakturera.length, sub: 'slutförda', color: '#e0e0e0', href: '/ordrar?status=klar' },
    { label: 'Förfallna', value: forfallna.length, sub: forfallna.length ? fmt(forfallnaBelopp) + ' obetalt' : 'inga', color: forfallna.length ? '#f87171' : '#4ade80', href: '/fakturor' },
    { label: 'Fakturerat idag', value: fmt(faktureratIdag), sub: 'ink. moms', color: '#4ade80', wide: true, href: '/fakturor' },
    { label: manad, value: fmt(faktureratManad), sub: 'fakturerat', color: '#E8C96A', wide: true, href: '/fakturor' },
  ]

  if (loading) return <div style={{ color: '#555', padding: 40, textAlign: 'center' }}>Laddar...</div>

  return (
    <div style={isMobile ? { overflowX: 'hidden' } : undefined}>
      <div style={isMobile ? { ...S.grid, gridTemplateColumns: '1fr' } : S.grid}>
        {statCards.map(c => (
          <Link key={c.label} href={(c as any).href} style={{ ...S.card, gridColumn: (c as any).wide ? 'span 1' : undefined, textDecoration: 'none', display: 'block', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a2a')}>
            <div style={{ ...S.cardAccent, background: c.color }} />
            <div style={S.cardLabel}>{c.label}</div>
            <div style={{ ...S.cardValue, color: c.color, ...(isMobile ? { fontSize: 26, wordBreak: 'break-word' } : {}) }}>{c.value}</div>
            <div style={S.cardSub}>{c.sub}</div>
          </Link>
        ))}
      </div>

      <div style={isMobile ? { ...S.kbRow, gridTemplateColumns: '1fr' } : S.kbRow}>
        {/* Ej planerade */}
        <div style={S.kbCol}>
          <div style={S.kbHeader}>
            <span style={{ ...S.kbTitle, color: '#f59e0b' }}>⚠ EJ PLANERADE</span>
            <span style={S.kbBadge}>{ejPlanerade.length}</span>
          </div>
          {ejPlanerade.length === 0
            ? <div style={S.kbEmpty}>Alla planerade ✓</div>
            : ejPlanerade.slice(0, 6).map(o => (
              <Link href={`/ordrar?order=${o.id}`} key={o.id} style={{ ...S.kbItem, display: 'block', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={S.kbItemTitle}>{o.titel}</div>
                <div style={S.kbItemSub}>{o.fastighet || '—'}</div>
              </Link>
            ))}
        </div>

        {/* Ej tilldelad — planerat men saknar resurs */}
        <div style={S.kbCol}>
          <div style={S.kbHeader}>
            <span style={{ ...S.kbTitle, color: '#f87171' }}>👤 EJ TILLDELAD</span>
            <span style={S.kbBadge}>{ejTilldelad.length}</span>
          </div>
          {ejTilldelad.length === 0
            ? <div style={S.kbEmpty}>Alla planerade jobb har resurs ✓</div>
            : ejTilldelad.slice(0, 6).map(o => (
              <Link href={`/ordrar?order=${o.id}`} key={o.id} style={{ ...S.kbItem, display: 'block', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={S.kbItemTitle}>{o.titel}</div>
                <div style={S.kbItemSub}>{o.bokad_datum ? fmtDate(o.bokad_datum) : '—'}{o.fastighet ? ` · ${o.fastighet}` : ''}</div>
              </Link>
            ))}
        </div>

        {/* Klara att fakturera */}
        <div style={S.kbCol}>
          <div style={S.kbHeader}>
            <span style={{ ...S.kbTitle, color: '#4ade80' }}>✅ KLARA ATT FAKTURERA</span>
            <span style={S.kbBadge}>{attFakturera.length}</span>
          </div>
          {attFakturera.length === 0
            ? <div style={S.kbEmpty}>Inga att fakturera</div>
            : attFakturera.slice(0, 6).map(o => (
              <Link href={`/ordrar?order=${o.id}`} key={o.id} style={{ ...S.kbItem, display: 'block', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={S.kbItemTitle}>{o.titel}</div>
                <div style={S.kbItemSub}>{o.fastighet || '—'}</div>
                {o.pris && <div style={S.kbItemAmount}>{fmt(o.pris)}</div>}
              </Link>
            ))}
        </div>

        {/* Senast fakturerade */}
        <div style={S.kbCol}>
          <div style={S.kbHeader}>
            <span style={{ ...S.kbTitle, color: '#E8C96A' }}>✓ SENAST FAKTURERADE</span>
            <span style={S.kbBadge}>{senastFakturerade.length}</span>
          </div>
          {senastFakturerade.length === 0
            ? <div style={S.kbEmpty}>Inga fakturor ännu</div>
            : senastFakturerade.map(i => {
              const inner = (
                <>
                  <div style={S.kbItemTitle}>{i.fakturanummer || 'Faktura'}</div>
                  <div style={S.kbItemSub}>{fmtDate(i.created_at)}</div>
                  <div style={S.kbItemAmount}>{fmt(i.totalt)}</div>
                </>
              )
              return i.order_id ? (
                <Link href={`/ordrar?order=${i.order_id}`} key={i.id} style={{ ...S.kbItem, display: 'block', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {inner}
                </Link>
              ) : (
                <div key={i.id} style={S.kbItem}>{inner}</div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
