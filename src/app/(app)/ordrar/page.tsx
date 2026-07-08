'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { Order, Customer } from '@/types'
import NyOrderModal from '@/components/NyOrderModal'
import OrderPanel from '@/components/OrderPanel'
import Sokfalt from '@/components/Sokfalt'
import { STATUS_LABEL, STATUS_COLOR, KAT_ICON, KATEGORIER as KATEGORIER_BAS, fmtKr } from '@/components/order-tabs/shared'

const KATEGORIER = ['Alla', ...KATEGORIER_BAS]
const STATUSAR = ['Alla', 'ny', 'pågående', 'klar', 'inaktiv']

// Bara de fält listan hämtar + renderar (matchar select nedan).
type OrderRow = Pick<Order, 'id' | 'status' | 'kategori' | 'titel' | 'fastighet' | 'ort' | 'postnummer' | 'order_number' | 'bokad_datum' | 'bokad_start' | 'bokad_slut' | 'tilldelad' | 'fakturerat_belopp' | 'created_at'> & { customer?: Pick<Customer, 'id' | 'namn' | 'telefon'> | null }

export default function OrdrarPage() {
  return <Suspense><OrdrarInner /></Suspense>
}

function OrdrarInner() {
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [katFilter, setKatFilter] = useState('Alla')
  const [statusFilter, setStatusFilter] = useState(() => {
    const s = searchParams.get('status')
    return s && ['ny', 'pågående', 'klar', 'inaktiv'].includes(s) ? s : 'Alla'
  })
  const [showNyOrder, setShowNyOrder] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('order'))
  // Map: order_id -> summerad kostnad (tid + inköp)
  const [kostnadMap, setKostnadMap] = useState<Record<string, number>>({})

  const fetchOrders = () => {
    const sb = createClient()
    sb.from('orders')
      // Bara fält som listan renderar — inte hela raden (beskrivning, anteckningar m.m.).
      .select('id, status, kategori, titel, fastighet, ort, postnummer, order_number, bokad_datum, bokad_start, bokad_slut, tilldelad, fakturerat_belopp, created_at, customer:customers(id,namn,telefon)')
      .order('created_at', { ascending: false })
      .then(({ data }) => { setOrders((data ?? []) as unknown as OrderRow[]); setLoading(false) })

    // Hämta ALLA kostnadsrader i två queries och summera per order_id client-side (undviker N+1)
    Promise.all([
      sb.from('order_tid_rader').select('order_id,total_kostnad'),
      sb.from('order_inkop').select('order_id,belopp'),
    ]).then(([tidRes, inkopRes]) => {
      const map: Record<string, number> = {}
      for (const r of tidRes.data || []) {
        if (!r.order_id) continue
        map[r.order_id] = (map[r.order_id] || 0) + (r.total_kostnad || 0)
      }
      for (const i of inkopRes.data || []) {
        if (!i.order_id) continue
        map[i.order_id] = (map[i.order_id] || 0) + (i.belopp || 0)
      }
      setKostnadMap(map)
    })
  }

  useEffect(() => { fetchOrders() }, [])

  // Öppna panelen när man kommer hit via ?order=<id> (t.ex. från dashboarden)
  useEffect(() => {
    const id = searchParams.get('order')
    if (id) setSelectedId(id)
  }, [searchParams])

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

  const chip = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? '#E8C96A' : '#2a2a2a'}`,
    background: active ? 'rgba(232,201,106,0.1)' : '#1a1a1a',
    color: active ? '#E8C96A' : '#888',
  })

  return (
    <div style={isMobile ? { overflowX: 'hidden' } : undefined}>
      {/* Header */}
      <div style={{ display: 'flex', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: 12 } : { justifyContent: 'space-between', alignItems: 'center' }), marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A' }}>
          Ordrar <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({filtered.length})</span>
        </div>
        <button onClick={() => setShowNyOrder(true)}
          style={{ background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Ny order
        </button>
      </div>

      {/* Sök */}
      <div style={{ marginBottom: 14 }}>
        <Sokfalt value={search} onChange={setSearch} placeholder="Sök order, kund, adress..." style={{ width: isMobile ? '100%' : 280 }} />
      </div>

      {/* Filter */}
      {isMobile ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none' }}>
            {STATUSAR.map(s => <option key={s} value={s}>{s === 'Alla' ? 'Alla statusar' : STATUS_LABEL[s] || s}</option>)}
          </select>
          <select value={katFilter} onChange={e => setKatFilter(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none' }}>
            {KATEGORIER.map(k => <option key={k} value={k}>{k === 'Alla' ? 'Alla kategorier' : `${KAT_ICON[k] || ''} ${k}`}</option>)}
          </select>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {STATUSAR.map(s => (
            <div key={s} style={chip(statusFilter === s)} onClick={() => setStatusFilter(s)}>
              {s === 'Alla' ? 'Alla statusar' : STATUS_LABEL[s] || s}
            </div>
          ))}
          <div style={{ width: 1, background: '#2a2a2a', margin: '0 4px' }} />
          {KATEGORIER.map(k => (
            <div key={k} style={chip(katFilter === k)} onClick={() => setKatFilter(k)}>
              {k !== 'Alla' ? (KAT_ICON[k] || '') + ' ' : ''}{k}
            </div>
          ))}
        </div>
      )}

      {/* Tabell / kortvy */}
      {isMobile ? (
        loading ? (
          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, textAlign: 'center', padding: 60, color: '#555' }}>Inga ordrar hittades</div>
        ) : (
          <div>
            {filtered.map(o => {
              const intakt = o.fakturerat_belopp || 0
              const kostnad = kostnadMap[o.id] || 0
              const tb = intakt - kostnad
              const tbProc = intakt > 0 ? (tb / intakt) * 100 : null
              const tomTB = intakt === 0 && kostnad === 0
              return (
                <div key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}>
                  {/* Titel + ordernummer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#d0d0d0', minWidth: 0 }}>
                      {KAT_ICON[o.kategori || ''] || '📋'} {o.titel}
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: (STATUS_COLOR[o.status] || '#555') + '22', color: STATUS_COLOR[o.status] || '#555', border: `1px solid ${STATUS_COLOR[o.status] || '#555'}44` }}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                  {o.order_number && <div style={{ fontSize: 12, color: '#E8C96A', fontWeight: 700, marginTop: 2 }}>{o.order_number}</div>}

                  {/* Sekundärrad: kund / fastighet / datum */}
                  <div style={{ fontSize: 12, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
                    <div>{o.customer?.namn || '—'}</div>
                    <div>
                      {o.fastighet || '—'}
                      {o.ort ? ` · ${o.postnummer ? o.postnummer + ' ' : ''}${o.ort}` : ''}
                    </div>
                    <div>
                      {o.bokad_datum ? new Date(o.bokad_datum).toLocaleDateString('sv-SE') : '—'}
                      {o.bokad_start ? ` ${o.bokad_start}${o.bokad_slut ? `–${o.bokad_slut}` : ''}` : ''}
                      {o.tilldelad?.length ? ` · ${o.tilldelad.map(p => p.split(' ')[0]).join(', ')}` : ''}
                    </div>
                  </div>

                  {/* Ekonomi: INTÄKT / KOSTNAD / TB */}
                  <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: '1px solid #1e1e1e', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#555' }}>INTÄKT</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: intakt > 0 ? '#4ade80' : '#555' }}>{intakt > 0 ? fmtKr(intakt) : '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#555' }}>KOSTNAD</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: kostnad > 0 ? '#f87171' : '#555' }}>{kostnad > 0 ? fmtKr(kostnad) : '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#555' }}>TB</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: tomTB ? '#555' : (tb >= 0 ? '#4ade80' : '#f87171') }}>
                        {tomTB ? '—' : fmtKr(tb)}
                        {tbProc !== null && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}> {tbProc.toFixed(0)}%</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Inga ordrar hittades</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {(['ORDER', 'KUND', 'FASTIGHET', 'DATUM', 'TILLDELAD', 'INTÄKT', 'KOSTNAD', 'TB', 'STATUS'] as const).map(h => {
                  const numeric = h === 'INTÄKT' || h === 'KOSTNAD' || h === 'TB'
                  return (
                    <th key={h} style={{ textAlign: numeric ? 'right' : 'left', padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>{h}</th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0' }}>
                    <div style={{ fontWeight: 600 }}>{KAT_ICON[o.kategori || ''] || '📋'} {o.titel}</div>
                    {o.order_number && <div style={{ fontSize: 12, color: '#E8C96A', fontWeight: 700, marginTop: 2 }}>{o.order_number}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0' }}>
                    <div>{o.customer?.namn || <span style={{ color: '#555' }}>—</span>}</div>
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0' }}>
                    <div>{o.fastighet || <span style={{ color: '#555' }}>—</span>}</div>
                    {o.ort && <div style={{ fontSize: 11, color: '#666' }}>{o.postnummer} {o.ort}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0' }}>
                    {o.bokad_datum ? <div>{new Date(o.bokad_datum).toLocaleDateString('sv-SE')}</div> : <span style={{ color: '#555' }}>—</span>}
                    {o.bokad_start && <div style={{ fontSize: 11, color: '#666' }}>{o.bokad_start}{o.bokad_slut ? `–${o.bokad_slut}` : ''}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0' }}>
                    {o.tilldelad?.length ? o.tilldelad.map(p => p.split(' ')[0]).join(', ') : <span style={{ color: '#555' }}>—</span>}
                  </td>
                  {(() => {
                    const intakt = o.fakturerat_belopp || 0
                    const kostnad = kostnadMap[o.id] || 0
                    const tb = intakt - kostnad
                    const tbProc = intakt > 0 ? (tb / intakt) * 100 : null
                    return (
                      <>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, textAlign: 'right', fontWeight: 600, color: intakt > 0 ? '#4ade80' : '#555' }}>
                          {intakt > 0 ? fmtKr(intakt) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, textAlign: 'right', fontWeight: 600, color: kostnad > 0 ? '#f87171' : '#555' }}>
                          {kostnad > 0 ? fmtKr(kostnad) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, textAlign: 'right', fontWeight: 700, color: (intakt === 0 && kostnad === 0) ? '#555' : (tb >= 0 ? '#4ade80' : '#f87171') }}>
                          {(intakt === 0 && kostnad === 0) ? '—' : fmtKr(tb)}
                          {tbProc !== null && <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>{tbProc.toFixed(0)}%</div>}
                        </td>
                      </>
                    )
                  })()}
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: (STATUS_COLOR[o.status] || '#555') + '22', color: STATUS_COLOR[o.status] || '#555', border: `1px solid ${STATUS_COLOR[o.status] || '#555'}44` }}>
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {showNyOrder && <NyOrderModal onClose={() => setShowNyOrder(false)} onSaved={fetchOrders} />}

      {selectedId && (
        <OrderPanel
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchOrders}
        />
      )}
    </div>
  )
}
