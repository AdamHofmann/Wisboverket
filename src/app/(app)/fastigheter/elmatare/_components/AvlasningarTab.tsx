import React from 'react'
import { C, btnPrimary, btnGhost } from '@/components/fastigheter/styles'
import { useConfirm } from '@/components/ConfirmDialog'
import Sokfalt from '@/components/Sokfalt'
import {
  Matare, Fastighet, MatareForm, Sort,
  formatDate, fmtKwh, card, cardHead, th, td, iconBtn,
} from './shared'

interface Props {
  isMobile: boolean
  matare: Matare[]
  fastigheter: Fastighet[]
  sok: string
  setSok: (v: string) => void
  avlSort: Sort
  toggleAvlSort: (key: string) => void
  expanded: Set<string>
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>
  bolagMatch: (fastighetId: string | null | undefined) => boolean
  getHyresgast: (m: Matare) => string
  getLokalNamn: (m: Matare) => string
  getSenaste: (m: Matare) => { id: string; datum: string; varde: number; avlast_av: string | null } | null
  getForeg: (m: Matare) => { id: string; datum: string; varde: number; avlast_av: string | null } | null
  confirm: ReturnType<typeof useConfirm>
  load: () => void
  setMatareForm: (f: MatareForm) => void
  setShowNewMatare: (v: boolean) => void
  setShowNewAvl: (v: boolean) => void
  setAvlHyresgast: (v: string) => void
  setAvlValues: (v: Record<string, string>) => void
  setAvlPrev: (v: Record<string, string>) => void
  setAvlDatum: (v: string) => void
  setAvlPrevDatum: (v: string) => void
  setAvlAvlastAv: (v: string) => void
}

