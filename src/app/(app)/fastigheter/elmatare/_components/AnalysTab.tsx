import React from 'react'
import { C } from '@/components/fastigheter/styles'
import {
  LevFaktura,
  formatSEK, formatDate, fmtKwh,
  card, cardHead, th, td,
} from './shared'

interface Props {
  isMobile: boolean
  levFakturor: LevFaktura[]
  bolagMatch: (fastighetId: string | null | undefined) => boolean
}

export default function AnalysTab({ isMobile, levFakturor, bolagMatch }: Props) {
  // Respektera bolagsväljaren i hela analysen
  const analysFakturor = levFakturor.filter(f => bolagMatch(f.fastighet_id))
  const perHyresgast: Record<string, { namn: string; totalKwh: number; totalDebiterat: number; perioder: number }> = {}
  analysFakturor.forEach(f => {
    f.debiteringar.forEach(d => {
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
              {analysFakturor.map(f => {
                const utdeb = f.debiteringar.reduce((s, d) => s + d.belopp, 0)
                const diff = utdeb - f.total_belopp
                return (
                  <div key={f.id} style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{f.fastighet.namn}</span>
                      <span style={{ color: C.muted2, fontSize: 12 }}>{formatDate(f.period_fran)} – {formatDate(f.period_till)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 8, fontSize: 12 }}>
                      <div><span style={{ color: C.muted2 }}>Lev.kostnad: </span><span style={{ fontWeight: 600, color: C.warn }}>{formatSEK(f.total_belopp)}</span></div>
                      <div><span style={{ color: C.muted2 }}>Utdebiterat: </span><span style={{ fontWeight: 600, color: C.ok }}>{utdeb > 0 ? formatSEK(utdeb) : '—'}</span></div>
                      <div><span style={{ color: C.muted2 }}>Differens: </span>{utdeb > 0 ? <span style={{ fontWeight: 600, color: diff >= 0 ? C.blue : C.danger }}>{diff >= 0 ? '+' : ''}{formatSEK(diff)}</span> : '—'}</div>
                      <div><span style={{ color: C.muted2 }}>Pris/kWh: </span><span style={{ color: C.text2 }}>{f.pris_per_kwh ? f.pris_per_kwh.toFixed(4) + ' kr' : '—'}</span></div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.panel2 }}>
                {['Period', 'Fastighet', 'Leverantörskostnad', 'Utdebiterat', 'Differens', 'Pris/kWh'].map((h, i) => (
                  <th key={i} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysFakturor.map(f => {
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
          )}
        </div>
      )}

      {hyresgastList.length === 0 && analysFakturor.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', ...card }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ color: C.muted, margin: 0 }}>Ingen data ännu</p>
          <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Registrera leverantörsfakturor och skapa debiteringar för att se analysen.</p>
        </div>
      )}
    </div>
  )
}
