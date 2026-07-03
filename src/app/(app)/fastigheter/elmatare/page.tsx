'use client'

// Migrerad från: src/app/elmatare/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold-styles + emoji-ikoner, @/components/fastigheter-tokens,
// data via de migrerade route-handlers under /api/fastigheter/*.
//
// VIKTIGT om fältnamn: Supabase returnerar snake_case-kolumner. Käll-appens UI använde
// camelCase. Render-koden här är anpassad till snake_case:
//   f_elmatare:               schablon_kwh, fastighet_id, lokal_id
//   f_elavlasning:            avlast_av
//   f_el_leverantorsfaktura:  period_fran, period_till, total_kwh, total_belopp, pris_per_kwh
//   f_eldebitering:           hyresgast_namn, forbrukning, pris_per_kwh, belopp, status
// Formulär POSTar fortfarande camelCase → routes läser både camel/snake (pick).
// Fastigheter hämtas från /api/fastigheter/objekt (namnbytt från källans /api/fastigheter),
// lokaler från /api/fastigheter/lokaler (nested junction "hyresavtal" behålls).

import { useEffect, useState } from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'

interface Avlasning { id: string; datum: string; varde: number; avlast_av: string | null }
interface Matare {
  id: string; matarnummer: string; beskrivning: string | null; schablon_kwh: number | null
  fastighet_id: string; lokal_id: string | null; aktiv: boolean
  fastighet: { id: string; namn: string }
  avlasningar: Avlasning[]
  _count: { avlasningar: number }
}
interface Debitering {
  id: string; hyresgast_namn: string; forbrukning: number | null; pris_per_kwh: number; belopp: number; status: string
}
interface LevFaktura {
  id: string; fastighet_id: string; period_fran: string; period_till: string
  total_kwh: number | null; total_belopp: number; pris_per_kwh: number | null
  fakturanummer: string | null; status: string
  fastighet: { id: string; namn: string }
  debiteringar: Debitering[]
}
interface Fastighet { id: string; namn: string }
interface Lokal {
  id: string; namn: string; fastighet_id: string
  hyresavtal?: { hyresavtal: { hyresgast: { namn: string } } }[]
}

type Tab = 'avlasningar' | 'leverantor' | 'debitering' | 'analys'

const formatSEK = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr'
const formatDate = (d: string) => new Date(d).toLocaleDateString('sv-SE')
const fmtKwh = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' kWh'

// ---- Lokala stilhjälpare (bygger på styles.ts-tokens) ----------------------
const card: React.CSSProperties = { borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '12px 16px', background: C.panel2, borderBottom: `1px solid ${C.borderSoft}` }
const th: React.CSSProperties = { padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.muted2, textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '10px 16px', fontSize: 13, color: C.text2, borderTop: `1px solid ${C.borderSoft}` }
const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600, background: bg, color })
const btnSmall: React.CSSProperties = { ...btnPrimary, padding: '4px 10px', fontSize: 12 }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 13, padding: 4, borderRadius: 6 }

