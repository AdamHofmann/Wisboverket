'use client'

// Migrerad från käll-appens src/app/fakturering/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold-styles + emoji-ikoner, data via /api/fastigheter/fakturor.
//
// VIKTIGT om fältnamn: Supabase-routen returnerar snake_case-kolumner. Käll-UI:t använde
// samma nästlade struktur (rader, hyresavtal.lokaler[].lokal.fastighet, hyresgast) och de
// fälten (fakturanummer, forfallodag, faktureringsfrekvens, personnummer ...) är redan
// snake_case/lowercase i schemat → ingen fält-remap behövs här utöver render-anpassningen.

import { useEffect, useState } from 'react'
import React from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost, btnDanger } from '@/components/fastigheter/styles'

interface FakturaRad {
  id: string; artikelkod: string; beskrivning: string
  antal: number; apris: number; belopp: number; moms: number
}

interface Faktura {
  id: string; fakturanummer: string; belopp: number; period: string
  forfallodag: string; status: string
  rader: FakturaRad[]
  hyresavtal: {
    lokaler: { lokal: { namn: string; fastighet: { namn: string } } }[]
    hyresgast: { id: string; namn: string; epost: string | null; personnummer: string | null }
    faktureringsfrekvens: string
  }
}

const statusConfig: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  ej_skickad: { label: 'Ej skickad', bg: C.field, color: C.muted, icon: '🕒' },
  skickad: { label: 'Skickad', bg: 'rgba(96,165,250,0.12)', color: C.blue, icon: '📤' },
  betald: { label: 'Betald', bg: 'rgba(74,222,128,0.12)', color: C.ok, icon: '✅' },
}

const formatSEK = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)
const formatDate = (d: string) => new Date(d).toLocaleDateString('sv-SE')

// Quarter options for a given year
function kvartalOptions(year: number) {
  return [
    { label: `Q1 ${year} (Jan–Mar)`, period: `${year}-01` },
    { label: `Q2 ${year} (Apr–Jun)`, period: `${year}-04` },
    { label: `Q3 ${year} (Jul–Sep)`, period: `${year}-07` },
    { label: `Q4 ${year} (Okt–Dec)`, period: `${year}-10` },
  ]
}

const selStyle: React.CSSProperties = { ...inp, width: 'auto', minWidth: 150 }

