'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, Invoice } from '@/types'
import Link from 'next/link'

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

const fmt = (n: number) => n.toLocaleString('sv-SE') + ' kr'
const fmtDate = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').order('created_at', { ascending: false }),
    ]).then(([{ data: o }, { data: i }]) => {
      setOrders(o || [])
      setInvoices(i || [])
      setLoading(false)
    })
  }, [])

  const aktiva = orders.filter(o => o.status === 'aktiv')
  const ejPlanerade = orders.filter(o => o.status === 'aktiv' && !o.bokad_datum)
  const attFakturera = orders.filter(o => o.status === 'slutförd')
  const idag = new Date().toISOString().split('T')[0]
  const faktureratIdag = invoices.filter(i => i.created_at?.startsWith(idag)).reduce((s, i) => s + (i.total_incl_moms || 0), 0)
  const manad = new Date().toLocaleString('sv-SE', { month: 'short' }).toUpperCase()
  const faktureratManad = invoices
    .filter(i => i.created_at?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, i) => s + (i.total_incl_moms || 0), 0)

  const senastFakturerade = invoices.slice(0, 5)

  const statCards = [
    { label: 'Öppna ordrar', value: aktiva.length, sub: `${ejPlanerade.length} nya`, color: '#60a5fa' },
    { label: 'Ej planerade', value: ejPlanerade.length, sub: 'saknar datum', color: '#f59e0b' },
    { label: 'Bekräftas', value: 0, sub: 'till kund', color: '#a78bfa' },
    { label: 'Att fakturera', value: attFakturera.length, sub: 'slutförda', color: '#e0e0e0' },
    { label: 'Fakturerat idag', value: fmt(faktureratIdag), sub: 'exkl moms', color: '#4ade80', wide: true },
    { label: manad, value: fmt(faktureratManad), sub: 'fakturerat', color: '#E8C96A', wide: true },
  ]

  if (loading) return <div style={{ color: '#555', padding: 40, textAlign: 'center' }}>Laddar...</div>

  return (
    <div>
      <div style={S.grid}>
        {statCards.map(c => (
          <div key={c.label} style={{ ...S.card, gridColumn: (c as any).wide ? 'span 1' : undefined }}>
            <div style={{ ...S.cardAccent, background: c.color }} />
            <div style={S.cardLabel}>{c.label}</div>
            <div style={{ ...S.cardValue, color: c.color }}>{c.value}</div>
            <div style={S.cardSub}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={S.kbRow}>
        {/* Ej planerade */}
        <div style={S.kbCol}>
          <div style={S.kbHeader}>
            <span style={{ ...S.kbTitle, color: '#f59e0b' }}>⚠ EJ PLANERADE</span>
            <span style={S.kbBadge}>{ejPlanerade.length}</span>
          </div>
          {ejPlanerade.length === 0
            ? <div style={S.kbEmpty}>Alla planerade ✓</div>
            : ejPlanerade.slice(0, 6).map(o => (
              <Link href={`/ordrar/${o.id}`} key={o.id} style={{ ...S.kbItem, display: 'block', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1e1e1e')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={S.kbItemTitle}>{o.titel}</div>
                <div style={S.kbItemSub}>{o.fastighet || '—'}</div>
              </Link>
            ))}
        </div>

        {/* Bekräftas till kund */}
        <div style={S.kbCol}>
          <div style={S.kbHeader}>
            <span style={{ ...S.kbTitle, color: '#a78bfa' }}>📋 BEKRÄFTAS TILL KUND</span>
            <span style={S.kbBadge}>0</span>
          </div>
          <div style={S.kbEmpty}>Alla klara är bekräftade ✓</div>
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
              <Link href={`/ordrar/${o.id}`} key={o.id} style={{ ...S.kbItem, display: 'block', textDecoration: 'none' }}
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
            : senastFakturerade.map(i => (
              <div key={i.id} style={S.kbItem}>
                <div style={S.kbItemTitle}>{i.invoice_number || 'Faktura'}</div>
                <div style={S.kbItemSub}>{fmtDate(i.created_at)}</div>
                <div style={S.kbItemAmount}>{fmt(i.total_incl_moms)}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
