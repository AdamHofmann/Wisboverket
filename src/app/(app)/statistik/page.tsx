'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useMediaQuery'

type FakturaRadItem = { desc?: string | null; belopp?: number | null; typ?: string | null }
type FakturaRad = { order_id: string | null; customer_id: string | null; kund_namn: string | null; totalt: number; fakturadatum: string; typ: string; rader?: FakturaRadItem[] | null }
type OrderRad = { id: string; kategori: string | null; fastighet: string | null; created_at: string; status: string }
type InkopRad = { order_id: string; belopp: number }

const fmtKr = (n: number) => Math.round(n).toLocaleString('sv-SE') + ' kr'
const G = '#E8C96A'

type PeriodKey = 'manad' | 'forr_manad' | 'ar' | 'allt' | 'custom'
type Range = { start: string; end: string } // YYYY-MM-DD, end inklusive

const pad = (n: number) => String(n).padStart(2, '0')
const sistaDagen = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate() // m0 = 0-baserad månad
const shiftAr = (d: string, delta: number) => `${Number(d.slice(0, 4)) + delta}${d.slice(4)}`
const shiftRange = (r: Range, delta: number): Range => ({ start: shiftAr(r.start, delta), end: shiftAr(r.end, delta) })
const iRange = (d: string, r: Range | null) => !r || (d >= r.start && d <= r.end)

export default function StatistikPage() {
  return (
    <div style={{ overflowX: 'hidden' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: G, marginBottom: 20 }}>Statistik</div>
      <EkonomiTab />
    </div>
  )
}

function EkonomiTab() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [fakturor, setFakturor] = useState<FakturaRad[]>([])
  const [orders, setOrders] = useState<OrderRad[]>([])
  const [inkop, setInkop] = useState<InkopRad[]>([])
  const [period, setPeriod] = useState<PeriodKey>('ar')
  const [franDatum, setFranDatum] = useState('')
  const [tillDatum, setTillDatum] = useState('')

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('fakturor').select('order_id,customer_id,kund_namn,totalt,fakturadatum,typ,rader'),
      sb.from('orders').select('id,kategori,fastighet,created_at,status'),
      sb.from('order_inkop').select('order_id,belopp'),
    ]).then(([f, o, i]) => {
      setFakturor(f.data || []); setOrders(o.data || []); setInkop(i.data || [])
      setLoading(false)
    })
  }, [])

  // Aktuellt datumintervall (null = obegränsat/Allt).
  const range = useMemo<Range | null>(() => {
    const now = new Date()
    const y = now.getFullYear(), m0 = now.getMonth()
    if (period === 'manad') return { start: `${y}-${pad(m0 + 1)}-01`, end: `${y}-${pad(m0 + 1)}-${pad(sistaDagen(y, m0))}` }
    if (period === 'forr_manad') { const d = new Date(y, m0 - 1, 1); const yy = d.getFullYear(), mm = d.getMonth(); return { start: `${yy}-${pad(mm + 1)}-01`, end: `${yy}-${pad(mm + 1)}-${pad(sistaDagen(yy, mm))}` } }
    if (period === 'ar') return { start: `${y}-01-01`, end: `${y}-12-31` }
    if (period === 'custom') return (franDatum && tillDatum) ? { start: franDatum, end: tillDatum } : null
    return null // allt
  }, [period, franDatum, tillDatum])

  // Samma period föregående år (för jämförelse) — bara när intervall är satt.
  const forraArRange = useMemo<Range | null>(() => range ? shiftRange(range, -1) : null, [range])

  const fakturerade = useMemo(() => fakturor.filter(f => f.typ === 'faktura' && iRange(f.fakturadatum, range)), [fakturor, range])
  const totalIntakt = fakturerade.reduce((s, f) => s + f.totalt, 0)

  // Jämförelse: intäkt samma period ifjol.
  const forraArIntakt = useMemo(() => forraArRange ? fakturor.filter(f => f.typ === 'faktura' && iRange(f.fakturadatum, forraArRange)).reduce((s, f) => s + f.totalt, 0) : null, [fakturor, forraArRange])
  const intaktYoY = (forraArIntakt !== null && forraArIntakt > 0) ? Math.round(((totalIntakt - forraArIntakt) / forraArIntakt) * 100) : null

  const orderIdsIPeriod = useMemo(() => new Set(fakturerade.map(f => f.order_id).filter(Boolean)), [fakturerade])
  const totalKostnad = useMemo(() => inkop.filter(i => orderIdsIPeriod.has(i.order_id)).reduce((s, i) => s + i.belopp, 0), [inkop, orderIdsIPeriod])

  const bruttovinst = totalIntakt - totalKostnad
  const marginal = totalIntakt > 0 ? Math.round((bruttovinst / totalIntakt) * 100) : null

  const orderById = useMemo(() => Object.fromEntries(orders.map(o => [o.id, o])), [orders])
  const kostnadPerOrder = useMemo(() => {
    const m: Record<string, number> = {}
    inkop.forEach(i => { m[i.order_id] = (m[i.order_id] || 0) + i.belopp })
    return m
  }, [inkop])

  const perKund = useMemo(() => grupp(fakturerade, f => f.kund_namn || 'Okänd', kostnadPerOrder), [fakturerade, kostnadPerOrder])
  const perKategori = useMemo(() => grupp(fakturerade, f => (f.order_id && orderById[f.order_id]?.kategori) || 'Övrigt', kostnadPerOrder), [fakturerade, orderById, kostnadPerOrder])
  const perFastighet = useMemo(() => grupp(fakturerade, f => (f.order_id && orderById[f.order_id]?.fastighet) || '(ingen fastighet)', kostnadPerOrder), [fakturerade, orderById, kostnadPerOrder])
  // Per artikel = utdebiterade rader (fakturaradernas desc), grupperade.
  const perArtikel = useMemo(() => {
    const m: Record<string, { name: string; intakt: number; kostnad: number; antal: number }> = {}
    fakturerade.forEach(f => (f.rader || []).forEach(r => {
      const namn = (r.desc || '').trim() || 'Övrigt'
      const belopp = Number(r.belopp) || 0
      if (!m[namn]) m[namn] = { name: namn, intakt: 0, kostnad: 0, antal: 0 }
      m[namn].intakt += belopp
      m[namn].antal++
    }))
    return Object.values(m).sort((a, b) => b.intakt - a.intakt)
  }, [fakturerade])

  const chip = (active: boolean) => ({
    padding: isMobile ? '8px 14px' : '5px 12px', borderRadius: 20, fontSize: isMobile ? 12 : 11, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    border: `1px solid ${active ? G : '#2a2a2a'}`,
    background: active ? 'rgba(232,201,106,0.1)' : '#1a1a1a',
    color: active ? G : '#888',
  })
  const dateInput = {
    padding: isMobile ? '7px 10px' : '5px 10px', borderRadius: 8, fontSize: isMobile ? 12 : 11,
    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#d0d0d0', colorScheme: 'dark' as const,
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[{ k: 'manad', l: 'Denna månad' }, { k: 'forr_manad', l: 'Föregående månad' }, { k: 'ar', l: 'Detta år' }, { k: 'allt', l: 'Allt' }, { k: 'custom', l: 'Eget datum' }].map(p => (
          <div key={p.k} style={chip(period === p.k)} onClick={() => setPeriod(p.k as PeriodKey)}>{p.l}</div>
        ))}
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#888' }}>Från</span>
          <input type="date" value={franDatum} max={tillDatum || undefined} onChange={e => setFranDatum(e.target.value)} style={dateInput} />
          <span style={{ fontSize: 11, color: '#888' }}>Till</span>
          <input type="date" value={tillDatum} min={franDatum || undefined} onChange={e => setTillDatum(e.target.value)} style={dateInput} />
          {!(franDatum && tillDatum) && <span style={{ fontSize: 11, color: '#fb923c' }}>Välj både från och till</span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KPI icon="💰" label="Fakturerat" value={fmtKr(totalIntakt)} color={G} isMobile={isMobile}
          sub={forraArIntakt === null ? undefined : forraArIntakt === 0 ? 'ingen data ifjol' : `${fmtKr(forraArIntakt)} ifjol${intaktYoY === null ? '' : ` · ${intaktYoY >= 0 ? '▲' : '▼'} ${Math.abs(intaktYoY)}%`}`}
          subColor={intaktYoY === null ? '#555' : intaktYoY >= 0 ? '#4ade80' : '#f87171'} />
        <KPI icon="🧾" label="Kostnader" value={fmtKr(totalKostnad)} color="#f87171" isMobile={isMobile} />
        <KPI icon="📈" label="Bruttovinst" value={fmtKr(bruttovinst)} color={bruttovinst >= 0 ? '#4ade80' : '#f87171'} isMobile={isMobile} />
        <KPI icon="📊" label="Marginal" value={marginal === null ? '—' : marginal + '%'} color={marginal !== null && marginal >= 20 ? '#4ade80' : '#fb923c'} isMobile={isMobile} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
        <BreakdownTable title="Per kund" rows={perKund} />
        <BreakdownTable title="Per artikel" rows={perArtikel} unit="rader" />
        <BreakdownTable title="Per kategori" rows={perKategori} />
        <BreakdownTable title="Per fastighet" rows={perFastighet} />
      </div>
    </div>
  )
}