export default function FaktureringPage() {
  const [fakturor, setFakturor] = useState<Faktura[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterHyresgast, setFilterHyresgast] = useState('')
  const [previewFaktura, setPreviewFaktura] = useState<Faktura | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [sortCol, setSortCol] = useState<string>('period')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)

  const now = new Date()
  const currentYear = now.getFullYear()

  // Monthly period options (12 months back + 3 ahead)
  const monthlyPeriods = Array.from({ length: 15 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - 12 + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Quarter options: nuvarande kvartal + nästa
  const nu = new Date()
  const nuQ = Math.ceil((nu.getMonth() + 1) / 3)
  const nuQperiod = `${currentYear}-${String((nuQ - 1) * 3 + 1).padStart(2, '0')}`
  const allKvartal = [...kvartalOptions(currentYear), ...kvartalOptions(currentYear + 1)]
  const kvartalOpts = allKvartal.filter(k => k.period >= nuQperiod).slice(0, 2)

  const currentPeriod = monthlyPeriods[12]

  useEffect(() => {
    setSelectedPeriod(currentPeriod)
    setFilterPeriod(currentPeriod)
    load(currentPeriod)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const load = (period?: string) => {
    const url = period ? `/api/fastigheter/fakturor?period=${period}` : '/api/fastigheter/fakturor'
    fetch(url).then(r => r.json()).then(data => { if (Array.isArray(data)) setFakturor(data) }).finally(() => setLoading(false))
  }

  const generate = async () => {
    if (!selectedPeriod) return
    setGenerating(true)
    setMessage(null)
    const res = await fetch('/api/fastigheter/fakturor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: selectedPeriod }),
    })
    const data = await res.json()
    const skippedMsg = data.skippade?.length > 0 ? ` (${data.skippade.length} redan fakturerade hoppades över)` : ''
    setMessage({ text: (data.message || 'Klart') + skippedMsg, type: data.count > 0 ? 'success' : 'info' })
    setGenerating(false)
    // Visa alla fakturor efter generering
    setFilterPeriod('')
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/fastigheter/fakturor/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load(filterPeriod || undefined)
  }

  const deleteFaktura = async (id: string) => {
    if (!confirm('Ta bort faktura?')) return
    await fetch(`/api/fastigheter/fakturor/${id}`, { method: 'DELETE' })
    load(filterPeriod || undefined)
  }

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const exportHogia = () => {
    const data = {
      exportdatum: new Date().toISOString(),
      period: filterPeriod,
      system: 'Hofmanns Fastigheter',
      fakturor: filtered.map(f => ({
        fakturanummer: f.fakturanummer,
        kundnummer: f.hyresavtal.hyresgast.id.slice(0, 8).toUpperCase(),
        kundnamn: f.hyresavtal.hyresgast.namn,
        forfallodag: f.forfallodag.split('T')[0],
        period: f.period,
        rader: f.rader.length > 0
          ? f.rader.map(r => ({
              artikelkod: r.artikelkod,
              beskrivning: r.beskrivning,
              antal: r.antal,
              apris: r.apris,
              belopp: r.belopp,
              moms: r.moms,
              konto: r.artikelkod === 'HYR' ? '3010' : '3011',
            }))
          : [{
              artikelkod: 'HYR',
              beskrivning: `Hyra – ${f.hyresavtal.lokaler.map(l => l.lokal.namn).join(', ')} (${f.hyresavtal.lokaler[0]?.lokal.fastighet.namn}) ${f.period}`,
              antal: 1, apris: f.belopp, belopp: f.belopp, moms: 0, konto: '3010',
            }],
        totalbelopp: f.belopp,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `hogia-${filterPeriod || 'export'}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const filtered = fakturor.filter(f => {
    if (filterStatus && f.status !== filterStatus) return false
    if (filterHyresgast && f.hyresavtal.hyresgast.namn !== filterHyresgast) return false
    return true
  })

  const uniqueHyresgaster = [...new Set(fakturor.map(f => f.hyresavtal.hyresgast.namn))].sort()
  const uniquePerioder = [...new Set(fakturor.map(f => f.period))].sort()

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortCol(col); setSortDir(1) }
  }

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = '', bv: string | number = ''
    switch (sortCol) {
      case 'fakturanr': av = a.fakturanummer; bv = b.fakturanummer; break
      case 'hyresgast': av = a.hyresavtal.hyresgast.namn; bv = b.hyresavtal.hyresgast.namn; break
      case 'lokal': av = a.hyresavtal.lokaler[0]?.lokal.namn ?? ''; bv = b.hyresavtal.lokaler[0]?.lokal.namn ?? ''; break
      case 'period': av = a.period; bv = b.period; break
      case 'belopp': av = a.belopp; bv = b.belopp; break
      case 'forfall': av = a.forfallodag; bv = b.forfallodag; break
      case 'status': av = a.status; bv = b.status; break
    }
    return av < bv ? -sortDir : av > bv ? sortDir : 0
  })

  const totalBelopp = filtered.reduce((s, f) => s + f.belopp, 0)
  const obetalda = filtered.filter(f => f.status !== 'betald').reduce((s, f) => s + f.belopp, 0)

  const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.muted, textTransform: 'uppercase' }
  const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: C.text2 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Fakturering</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Generera och hantera hyresavier</p>
        </div>
      </div>

      {/* Generate section */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 20 }}>
        <h3 style={{ fontWeight: 700, color: C.text, margin: 0, marginBottom: 4 }}>Generera fakturor</h3>
        <p style={{ fontSize: 12, color: C.muted2, marginBottom: 16 }}>Kvartalsavtal: välj kvartalets startmånad (Jan/Apr/Jul/Okt) – systemet skapar automatiskt tre fakturor med rätt förfallodatum.</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={lbl}>Månadsfaktura</label>
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} onFocus={fo} onBlur={fb} style={selStyle}>
              {monthlyPeriods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ color: C.muted2, fontSize: 13, paddingBottom: 10 }}>eller</div>
          <div>
            <label style={lbl}>Kvartalsfaktura</label>
            <select value="" onChange={e => { if (e.target.value) setSelectedPeriod(e.target.value) }} onFocus={fo} onBlur={fb} style={selStyle}>
              <option value="">Välj kvartal...</option>
              {kvartalOpts.map(k => <option key={k.period} value={k.period}>{k.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={generate} disabled={generating} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 8, opacity: generating ? 0.5 : 1 }}>
              <span style={{ display: 'inline-block', animation: generating ? 'spin 1s linear infinite' : undefined }}>🔄</span>
              {generating ? 'Genererar...' : `Generera för ${selectedPeriod}`}
            </button>
            {filtered.length > 0 && (
              <button onClick={exportHogia} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⬇️ Exportera Hogia JSON
              </button>
            )}
          </div>
        </div>
        {message && (
          <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: message.type === 'success' ? C.ok : C.blue }}>
            {message.text}
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: 0 }}>{filtered.length}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Fakturor</p>
        </div>
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: 0 }}>{formatSEK(totalBelopp)}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Totalt</p>
        </div>
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: obetalda > 0 ? C.danger : C.ok, margin: 0 }}>{formatSEK(obetalda)}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Obetalt</p>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={filterPeriod} onChange={e => { setFilterPeriod(e.target.value); load(e.target.value || undefined) }} onFocus={fo} onBlur={fb} style={selStyle}>
          <option value="">Alla perioder</option>
          {uniquePerioder.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterHyresgast} onChange={e => setFilterHyresgast(e.target.value)} onFocus={fo} onBlur={fb} style={selStyle}>
          <option value="">Alla hyresgäster</option>
          {uniqueHyresgaster.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} onFocus={fo} onBlur={fb} style={selStyle}>
          <option value="">Alla statusar</option>
          <option value="ej_skickad">Ej skickad</option>
          <option value="skickad">Skickad</option>
          <option value="betald">Betald</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : (
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2 }}>
                  <th style={{ ...th, width: 32, padding: '12px 8px' }}></th>
                  {([
                    { key: 'fakturanr', label: 'Fakturanr' },
                    { key: 'hyresgast', label: 'Hyresgäst' },
                    { key: 'lokal', label: 'Lokal' },
                    { key: 'period', label: 'Period' },
                    { key: 'belopp', label: 'Belopp' },
                    { key: 'forfall', label: 'Förfallodatum' },
                    { key: 'status', label: 'Status' },
                    { key: '', label: 'Åtgärd' },
                  ] as const).map(h => (
                    <th key={h.label} onClick={() => h.key && toggleSort(h.key)} style={{ ...th, cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                      {h.label}{sortCol === h.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>
                    Inga fakturor för vald period. Generera fakturor ovan.
                  </td></tr>
                ) : sorted.map((f) => {
                  const sc = statusConfig[f.status] || statusConfig.ej_skickad
                  const expanded = expandedRows.has(f.id)
                  const hasRader = f.rader && f.rader.length > 0
                  return (
                    <React.Fragment key={f.id}>
                      <tr
                        style={{ borderTop: `1px solid ${C.borderSoft}`, cursor: 'pointer' }}
                        onClick={() => setPreviewFaktura(f)}
                        onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ ...td, padding: '12px 8px' }}>
                          {hasRader && (
                            <button onClick={(e) => { e.stopPropagation(); toggleRow(f.id) }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 12 }}>
                              {expanded ? '▾' : '▸'}
                            </button>
                          )}
                        </td>
                        <td style={{ ...td, fontFamily: 'monospace', color: C.text }}>{f.fakturanummer}</td>
                        <td style={{ ...td, fontWeight: 600, color: C.text }}>{f.hyresavtal.hyresgast.namn}</td>
                        <td style={td}>
                          <div>{f.hyresavtal.lokaler.map(l => l.lokal.namn).join(', ')}</div>
                          <div style={{ fontSize: 11, color: C.muted2 }}>{f.hyresavtal.lokaler[0]?.lokal.fastighet.namn}</div>
                        </td>
                        <td style={td}>
                          <div>{f.period}</div>
                          {f.hyresavtal.faktureringsfrekvens === 'kvartalsvis' && (
                            <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', borderRadius: 4, padding: '1px 5px' }}>Kvartal</span>
                          )}
                        </td>
                        <td style={{ ...td, fontWeight: 700, color: C.text }}>{formatSEK(f.belopp)}</td>
                        <td style={td}>{formatDate(f.forfallodag)}</td>
                        <td style={td}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {f.status === 'ej_skickad' && (
                              <button onClick={(e) => { e.stopPropagation(); updateStatus(f.id, 'skickad') }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(96,165,250,0.12)', color: C.blue, border: 'none', cursor: 'pointer' }}>Markera skickad</button>
                            )}
                            {f.status === 'skickad' && (
                              <button onClick={(e) => { e.stopPropagation(); updateStatus(f.id, 'betald') }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(74,222,128,0.12)', color: C.ok, border: 'none', cursor: 'pointer' }}>Markera betald</button>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); deleteFaktura(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(248,113,113,0.1)', color: C.danger, border: 'none', cursor: 'pointer' }}>Ta bort</button>
                          </div>
                        </td>
                      </tr>
                      {expanded && hasRader && (
                        <tr style={{ background: C.panel2 }}>
                          <td colSpan={9} style={{ padding: '12px 32px' }}>
                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ color: C.muted2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Artikel</th>
                                  <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Beskrivning</th>
                                  <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 600 }}>Antal</th>
                                  <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 600 }}>À-pris</th>
                                  <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 600 }}>Belopp</th>
                                  <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 600 }}>Moms</th>
                                </tr>
                              </thead>
                              <tbody>
                                {f.rader.map(r => (
                                  <tr key={r.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                                    <td style={{ padding: '4px 0', fontFamily: 'monospace', color: C.muted }}>{r.artikelkod}</td>
                                    <td style={{ padding: '4px 0', color: C.text2 }}>{r.beskrivning}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', color: C.muted }}>{r.antal}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', color: C.muted }}>{formatSEK(r.apris)}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, color: C.text }}>{formatSEK(r.belopp)}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', color: C.muted2 }}>{r.moms}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Förhandsgranskning — fakturavy */}
      <SlideOver
        open={!!previewFaktura}
        onClose={() => setPreviewFaktura(null)}
        title={previewFaktura ? `Faktura ${previewFaktura.fakturanummer}` : 'Faktura'}
        width="lg"
        footer={previewFaktura ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`/api/fastigheter/fakturor/${previewFaktura.id}/print`} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Skriv ut</a>
            {previewFaktura.status === 'ej_skickad' && <button onClick={() => { updateStatus(previewFaktura.id, 'skickad'); setPreviewFaktura(null) }} style={{ ...btnPrimary, flex: 1 }}>Markera skickad</button>}
            {previewFaktura.status === 'skickad' && <button onClick={() => { updateStatus(previewFaktura.id, 'betald'); setPreviewFaktura(null) }} style={{ ...btnPrimary, flex: 1, background: C.ok }}>Markera betald</button>}
            <button onClick={() => { deleteFaktura(previewFaktura.id); setPreviewFaktura(null) }} style={btnDanger}>Ta bort</button>
          </div>
        ) : undefined}
      >
        {previewFaktura && (() => {
          const f = previewFaktura
          const hg = f.hyresavtal.hyresgast
          const lokal = f.hyresavtal.lokaler[0]?.lokal
          const subtotal = f.rader.reduce((s, r) => s + r.belopp, 0)
          const momsBelopp = f.rader.reduce((s, r) => s + r.belopp * (r.moms / 100), 0)
          const totalInkl = subtotal + momsBelopp
          const r2 = (n: number) => Math.round(n * 100) / 100

          return (
            <div>
              {/* Fakturahuvud */}
              <div style={{ padding: '24px 32px', borderBottom: `1px solid ${C.borderSoft}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0, letterSpacing: 1 }}>FAKTURA</h2>
                    <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{f.fakturanummer}</p>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <p style={{ fontWeight: 700, color: C.gold, margin: 0 }}>{lokal?.fastighet.namn}</p>
                  </div>
                </div>
              </div>

              <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Mottagare + fakturadata */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Faktureras</p>
                    <p style={{ fontWeight: 600, color: C.text, margin: 0 }}>{hg.namn}</p>
                    {hg.personnummer && <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{hg.personnummer}</p>}
                  </div>
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Fakturadatum</span><span style={{ color: C.text2 }}>{new Date().toLocaleDateString('sv-SE')}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Förfallodatum</span><span style={{ fontWeight: 600, color: C.text }}>{formatDate(f.forfallodag)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Period</span><span style={{ color: C.text2 }}>{f.period}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Lokal</span><span style={{ color: C.text2 }}>{f.hyresavtal.lokaler.map(l => l.lokal.namn).join(', ')}</span></div>
                  </div>
                </div>

                {/* Fakturarader */}
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.borderStrong}` }}>
                      <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: C.text2 }}>Beskrivning</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: C.text2, width: 64 }}>Antal</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: C.text2, width: 96 }}>À-pris</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: C.text2, width: 40 }}>Moms</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: C.text2, width: 112 }}>Belopp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.rader.filter(r => r.artikelkod !== 'ORE' || r.belopp !== 0).map(r => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                        <td style={{ padding: '10px 0', color: C.text }}>{r.beskrivning}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: C.muted }}>{r.antal}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: C.muted }}>{formatSEK(r.apris)}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: C.muted2, fontSize: 12 }}>{r.moms > 0 ? `${r.moms}%` : '—'}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: C.text }}>{formatSEK(r.belopp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summering */}
                <div style={{ borderTop: `2px solid ${C.borderStrong}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.muted }}>Summa exkl. moms</span>
                    <span style={{ fontWeight: 600, color: C.text2 }}>{formatSEK(r2(subtotal))}</span>
                  </div>
                  {momsBelopp > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: C.muted }}>Moms 25%</span>
                      <span style={{ fontWeight: 600, color: C.text2 }}>{formatSEK(r2(momsBelopp))}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8, color: C.text }}>
                    <span>Att betala</span>
                    <span style={{ color: C.gold }}>{formatSEK(r2(totalInkl))}</span>
                  </div>
                </div>

                {/* Betalningsinfo */}
                <div style={{ borderRadius: 8, background: C.field, border: `1px solid ${C.border}`, padding: '12px 16px', fontSize: 13 }}>
                  <p style={{ fontWeight: 600, color: C.text2, marginBottom: 4 }}>Betalningsinformation</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px', color: C.muted }}>
                    <span>Förfallodatum:</span><span style={{ fontWeight: 600, color: C.text2 }}>{formatDate(f.forfallodag)}</span>
                    <span>Fakturanummer:</span><span style={{ fontFamily: 'monospace', color: C.text2 }}>{f.fakturanummer}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </SlideOver>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
