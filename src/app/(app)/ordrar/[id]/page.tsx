'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Order, Customer } from '@/types'

const STATUS_COLOR: Record<string, string> = { aktiv: '#4ade80', slutförd: '#60a5fa', inaktiv: '#555' }
const KAT_ICON: Record<string, string> = { Rondering: '🔑', Städning: '🧹', El: '⚡', Rör: '🔧', Bygg: '🏗️', Mark: '⛏️', Övrigt: '📋' }
const STATUSAR = ['aktiv', 'slutförd', 'inaktiv']

const S: Record<string, React.CSSProperties> = {
  back: { background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, padding: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 6 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  titel: { fontSize: 22, fontWeight: 800, color: '#e0e0e0' },
  meta: { fontSize: 12, color: '#555', marginTop: 4 },
  statusBadge: (s: string): React.CSSProperties => ({
    fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 20,
    background: (STATUS_COLOR[s] || '#555') + '22',
    color: STATUS_COLOR[s] || '#555',
    border: `1px solid ${STATUS_COLOR[s] || '#555'}44`,
  }),
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  card: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 18px' },
  cardTitle: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 12 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  label: { fontSize: 11, color: '#555' },
  value: { fontSize: 13, color: '#d0d0d0', fontWeight: 500, textAlign: 'right' as const, maxWidth: '60%' },
  fullCard: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 18px', marginBottom: 16 },
  instruktion: { fontSize: 13, color: '#c0c0c0', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const },
  actions: { display: 'flex', gap: 10, marginTop: 8 },
  actionBtn: (color: string): React.CSSProperties => ({
    border: `1px solid ${color}44`, borderRadius: 8, padding: '8px 16px',
    background: color + '11', color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  }),
  chip: { display: 'inline-block', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(232,201,106,0.1)', color: '#E8C96A', border: '1px solid rgba(232,201,106,0.2)', marginRight: 6, marginBottom: 4 },
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order & { customer?: Customer } | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingStatus, setChangingStatus] = useState(false)

  const fetchOrder = async () => {
    const { data } = await createClient()
      .from('orders')
      .select('*, customer:customers(id, namn, telefon, epost)')
      .eq('id', id)
      .single()
    setOrder(data)
    setLoading(false)
  }

  useEffect(() => { fetchOrder() }, [id])

  const updateStatus = async (status: string) => {
    setChangingStatus(true)
    await createClient().from('orders').update({ status }).eq('id', id)
    await fetchOrder()
    setChangingStatus(false)
  }

  if (loading) return <div style={{ color: '#555', padding: 40, textAlign: 'center' }}>Laddar...</div>
  if (!order) return <div style={{ color: '#555', padding: 40, textAlign: 'center' }}>Order hittades inte</div>

  const fmt = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <button style={S.back} onClick={() => router.push('/ordrar')}>← Tillbaka till ordrar</button>

      <div style={S.header}>
        <div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
            {KAT_ICON[order.kategori || ''] || '📋'} {order.kategori} · {order.order_number || order.id.slice(0, 8)}
          </div>
          <div style={S.titel}>{order.titel}</div>
          <div style={S.meta}>{order.fastighet}{order.ort ? ` · ${order.postnummer} ${order.ort}` : ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={S.statusBadge(order.status)}>{order.status}</span>
        </div>
      </div>

      {/* Statusändring */}
      <div style={{ ...S.fullCard, marginBottom: 16 }}>
        <div style={S.cardTitle}>ÄNDRA STATUS</div>
        <div style={S.actions}>
          {STATUSAR.map(s => (
            <button key={s} onClick={() => updateStatus(s)} disabled={changingStatus || order.status === s}
              style={{
                ...S.actionBtn(STATUS_COLOR[s]),
                opacity: order.status === s ? 0.4 : 1,
                cursor: order.status === s ? 'default' : 'pointer',
              }}>
              {s === 'aktiv' ? '▶ Aktiv' : s === 'slutförd' ? '✓ Slutförd' : '✕ Inaktiv'}
            </button>
          ))}
        </div>
      </div>

      <div style={S.grid}>
        {/* Kund */}
        <div style={S.card}>
          <div style={S.cardTitle}>KUND</div>
          {order.customer ? (
            <>
              <div style={{ ...S.row }}>
                <span style={S.label}>Namn</span>
                <span style={{ ...S.value, color: '#E8C96A' }}>{order.customer.namn}</span>
              </div>
              {order.customer.telefon && (
                <div style={S.row}>
                  <span style={S.label}>Telefon</span>
                  <a href={`tel:${order.customer.telefon}`} style={{ ...S.value, color: '#60a5fa', textDecoration: 'none' }}>{order.customer.telefon}</a>
                </div>
              )}
              {order.customer.epost && (
                <div style={S.row}>
                  <span style={S.label}>E-post</span>
                  <a href={`mailto:${order.customer.epost}`} style={{ ...S.value, color: '#60a5fa', textDecoration: 'none' }}>{order.customer.epost}</a>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#444', fontSize: 13 }}>Ingen kund kopplad</div>
          )}
        </div>

        {/* Planering */}
        <div style={S.card}>
          <div style={S.cardTitle}>PLANERING</div>
          {order.bokad_datum && (
            <div style={S.row}>
              <span style={S.label}>Datum</span>
              <span style={S.value}>{fmt(order.bokad_datum)}</span>
            </div>
          )}
          {order.bokad_start && (
            <div style={S.row}>
              <span style={S.label}>Tid</span>
              <span style={S.value}>{order.bokad_start}{order.bokad_slut ? `–${order.bokad_slut}` : ''}</span>
            </div>
          )}
          {order.tilldelad?.length && (
            <div style={{ marginTop: 8 }}>
              <div style={{ ...S.label, marginBottom: 6 }}>Personal</div>
              <div>{order.tilldelad.map(p => <span key={p} style={S.chip}>{p.split(' ')[0]}</span>)}</div>
            </div>
          )}
          {!order.bokad_datum && !order.tilldelad?.length && (
            <div style={{ color: '#444', fontSize: 13 }}>Ej planerad</div>
          )}
        </div>
      </div>

      {/* Arbetsinstruktion */}
      {order.beskrivning && (
        <div style={S.fullCard}>
          <div style={S.cardTitle}>ARBETSINSTRUKTION</div>
          <div style={S.instruktion}>{order.beskrivning}</div>
        </div>
      )}

      {/* Intern anteckning */}
      {order.intern_anteckning && (
        <div style={{ ...S.fullCard, borderColor: '#2a2200' }}>
          <div style={{ ...S.cardTitle, color: '#E8C96A88' }}>INTERN ANTECKNING</div>
          <div style={{ ...S.instruktion, color: '#999' }}>{order.intern_anteckning}</div>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#333', marginTop: 8 }}>
        Skapad {fmt(order.created_at)} · Senast ändrad {fmt(order.updated_at)}
      </div>
    </div>
  )
}