export default function AvlasningarTab({
  isMobile, matare, fastigheter, sok, setSok, avlSort, toggleAvlSort, expanded, setExpanded,
  bolagMatch, getHyresgast, getLokalNamn, getSenaste, getForeg, confirm, load,
  setMatareForm, setShowNewMatare, setShowNewAvl, setAvlHyresgast, setAvlValues, setAvlPrev,
  setAvlDatum, setAvlPrevDatum, setAvlAvlastAv,
}: Props) {
  const sokQ = sok.trim().toLowerCase()
  // Filtrera på bolag (via fastighet) + fritext (mätpunkt, hyresgäst, fastighet, mätarnr)
  const synligaMatare = matare
    .filter(m => bolagMatch(m.fastighet_id))
    .filter(m => {
      if (!sokQ) return true
      return [getHyresgast(m), getLokalNamn(m), m.beskrivning, m.matarnummer, m.fastighet?.namn]
        .some(v => (v || '').toLowerCase().includes(sokQ))
    })
  const grouped: Record<string, { namn: string; matare: Matare[] }> = {}
  synligaMatare.forEach(m => {
    const namn = getHyresgast(m)
    if (!grouped[namn]) grouped[namn] = { namn, matare: [] }
    grouped[namn].matare.push(m)
  })
  const hyresgastLista = Object.values(grouped).sort((a, b) => a.namn.localeCompare(b.namn))

  // Sorteringsnyckel för en mätarrad
  const avlSortVal = (m: Matare, key: string): string | number => {
    const s = getSenaste(m), f = getForeg(m)
    switch (key) {
      case 'matpunkt': return (m.beskrivning || getLokalNamn(m) || 'Huvudmätare').toLowerCase()
      case 'senaste': return s ? new Date(s.datum).getTime() : -1
      case 'varde': return s ? s.varde : -Infinity
      case 'forbrukning': return s && f ? s.varde - f.varde : -Infinity
      default: return 0
    }
  }
  const sorteradeMatare = (rader: Matare[]) => [...rader].sort((a, b) => {
    const va = avlSortVal(a, avlSort.key), vb = avlSortVal(b, avlSort.key)
    const c = va < vb ? -1 : va > vb ? 1 : 0
    return avlSort.dir === 'asc' ? c : -c
  })
  const AVL_COLS: { label: string; key: string | null }[] = [
    { label: 'Mätpunkt', key: 'matpunkt' }, { label: 'Senaste avläsning', key: 'senaste' },
    { label: 'Mätarvärde', key: 'varde' }, { label: 'Förbrukning', key: 'forbrukning' }, { label: '', key: null },
  ]

  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
      <Sokfalt value={sok} onChange={setSok} placeholder="Sök mätpunkt, hyresgäst, fastighet..." style={{ width: isMobile ? '100%' : 280 }} />
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, ...(isMobile ? { flexDirection: 'column' } : {}) }}>
      <button
        onClick={() => { setMatareForm({ matarnummer: '', fastighetId: fastigheter[0]?.id || '', lokalId: '', beskrivning: '', schablonKwh: '' }); setShowNewMatare(true) }}
        style={{ ...btnGhost, ...(isMobile ? { width: '100%' } : {}) }}
      >
        + Ny mätpunkt
      </button>
      <button
        onClick={() => { setShowNewAvl(true); setAvlHyresgast(''); setAvlValues({}); setAvlPrev({}); setAvlDatum(new Date().toISOString().split('T')[0]); const pd = new Date(); pd.setMonth(pd.getMonth() - 1); setAvlPrevDatum(pd.toISOString().split('T')[0]); setAvlAvlastAv('') }}
        style={{ ...btnPrimary, opacity: matare.length === 0 ? 0.5 : 1, ...(isMobile ? { width: '100%' } : {}) }}
        disabled={matare.length === 0}
      >
        ⚡ Ny avläsning
      </button>
    </div>

    {matare.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '64px 0', ...card }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
        <p style={{ color: C.muted, margin: 0 }}>Inga mätare registrerade</p>
        <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Registrera en mätpunkt via en hyresgäst för att komma igång</p>
      </div>
    ) : hyresgastLista.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '48px 0', ...card }}>
        <p style={{ color: C.muted2, margin: 0, fontSize: 13 }}>Inga mätpunkter matchar filtret</p>
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {hyresgastLista.map(g => (
          <div key={g.namn} style={card}>
            <div style={{ ...cardHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ color: C.gold }}>⚡</span>
                <h3 style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0 }}>{g.namn}</h3>
                <span style={{ fontSize: 12, color: C.muted2 }}>{g.matare[0].fastighet.namn}</span>
              </div>
              <button onClick={() => {
                const m = g.matare[0]
                setMatareForm({ matarnummer: '', fastighetId: m.fastighet_id, lokalId: m.lokal_id || '', beskrivning: '', schablonKwh: '' })
                setShowNewMatare(true)
              }} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>+ Ny mätpunkt</button>
            </div>
            {isMobile ? (
              // MOBIL: kortlayout per mätpunkt (ingen horisontell scroll)
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {sorteradeMatare(g.matare).map(m => {
                  const s = getSenaste(m), f = getForeg(m)
                  const diff = s && f ? s.varde - f.varde : null
                  const days = s ? Math.round((Date.now() - new Date(s.datum).getTime()) / 864e5) : null
                  const historik = m.avlasningar || []
                  const oppen = expanded.has(m.id)
                  const kanExpandera = historik.length > 0
                  return (
                    <div key={m.id} style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div
                          onClick={() => kanExpandera && setExpanded(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })}
                          style={{ flex: 1, cursor: kanExpandera ? 'pointer' : 'default' }}
                        >
                          <p style={{ color: C.text, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {kanExpandera && <span style={{ fontSize: 9, color: C.muted2, transform: oppen ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s', display: 'inline-block' }}>▶</span>}
                            {m.beskrivning || getLokalNamn(m) || 'Huvudmätare'}
                            {kanExpandera && <span style={{ fontSize: 11, fontWeight: 500, color: C.muted2 }}>({historik.length} avläsn.)</span>}
                          </p>
                          {m.schablon_kwh ? <p style={{ fontSize: 11, color: C.blue, margin: '2px 0 0' }}>Schablon {m.schablon_kwh} kWh/mån</p> : null}
                        </div>
                        <button onClick={async e => { e.stopPropagation(); if (await confirm({ message: 'Ta bort mätpunkt?', danger: true, confirmLabel: 'Ta bort' })) { await fetch(`/api/fastigheter/elmatare/${m.id}`, { method: 'DELETE' }); load() } }} style={iconBtn}>🗑️</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 10, fontSize: 12 }}>
                        <div>
                          <span style={{ color: C.muted2 }}>Senaste: </span>
                          {s ? <span style={{ color: C.text2 }}>{formatDate(s.datum)} <span style={{ fontWeight: 600, color: days! > 90 ? C.danger : days! > 30 ? C.warn : C.ok }}>({days}d)</span></span> : <span style={{ color: C.muted2 }}>—</span>}
                        </div>
                        <div>
                          <span style={{ color: C.muted2 }}>Mätarvärde: </span>
                          <span style={{ fontFamily: 'monospace', color: C.text }}>{s ? s.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) : '—'}</span>
                        </div>
                        <div>
                          <span style={{ color: C.muted2 }}>Förbrukning: </span>
                          {diff != null ? <span style={{ fontWeight: 600, color: C.gold }}>{fmtKwh(diff)}</span> : <span style={{ color: C.muted2 }}>—</span>}
                        </div>
                      </div>
                      {oppen && kanExpandera && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {historik.map((a, i) => {
                            const foreg = historik[i + 1]
                            const forb = foreg ? a.varde - foreg.varde : null
                            return (
                              <div key={a.id} style={{ borderRadius: 8, background: C.panel2, padding: 10, fontSize: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                  <span style={{ color: C.text2 }}>{formatDate(a.datum)}</span>
                                  <span style={{ fontFamily: 'monospace', color: C.text }}>{a.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, color: C.muted2 }}>
                                  <span>Avläst av: {a.avlast_av || '—'}</span>
                                  <span style={{ color: forb != null ? C.gold : C.muted2, fontWeight: forb != null ? 600 : 400 }}>{forb != null ? fmtKwh(forb) : '—'}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col />
                <col style={{ width: 190 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 150 }} />
                <col style={{ width: 56 }} />
              </colgroup>
              <thead>
                <tr>
                  {AVL_COLS.map((c, i) => {
                    const aktiv = c.key && avlSort.key === c.key
                    return (
                      <th key={i} onClick={() => c.key && toggleAvlSort(c.key)}
                        style={{ ...th, cursor: c.key ? 'pointer' : 'default', color: aktiv ? C.gold : th.color, userSelect: 'none', whiteSpace: 'nowrap' }}>
                        {c.label}{aktiv ? (avlSort.dir === 'asc' ? ' ▲' : ' ▼') : c.key ? <span style={{ opacity: 0.25 }}> ⇅</span> : ''}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sorteradeMatare(g.matare).map(m => {
                  const s = getSenaste(m), f = getForeg(m)
                  const diff = s && f ? s.varde - f.varde : null
                  const days = s ? Math.round((Date.now() - new Date(s.datum).getTime()) / 864e5) : null
                  const historik = m.avlasningar || []
                  const oppen = expanded.has(m.id)
                  const kanExpandera = historik.length > 0
                  return (
                    <React.Fragment key={m.id}>
                    <tr
                      onClick={() => kanExpandera && setExpanded(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })}
                      style={{ cursor: kanExpandera ? 'pointer' : 'default' }}
                      onMouseEnter={e => { if (kanExpandera) e.currentTarget.style.background = C.panel2 }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={td}>
                        <p style={{ color: C.text, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {kanExpandera && <span style={{ fontSize: 9, color: C.muted2, transform: oppen ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s', display: 'inline-block' }}>▶</span>}
                          {m.beskrivning || getLokalNamn(m) || 'Huvudmätare'}
                          {kanExpandera && <span style={{ fontSize: 11, fontWeight: 500, color: C.muted2 }}>({historik.length} avläsn.)</span>}
                        </p>
                        {m.schablon_kwh ? <p style={{ fontSize: 11, color: C.blue, margin: 0 }}>Schablon {m.schablon_kwh} kWh/mån</p> : null}
                      </td>
                      <td style={td}>
                        {s ? <span>{formatDate(s.datum)} <span style={{ fontSize: 11, fontWeight: 600, color: days! > 90 ? C.danger : days! > 30 ? C.warn : C.ok }}>({days}d)</span></span>
                          : <span style={{ color: C.muted2 }}>—</span>}
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace', color: C.text }}>{s ? s.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) : '—'}</td>
                      <td style={td}>{diff != null ? <span style={{ fontWeight: 600, color: C.gold }}>{fmtKwh(diff)}</span> : '—'}</td>
                      <td style={td}>
                        <button onClick={async e => { e.stopPropagation(); if (await confirm({ message: 'Ta bort mätpunkt?', danger: true, confirmLabel: 'Ta bort' })) { await fetch(`/api/fastigheter/elmatare/${m.id}`, { method: 'DELETE' }); load() } }} style={iconBtn}>🗑️</button>
                      </td>
                    </tr>
                    {oppen && (
                      <tr>
                        <td colSpan={5} style={{ padding: 0, background: C.panel2, borderTop: `1px solid ${C.borderSoft}` }}>
                          <div style={{ padding: '10px 16px 14px 34px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: 8, padding: '4px 0', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.muted2, textTransform: 'uppercase', borderBottom: `1px solid ${C.borderSoft}` }}>
                              <div>Datum</div><div>Mätarvärde</div><div>Förbrukning</div><div>Avläst av</div>
                            </div>
                            {historik.map((a, i) => {
                              const foreg = historik[i + 1]
                              const forb = foreg ? a.varde - foreg.varde : null
                              return (
                                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: 8, padding: '6px 0', fontSize: 12, color: C.text2, borderBottom: `1px solid ${C.borderSoft}` }}>
                                  <div>{formatDate(a.datum)}</div>
                                  <div style={{ fontFamily: 'monospace', color: C.text }}>{a.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 })}</div>
                                  <div style={{ color: forb != null ? C.gold : C.muted2, fontWeight: forb != null ? 600 : 400 }}>{forb != null ? fmtKwh(forb) : '—'}</div>
                                  <div style={{ color: C.muted }}>{a.avlast_av || '—'}</div>
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
  )
}
