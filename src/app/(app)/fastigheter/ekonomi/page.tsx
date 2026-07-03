'use client'

// Migrerad: käll-appens src/app/ekonomi/page.tsx (Tailwind, lucide, blå/ljus)
// → mål-appens inline dark/gold-tema, emoji-ikoner, SlideOver + tokens från
// @/components/fastigheter. Data via de migrerade route-handlers under
// /api/fastigheter/* (namespacat).
//
// VIKTIGT om fältnamn: /api/fastigheter/lan returnerar snake_case-kolumner
// (amort_typ, amort_belopp, startdatum, slutdatum) med nästlad fastighet
// (fastighet.namn, fastighet.bolag.namn). Statistik-routerna (nettoresultat/
// kassaflode) returnerar däremot camelCase-beräkningsfält oförändrade.
// Formuläret POSTar camelCase (fastighetId, amortTyp, amortBelopp) — routen
// läser både camel och snake.

import { useEffect, useState } from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'

interface FastighetResult {
  fastighetId: string; fastighetNamn: string; bolagNamn: string | null
  antalLokaler: number; antalAvtal: number; totalLOA: number
  intakterManad: number; intakterAr: number
  kostnaderManad: number; kostnaderAr: number
  nettoManad: number; nettoAr: number
  dpiPerKvm: number
}

interface NettoresultatData {
  fastigheter: FastighetResult[]
  totalt: { intakterManad: number; intakterAr: number; kostnaderManad: number; kostnaderAr: number; nettoManad: number; nettoAr: number }
}

interface KassaManad {
  period: string; intakter: number; kostnader: number; elKostnader: number
  ranta: number; amortering: number
  totalKostnader: number; netto: number; ackumulerat: number
}

interface KassaflodeData {
  manader: KassaManad[]
  summor: { totalIntakter: number; totalKostnader: number; totalNetto: number }
  nuPeriod: string
}

// snake_case från /api/fastigheter/lan
interface Lan {
  id: string; fastighet_id: string; langivare: string; belopp: number
  ranta: number; amort_typ: string; amort_belopp: number | null
  startdatum: string; slutdatum: string | null; kommentar: string | null
  fastighet: { id: string; namn: string; bolag?: { namn: string } | null } | null
}

interface Fastighet { id: string; namn: string }

type Tab = 'nettoresultat' | 'kassaflode' | 'lan'

const formatSEK = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

const periodLabel = (p: string) => {
  const [y, m] = p.split('-')
  const manader = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
  return `${manader[parseInt(m) - 1]} ${y}`
}

const amortTypLabel: Record<string, string> = { manadlig: 'Månadsvis', kvartalsvis: 'Kvartalsvis', arsvis: 'Årsvis', ingen: 'Ingen' }

// --- lokala stil-hjälpare (dark/gold) ---------------------------------------
const th: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  letterSpacing: 1, textTransform: 'uppercase', color: C.muted,
}
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: C.text2 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }

const kpiCard = (accent: string): React.CSSProperties => ({
  borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel,
  padding: 20, borderLeft: `3px solid ${accent}`,
})
const kpiLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: C.muted, margin: 0 }
const kpiValue: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: C.text, marginTop: 6 }
const kpiSub: React.CSSProperties = { fontSize: 12, color: C.muted2, marginTop: 4 }

const tableWrap: React.CSSProperties = {
  borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel,
  overflow: 'hidden',
}
const tableScroll: React.CSSProperties = { overflowX: 'auto' }

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  background: 'none', border: 'none', borderBottom: `2px solid ${active ? C.gold : 'transparent'}`,
  color: active ? C.gold : C.muted, marginBottom: -1,
})

const segBtn = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', borderRadius: 6,
  border: 'none', background: active ? C.gold : 'transparent', color: active ? '#000' : C.muted,
})

const fieldGold: React.CSSProperties = { ...inp } // inp already gold-themed

