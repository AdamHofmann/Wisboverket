import React, { useState } from 'react'
import { C, inp, lbl } from '@/components/fastigheter/styles'
import {
  LevFaktura, Omgang,
  formatSEK, formatDate, fmtKwh, TYP_LABELS,
  card, cardHead, th, td,
} from './shared'

interface Props {
  isMobile: boolean
  levFakturor: LevFaktura[]
  omgangar: Omgang[]
  bolagMatch: (fastighetId: string | null | undefined) => boolean
}

export default function AnalysTab({ isMobile, levFakturor, omgangar, bolagMatch }: Props) {
  // Fastigheter + år som finns i datan (respekterar bolagsväljaren) — för filtren.
  const fastigheter = [...new Map(
    levFakturor.filter(f => bolagMatch(f.fastighet_id)).map(f => [f.fastighet_id, f.fastighet?.namn || 'Okänd']),
  ).entries()].map(([id, namn]) => ({ id, namn })).sort((a, b) => a.namn.localeCompare(b.namn, 'sv'))
  const arList = [...new Set(levFakturor.map(f => Number((f.period_fran ?? '').slice(0, 4))).filter(Boolean))].sort((a, b) => b - a)

  // Filter: år/kvartal/fastighet. Poängen: kostnad OCH utdebiterat måste gälla
  // SAMMA avgränsning, annars blir differensen meningslös. Default = senaste året,
  // alla kvartal, alla fastigheter.
  const [ar, setAr] = useState<number | 'alla'>(() => arList[0] ?? 'alla')
  const [kvartal, setKvartal] = useState<number | 'alla'>('alla')
  const [fastId, setFastId] = useState<string>('alla')

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const bounds = (() => {
    if (ar === 'alla') return null
    if (kvartal === 'alla') return { fran: `${ar}-01-01`, till: `${ar}-12-31` }
    const startM = (kvartal - 1) * 3
    return { fran: `${ar}-${pad2(startM + 1)}-01`, till: `${ar}-${pad2(startM + 3)}-${pad2(new Date(ar, startM + 3, 0).getDate())}` }
  })()
  const inFast = (fid: string | null | undefined) => fastId === 'alla' || fid === fastId
  const overlaps = (pf?: string | null, pt?: string | null) =>
    !bounds || ((pf ?? '') <= bounds.till && (pt ?? '') >= bounds.fran)

  // Respektera bolagsväljaren + period/fastighetsfiltret i hela analysen.
  const analysFakturor = levFakturor.filter(f => bolagMatch(f.fastighet_id) && inFast(f.fastighet_id) && overlaps(f.period_fran, f.period_till))
  // Utdebiterat + förbrukning kommer från omgångarnas debiteringar (utdebiteringarna),
  // INTE från leverantörsfakturorna (som saknar debiteringar).
  const synligaOmgangar = omgangar.filter(o => bolagMatch(o.fastighet_id) && inFast(o.fastighet_id) && overlaps(o.period_fran, o.period_till))
  const perHyresgast: Record<string, { namn: string; totalKwh: number; totalDebiterat: number; perioder: number }> = {}
  synligaOmgangar.forEach(o => {
    o.debiteringar.forEach(d => {
      if (!d.hyresgast_namn) return
      if (!perHyresgast[d.hyresgast_namn]) perHyresgast[d.hyresgast_namn] = { namn: d.hyresgast_namn, totalKwh: 0, totalDebiterat: 0, perioder: 0 }
      perHyresgast[d.hyresgast_namn].totalKwh += d.forbrukning ?? 0
      perHyresgast[d.hyresgast_namn].totalDebiterat += d.belopp
      perHyresgast[d.hyresgast_namn].perioder++
    })
  })
  const hyresgastList = Object.values(perHyresgast).sort((a, b) => b.totalDebiterat - a.totalDebiterat)
  const totalLevKostnad = analysFakturor.reduce((s, f) => s + f.total_belopp, 0)
  const totalUtdebiterat = hyresgastList.reduce((s, h) => s + h.totalDebiterat, 0)
  const totalKwh = hyresgastList.reduce((s, h) => s + h.totalKwh, 0)
  const differens = totalUtdebiterat - totalLevKostnad

  const kpiCard = (accent: string): React.CSSProperties => ({
    borderRadius: 12, background: C.panel, border: `1px solid ${C.borderSoft}`, borderLeft: `3px solid ${accent}`, padding: 16,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter — kostnad och utdebiterat jämförs bara rätt inom samma avgränsning */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: isMobile ? '1 1 100%' : '0 0 auto' }}>
          <label style={lbl}>År</label>
          <select style={{ ...inp, minWidth: 110 }} value={String(ar)} onChange={e => setAr(e.target.value === 'alla' ? 'alla' : Number(e.target.value))}>
            <option value="alla">Alla år</option>
            {arList.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ flex: isMobile ? '1 1 100%' : '0 0 auto' }}>
          <label style={lbl}>Kvartal</label>
          <select style={{ ...inp, minWidth: 140, opacity: ar === 'alla' ? 0.5 : 1 }} value={String(kvartal)} disabled={ar === 'alla'} onChange={e => setKvartal(e.target.value === 'alla' ? 'alla' : Number(e.target.value))}>
            <option value="alla">Alla kvartal</option>
            <option value={1}>Q1 (jan–mar)</option>
            <option value={2}>Q2 (apr–jun)</option>
            <option value={3}>Q3 (jul–sep)</option>
            <option value={4}>Q4 (okt–dec)</option>
          </select>
        </div>
        <div style={{ flex: isMobile ? '1 1 100%' : '1 1 auto', minWidth: 160 }}>
          <label style={lbl}>Fastighet</label>
          <select style={{ ...inp, width: '100%' }} value={fastId} onChange={e => setFastId(e.target.value)}>
            <option value="alla">Alla fastigheter</option>
            {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
          </select>
        </div>
      </div>

      {/* Sammanfattningskort */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
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
          {isMobile ? (
            // MOBIL: kortlayout per hyresgäst (ingen horisontell scroll)
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {hyresgastList.map(h => (
                <div key={h.namn} style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{h.namn}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 8, fontSize: 12 }}>
                    <div><span style={{ color: C.muted2 }}>Perioder: </span><span style={{ color: C.text2 }}>{h.perioder}</span></div>
                    <div><span style={{ color: C.muted2 }}>Förbrukning: </span><span style={{ color: C.text2 }}>{fmtKwh(h.totalKwh)}</span></div>
                    <div><span style={{ color: C.muted2 }}>Debiterat: </span><span style={{ fontWeight: 700, color: C.text }}>{formatSEK(h.totalDebiterat)}</span></div>
                    <div><span style={{ color: C.muted2 }}>Snitt/kvartal: </span><span style={{ color: C.text2 }}>{h.perioder > 0 ? formatSEK(h.totalDebiterat / h.perioder) : '—'}</span></div>
                  </div>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.border}`, background: '#000', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: C.text }}>Totalt · {fmtKwh(totalKwh)}</span>
                <span style={{ fontWeight: 700, color: C.gold }}>{formatSEK(totalUtdebiterat)}</span>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* Per leverantörsfaktura */}
      {analysFakturor.length > 0 && (
        <div style={card}>
          <div style={cardHead}>
            <h3 style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0 }}>Per period</h3>
          </div>
          {isMobile ? (
            // MOBIL: kortlayout per period (ingen horisontell scroll)
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {analysFakturor.map(f => (
                  <div key={f.id} style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{f.fastighet.namn}{f.typ ? ` · ${TYP_LABELS[f.typ] || f.typ}` : ''}</span>
                      <span style={{ color: C.muted2, fontSize: 12 }}>{formatDate(f.period_fran)} – {formatDate(f.period_till)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 8, fontSize: 12 }}>
                      <div><span style={{ color: C.muted2 }}>Lev.kostnad: </span><span style={{ fontWeight: 600, color: C.warn }}>{formatSEK(f.total_belopp)}</span></div>
                      <div><span style={{ color: C.muted2 }}>Pris/kWh: </span><span style={{ color: C.text2 }}>{f.pris_per_kwh ? f.pris_per_kwh.toFixed(4) + ' kr' : '—'}</span></div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.panel2 }}>
                {['Period', 'Fastighet', 'Typ', 'Leverantörskostnad', 'Pris/kWh'].map((h, i) => (
                  <th key={i} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysFakturor.map(f => (
                  <tr key={f.id}>
                    <td style={td}>{formatDate(f.period_fran)} – {formatDate(f.period_till)}</td>
                    <td style={{ ...td, color: C.text }}>{f.fastighet.namn}</td>
                    <td style={{ ...td, color: C.text2 }}>{f.typ ? TYP_LABELS[f.typ] || f.typ : '—'}</td>
                    <td style={{ ...td, fontWeight: 600, color: C.warn }}>{formatSEK(f.total_belopp)}</td>
                    <td style={td}>{f.pris_per_kwh ? f.pris_per_kwh.toFixed(4) + ' kr' : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {hyresgastList.length === 0 && analysFakturor.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', ...card }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ color: C.muted, margin: 0 }}>Ingen data för valt filter</p>
          <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Justera år/kvartal/fastighet ovan — eller registrera leverantörsfakturor och skapa debiteringar.</p>
        </div>
      )}
    </div>
  )
}
