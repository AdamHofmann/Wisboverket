'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'

type LoggRad = {
  id: string
  typ: 'fel' | 'prestanda' | 'info'
  niva: 'error' | 'warn' | 'info'
  kalla: string | null
  path: string | null
  meddelande: string
  duration_ms: number | null
  detaljer: unknown
  created_at: string
}

type TypFilter = 'alla' | 'fel' | 'prestanda' | 'info'
type NivaFilter = 'alla' | 'error' | 'warn' | 'info'
type TidFilter = '24h' | '7d' | 'allt'

const fmtTid = (d: string) =>
  new Date(d).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })

const TYP_FARG: Record<LoggRad['typ'], string> = { fel: '#f87171', prestanda: '#60a5fa', info: '#9ca3af' }
const TYP_LABEL: Record<LoggRad['typ'], string> = { fel: 'FEL', prestanda: 'PREST', info: 'INFO' }

const median = (arr: number[]) => {
  if (arr.length === 0) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const fmtMs = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${Math.round(n)} ms`)

export default function SystemloggPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const [logg, setLogg] = useState<LoggRad[]>([])
  const [laddar, setLaddar] = useState(true)
  const [tabellSaknas, setTabellSaknas] = useState(false)
  const [oppen, setOppen] = useState<string | null>(null)
  const [rensar, setRensar] = useState(false)

  // filter
  const [typF, setTypF] = useState<TypFilter>('alla')
  const [nivaF, setNivaF] = useState<NivaFilter>('alla')
  const [tidF, setTidF] = useState<TidFilter>('24h')
  const [text, setText] = useState('')

  const fetchLogg = () => {
    setLaddar(true)
    createClient()
      .from('app_logg')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) { setTabellSaknas(true); setLaddar(false); return }
        setTabellSaknas(false); setLogg((data as LoggRad[]) || []); setLaddar(false)
      })
  }
  useEffect(() => { fetchLogg() }, [])

  const rensaGamla = async () => {
    if (!(await confirm({ message: 'Radera alla loggposter äldre än 30 dagar?', danger: true, confirmLabel: 'Ta bort' }))) return
    setRensar(true)
    const gr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    createClient().from('app_logg').delete().lt('created_at', gr)
      .then(({ error }) => {
        setRensar(false)
        if (error) { toast.error('Kunde inte rensa: ' + error.message); return }
        fetchLogg()
      })
  }

  // Sammanfattning (baserat på hela hämtade datasetet, ~200 senaste)
  const sammanfattning = useMemo(() => {
    const nu = Date.now()
    const dygn = nu - 24 * 60 * 60 * 1000
    const felSenaste24h = logg.filter(l => l.typ === 'fel' && new Date(l.created_at).getTime() >= dygn).length

    const prest = logg.filter(l => l.typ === 'prestanda' && l.duration_ms != null)
    const snitt = prest.length ? prest.reduce((s, l) => s + (l.duration_ms || 0), 0) / prest.length : 0

    const perPath = new Map<string, number[]>()
    for (const l of prest) {
      const key = l.path || '—'
      if (!perPath.has(key)) perPath.set(key, [])
      perPath.get(key)!.push(l.duration_ms || 0)
    }
    const topp = [...perPath.entries()]
      .map(([path, ds]) => ({ path, median: median(ds), max: Math.max(...ds), antal: ds.length }))
      .sort((a, b) => b.median - a.median)
      .slice(0, 3)

    return { felSenaste24h, snitt, antalPrest: prest.length, topp }
  }, [logg])

  const visade = useMemo(() => {
    const nu = Date.now()
    const grans = tidF === '24h' ? nu - 24 * 60 * 60 * 1000 : tidF === '7d' ? nu - 7 * 24 * 60 * 60 * 1000 : 0
    const q = text.trim().toLowerCase()
    return logg.filter(l => {
      if (typF !== 'alla' && l.typ !== typF) return false
      if (nivaF !== 'alla' && l.niva !== nivaF) return false
      if (grans && new Date(l.created_at).getTime() < grans) return false
      if (q) {
        const hay = `${l.path || ''} ${l.meddelande || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [logg, typF, nivaF, tidF, text])

  const chip = (active: boolean) => ({
    padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: `1px solid ${active ? '#E8C96A' : '#2a2a2a'}`,
    background: active ? 'rgba(232,201,106,0.1)' : '#1a1a1a', color: active ? '#E8C96A' : '#888',
  })

  const kort = (label: string, varde: React.ReactNode, farg = '#e0e0e0') => (
    <div style={{ flex: '1 1 160px', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: farg }}>{varde}</div>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', marginBottom: 4 }}>Systemlogg</div>
      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.7, marginTop: 4, marginBottom: 20 }}>
        Inbyggd hälsologg — fel loggas alltid, prestanda selektivt (API &gt; 1000 ms och sidladdning). Senaste 200 posterna.
      </div>

      {tabellSaknas ? (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '24px', textAlign: 'center', fontSize: 12, color: '#666' }}>
          Logg-tabellen är inte skapad ännu. Kör <strong style={{ color: '#E8C96A' }}>supabase/migrations/027_app_logg.sql</strong> i Supabase, så aktiveras loggen.
        </div>
      ) : (
        <>
          {/* Sammanfattning */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {kort('Fel senaste 24h', sammanfattning.felSenaste24h, sammanfattning.felSenaste24h > 0 ? '#f87171' : '#4ade80')}
            {kort('Snittsvarstid (prestanda)', sammanfattning.antalPrest ? fmtMs(sammanfattning.snitt) : '—', '#60a5fa')}
            <div style={{ flex: '2 1 320px', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Topp 3 långsammaste path</div>
              {sammanfattning.topp.length === 0 ? (
                <div style={{ fontSize: 13, color: '#555' }}>Inga prestanda-poster ännu</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {sammanfattning.topp.map(t => (
                    <div key={t.path} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 12 }}>
                      <span style={{ color: '#d0d0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{t.path}</span>
                      <span style={{ color: '#60a5fa', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {fmtMs(t.median)} <span style={{ color: '#555', fontWeight: 400 }}>median · {fmtMs(t.max)} max</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
            {(['alla', 'fel', 'prestanda', 'info'] as TypFilter[]).map(t => (
              <div key={t} style={chip(typF === t)} onClick={() => setTypF(t)}>{t === 'alla' ? 'Alla' : t[0].toUpperCase() + t.slice(1)}</div>
            ))}
            <span style={{ width: 1, height: 20, background: '#2a2a2a', margin: '0 4px' }} />
            {(['alla', 'error', 'warn', 'info'] as NivaFilter[]).map(n => (
              <div key={n} style={chip(nivaF === n)} onClick={() => setNivaF(n)}>{n === 'alla' ? 'Alla nivåer' : n}</div>
            ))}
            <span style={{ width: 1, height: 20, background: '#2a2a2a', margin: '0 4px' }} />
            {(['24h', '7d', 'allt'] as TidFilter[]).map(t => (
              <div key={t} style={chip(tidF === t)} onClick={() => setTidF(t)}>{t === '24h' ? '24h' : t === '7d' ? '7 dagar' : 'Allt'}</div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Sök i path / meddelande…"
              style={{ flex: '1 1 240px', minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #2a2a2a', background: '#0d0d0d', color: '#e0e0e0', fontSize: 13, outline: 'none' }}
            />
            <button onClick={fetchLogg} style={{ ...chip(false), cursor: 'pointer', padding: '8px 14px' }}>↻ Uppdatera</button>
            <button onClick={rensaGamla} disabled={rensar}
              style={{ padding: '8px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: rensar ? 'default' : 'pointer', border: '1px solid #f8717144', background: 'rgba(248,113,113,0.08)', color: rensar ? '#666' : '#f87171' }}>
              {rensar ? 'Rensar…' : 'Rensa > 30 dagar'}
            </button>
          </div>

          {/* Lista */}
          {laddar ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#555', fontSize: 13 }}>Laddar...</div>
          ) : visade.length === 0 ? (
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '24px', textAlign: 'center', fontSize: 12, color: '#666' }}>
              Inga loggposter matchar filtret.
            </div>
          ) : (
            <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 66px 56px 90px 1fr 78px', gap: 12, padding: '9px 16px', borderBottom: '1px solid #1e1e1e', fontSize: 10, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                <span>Tid</span><span>Typ</span><span>Nivå</span><span>Källa</span><span>Path / meddelande</span><span style={{ textAlign: 'right' }}>Tid ms</span>
              </div>
              {visade.map((l, i) => {
                const farg = TYP_FARG[l.typ]
                const expanderad = oppen === l.id
                const harDetaljer = l.detaljer != null
                return (
                  <div key={l.id} style={{ borderTop: i > 0 ? '1px solid #1a1a1a' : 'none' }}>
                    <div
                      onClick={() => harDetaljer && setOppen(expanderad ? null : l.id)}
                      style={{ display: 'grid', gridTemplateColumns: '150px 66px 56px 90px 1fr 78px', gap: 12, alignItems: 'center', padding: '11px 16px', cursor: harDetaljer ? 'pointer' : 'default' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{fmtTid(l.created_at)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: farg + '22', color: farg, border: `1px solid ${farg}44`, textAlign: 'center' }}>{TYP_LABEL[l.typ]}</span>
                      <span style={{ fontSize: 11, color: l.niva === 'error' ? '#f87171' : l.niva === 'warn' ? '#fbbf24' : '#888', fontWeight: 600 }}>{l.niva}</span>
                      <span style={{ fontSize: 11, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.kalla || '—'}</span>
                      <span style={{ fontSize: 13, color: '#d0d0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.path && <span style={{ color: '#888', fontFamily: 'monospace', fontSize: 12, marginRight: 8 }}>{l.path}</span>}
                        {l.meddelande}
                        {harDetaljer && <span style={{ color: '#555', marginLeft: 8, fontSize: 11 }}>{expanderad ? '▾' : '▸'}</span>}
                      </span>
                      <span style={{ fontSize: 12, color: l.duration_ms != null ? '#60a5fa' : '#444', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {l.duration_ms != null ? fmtMs(l.duration_ms) : '—'}
                      </span>
                    </div>
                    {expanderad && harDetaljer && (
                      <div style={{ padding: '0 16px 14px' }}>
                        <pre style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 8, padding: '10px 12px', color: '#aaa', fontSize: 11, overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {typeof l.detaljer === 'string' ? l.detaljer : JSON.stringify(l.detaljer, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
