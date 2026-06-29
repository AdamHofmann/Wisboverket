'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Order, Customer } from '@/types'
import { useRouter } from 'next/navigation'
import NyOrderModal from '@/components/NyOrderModal'

const KATEGORIER = ['Alla', 'Rondering', 'Städning', 'El', 'Rör', 'Bygg', 'Mark', 'Övrigt']
const STATUSAR = ['Alla', 'aktiv', 'slutförd', 'inaktiv']
const STATUS_COLOR: Record<string, string> = { aktiv: '#4ade80', slutförd: '#60a5fa', inaktiv: '#555' }
const KAT_ICON: Record<string, string> = { Rondering: '🔑', Städning: '🧹', El: '⚡', Rör: '🔧', Bygg: '🏗️', Mark: '⛏️', Övrigt: '📋' }

const S: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, color: '#E8C96A' },
  filters: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  chip: { padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid #2a2a2a', background: '#1a1a1a', color: '#888', transition: 'all 0.1s' },
  chipActive: { background: 'rgba(232,201,106,0.12)', borderColor: '#E8C96A', color: '#E8C96A' },
  search: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 14px', color: '#e0e0e0', fontSize: 13, width: 260, outline: 'none' },
  newBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' },
  td: { padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0', verticalAlign: 'middle' },
  row: { cursor: 'pointer', transition: 'background 0.1s' },
  empty: { textAlign: 'center', padding: 60, color: '#555', fontSize: 14 },
}

export default function OrdrarPage() {
  const [orders, setOrders] = useState<(Order & { customer?: Customer })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [katFilter, setKatFilter] = useState('Alla')
  const [statusFilter, setStatusFilter] = useState('aktiv')
  const [showNyOrder, setShowNyOrder] = useState(false)
  const router = useRouter()

  const fetchOrders = () => {
    const supabase = createClient()
    supabase
      .from('orders')
      .select('*, customer:customers(id, namn, telefon)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOrders(data || []); setLoading(false) })
  }

  useEffect(() => { fetchOrders() }, [])

  const filtered = useMemo(() => orders.filter(o => {
    if (statusFilter !== 'Alla' && o.status !== statusFilter) return false
    if (katFilter !== 'Alla' && o.kategori !== katFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return o.titel.toLowerCase().includes(q) ||
        o.fastighet?.toLowerCase().includes(q) ||
        o.customer?.namn.toLowerCase().includes(q) ||
        o.order_number?.toLowerCase().includes(q) || false
    }
    return true
  }), [orders, statusFilter, katFilter, search])

  return (
    <div>
      <div style={S.header}>
        <div style={S.title}>Ordrar <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({filtered.length})</span></div>
        <button style={S.newBtn} onClick={() => setShowNyOrder(true)}>+ Ny order</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Sök order, kund, adress..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={S.search}
          onFocus={e => e.target.style.borderColor = '#E8C96A'}
          onBlur={e => e.target.style.borderColor = '#2a2a2a'}
        />
      </div>

      <div style={S.filters}>
        {STATUSAR.map(s => (
          <div key={s} onClick={() => setStatusFilter(s)}
            style={{ ...S.chip, ...(statusFilter === s ? S.chipActive : {}) }}>
            {s === 'Alla' ? 'Alla statusar' : s}
          </div>
        ))}
        <div style={{ width: 1, background: '#2a2a2a', margin: '0 4px' }} />
        {KATEGORIER.map(k => (
          <div key={k} onClick={() => setKatFilter(k)}
            style={{ ...S.chip, ...(katFilter === k ? S.chipActive : {}) }}>
            {k !== 'Alla' ? (KAT_ICON[k] || '') + ' ' : ''}{k}
          </div>
        ))}
      </div>

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={S.empty}>Laddar...</div>
        ) : filtered.length === 0 ? (
          <div style={S.empty}>Inga ordrar hittades</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ORDER</th>
                <th style={S.th}>KUND</th>
                <th style={S.th}>FASTIGHET</th>
                <th style={S.th}>DATUM</th>
                <th style={S.th}>TILLDELAD</th>
                <th style={S.th}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} style={S.row}
                  onClick={() => router.push(`/ordrar/${o.id}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#e0e0e0' }}>
                      {KAT_ICON[o.kategori || ''] || '📋'} {o.titel}
                    </div>
                    {o.order_number && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{o.order_number}</div>}
                  </td>
                  <td style={S.td}>
                    <div>{o.customer?.namn || <span style={{ color: '#555' }}>—</span>}</div>
                    {o.customer?.telefon && <div style={{ fontSize: 11, color: '#666' }}>{o.customer.telefon}</div>}
                  </td>
                  <td style={S.td}>
                    <div>{o.fastighet || <span style={{ color: '#555' }}>—</span>}</div>
                    {o.ort && <div style={{ fontSize: 11, color: '#666' }}>{o.postnummer} {o.ort}</div>}
                  </td>
                  <td style={S.td}>
                    {o.bokad_datum
                      ? <div>{new Date(o.bokad_datum).toLocaleDateString('sv-SE')}</div>
                      : <span style={{ color: '#555' }}>—</span>}
                    {o.bokad_start && <div style={{ fontSize: 11, color: '#666' }}>{o.bokad_start}–{o.bokad_slut}</div>}
                  </td>
                  <td style={S.td}>
                    {o.tilldelad?.length
                      ? o.tilldelad.map(p => p.split(' ')[0]).join(', ')
                      : <span style={{ color: '#555' }}>—</span>}
                  </td>
                  <td style={S.td}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10,
                      background: (STATUS_COLOR[o.status] || '#555') + '22',
                      color: STATUS_COLOR[o.status] || '#555',
                      border: `1px solid ${STATUS_COLOR[o.status] || '#555'}44`
                    }}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNyOrder && (
        <NyOrderModal onClose={() => setShowNyOrder(false)} onSaved={fetchOrders} />
      )}
    </div>
  )
}
