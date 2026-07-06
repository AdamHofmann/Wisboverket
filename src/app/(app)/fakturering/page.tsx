'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FakturaVy } from '@/components/order-tabs/FakturorTab'
import { useIsMobile } from '@/hooks/useMediaQuery'

type Faktura = {
  id: string; fakturanummer: string; typ: string; status: string; fakturadatum: string
  totalt: number; subtotal: number; moms_belopp: number
  kund_namn: string | null; kund_epost: string | null; referens: string | null; original_faktura_id: string | null
  hogia_faktura_id: string | null; hogia_synkad_at: string | null
  rader: Array<{ typ: string; desc: string; antal: number; apris: number; enhet: string; belopp: number }>
  order_id: string | null
}

const STATUS_COLOR: Record<string, string> = { utkast: '#888', skickad: '#4ade80', betald: '#60a5fa', krediterad: '#f87171', delkrediterad: '#fb923c', kreditnota: '#f87171' }
const fmtKr = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 0 }) + ' kr'
const fmtDatum = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

export default function FaktureringPage() {
  const isMobile = useIsMobile()
  const [fakturor, setFakturor] = useState<Faktura[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('Alla')
  const [search, setSearch] = useState('')
  const [vald, setVald] = useState<Faktura | null>(null)

  useEffect(() => {
    createClient().from('fakturor').select('*')
      .order('fakturadatum', { ascending: false })
      .then(({ data }) => { setFakturor(data || []); setLoading(false) })
  }, [])

  const filtered = useMemo(() => fakturor.filter(f => {
    if (statusFilter !== 'Alla' && f.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return f.fakturanummer.toLowerCase().includes(q) || f.kund_namn?.toLowerCase().includes(q) || false
    }
    return true
  }), [fakturor, statusFilter, search])

  const totFakturerat = fakturor.filter(f => f.typ === 'faktura' && f.status !== 'krediterad').reduce((s, f) => s + f.totalt, 0)
  const totBetalt = fakturor.filter(f => f.status === 'betald').reduce((s, f) => s + f.totalt, 0)
  const totObetalt = fakturor.filter(f => f.status === 'skickad').reduce((s, f) => s + f.totalt, 0)

  const inp = { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 14px', color: '#e0e0e0', fontSize: 13, outline: 'none' }
  const chip = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${active ? '#E8C96A' : '#2a2a2a'}`,
    background: active ? 'rgba(232,201,106,0.1)' : '#1a1a1a',
    color: active ? '#E8C96A' : '#888',
  })

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A', marginBottom: 16 }}>Fakturor</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Totalt fakturerat" value={fmtKr(totFakturerat)} color="#E8C96A" />
          <StatCard label="Betalt" value={fmtKr(totBetalt)} color="#4ade80" />
          <StatCard label="Obetalt (skickade)" value={fmtKr(totObetalt)} color="#fb923c" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row' }}>
        <input placeholder="Sök faktura, kund..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, ...(isMobile ? { width: '100%', boxSizing: 'border-box' as const } : {}) }}
          onFocus={e => e.currentTarget.style.borderColor = '#E8C96A'} onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Alla', 'utkast', 'skickad', 'betald', 'krediterad'].map(s => (
            <div key={s} style={chip(statusFilter === s)} onClick={() => setStatusFilter(s)}>{s}</div>
          ))}
        </div>
      </div>

      <div style={{ background: isMobile ? 'transparent' : '#141414', border: isMobile ? 'none' : '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            {fakturor.length === 0 ? (
              <><div style={{ fontSize: 32, marginBottom: 10 }}>🧾</div><div>Inga fakturor ännu — fakturor skapas via Tid & Fakturering på varje order</div></>
            ) : 'Inga träffar'}
          </div>
        ) : isMobile ? (
          <div>
            {filtered.map(f => {
              const erKreditnota = f.typ === 'kreditnota'
              const color = STATUS_COLOR[f.status] || '#888'
              return (
                <div key={f.id} onClick={() => setVald(f)}
                  style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: erKreditnota ? '#f87171' : '#E8C96A' }}>{f.fakturanummer}</div>
                      {erKreditnota && <div style={{ fontSize: 10, color: '#f87171' }}>KREDITNOTA</div>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: color + '22', color, border: `1px solid ${color}44`, whiteSpace: 'nowrap' as const }}>
                      {f.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginTop: 8 }}>
                    <div style={{ fontSize: 13, color: '#888' }}>{f.kund_namn || '—'}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: erKreditnota ? '#f87171' : '#e0e0e0', whiteSpace: 'nowrap' as const }}>
                      {erKreditnota ? '−' : ''}{fmtKr(Math.abs(f.totalt))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>FAKTURA</th>
                <th style={{ textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>KUND</th>
                <th style={{ textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>DATUM</th>
                <th style={{ textAlign: 'right' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>BELOPP</th>
                <th style={{ textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const erKreditnota = f.typ === 'kreditnota'
                const color = STATUS_COLOR[f.status] || '#888'
                return (
                  <tr key={f.id} onClick={() => setVald(f)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0' }}>
                      <div style={{ fontWeight: 700, color: erKreditnota ? '#f87171' : '#E8C96A' }}>{f.fakturanummer}</div>
                      {erKreditnota && <div style={{ fontSize: 10, color: '#f87171' }}>KREDITNOTA</div>}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#888' }}>{f.kund_namn || '—'}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#666' }}>{fmtDatum(f.fakturadatum)}</td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 14, fontWeight: 700, color: erKreditnota ? '#f87171' : '#e0e0e0', textAlign: 'right' as const }}>
                      {erKreditnota ? '−' : ''}{fmtKr(Math.abs(f.totalt))}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: color + '22', color, border: `1px solid ${color}44` }}>
                        {f.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {vald && <FakturaVy faktura={vald} onClose={() => setVald(null)} />}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#141414', border: `1px solid ${color}22`, borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 8 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}