export default function EkonomiPage() {
  const [tab, setTab] = useState<Tab>('nettoresultat')
  const [nettoData, setNettoData] = useState<NettoresultatData | null>(null)
  const [kassaData, setKassaData] = useState<KassaflodeData | null>(null)
  const [lan, setLan] = useState<Lan[]>([])
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [loading, setLoading] = useState(true)
  const [visning, setVisning] = useState<'manad' | 'ar'>('ar')
  const [showLanForm, setShowLanForm] = useState(false)
  const [lanForm, setLanForm] = useState({ fastighetId: '', langivare: '', belopp: '', ranta: '', amortTyp: 'manadlig', amortBelopp: '', startdatum: '', slutdatum: '', kommentar: '' })
  const [sparar, setSparar] = useState(false)

  const laddaLan = () => fetch('/api/fastigheter/lan').then(r => r.json()).then(d => { if (Array.isArray(d)) setLan(d) }).catch(() => {})

  useEffect(() => {
    Promise.all([
      fetch('/api/fastigheter/statistik/nettoresultat').then(r => r.json()),
      fetch('/api/fastigheter/statistik/kassaflode').then(r => r.json()),
      fetch('/api/fastigheter/lan').then(r => r.json()),
      fetch('/api/fastigheter/objekt').then(r => r.json()),
    ]).then(([n, k, l, f]) => {
      if (n.fastigheter) setNettoData(n)
      if (k.manader) setKassaData(k)
      if (Array.isArray(l)) setLan(l)
      if (Array.isArray(f)) setFastigheter(f.map((x: Fastighet) => ({ id: x.id, namn: x.namn })))
    }).finally(() => setLoading(false))
  }, [])

  const sparaLan = async () => {
    if (!lanForm.fastighetId || !lanForm.langivare || !lanForm.belopp || !lanForm.ranta || !lanForm.startdatum) return
    setSparar(true)
    await fetch('/api/fastigheter/lan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lanForm) })
    await Promise.all([laddaLan(), fetch('/api/fastigheter/statistik/kassaflode').then(r => r.json()).then(k => { if (k.manader) setKassaData(k) })])
    setShowLanForm(false)
    setLanForm({ fastighetId: '', langivare: '', belopp: '', ranta: '', amortTyp: 'manadlig', amortBelopp: '', startdatum: '', slutdatum: '', kommentar: '' })
    setSparar(false)
  }

  const taBortLan = async (id: string) => {
    if (!confirm('Ta bort lånet?')) return
    await fetch(`/api/fastigheter/lan/${id}`, { method: 'DELETE' })
    await Promise.all([laddaLan(), fetch('/api/fastigheter/statistik/kassaflode').then(r => r.json()).then(k => { if (k.manader) setKassaData(k) })])
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>

  const totalSkuld = lan.reduce((s, l) => s + l.belopp, 0)
  const totalRantaAr = lan.reduce((s, l) => s + (l.belopp * l.ranta / 100), 0)
  const totalAmortManad = lan.reduce((s, l) => {
    if (!l.amort_belopp || l.amort_typ === 'ingen') return s
    if (l.amort_typ === 'manadlig') return s + l.amort_belopp
    if (l.amort_typ === 'kvartalsvis') return s + l.amort_belopp / 3
    if (l.amort_typ === 'arsvis') return s + l.amort_belopp / 12
    return s
  }, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Ekonomi</h2>

      {/* Flikar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={() => setTab('nettoresultat')} style={tabBtn(tab === 'nettoresultat')}>Nettoresultat</button>
        <button onClick={() => setTab('kassaflode')} style={tabBtn(tab === 'kassaflode')}>Kassaflöde</button>
        <button onClick={() => setTab('lan')} style={tabBtn(tab === 'lan')}>
          Lån {lan.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, background: C.goldSoft, color: C.gold, borderRadius: 999, padding: '1px 8px', fontWeight: 700 }}>{lan.length}</span>}
        </button>
      </div>

      {/* NETTORESULTAT */}
      {tab === 'nettoresultat' && nettoData && (() => {
        const t = nettoData.totalt
        const netto = visning === 'ar' ? t.nettoAr : t.nettoManad
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 4, borderRadius: 8, background: C.panel2, border: `1px solid ${C.borderSoft}`, padding: 4 }}>
                <button onClick={() => setVisning('manad')} style={segBtn(visning === 'manad')}>Månad</button>
                <button onClick={() => setVisning('ar')} style={segBtn(visning === 'ar')}>År</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={kpiCard(C.ok)}>
                <p style={kpiLabel}>Intäkter</p>
                <p style={{ ...kpiValue, color: C.ok }}>{formatSEK(visning === 'ar' ? t.intakterAr : t.intakterManad)}</p>
                <p style={kpiSub}>per {visning === 'ar' ? 'år' : 'månad'}</p>
              </div>
              <div style={kpiCard(C.danger)}>
                <p style={kpiLabel}>Kostnader</p>
                <p style={{ ...kpiValue, color: C.danger }}>{formatSEK(visning === 'ar' ? t.kostnaderAr : t.kostnaderManad)}</p>
                <p style={kpiSub}>per {visning === 'ar' ? 'år' : 'månad'}</p>
              </div>
              <div style={kpiCard(netto >= 0 ? C.gold : C.warn)}>
                <p style={kpiLabel}>Nettoresultat</p>
                <p style={{ ...kpiValue, color: netto >= 0 ? C.gold : C.warn }}>{formatSEK(netto)}</p>
                <p style={kpiSub}>per {visning === 'ar' ? 'år' : 'månad'}</p>
              </div>
            </div>
            <div style={tableWrap}>
              <div style={tableScroll}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
                      <th style={th}>Fastighet</th>
                      <th style={thR}>Lokaler</th>
                      <th style={thR}>LOA</th>
                      <th style={{ ...thR, color: C.ok }}>Intäkter</th>
                      <th style={{ ...thR, color: C.danger }}>Kostnader</th>
                      <th style={thR}>Netto</th>
                      <th style={thR}>kr/kvm/år</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nettoData.fastigheter.map(f => {
                      const fNetto = visning === 'ar' ? f.nettoAr : f.nettoManad
                      const fKost = visning === 'ar' ? f.kostnaderAr : f.kostnaderManad
                      return (
                        <tr key={f.fastighetId} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                          <td style={td}>
                            <p style={{ fontWeight: 600, color: C.text, margin: 0 }}>{f.fastighetNamn}</p>
                            {f.bolagNamn && <p style={{ fontSize: 12, color: C.muted2, margin: 0 }}>{f.bolagNamn}</p>}
                          </td>
                          <td style={tdR}>{f.antalLokaler}</td>
                          <td style={tdR}>{f.totalLOA > 0 ? f.totalLOA.toLocaleString('sv-SE') : '—'}</td>
                          <td style={{ ...tdR, fontWeight: 600, color: C.ok }}>{formatSEK(visning === 'ar' ? f.intakterAr : f.intakterManad)}</td>
                          <td style={{ ...tdR, fontWeight: 600, color: C.danger }}>{fKost > 0 ? formatSEK(fKost) : '—'}</td>
                          <td style={{ ...tdR, fontWeight: 700, color: fNetto >= 0 ? C.text : C.warn }}>{formatSEK(fNetto)}</td>
                          <td style={tdR}>{f.dpiPerKvm > 0 ? `${f.dpiPerKvm.toLocaleString('sv-SE')} kr` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#000', color: C.text }}>
                      <td style={{ ...td, fontWeight: 700, color: C.gold }}>Totalt</td>
                      <td style={tdR}>{nettoData.fastigheter.reduce((s, f) => s + f.antalLokaler, 0)}</td>
                      <td style={tdR}>{nettoData.fastigheter.reduce((s, f) => s + f.totalLOA, 0).toLocaleString('sv-SE')}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: C.ok }}>{formatSEK(visning === 'ar' ? t.intakterAr : t.intakterManad)}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: C.danger }}>{formatSEK(visning === 'ar' ? t.kostnaderAr : t.kostnaderManad)}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: C.gold }}>{formatSEK(netto)}</td>
                      <td style={td}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* KASSAFLÖDE */}
      {tab === 'kassaflode' && kassaData && (() => {
        const s = kassaData.summor
        const aktuellManad = kassaData.manader.find(m => m.period === kassaData.nuPeriod)
        const visade = kassaData.manader.filter(m => m.intakter > 0 || m.totalKostnader > 0 || m.period >= kassaData.nuPeriod)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
              <div style={kpiCard(C.ok)}>
                <p style={kpiLabel}>Totala intäkter</p>
                <p style={{ ...kpiValue, fontSize: 20, color: C.ok }}>{formatSEK(s.totalIntakter)}</p>
              </div>
              <div style={kpiCard(C.danger)}>
                <p style={kpiLabel}>Totala kostnader</p>
                <p style={{ ...kpiValue, fontSize: 20, color: C.danger }}>{formatSEK(s.totalKostnader)}</p>
              </div>
              <div style={kpiCard(s.totalNetto >= 0 ? C.gold : C.warn)}>
                <p style={kpiLabel}>Totalt netto</p>
                <p style={{ ...kpiValue, fontSize: 20, color: s.totalNetto >= 0 ? C.gold : C.warn }}>{formatSEK(s.totalNetto)}</p>
              </div>
              <div style={kpiCard(C.muted)}>
                <p style={kpiLabel}>Ack. saldo nu</p>
                <p style={{ ...kpiValue, fontSize: 20, color: (aktuellManad?.ackumulerat ?? 0) >= 0 ? C.text : C.danger }}>{formatSEK(aktuellManad?.ackumulerat ?? 0)}</p>
              </div>
            </div>
            <div style={tableWrap}>
              <div style={tableScroll}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
                      <th style={th}>Period</th>
                      <th style={{ ...thR, color: C.ok }}>Intäkter</th>
                      <th style={{ ...thR, color: C.danger }}>Drift</th>
                      <th style={{ ...thR, color: C.warn }}>El</th>
                      <th style={{ ...thR, color: '#a78bfa' }}>Ränta</th>
                      <th style={{ ...thR, color: '#818cf8' }}>Amortering</th>
                      <th style={{ ...thR, color: C.danger }}>Tot. kostn.</th>
                      <th style={thR}>Netto</th>
                      <th style={thR}>Ack. saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visade.map(m => {
                      const isNu = m.period === kassaData.nuPeriod
                      const isFuture = m.period > kassaData.nuPeriod
                      return (
                        <tr key={m.period} style={{ borderTop: `1px solid ${C.borderSoft}`, background: isNu ? C.goldSoft : isFuture ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                          <td style={{ ...td, padding: '10px 16px' }}>
                            <span style={{ fontWeight: 600, color: isNu ? C.gold : isFuture ? C.muted2 : C.text }}>{periodLabel(m.period)}</span>
                            {isNu && <span style={{ marginLeft: 8, fontSize: 11, background: C.goldSoft, color: C.gold, borderRadius: 999, padding: '1px 8px' }}>Nu</span>}
                            {isFuture && <span style={{ marginLeft: 8, fontSize: 11, color: C.muted2 }}>(prognos)</span>}
                          </td>
                          <td style={{ ...tdR, padding: '10px 16px', fontWeight: 600, color: C.ok }}>{m.intakter > 0 ? formatSEK(m.intakter) : '—'}</td>
                          <td style={{ ...tdR, padding: '10px 16px', color: C.danger }}>{m.kostnader > 0 ? formatSEK(m.kostnader) : '—'}</td>
                          <td style={{ ...tdR, padding: '10px 16px', color: C.warn }}>{m.elKostnader > 0 ? formatSEK(m.elKostnader) : '—'}</td>
                          <td style={{ ...tdR, padding: '10px 16px', color: '#a78bfa' }}>{m.ranta > 0 ? formatSEK(m.ranta) : '—'}</td>
                          <td style={{ ...tdR, padding: '10px 16px', color: '#818cf8' }}>{m.amortering > 0 ? formatSEK(m.amortering) : '—'}</td>
                          <td style={{ ...tdR, padding: '10px 16px', fontWeight: 600, color: C.danger }}>{m.totalKostnader > 0 ? formatSEK(m.totalKostnader) : '—'}</td>
                          <td style={{ ...tdR, padding: '10px 16px' }}>
                            <span style={{ fontWeight: 700, color: m.netto >= 0 ? C.ok : C.danger }}>{m.netto !== 0 ? (m.netto > 0 ? '+' : '') + formatSEK(m.netto) : '—'}</span>
                          </td>
                          <td style={{ ...tdR, padding: '10px 16px' }}>
                            <span style={{ fontWeight: 700, color: m.ackumulerat >= 0 ? C.text : C.danger }}>{formatSEK(m.ackumulerat)}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.muted2, fontStyle: 'italic', margin: 0 }}>Ränta och amortering beräknas månadsvis från registrerade lån. Prognos baseras på aktiva hyresavtal.</p>
          </div>
        )
      })()}

      {/* LÅN */}
      {tab === 'lan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Sammanfattningskort */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={kpiCard(C.muted)}>
              <p style={kpiLabel}>Total skuld</p>
              <p style={{ ...kpiValue, fontSize: 20 }}>{formatSEK(totalSkuld)}</p>
            </div>
            <div style={kpiCard('#a78bfa')}>
              <p style={kpiLabel}>Räntekostnad/år</p>
              <p style={{ ...kpiValue, fontSize: 20, color: '#a78bfa' }}>{formatSEK(totalRantaAr)}</p>
              <p style={kpiSub}>{formatSEK(totalRantaAr / 12)}/mån</p>
            </div>
            <div style={kpiCard('#818cf8')}>
              <p style={kpiLabel}>Amortering/mån</p>
              <p style={{ ...kpiValue, fontSize: 20, color: '#818cf8' }}>{formatSEK(totalAmortManad)}</p>
              <p style={kpiSub}>{formatSEK(totalAmortManad * 12)}/år</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowLanForm(true)} style={btnPrimary}>+ Nytt lån</button>
          </div>

          {/* Låntabell */}
          <div style={tableWrap}>
            {lan.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.muted2, padding: '40px 0', margin: 0 }}>Inga lån registrerade</p>
            ) : (
              <div style={tableScroll}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
                      <th style={th}>Fastighet</th>
                      <th style={th}>Långivare</th>
                      <th style={thR}>Belopp</th>
                      <th style={{ ...thR, color: '#a78bfa' }}>Ränta %</th>
                      <th style={{ ...thR, color: '#a78bfa' }}>Ränta/mån</th>
                      <th style={{ ...thR, color: '#818cf8' }}>Amortering</th>
                      <th style={th}>Startdatum</th>
                      <th style={th}>Slutdatum</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lan.map(l => {
                      const rantaManad = Math.round(l.belopp * l.ranta / 100 / 12)
                      const amortManad = !l.amort_belopp || l.amort_typ === 'ingen' ? 0
                        : l.amort_typ === 'manadlig' ? l.amort_belopp
                        : l.amort_typ === 'kvartalsvis' ? l.amort_belopp / 3
                        : l.amort_belopp / 12
                      return (
                        <tr key={l.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                          <td style={{ ...td, fontWeight: 600, color: C.text }}>{l.fastighet?.namn ?? '—'}</td>
                          <td style={td}>{l.langivare}</td>
                          <td style={{ ...tdR, fontWeight: 600, color: C.text }}>{formatSEK(l.belopp)}</td>
                          <td style={{ ...tdR, color: '#a78bfa' }}>{l.ranta.toLocaleString('sv-SE', { minimumFractionDigits: 2 })}%</td>
                          <td style={{ ...tdR, color: '#a78bfa' }}>{formatSEK(rantaManad)}</td>
                          <td style={{ ...tdR, color: '#818cf8' }}>
                            {l.amort_typ === 'ingen' ? '—' : `${formatSEK(amortManad)}/mån`}
                            <div style={{ fontSize: 11, color: C.muted2 }}>{amortTypLabel[l.amort_typ]}</div>
                          </td>
                          <td style={td}>{new Date(l.startdatum).toLocaleDateString('sv-SE')}</td>
                          <td style={td}>{l.slutdatum ? new Date(l.slutdatum).toLocaleDateString('sv-SE') : '—'}</td>
                          <td style={tdR}>
                            <button onClick={() => taBortLan(l.id)} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 14, padding: 4 }}>🗑️</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nytt lån SlideOver */}
      <SlideOver
        open={showLanForm}
        onClose={() => setShowLanForm(false)}
        title="Nytt lån"
        width="md"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowLanForm(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={sparaLan} disabled={sparar} style={{ ...btnPrimary, flex: 1, opacity: sparar ? 0.5 : 1 }}>{sparar ? 'Sparar...' : 'Spara lån'}</button>
          </div>
        }
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>Fastighet *</label>
            <select style={fieldGold} onFocus={fo} onBlur={fb} value={lanForm.fastighetId} onChange={e => setLanForm(p => ({ ...p, fastighetId: e.target.value }))}>
              <option value="">Välj fastighet</option>
              {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Långivare *</label>
            <input style={fieldGold} onFocus={fo} onBlur={fb} value={lanForm.langivare} onChange={e => setLanForm(p => ({ ...p, langivare: e.target.value }))} placeholder="t.ex. Swedbank, SEB" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Lånebelopp (kr) *</label>
              <input type="number" style={fieldGold} onFocus={fo} onBlur={fb} value={lanForm.belopp} onChange={e => setLanForm(p => ({ ...p, belopp: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label style={lbl}>Räntesats (% / år) *</label>
              <input type="number" step="0.01" style={fieldGold} onFocus={fo} onBlur={fb} value={lanForm.ranta} onChange={e => setLanForm(p => ({ ...p, ranta: e.target.value }))} placeholder="3.50" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Amorteringstyp</label>
              <select style={fieldGold} onFocus={fo} onBlur={fb} value={lanForm.amortTyp} onChange={e => setLanForm(p => ({ ...p, amortTyp: e.target.value }))}>
                <option value="manadlig">Månadsvis</option>
                <option value="kvartalsvis">Kvartalsvis</option>
                <option value="arsvis">Årsvis</option>
                <option value="ingen">Ingen amortering</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Amorteringsbelopp (kr)</label>
              <input type="number" style={{ ...fieldGold, opacity: lanForm.amortTyp === 'ingen' ? 0.5 : 1 }} onFocus={fo} onBlur={fb} value={lanForm.amortBelopp} onChange={e => setLanForm(p => ({ ...p, amortBelopp: e.target.value }))} disabled={lanForm.amortTyp === 'ingen'} placeholder="0" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Startdatum *</label>
              <input type="date" style={fieldGold} onFocus={fo} onBlur={fb} value={lanForm.startdatum} onChange={e => setLanForm(p => ({ ...p, startdatum: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Slutdatum</label>
              <input type="date" style={fieldGold} onFocus={fo} onBlur={fb} value={lanForm.slutdatum} onChange={e => setLanForm(p => ({ ...p, slutdatum: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={lbl}>Kommentar</label>
            <textarea rows={2} style={{ ...fieldGold, resize: 'none' }} onFocus={fo} onBlur={fb} value={lanForm.kommentar} onChange={e => setLanForm(p => ({ ...p, kommentar: e.target.value }))} />
          </div>
          {lanForm.belopp && lanForm.ranta && (
            <div style={{ background: C.field, border: `1px solid ${C.borderSoft}`, borderRadius: 8, padding: 12, fontSize: 13, color: C.text2, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ margin: 0 }}>Ränta/mån: <strong style={{ color: C.gold }}>{formatSEK(parseFloat(lanForm.belopp) * parseFloat(lanForm.ranta) / 100 / 12)}</strong></p>
              {lanForm.amortBelopp && lanForm.amortTyp !== 'ingen' && (
                <p style={{ margin: 0 }}>Amortering/mån: <strong style={{ color: C.gold }}>{formatSEK(
                  lanForm.amortTyp === 'manadlig' ? parseFloat(lanForm.amortBelopp)
                  : lanForm.amortTyp === 'kvartalsvis' ? parseFloat(lanForm.amortBelopp) / 3
                  : parseFloat(lanForm.amortBelopp) / 12
                )}</strong></p>
              )}
            </div>
          )}
        </div>
      </SlideOver>
    </div>
  )
}
