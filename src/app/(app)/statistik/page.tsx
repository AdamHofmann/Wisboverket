'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type FakturaRad = { order_id: string | null; customer_id: string | null; kund_namn: string | null; totalt: number; fakturadatum: string; typ: string }
type OrderRad = { id: string; kategori: string | null; fastighet: string | null; created_at: string; status: string }
type InkopRad = { order_id: string; belopp: number }

const fmtKr = (n: number) => Math.round(n).toLocaleString('sv-SE') + ' kr'
const G = '#E8C96A'

export default function StatistikPage() {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: G, marginBottom: 20 }}>Statistik</div>
      <EkonomiTab />
    </div>
  )
}

function EkonomiTab() {
  const [loading, setLoading] = useState(true)
  const [fakturor, setFakturor] = useState<FakturaRad[]>([])
  const [orders, setOrders] = useState<OrderRad[]>([])
  const [inkop, setInkop] = useState<InkopRad[]>([])
  const [period, setPeriod] = useState<'manad' | 'ar' | 'allt'>('ar')

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('fakturor').select('order_id,customer_id,kund_namn,totalt,fakturadatum,typ'),
      sb.from('orders').select('id,kategori,fastighet,created_at,status'),
      sb.from('order_inkop').select('order_id,belopp'),
    ]).then(([f, o, i]) => {
      setFakturor(f.data || []); setOrders(o.data || []); setInkop(i.data || [])
      setLoading(false)
    })
  }, [])

  const idag = new Date().toISOString().slice(0, 10)
  const thisMonth = idag.slice(0, 7)
  const thisYear = idag.slice(0, 4)

  const iPeriod = (d: string) => {
    if (period === 'manad') return d.startsWith(thisMonth)
    if (period === 'ar') return d.startsWith(thisYear)
    return true
  }

  const fakturerade = useMemo(() => fakturor.filter(f => f.typ === 'faktura' && iPeriod(f.fakturadatum)), [fakturor, period])
  const totalIntakt = fakturerade.reduce((s, f) => s + f.totalt, 0)

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

  const chip = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? G : '#2a2a2a'}`,
    background: active ? 'rgba(232,201,106,0.1)' : '#1a1a1a',
    color: active ? G : '#888',
  })

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[{ k: 'manad', l: 'Denna månad' }, { k: 'ar', l: 'Detta år' }, { k: 'allt', l: 'Allt' }].map(p => (
          <div key={p.k} style={chip(period === p.k)} onClick={() => setPeriod(p.k as any)}>{p.l}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KPI icon="💰" label="Fakturerat" value={fmtKr(totalIntakt)} color={G} />
        <KPI icon="🧾" label="Kostnader" value={fmtKr(totalKostnad)} color="#f87171" />
        <KPI icon="📈" label="Bruttovinst" value={fmtKr(bruttovinst)} color={bruttovinst >= 0 ? '#4ade80' : '#f87171'} />
        <KPI icon="📊" label="Marginal" value={marginal === null ? '—' : marginal + '%'} color={marginal !== null && marginal >= 20 ? '#4ade80' : '#fb923c'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <BreakdownTable title="Per kund" rows={perKund} />
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

function KPI({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 9, color: '#555', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const }}>{label}</div>
    </div>
  )
}

function BreakdownTable({ title, rows }: { title: string; rows: { name: string; intakt: number; kostnad: number; antal: number }[] }) {
  return (
    <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e1e', fontSize: 12, fontWeight: 700, color: '#888' }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#444', fontSize: 12 }}>Ingen data</div>
      ) : rows.slice(0, 8).map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <div style={{ fontSize: 12, color: '#d0d0d0', fontWeight: 600 }}>{r.name}</div>
            <div style={{ fontSize: 10, color: '#555' }}>{r.antal} fakturor</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: G }}>{fmtKr(r.intakt)}</div>
        </div>
      ))}
    </div>
  )
}