function grupp(fakturor: FakturaRad[], keyFn: (f: FakturaRad) => string, kostnadPerOrder: Record<string, number>) {
  const m: Record<string, { name: string; intakt: number; kostnad: number; antal: number }> = {}
  fakturor.forEach(f => {
    const key = keyFn(f)
    if (!m[key]) m[key] = { name: key, intakt: 0, kostnad: 0, antal: 0 }
    m[key].intakt += f.totalt
    m[key].kostnad += (f.order_id && kostnadPerOrder[f.order_id]) || 0
    m[key].antal++
  })
  return Object.values(m).sort((a, b) => b.intakt - a.intakt)
}

function KPI({ icon, label, value, color, isMobile, sub, subColor }: { icon: string; label: string; value: string; color: string; isMobile?: boolean; sub?: string; subColor?: string }) {
  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: isMobile ? 14 : 18 }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, color, lineHeight: 1, marginBottom: 4, wordBreak: 'break-word' as const }}>{value}</div>
      <div style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: subColor || '#555', fontWeight: 600, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function BreakdownTable({ title, rows, unit = 'fakturor' }: { title: string; rows: { name: string; intakt: number; kostnad: number; antal: number }[]; unit?: string }) {
  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e1e', fontSize: 12, fontWeight: 700, color: '#888' }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#444', fontSize: 12 }}>Ingen data</div>
      ) : rows.slice(0, 8).map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#d0d0d0', fontWeight: 600, wordBreak: 'break-word' }}>{r.name}</div>
            <div style={{ fontSize: 10, color: '#555' }}>{r.antal} {unit}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: G, whiteSpace: 'nowrap' }}>{fmtKr(r.intakt)}</div>
        </div>
      ))}
    </div>
  )
}
