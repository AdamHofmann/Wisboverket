'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, Customer } from '@/types'
import SendModal from '@/components/SendModal'
import TidFaktureringTab from '@/components/order-tabs/TidFaktureringTab'
import InkopTab from '@/components/order-tabs/InkopTab'
import EkonomiTab from '@/components/order-tabs/EkonomiTab'
import FakturorTab from '@/components/order-tabs/FakturorTab'

type Kommunikation = {
  id: string
  typ: string
  kanal: string | null
  mottagare: string | null
  meddelande: string
  created_at: string
}

const STATUSAR = ['aktiv', 'slutförd', 'inaktiv']
const STATUS_COLOR: Record<string, string> = { aktiv: '#4ade80', slutförd: '#60a5fa', inaktiv: '#555' }
const KAT_ICON: Record<string, string> = { Rondering: '🔑', Städning: '🧹', El: '⚡', Rör: '🔧', Bygg: '🏗️', Mark: '⛏️', Övrigt: '📋' }
const TYP_ICON: Record<string, string> = { orderbekräftelse: '📩', åtgärdad: '✅', info: 'ℹ️', eget: '✏️', kopierat: '📋', email: '📧', sms: '💬' }

const TABS = [
  { id: 'info', label: '📋 Info' },
  { id: 'tid', label: '⏱ Tid & Fakturering' },
  { id: 'inkop', label: '🛒 Inköp' },
  { id: 'ekonomi', label: '📊 Ekonomi' },
  { id: 'fakturor', label: '🧾 Fakturor' },
  { id: 'utskick', label: '📬 Utskick' },
  { id: 'betyg', label: '⭐ Betyg' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  back: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, padding: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6 },
  card: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 18px', marginBottom: 14 },
  cardTitle: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 12 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  label: { fontSize: 11, color: '#555' },
  value: { fontSize: 13, color: '#d0d0d0', fontWeight: 500, textAlign: 'right' as const, maxWidth: '65%' },
  chip: { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(232,201,106,0.1)', color: '#E8C96A', border: '1px solid rgba(232,201,106,0.2)', marginRight: 6, marginBottom: 4 },
  statusBadge: (s: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
    background: (STATUS_COLOR[s] || '#555') + '22', color: STATUS_COLOR[s] || '#555',
    border: `1px solid ${STATUS_COLOR[s] || '#555'}44`,
  }),
  tabBar: { display: 'flex', gap: 2, borderBottom: '1px solid #1e1e1e', marginBottom: 20 },
  tab: (active: boolean): React.CSSProperties => ({
    padding: '10px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: 'none', color: active ? '#E8C96A' : '#555', borderBottom: active ? '2px solid #E8C96A' : '2px solid transparent',
    transition: 'all 0.1s',
  }),
  logItem: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '12px 14px', marginBottom: 8 },
  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  logTyp: { fontSize: 12, fontWeight: 700, color: '#d0d0d0' },
  logMeta: { fontSize: 11, color: '#555' },
  logMsg: { fontSize: 12, color: '#888', marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const },
  actionRow: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const },
  actionBtn: (color: string, disabled?: boolean): React.CSSProperties => ({
    border: `1px solid ${color}44`, borderRadius: 8, padding: '9px 16px',
    background: color + '11', color, fontSize: 12, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
  }),
  starBtn: (filled: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', fontSize: 24, cursor: 'pointer',
    color: filled ? '#E8C96A' : '#333', transition: 'color 0.1s',
  }),
  textarea: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: 100 },
  flag: (color: string): React.CSSProperties => ({
    fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: '3px 8px', borderRadius: 4,
    background: color + '22', color, border: `1px solid ${color}44`,
  }),
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order & { customer?: Customer } | null>(null)
  const [kommunikation, setKommunikation] = useState<Kommunikation[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [showSend, setShowSend] = useState(false)
  const [betyg, setBetyg] = useState(0)
  const [betygKommentar, setBetygKommentar] = useState('')
  const [sparaBetyg, setSparaBetyg] = useState(false)

  const fetchAll = async () => {
    const supabase = createClient()
    const [{ data: o }, { data: k }] = await Promise.all([
      supabase.from('orders').select('*, customer:customers(id, namn, telefon, epost)').eq('id', id).single(),
      supabase.from('order_kommunikation').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    ])
    setOrder(o)
    setKommunikation(k || [])
    if (o) { setBetyg(o.betyg || 0); setBetygKommentar(o.betyg_kommentar || '') }
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [id])

  const updateStatus = async (status: string) => {
    await createClient().from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    fetchAll()
  }

  const sparaBetygFn = async () => {
    setSparaBetyg(true)
    await createClient().from('orders').update({ betyg, betyg_kommentar: betygKommentar }).eq('id', id)
    setSparaBetyg(false)
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtTime = (d: string) => new Date(d).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  if (loading) return <div style={{ color: '#555', padding: 60, textAlign: 'center' }}>Laddar...</div>
  if (!order) return <div style={{ color: '#555', padding: 60, textAlign: 'center' }}>Order hittades inte</div>

  const behöverBekräftelse = kommunikation.length === 0 && order.status === 'aktiv'
  const klarAttFakturera = order.status === 'slutförd'

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <button style={S.back} onClick={() => router.push('/ordrar')}>← Tillbaka</button>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={S.statusBadge(order.status)}>{order.status}</span>
          {order.kategori && <span style={{ ...S.statusBadge('aktiv'), background: '#2a2a2a22', color: '#888', borderColor: '#2a2a2a' }}>{KAT_ICON[order.kategori] || '📋'} {order.kategori}</span>}
          {behöverBekräftelse && <span style={S.flag('#a78bfa')}>BEKRÄFTA</span>}
          {klarAttFakturera && <span style={S.flag('#E8C96A')}>FAKTURERA</span>}
          {order.aterkommande && <span style={S.flag('#60a5fa')}>🔄 {order.aterkommande}</span>}
          {order.prioritet === 'hog' && <span style={S.flag('#fb923c')}>⚡ HÖG PRIORITET</span>}
          {order.prioritet === 'akut' && <span style={S.flag('#f87171')}>🚨 AKUT</span>}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#e0e0e0', marginBottom: 4 }}>{order.titel}</div>
        {order.fastighet && <div style={{ fontSize: 13, color: '#555' }}>{order.fastighet}{order.ort ? ` · ${order.postnummer} ${order.ort}` : ''}</div>}
      </div>

      {/* Actions */}
      <div style={S.actionRow}>
        <button style={S.actionBtn('#a78bfa')} onClick={() => setShowSend(true)}>📬 Kontakta kund</button>
        {STATUSAR.filter(s => s !== order.status).map(s => (
          <button key={s} style={S.actionBtn(STATUS_COLOR[s])} onClick={() => updateStatus(s)}>
            {s === 'aktiv' ? '▶ Aktiv' : s === 'slutförd' ? '✓ Slutförd' : '✕ Inaktiv'}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#444' }}>#{order.order_number || order.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* INFO */}
      {tab === 'info' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Kund */}
            <div style={S.card}>
              <div style={S.cardTitle}>KUND</div>
              {order.customer ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#E8C96A', marginBottom: 8 }}>{order.customer.namn}</div>
                  {order.customer.telefon && (
                    <div style={S.row}>
                      <span style={S.label}>Telefon</span>
                      <a href={`tel:${order.customer.telefon}`} style={{ ...S.value, color: '#60a5fa', textDecoration: 'none' }}>{order.customer.telefon}</a>
                    </div>
                  )}
                  {order.customer.epost && (
                    <div style={S.row}>
                      <span style={S.label}>E-post</span>
                      <a href={`mailto:${order.customer.epost}`} style={{ ...S.value, color: '#60a5fa', textDecoration: 'none', fontSize: 11 }}>{order.customer.epost}</a>
                    </div>
                  )}
                </>
              ) : <div style={{ fontSize: 13, color: '#444' }}>Ingen kund kopplad</div>}
            </div>

            {/* Planering */}
            <div style={S.card}>
              <div style={S.cardTitle}>PLANERING</div>
              {order.bokad_datum ? (
                <div style={S.row}>
                  <span style={S.label}>Datum</span>
                  <span style={S.value}>{fmt(order.bokad_datum)}</span>
                </div>
              ) : <div style={{ fontSize: 12, color: '#444', marginBottom: 8 }}>Ej planerad</div>}
              {order.bokad_start && (
                <div style={S.row}>
                  <span style={S.label}>Tid</span>
                  <span style={S.value}>{order.bokad_start}{order.bokad_slut ? `–${order.bokad_slut}` : ''}</span>
                </div>
              )}
              {order.tilldelad?.length ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ ...S.label, marginBottom: 6 }}>Personal</div>
                  <div>{order.tilldelad.map(p => <span key={p} style={S.chip}>{p.split(' ')[0]}</span>)}</div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Arbetsinstruktion */}
          {order.beskrivning && (
            <div style={S.card}>
              <div style={S.cardTitle}>ARBETSINSTRUKTION</div>
              <div style={{ fontSize: 13, color: '#c0c0c0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{order.beskrivning}</div>
            </div>
          )}

          {/* Intern anteckning */}
          {order.intern_anteckning && (
            <div style={{ ...S.card, borderColor: '#2a2200' }}>
              <div style={{ ...S.cardTitle, color: '#E8C96A88' }}>INTERN ANTECKNING</div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.7 }}>{order.intern_anteckning}</div>
            </div>
          )}

          <div style={{ fontSize: 11, color: '#333', marginTop: 4 }}>
            Skapad {fmt(order.created_at)} · Senast ändrad {fmt(order.updated_at)}
          </div>
        </div>
      )}

      {/* UTSKICK */}
      {tab === 'utskick' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#555' }}>{kommunikation.length} utskick</div>
            <button style={S.actionBtn('#a78bfa')} onClick={() => setShowSend(true)}>+ Nytt utskick</button>
          </div>
          {kommunikation.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#444' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
              <div>Inga utskick gjorda ännu</div>
            </div>
          ) : kommunikation.map(k => (
            <div key={k.id} style={S.logItem}>
              <div style={S.logHeader}>
                <div style={S.logTyp}>
                  {TYP_ICON[k.typ] || '📩'} {k.typ.charAt(0).toUpperCase() + k.typ.slice(1)}
                  {k.kanal && <span style={{ fontSize: 10, color: '#555', marginLeft: 8 }}>via {k.kanal}</span>}
                </div>
                <div style={S.logMeta}>{fmtTime(k.created_at)}</div>
              </div>
              {k.mottagare && <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{k.mottagare}</div>}
              <div style={S.logMsg}>{k.meddelande}</div>
            </div>
          ))}
        </div>
      )}

      {/* BETYG */}
      {tab === 'betyg' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>KUNDBETYG</div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} style={S.starBtn(s <= betyg)} onClick={() => setBetyg(s)}>★</button>
              ))}
              {betyg > 0 && <span style={{ fontSize: 12, color: '#E8C96A', marginLeft: 8, alignSelf: 'center' }}>{betyg}/5</span>}
            </div>
            <textarea
              style={S.textarea} value={betygKommentar}
              onChange={e => setBetygKommentar(e.target.value)}
              placeholder="Kommentar från kunden..."
              onFocus={e => e.currentTarget.style.borderColor = '#E8C96A'}
              onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'}
            />
            <button onClick={sparaBetygFn} disabled={sparaBetyg}
              style={{ marginTop: 12, background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {sparaBetyg ? 'Sparar...' : 'Spara betyg'}
            </button>
          </div>
        </div>
      )}

      {tab === 'tid' && <TidFaktureringTab orderId={order.id} />}
      {tab === 'inkop' && <InkopTab orderId={order.id} />}
      {tab === 'ekonomi' && <EkonomiTab orderId={order.id} faktureradeBelopp={order.fakturerat_belopp} />}
      {tab === 'fakturor' && <FakturorTab orderId={order.id} />}

      {showSend && order && (
        <SendModal
          orderId={order.id}
          orderTitel={order.titel}
          kundEpost={order.customer?.epost}
          kundTelefon={order.customer?.telefon}
          onClose={() => setShowSend(false)}
          onSent={() => { fetchAll(); setTab('utskick') }}
        />
      )}
    </div>
  )
}