export default function ElMatarePage() {
  const [tab, setTab] = useState<Tab>('avlasningar')
  const [matare, setMatare] = useState<Matare[]>([])
  const [levFakturor, setLevFakturor] = useState<LevFaktura[]>([])
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [lokaler, setLokaler] = useState<Lokal[]>([])
  const [loading, setLoading] = useState(true)

  const [showNewMatare, setShowNewMatare] = useState(false)
  const [showNewAvl, setShowNewAvl] = useState(false)
  const [showNewLev, setShowNewLev] = useState(false)
  const [matareForm, setMatareForm] = useState({ matarnummer: '', fastighetId: '', lokalId: '', beskrivning: '', schablonKwh: '' })
  const [avlHyresgast, setAvlHyresgast] = useState('')
  const [avlValues, setAvlValues] = useState<Record<string, string>>({})
  const [avlPrev, setAvlPrev] = useState<Record<string, string>>({})
  const [avlDatum, setAvlDatum] = useState(new Date().toISOString().split('T')[0])
  const [avlAvlastAv, setAvlAvlastAv] = useState('')
  const [levForm, setLevForm] = useState({ fastighetId: '', periodFran: '', periodTill: '', totalKwh: '', totalBelopp: '', fakturanummer: '' })
  const [saving, setSaving] = useState(false)
  const [skannar, setSkannar] = useState(false)

  const load = () => {
    Promise.all([
      fetch('/api/fastigheter/elmatare').then(r => r.json()),
      fetch('/api/fastigheter/el-leverantor').then(r => r.json()),
      fetch('/api/fastigheter/objekt').then(r => r.json()),
      fetch('/api/fastigheter/lokaler').then(r => r.json()),
    ]).then(([m, l, f, lok]) => {
      if (Array.isArray(m)) setMatare(m)
      if (Array.isArray(l)) setLevFakturor(l)
      if (Array.isArray(f)) setFastigheter(f)
      if (Array.isArray(lok)) setLokaler(lok)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const getHyresgast = (m: Matare) => {
    if (m.lokal_id) {
      const lokal = lokaler.find(l => l.id === m.lokal_id)
      if (lokal?.hyresavtal?.[0]) return lokal.hyresavtal[0].hyresavtal.hyresgast.namn
      if (lokal) return lokal.namn
    }
    return m.beskrivning || m.matarnummer
  }

  const getLokalNamn = (m: Matare) => {
    if (m.lokal_id) {
      const lokal = lokaler.find(l => l.id === m.lokal_id)
      return lokal?.namn || ''
    }
    return m.beskrivning || ''
  }

  const getSenaste = (m: Matare) => m.avlasningar?.[0] || null
  const getForeg = (m: Matare) => m.avlasningar?.[1] || null

  const saveMatare = async () => { setSaving(true); await fetch('/api/fastigheter/elmatare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(matareForm) }); setSaving(false); setShowNewMatare(false); load() }
  const saveAvl = async () => {
    setSaving(true)
    const entries = Object.entries(avlValues).filter(([, v]) => v)
    for (const [matareId, varde] of entries) {
      await fetch(`/api/fastigheter/elmatare/${matareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ varde, datum: avlDatum, avlastAv: avlAvlastAv }),
      })
    }
    setSaving(false); setShowNewAvl(false); setAvlValues({}); load()
  }
  const saveLev = async () => { setSaving(true); await fetch('/api/fastigheter/el-leverantor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(levForm) }); setSaving(false); setShowNewLev(false); load() }
  const beraknaDebitering = async (id: string) => { await fetch(`/api/fastigheter/el-leverantor/${id}`, { method: 'POST' }); load() }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'avlasningar', label: 'Mätaravläsningar' },
    { id: 'leverantor', label: 'Leverantörsfaktura' },
    { id: 'debitering', label: 'Hyresgästdebitering' },
    { id: 'analys', label: 'Analys' },
  ]

  const hyresgasterMedMatareSet = new Set(matare.map(m => getHyresgast(m)))
  const hyresgasterUtanMatare = lokaler
    .filter(l => l.hyresavtal?.some(() => true))
    .map(l => l.hyresavtal?.[0]?.hyresavtal?.hyresgast?.namn)
    .filter((n): n is string => !!n && !hyresgasterMedMatareSet.has(n))
    .filter((n, i, arr) => arr.indexOf(n) === i)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>⚡ Elförbrukning &amp; Fakturering</h2>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, gap: 4 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: '2px solid', marginBottom: -1,
              borderColor: tab === t.id ? C.gold : 'transparent',
              color: tab === t.id ? C.gold : C.muted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div> : <>

      {/* MÄTARAVLÄSNINGAR */}
      {tab === 'avlasningar' && (() => {
        const grouped: Record<string, { namn: string; matare: Matare[] }> = {}
        matare.forEach(m => {
          const namn = getHyresgast(m)
          if (!grouped[namn]) grouped[namn] = { namn, matare: [] }
          grouped[namn].matare.push(m)
        })
        const hyresgastLista = Object.values(grouped).sort((a, b) => a.namn.localeCompare(b.namn))

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={() => { setShowNewAvl(true); setAvlHyresgast(''); setAvlValues({}); setAvlPrev({}); setAvlDatum(new Date().toISOString().split('T')[0]); setAvlAvlastAv('') }}
              style={{ ...btnPrimary, opacity: matare.length === 0 ? 0.5 : 1 }}
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hyresgastLista.map(g => (
                <div key={g.namn} style={card}>
                  <div style={{ ...cardHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: C.gold }}>⚡</span>
                      <h3 style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0 }}>{g.namn}</h3>
                      <span style={{ fontSize: 12, color: C.muted2 }}>{g.matare[0].fastighet.namn}</span>
                    </div>
                    <button onClick={() => {
                      const m = g.matare[0]
                      setMatareForm({ matarnummer: '', fastighetId: m.fastighet_id, lokalId: m.lokal_id || '', beskrivning: '', schablonKwh: '' })
                      setShowNewMatare(true)
                    }} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Ny mätpunkt</button>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Mätpunkt', 'Senaste avläsning', 'Mätarvärde', 'Förbrukning', ''].map((h, i) => (
                          <th key={i} style={th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {g.matare.map(m => {
                        const s = getSenaste(m), f = getForeg(m)
                        const diff = s && f ? s.varde - f.varde : null
                        const days = s ? Math.round((Date.now() - new Date(s.datum).getTime()) / 864e5) : null
                        return (
                          <tr key={m.id}>
                            <td style={td}>
                              <p style={{ color: C.text, fontWeight: 600, margin: 0 }}>{m.beskrivning || getLokalNamn(m) || 'Huvudmätare'}</p>
                              {m.schablon_kwh ? <p style={{ fontSize: 11, color: C.blue, margin: 0 }}>Schablon {m.schablon_kwh} kWh/mån</p> : null}
                            </td>
                            <td style={td}>
                              {s ? <span>{formatDate(s.datum)} <span style={{ fontSize: 11, fontWeight: 600, color: days! > 90 ? C.danger : days! > 30 ? C.warn : C.ok }}>({days}d)</span></span>
                                : <span style={{ color: C.muted2 }}>—</span>}
                            </td>
                            <td style={{ ...td, fontFamily: 'monospace', color: C.text }}>{s ? s.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) : '—'}</td>
                            <td style={td}>{diff != null ? <span style={{ fontWeight: 600, color: C.gold }}>{fmtKwh(diff)}</span> : '—'}</td>
                            <td style={td}>
                              <button onClick={async () => { if (confirm('Ta bort mätpunkt?')) { await fetch(`/api/fastigheter/elmatare/${m.id}`, { method: 'DELETE' }); load() } }} style={iconBtn}>🗑️</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
        )
      })()}

      {/* LEVERANTÖRSFAKTURA */}
      {tab === 'leverantor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowNewLev(true); setLevForm({ fastighetId: fastigheter[0]?.id || '', periodFran: '', periodTill: '', totalKwh: '', totalBelopp: '', fakturanummer: '' }) }} style={btnPrimary}>
              + Ny faktura
            </button>
          </div>
          <div style={card}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.panel2 }}>
                  {['Fastighet', 'Period', 'Tot. kWh', 'Belopp exkl.', 'Pris/kWh', 'Status', ''].map((h, i) => (
                    <th key={i} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {levFakturor.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: C.muted2 }}>Inga leverantörsfakturor</td></tr>
                ) : levFakturor.map(f => (
                  <tr key={f.id}>
                    <td style={{ ...td, fontWeight: 600, color: C.text }}>{f.fastighet.namn}</td>
                    <td style={td}>{formatDate(f.period_fran)} – {formatDate(f.period_till)}{f.fakturanummer ? <span style={{ fontSize: 11, color: C.muted2, marginLeft: 4 }}>({f.fakturanummer})</span> : ''}</td>
                    <td style={td}>{f.total_kwh ? f.total_kwh.toLocaleString('sv-SE') : '—'}</td>
                    <td style={{ ...td, fontWeight: 600, color: C.text }}>{formatSEK(f.total_belopp)}</td>
                    <td style={td}>{f.pris_per_kwh ? f.pris_per_kwh.toFixed(4) + ' kr' : '—'}</td>
                    <td style={td}>
                      {f.debiteringar.length > 0
                        ? <span style={pill('rgba(74,222,128,0.12)', C.ok)}>Debitering klar</span>
                        : <span style={pill('rgba(251,146,60,0.12)', C.warn)}>Ej debiterad</span>}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {f.debiteringar.length === 0 && <button onClick={() => beraknaDebitering(f.id)} style={btnSmall}>Beräkna</button>}
                        <button onClick={async () => { if (confirm('Ta bort?')) { await fetch(`/api/fastigheter/el-leverantor/${f.id}`, { method: 'DELETE' }); load() } }} style={iconBtn}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEBITERING */}
      {tab === 'debitering' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {levFakturor.filter(f => f.debiteringar.length > 0).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', ...card }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
              <p style={{ color: C.muted, margin: 0 }}>Inga debiteringsunderlag</p>
              <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Registrera en leverantörsfaktura och klicka &quot;Beräkna&quot;.</p>
            </div>
          ) : levFakturor.filter(f => f.debiteringar.length > 0).map(f => (
            <div key={f.id} style={card}>
              <div style={{ ...cardHead, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0 }}>{f.fastighet.namn} — {formatDate(f.period_fran)} – {formatDate(f.period_till)}</h3>
                  <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Pris/kWh: {f.pris_per_kwh?.toFixed(4)} kr · Leverantörskostnad: {formatSEK(f.total_belopp)}</p>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Hyresgäst', 'Förbrukning', 'Pris/kWh', 'Att debitera', 'Status'].map((h, i) => (
                      <th key={i} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {f.debiteringar.map(d => (
                    <tr key={d.id}>
                      <td style={{ ...td, fontWeight: 600, color: C.text }}>{d.hyresgast_namn}</td>
                      <td style={td}>{d.forbrukning != null ? fmtKwh(d.forbrukning) : <span style={{ fontSize: 11, color: C.warn }}>Avläsning saknas</span>}</td>
                      <td style={td}>{d.pris_per_kwh.toFixed(4)} kr</td>
                      <td style={{ ...td, fontWeight: 700, color: C.text }}>{formatSEK(d.belopp)}</td>
                      <td style={td}>
                        {d.status === 'fakturerad'
                          ? <span style={pill('rgba(74,222,128,0.12)', C.ok)}>Fakturerad</span>
                          : <span style={pill('rgba(251,146,60,0.12)', C.warn)}>Ej fakturerad</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#000' }}>
                    <td style={{ ...td, fontWeight: 700, color: C.text, borderTop: `1px solid ${C.border}` }}>Totalt utdebiterat</td>
                    <td style={{ ...td, color: C.text2, borderTop: `1px solid ${C.border}` }}>{fmtKwh(f.debiteringar.reduce((s, d) => s + (d.forbrukning ?? 0), 0))}</td>
                    <td style={{ ...td, borderTop: `1px solid ${C.border}` }}></td>
                    <td style={{ ...td, fontWeight: 700, color: C.gold, borderTop: `1px solid ${C.border}` }}>{formatSEK(f.debiteringar.reduce((s, d) => s + d.belopp, 0))}</td>
                    <td style={{ ...td, borderTop: `1px solid ${C.border}` }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ANALYS */}
      {tab === 'analys' && (() => {
        const perHyresgast: Record<string, { namn: string; totalKwh: number; totalDebiterat: number; perioder: number }> = {}
        levFakturor.forEach(f => {
          f.debiteringar.forEach(d => {
            if (!perHyresgast[d.hyresgast_namn]) perHyresgast[d.hyresgast_namn] = { namn: d.hyresgast_namn, totalKwh: 0, totalDebiterat: 0, perioder: 0 }
            perHyresgast[d.hyresgast_namn].totalKwh += d.forbrukning ?? 0
            perHyresgast[d.hyresgast_namn].totalDebiterat += d.belopp
            perHyresgast[d.hyresgast_namn].perioder++
          })
        })
        const hyresgastList = Object.values(perHyresgast).sort((a, b) => b.totalDebiterat - a.totalDebiterat)
        const totalLevKostnad = levFakturor.reduce((s, f) => s + f.total_belopp, 0)
        const totalUtdebiterat = hyresgastList.reduce((s, h) => s + h.totalDebiterat, 0)
        const totalKwh = hyresgastList.reduce((s, h) => s + h.totalKwh, 0)
        const differens = totalUtdebiterat - totalLevKostnad

        const kpiCard = (accent: string): React.CSSProperties => ({
          borderRadius: 12, background: C.panel, border: `1px solid ${C.borderSoft}`, borderLeft: `3px solid ${accent}`, padding: 16,
        })

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Sammanfattningskort */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div style={kpiCard(C.warn)}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.warn, textTransform: 'uppercase', margin: 0 }}>Leverantörskostnad</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4 }}>{formatSEK(totalLevKostnad)}</p>
              </div>
              <div style={kpiCard(C.ok)}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.ok, textTransform: 'uppercase', margin: 0 }}>Utdebiterat</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4 }}>{formatSEK(totalUtdebiterat)}</p>
              </div>
              <div style={kpiCard(differens >= 0 ? C.blue : C.danger)}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', margin: 0, color: differens >= 0 ? C.blue : C.danger }}>Differens</p>
                <p style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: differens >= 0 ? C.blue : C.danger }}>{differens >= 0 ? '+' : ''}{formatSEK(differens)}</p>
              </div>
              <div style={kpiCard(C.gold)}>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.gold, textTransform: 'uppercase', margin: 0 }}>Total förbrukning</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: C.text, marginTop: 4 }}>{totalKwh.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kWh</p>
              </div>
            </div>

            {/* Per hyresgäst */}
            {hyresgastList.length > 0 && (
              <div style={card}>
                <div style={cardHead}>
                  <h3 style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0 }}>Förbrukning per hyresgäst</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.panel2 }}>
                      {['Hyresgäst', 'Perioder', 'Total förbrukning', 'Totalt debiterat', 'Snitt/kvartal'].map((h, i) => (
                        <th key={i} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hyresgastList.map(h => (
                      <tr key={h.namn}>
                        <td style={{ ...td, fontWeight: 600, color: C.text }}>{h.namn}</td>
                        <td style={td}>{h.perioder}</td>
                        <td style={td}>{fmtKwh(h.totalKwh)}</td>
                        <td style={{ ...td, fontWeight: 700, color: C.text }}>{formatSEK(h.totalDebiterat)}</td>
                        <td style={td}>{h.perioder > 0 ? formatSEK(h.totalDebiterat / h.perioder) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#000' }}>
                      <td style={{ ...td, fontWeight: 700, color: C.text, borderTop: `1px solid ${C.border}` }}>Totalt</td>
                      <td style={{ ...td, borderTop: `1px solid ${C.border}` }}></td>
                      <td style={{ ...td, color: C.text2, borderTop: `1px solid ${C.border}` }}>{fmtKwh(totalKwh)}</td>
                      <td style={{ ...td, fontWeight: 700, color: C.gold, borderTop: `1px solid ${C.border}` }}>{formatSEK(totalUtdebiterat)}</td>
                      <td style={{ ...td, borderTop: `1px solid ${C.border}` }}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Per leverantörsfaktura */}
            {levFakturor.length > 0 && (
              <div style={card}>
                <div style={cardHead}>
                  <h3 style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0 }}>Per period</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.panel2 }}>
                      {['Period', 'Fastighet', 'Leverantörskostnad', 'Utdebiterat', 'Differens', 'Pris/kWh'].map((h, i) => (
                        <th key={i} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {levFakturor.map(f => {
                      const utdeb = f.debiteringar.reduce((s, d) => s + d.belopp, 0)
                      const diff = utdeb - f.total_belopp
                      return (
                        <tr key={f.id}>
                          <td style={td}>{formatDate(f.period_fran)} – {formatDate(f.period_till)}</td>
                          <td style={{ ...td, color: C.text }}>{f.fastighet.namn}</td>
                          <td style={{ ...td, fontWeight: 600, color: C.warn }}>{formatSEK(f.total_belopp)}</td>
                          <td style={{ ...td, fontWeight: 600, color: C.ok }}>{utdeb > 0 ? formatSEK(utdeb) : '—'}</td>
                          <td style={td}>
                            {utdeb > 0 ? <span style={{ fontWeight: 600, color: diff >= 0 ? C.blue : C.danger }}>{diff >= 0 ? '+' : ''}{formatSEK(diff)}</span> : '—'}
                          </td>
                          <td style={td}>{f.pris_per_kwh ? f.pris_per_kwh.toFixed(4) + ' kr' : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {hyresgastList.length === 0 && levFakturor.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 0', ...card }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                <p style={{ color: C.muted, margin: 0 }}>Ingen data ännu</p>
                <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Registrera leverantörsfakturor och skapa debiteringar för att se analysen.</p>
              </div>
            )}
          </div>
        )
      })()}

      </>}

      {/* NY MÄTPUNKT */}
      <SlideOver open={showNewMatare} onClose={() => setShowNewMatare(false)} title="Ny mätpunkt" width="md"
        subtitle={matareForm.lokalId ? lokaler.find(l => l.id === matareForm.lokalId)?.hyresavtal?.[0]?.hyresavtal?.hyresgast?.namn : undefined}
        footer={<div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setShowNewMatare(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
          <button onClick={saveMatare} disabled={saving || !matareForm.beskrivning} style={{ ...btnPrimary, flex: 1, opacity: saving || !matareForm.beskrivning ? 0.5 : 1 }}>{saving ? 'Skapar...' : 'Lägg till'}</button>
        </div>}>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hyresgasterUtanMatare.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.muted, textTransform: 'uppercase', marginBottom: 8 }}>Hyresgäster utan mätare — välj för att förifylla:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {hyresgasterUtanMatare.map(namn => {
                  const lokal = lokaler.find(l => l.hyresavtal?.[0]?.hyresavtal?.hyresgast?.namn === namn)
                  const aktiv = matareForm.lokalId === lokal?.id
                  return (
                    <button key={namn} type="button" onClick={() => setMatareForm(f => ({ ...f, fastighetId: lokal?.fastighet_id || fastigheter[0]?.id || '', lokalId: lokal?.id || '' }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, border: `1px solid ${aktiv ? C.gold : C.border}`, background: aktiv ? C.goldSoft : C.field, color: aktiv ? C.gold : C.muted, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + {namn}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {!matareForm.lokalId && <>
            <div>
              <label style={lbl}>Fastighet</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={matareForm.fastighetId} onChange={e => setMatareForm({ ...matareForm, fastighetId: e.target.value, lokalId: '' })}>
                {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Hyresgäst</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={matareForm.lokalId} onChange={e => setMatareForm({ ...matareForm, lokalId: e.target.value })}>
                <option value="">Gemensam el</option>
                {lokaler.filter(l => l.fastighet_id === matareForm.fastighetId).map(l => (
                  <option key={l.id} value={l.id}>{l.hyresavtal?.[0]?.hyresavtal?.hyresgast?.namn || l.namn}</option>
                ))}
              </select>
            </div>
          </>}
          <div>
            <label style={lbl}>Mätpunkt / Namn *</label>
            <input style={inp} onFocus={fo} onBlur={fb} value={matareForm.beskrivning} onChange={e => setMatareForm({ ...matareForm, beskrivning: e.target.value })} placeholder="T.ex. Verkstad, Bod, Uppvärmning" autoFocus />
          </div>
          <div>
            <label style={lbl}>Schablon kWh/mån <span style={{ color: C.muted2, fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>(fast förbrukning istället för avläsning)</span></label>
            <input type="number" style={inp} onFocus={fo} onBlur={fb} value={matareForm.schablonKwh} onChange={e => setMatareForm({ ...matareForm, schablonKwh: e.target.value })} placeholder="Lämna tomt för manuell avläsning" />
          </div>
        </div>
      </SlideOver>

      {/* NY AVLÄSNING */}
      <SlideOver open={showNewAvl} onClose={() => setShowNewAvl(false)} title="Ny avläsning" width="md"
        footer={<div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setShowNewAvl(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
          <button onClick={saveAvl} disabled={saving || Object.values(avlValues).every(v => !v)} style={{ ...btnPrimary, flex: 1, opacity: saving || Object.values(avlValues).every(v => !v) ? 0.5 : 1 }}>{saving ? 'Sparar...' : 'Registrera avläsningar'}</button>
        </div>}>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={lbl}>Hyresgäst</label>
            <select style={inp} onFocus={fo} onBlur={fb} value={avlHyresgast} onChange={e => {
              const namn = e.target.value
              setAvlHyresgast(namn)
              setAvlValues({})
              const prev: Record<string, string> = {}
              matare.filter(m => m.aktiv && !m.schablon_kwh && getHyresgast(m) === namn).forEach(m => {
                const s = getSenaste(m)
                if (s) prev[m.id] = String(s.varde)
              })
              setAvlPrev(prev)
            }}>
              <option value="">Välj hyresgäst...</option>
              {[...new Set(matare.filter(m => m.aktiv && !m.schablon_kwh).map(m => getHyresgast(m)))].sort().map(namn => (
                <option key={namn} value={namn}>{namn}</option>
              ))}
            </select>
          </div>

          {avlHyresgast && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label style={lbl}>Datum</label>
                <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={avlDatum} onChange={e => setAvlDatum(e.target.value)} /></div>
              <div><label style={lbl}>Avläst av</label>
                <input style={inp} onFocus={fo} onBlur={fb} value={avlAvlastAv} onChange={e => setAvlAvlastAv(e.target.value)} placeholder="Namn" /></div>
            </div>
          )}

          {avlHyresgast && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text2, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}`, margin: 0 }}>Mätpunkter</h4>
              {matare.filter(m => m.aktiv && !m.schablon_kwh && getHyresgast(m) === avlHyresgast).map(m => {
                const s = getSenaste(m)
                const val = avlValues[m.id] || ''
                const prevVal = avlPrev[m.id] || ''
                const prevNum = prevVal ? parseFloat(prevVal) : null
                const diff = val && prevNum != null ? parseFloat(val) - prevNum : null
                return (
                  <div key={m.id} style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.field, padding: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: '0 0 8px' }}>{m.beskrivning || 'Huvudmätare'}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ ...lbl, letterSpacing: 0, textTransform: 'none', fontWeight: 500, color: C.muted2 }}>Föregående värde</label>
                        <input type="number" step="0.01" style={{ ...inp, background: s ? C.panel2 : C.field, color: s ? C.muted : C.text2 }} onFocus={fo} onBlur={fb} value={prevVal} onChange={e => setAvlPrev(prev => ({ ...prev, [m.id]: e.target.value }))} placeholder={s ? '' : 'Fyll i startvärde'} />
                        {s && <p style={{ fontSize: 11, color: C.muted2, margin: '2px 0 0' }}>{formatDate(s.datum)}</p>}
                      </div>
                      <div>
                        <label style={{ ...lbl, letterSpacing: 0, textTransform: 'none', fontWeight: 500, color: C.muted2 }}>Nytt värde</label>
                        <input type="number" step="0.01" style={inp} onFocus={fo} onBlur={fb} value={val} onChange={e => setAvlValues(prev => ({ ...prev, [m.id]: e.target.value }))} placeholder="kWh" />
                      </div>
                    </div>
                    {diff != null && diff > 0 && (
                      <div style={{ marginTop: 8, borderRadius: 6, background: C.goldSoft, border: `1px solid rgba(232,201,106,0.2)`, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: C.gold }}>
                        Förbrukning: {fmtKwh(diff)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SlideOver>

      {/* NY LEVERANTÖRSFAKTURA */}
      <SlideOver open={showNewLev} onClose={() => setShowNewLev(false)} title="Ny leverantörsfaktura" width="md"
        footer={<div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => setShowNewLev(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
          <button onClick={saveLev} disabled={saving || !levForm.totalBelopp || !levForm.periodFran} style={{ ...btnPrimary, flex: 1, opacity: saving || !levForm.totalBelopp || !levForm.periodFran ? 0.5 : 1 }}>{saving ? 'Sparar...' : 'Spara'}</button>
        </div>}>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* AI-skanning */}
          <div style={{ borderRadius: 8, border: `2px dashed ${C.border}`, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>📄</div>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Skanna faktura med AI</p>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: C.field, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: C.text2 }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={async e => {
                const fil = e.target.files?.[0]
                if (!fil) return
                setSkannar(true)
                const fd = new FormData(); fd.append('fil', fil)
                try {
                  const res = await fetch('/api/fastigheter/el-leverantor/skanna', { method: 'POST', body: fd })
                  const data = await res.json()
                  if (data.periodFran) setLevForm(prev => ({
                    ...prev,
                    periodFran: data.periodFran ?? prev.periodFran,
                    periodTill: data.periodTill ?? prev.periodTill,
                    totalKwh: data.totalKwh?.toString() ?? prev.totalKwh,
                    totalBelopp: data.totalBelopp?.toString() ?? prev.totalBelopp,
                    fakturanummer: data.fakturanummer ?? prev.fakturanummer,
                  }))
                } catch { /* låt användaren fylla manuellt */ }
                setSkannar(false)
              }} />
              {skannar ? 'Analyserar...' : 'Välj bild eller PDF'}
            </label>
          </div>
          <div>
            <label style={lbl}>Fastighet</label>
            <select style={inp} onFocus={fo} onBlur={fb} value={levForm.fastighetId} onChange={e => setLevForm({ ...levForm, fastighetId: e.target.value })}>
              {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={lbl}>Period från</label>
              <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={levForm.periodFran} onChange={e => setLevForm({ ...levForm, periodFran: e.target.value })} /></div>
            <div><label style={lbl}>Period till</label>
              <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={levForm.periodTill} onChange={e => setLevForm({ ...levForm, periodTill: e.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div><label style={lbl}>Totalt kWh</label>
              <input type="number" style={inp} onFocus={fo} onBlur={fb} value={levForm.totalKwh} onChange={e => setLevForm({ ...levForm, totalKwh: e.target.value })} /></div>
            <div><label style={lbl}>Belopp exkl. moms</label>
              <input type="number" step="0.01" style={inp} onFocus={fo} onBlur={fb} value={levForm.totalBelopp} onChange={e => setLevForm({ ...levForm, totalBelopp: e.target.value })} /></div>
            <div><label style={lbl}>Pris/kWh (auto)</label>
              <input readOnly style={{ ...inp, background: C.panel2, color: C.muted }} value={levForm.totalKwh && levForm.totalBelopp ? (parseFloat(levForm.totalBelopp) / parseFloat(levForm.totalKwh)).toFixed(4) + ' kr' : '—'} /></div>
          </div>
          <div>
            <label style={lbl}>Fakturanummer (valfritt)</label>
            <input style={inp} onFocus={fo} onBlur={fb} value={levForm.fakturanummer} onChange={e => setLevForm({ ...levForm, fakturanummer: e.target.value })} />
          </div>
        </div>
      </SlideOver>
    </div>
  )
}
