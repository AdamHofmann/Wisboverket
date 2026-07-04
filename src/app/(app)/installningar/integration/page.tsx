'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS = [
  { label: 'Kunder', status: 'Förberedd' },
  { label: 'Artiklar', status: 'Förberedd' },
  { label: 'Fakturor', status: 'Förberedd' },
]

type LoggRad = {
  id: string; tidpunkt: string; entitet: string; entitet_id: string | null
  entitet_namn: string | null; riktning: string; status: string
  meddelande: string | null; detalj: unknown; hogia_id: string | null
}

const fmtTid = (d: string) => new Date(d).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const ENT_LABEL: Record<string, string> = { kund: 'Kund', artikel: 'Artikel', faktura: 'Faktura' }

export default function IntegrationPage() {
  const [logg, setLogg] = useState<LoggRad[]>([])
  const [laddar, setLaddar] = useState(true)
  const [tabellSaknas, setTabellSaknas] = useState(false)
  const [filter, setFilter] = useState<'alla' | 'fel'>('alla')
  const [oppen, setOppen] = useState<string | null>(null)

  const fetchLogg = () => {
    setLaddar(true)
    createClient().from('hogia_synk_logg').select('*').order('tidpunkt', { ascending: false }).limit(100)
      .then(({ data, error }) => {
        if (error) { setTabellSaknas(true); setLaddar(false); return }
        setTabellSaknas(false); setLogg(data || []); setLaddar(false)
      })
  }
  useEffect(() => { fetchLogg() }, [])

  const visade = filter === 'fel' ? logg.filter(l => l.status === 'fel') : logg
  const antalFel = logg.filter(l => l.status === 'fel').length

  const chip = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${active ? '#E8C96A' : '#2a2a2a'}`,
    background: active ? 'rgba(232,201,106,0.1)' : '#1a1a1a', color: active ? '#E8C96A' : '#888',
  })

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', marginBottom: 4 }}>Hogia OpenBusiness</div>
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 16px', marginTop: 12, marginBottom: 20, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
        Synk aktiveras i <strong style={{ color: '#E8C96A' }}>Fas 2</strong> när API-nyckeln är på plats. Synkloggen nedan fylls då automatiskt vid varje synkförsök.
      </div>

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden', marginBottom: 28 }}>
        {STATUS.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: i > 0 ? '1px solid #1a1a1a' : 'none' }}>
            <span style={{ fontSize: 13, color: '#d0d0d0', fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 4, background: '#fb923c22', color: '#fb923c', border: '1px solid #fb923c44' }}>{s.status}</span>
          </div>
        ))}
      </div>

      {/* Synklogg */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>
          Synklogg {!tabellSaknas && <span style={{ fontSize: 12, color: '#555', fontWeight: 400 }}>({logg.length}{antalFel > 0 ? ` · ${antalFel} fel` : ''})</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {!tabellSaknas && (
            <>
              <div style={chip(filter === 'alla')} onClick={() => setFilter('alla')}>Alla</div>
              <div style={chip(filter === 'fel')} onClick={() => setFilter('fel')}>Bara fel</div>
              <button onClick={fetchLogg} style={{ ...chip(false), cursor: 'pointer' }}>↻ Uppdatera</button>
            </>
          )}
        </div>
      </div>

      {tabellSaknas ? (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '24px', textAlign: 'center', fontSize: 12, color: '#666' }}>
          Logg-tabellen är inte skapad ännu. Kör <strong style={{ color: '#E8C96A' }}>supabase/migrations/019_hogia_synk_logg.sql</strong> i Supabase, så aktiveras loggen.
        </div>
      ) : laddar ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#555', fontSize: 13 }}>Laddar...</div>
      ) : visade.length === 0 ? (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '24px', textAlign: 'center', fontSize: 12, color: '#666' }}>
          {filter === 'fel' ? 'Inga fel loggade 👍' : 'Inga synkhändelser ännu — loggen fylls när Fas 2-synken körs.'}
        </div>
      ) : (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
          {visade.map((l, i) => {
            const ok = l.status === 'ok'
            const farg = ok ? '#4ade80' : '#f87171'
            const expanderad = oppen === l.id
            return (
              <div key={l.id} style={{ borderTop: i > 0 ? '1px solid #1a1a1a' : 'none' }}>
                <div onClick={() => setOppen(expanderad ? null : l.id)}
                  style={{ display: 'grid', gridTemplateColumns: '140px 80px 1fr auto', gap: 12, alignItems: 'center', padding: '11px 16px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 12, color: '#888' }}>{fmtTid(l.tidpunkt)}</span>
                  <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>{ENT_LABEL[l.entitet] || l.entitet}</span>
                  <span style={{ fontSize: 13, color: '#d0d0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.entitet_namn || l.entitet_id || '—'}
                    {l.meddelande && <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>· {l.meddelande}</span>}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 4, background: farg + '22', color: farg, border: `1px solid ${farg}44` }}>
                    {ok ? '✓ OK' : '✕ FEL'}
                  </span>
                </div>
                {expanderad && (
                  <div style={{ padding: '0 16px 14px', fontSize: 12, color: '#888' }}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
                      {l.hogia_id && <span>Hogia-id: <span style={{ color: '#d0d0d0' }}>{l.hogia_id}</span></span>}
                      <span>Riktning: <span style={{ color: '#d0d0d0' }}>{l.riktning}</span></span>
                      {l.entitet_id && <span>Post-id: <span style={{ color: '#d0d0d0' }}>{l.entitet_id}</span></span>}
                    </div>
                    {l.detalj != null && (
                      <pre style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '10px 12px', color: '#aaa', fontSize: 11, overflowX: 'auto', margin: 0 }}>
                        {JSON.stringify(l.detalj, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
