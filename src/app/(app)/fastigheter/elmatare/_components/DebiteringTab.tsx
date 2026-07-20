import React from 'react'
import { C, btnPrimary } from '@/components/fastigheter/styles'
import {
  Omgang, OmgangDebitering, Fastighet,
  TYP_LABELS, typPill, formatSEK, formatDate, fmtKwh,
  card, cardHead, th, td, pill, iconBtn,
} from './shared'

interface Props {
  isMobile: boolean
  omgangar: Omgang[]
  fastigheter: Fastighet[]
  bolagMatch: (fastighetId: string | null | undefined) => boolean
  matpunktNamn: (matareId: string | null) => string
  skapaElFakturorValda: (perOmgang: { omgangId: string; hyresgaster: string[] }[]) => void
  deleteOmgang: (id: string) => void
  deleteHyresgastDebitering: (omgangId: string, hyresgastNamn: string) => void
  setOmgangFastighetId: (v: string) => void
  setOmgangAr: (v: number) => void
  setOmgangKvartal: (v: 1 | 2 | 3 | 4) => void
  setOmgangValda: (v: Set<string>) => void
  setShowNewOmgang: (v: boolean) => void
}

export default function DebiteringTab({
  isMobile, omgangar, fastigheter, bolagMatch, matpunktNamn,
  skapaElFakturorValda, deleteOmgang, deleteHyresgastDebitering,
  setOmgangFastighetId, setOmgangAr, setOmgangKvartal, setOmgangValda, setShowNewOmgang,
}: Props) {
  // Val av enskilda hyresgäster per omgång (nyckel: "omgangId::hyresgastNamn").
  const [valdaHyresgaster, setValdaHyresgaster] = React.useState<Set<string>>(new Set())
  const hgKey = (omgangId: string, namn: string) => `${omgangId}::${namn}`
  const toggleHyresgast = (omgangId: string, namn: string) => setValdaHyresgaster(prev => {
    const n = new Set(prev); const k = hgKey(omgangId, namn); n.has(k) ? n.delete(k) : n.add(k); return n
  })
  // Respektera bolagsväljaren (omgång bär fastighet_id)
  const synligaOmgangar = omgangar.filter(o => bolagMatch(o.fastighet_id))

  // Urvalet ligger i en Set som INTE rensas när omgångar ändras, tas bort eller
  // döljs av bolagsväljaren. Utan avstämning kunde kvarvarande markeringar både
  // blåsa upp räknaren ("4 valda" när 2 syns) OCH faktureras oavsiktligt.
  // Därför: räkna och fakturera BARA markeringar som hör till en hyresgäst som
  // faktiskt visas just nu → siffran matchar alltid kryssrutorna på skärmen.
  const giltigaNycklar = new Set<string>()
  for (const o of synligaOmgangar) {
    for (const d of o.debiteringar ?? []) giltigaNycklar.add(hgKey(o.id, d.hyresgast_namn))
  }
  const valdaSynliga = new Set([...valdaHyresgaster].filter(k => giltigaNycklar.has(k)))
  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
      {valdaSynliga.size > 0 && (
        <button
          onClick={() => {
            // Gruppera valda hyresgäster per omgång (nyckel: "omgangId::namn").
            const perOmgang: { omgangId: string; hyresgaster: string[] }[] = []
            for (const k of valdaSynliga) {
              const i = k.indexOf('::'); const omgangId = k.slice(0, i); const namn = k.slice(i + 2)
              let g = perOmgang.find(x => x.omgangId === omgangId)
              if (!g) { g = { omgangId, hyresgaster: [] }; perOmgang.push(g) }
              g.hyresgaster.push(namn)
            }
            skapaElFakturorValda(perOmgang)
            setValdaHyresgaster(new Set())
          }}
          style={{ padding: '10px 18px', borderRadius: 8, background: C.gold, border: 'none', color: '#1a1a1a', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...(isMobile ? { width: '100%' } : {}) }}
        >
          Skapa el-fakturor för {valdaSynliga.size} vald{valdaSynliga.size === 1 ? '' : 'a'} hyresgäst{valdaSynliga.size === 1 ? '' : 'er'}
        </button>
      )}
      <button
        onClick={() => {
          const fid = fastigheter[0]?.id || ''
          setOmgangFastighetId(fid)
          setOmgangAr(new Date().getFullYear())
          setOmgangKvartal(1)
          setOmgangValda(new Set())
          setShowNewOmgang(true)
        }}
        style={{ ...btnPrimary, opacity: fastigheter.length === 0 ? 0.5 : 1, ...(isMobile ? { width: '100%' } : {}) }}
        disabled={fastigheter.length === 0}
      >
        + Ny debiteringsomgång
      </button>
    </div>

    {synligaOmgangar.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '64px 0', ...card }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
        <p style={{ color: C.muted, margin: 0 }}>{omgangar.length === 0 ? 'Inga debiteringsomgångar' : 'Inga debiteringsomgångar för valt bolag'}</p>
        <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Skapa en omgång för att slå ihop nät- och handelsfakturor till ett blandpris och debitera hyresgästerna.</p>
      </div>
    ) : synligaOmgangar.map(o => {
      const utdeb = o.debiteringar.reduce((s, d) => s + d.belopp, 0)
      const utdebKwh = o.debiteringar.reduce((s, d) => s + (d.forbrukning ?? 0), 0)
      const differens = utdeb - o.total_kostnad
      return (
        <div key={o.id} style={card}>
          <div style={{ ...cardHead, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0 }}>{o.fastighet?.namn} — {formatDate(o.period_fran)} – {formatDate(o.period_till)}</h3>
              <p style={{ fontSize: 12, color: C.muted, margin: '4px 0 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>Total kWh: <span style={{ color: C.text2 }}>{o.total_kwh != null ? fmtKwh(o.total_kwh) : '—'}</span></span>
                <span>Total kostnad: <span style={{ color: C.text2 }}>{formatSEK(o.total_kostnad)}</span></span>
                <span>Blandpris: <span style={{ color: C.gold }}>{o.blandpris != null ? o.blandpris.toFixed(4) + ' kr/kWh' : '—'}</span></span>
              </p>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {Object.entries(o.fakturor.reduce((acc, f) => {
                  const t = f.typ || 'ovrigt'
                  if (!acc[t]) acc[t] = { summa: 0, antal: 0 }
                  acc[t].summa += f.total_belopp; acc[t].antal++
                  return acc
                }, {} as Record<string, { summa: number; antal: number }>)).map(([typ, v]) => (
                  <span key={typ} style={pill(typPill(typ)?.background as string || 'rgba(136,136,136,0.14)', typPill(typ)?.color as string || '#aaa')}>
                    {TYP_LABELS[typ] || 'Faktura'}{v.antal > 1 ? ` (${v.antal} st)` : ''} · {formatSEK(v.summa)}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={pill('rgba(232,201,106,0.12)', C.gold)}>{o.status}</span>
              {(() => {
                const harFakturerad = o.debiteringar.some(d => d.status === 'fakturerad')
                return (
                  <button
                    onClick={() => { if (!harFakturerad) deleteOmgang(o.id) }}
                    disabled={harFakturerad}
                    title={harFakturerad ? 'Kan inte tas bort — omgången har fakturerade hyresgäster. Kreditera/ta bort el-fakturorna först.' : 'Ta bort omgången'}
                    style={{ ...iconBtn, opacity: harFakturerad ? 0.3 : 1, cursor: harFakturerad ? 'not-allowed' : 'pointer' }}>
                    🗑️
                  </button>
                )
              })()}
            </div>
          </div>
          {(() => {
            // Gruppera debiteringsrader per hyresgäst (behåll ordning)
            const grupper: { namn: string; rader: OmgangDebitering[] }[] = []
            for (const d of o.debiteringar) {
              let g = grupper.find(x => x.namn === d.hyresgast_namn)
              if (!g) { g = { namn: d.hyresgast_namn, rader: [] }; grupper.push(g) }
              g.rader.push(d)
            }
            if (isMobile) {
              // MOBIL: kortlayout per debiteringsrad (ingen horisontell scroll)
              return (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {o.debiteringar.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: C.muted2, fontSize: 12, borderTop: `1px solid ${C.borderSoft}` }}>Inga aktiva mätare i fastigheten</div>
                  ) : grupper.map(g => {
                    const gKwh = g.rader.reduce((s, d) => s + (d.forbrukning ?? 0), 0)
                    const gBelopp = g.rader.reduce((s, d) => s + d.belopp, 0)
                    const gFakturerad = g.rader.some(d => d.status === 'fakturerad')
                    return (
                      <div key={g.namn} style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px' }}>
                        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: C.text, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={valdaHyresgaster.has(hgKey(o.id, g.namn))} onChange={() => toggleHyresgast(o.id, g.namn)} style={{ width: 14, height: 14, accentColor: C.gold, cursor: 'pointer' }} />{g.namn}</span>
                          <button onClick={() => { if (!gFakturerad) deleteHyresgastDebitering(o.id, g.namn) }} disabled={gFakturerad}
                            title={gFakturerad ? 'Kan inte tas bort — hyresgästen är fakturerad. Kreditera fakturan först.' : 'Ta bort hyresgästen ur omgången'}
                            style={{ ...iconBtn, opacity: gFakturerad ? 0.3 : 1, cursor: gFakturerad ? 'not-allowed' : 'pointer' }}>🗑️</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {g.rader.map(d => (
                            <div key={d.id} style={{ borderRadius: 8, background: C.panel2, padding: 10, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ color: C.text2 }}>{matpunktNamn(d.matare_id)}</span>
                                <span style={{ fontWeight: 700, color: C.text }}>{formatSEK(d.belopp)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, color: C.muted2 }}>
                                <span>{d.forbrukning != null ? fmtKwh(d.forbrukning) : <span style={{ color: C.warn }}>Avläsning saknas</span>} · {d.pris_per_kwh.toFixed(4)} kr</span>
                                {d.status === 'fakturerad'
                                  ? <span style={pill('rgba(74,222,128,0.12)', C.ok)}>Fakturerad</span>
                                  : <span style={pill('rgba(251,146,60,0.12)', C.warn)}>Ej fakturerad</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {g.rader.length >= 1 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8, fontSize: 12 }}>
                            <span style={{ color: C.muted2 }}>Summa {g.namn} · {fmtKwh(gKwh)}</span>
                            <span style={{ fontWeight: 700, color: C.gold }}>{formatSEK(gBelopp)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div style={{ borderTop: `1px solid ${C.border}`, background: '#000', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: C.text }}>Totalt utdebiterat · {fmtKwh(utdebKwh)}</span>
                      <span style={{ fontWeight: 700, color: C.gold }}>{formatSEK(utdeb)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                      <span style={{ color: C.muted }}>Differens mot total kostnad</span>
                      <span style={{ fontWeight: 700, color: differens >= 0 ? C.blue : C.danger }}>{differens >= 0 ? '+' : ''}{formatSEK(differens)}</span>
                    </div>
                  </div>
                </div>
              )
            }
            return (
          <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Hyresgäst', 'Mätpunkt', 'Förbrukning', 'Pris/kWh', 'Att debitera', 'Status'].map((h, i) => (
                  <th key={i} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {o.debiteringar.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: C.muted2 }}>Inga aktiva mätare i fastigheten</td></tr>
              ) : grupper.map((g, gi) => {
                const gKwh = g.rader.reduce((s, d) => s + (d.forbrukning ?? 0), 0)
                const gBelopp = g.rader.reduce((s, d) => s + d.belopp, 0)
                const gFakturerad = g.rader.some(d => d.status === 'fakturerad')
                return (
                  <React.Fragment key={g.namn}>
                    {gi > 0 && <tr aria-hidden="true"><td colSpan={6} style={{ height: 16 }} /></tr>}
                    {g.rader.map((d, i) => (
                      <tr key={d.id}>
                        <td style={{ ...td, fontWeight: 600, color: C.text, borderTop: i === 0 ? `1px solid ${C.borderSoft}` : 'none' }}>{i === 0 ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={valdaHyresgaster.has(hgKey(o.id, g.namn))} onChange={() => toggleHyresgast(o.id, g.namn)} style={{ width: 14, height: 14, accentColor: C.gold, cursor: 'pointer' }} title="Välj hyresgäst att fakturera" />{g.namn}<button onClick={() => { if (!gFakturerad) deleteHyresgastDebitering(o.id, g.namn) }} disabled={gFakturerad} title={gFakturerad ? 'Kan inte tas bort — hyresgästen är fakturerad. Kreditera fakturan först.' : 'Ta bort hyresgästen ur omgången'} style={{ ...iconBtn, opacity: gFakturerad ? 0.3 : 1, cursor: gFakturerad ? 'not-allowed' : 'pointer', fontSize: 12 }}>🗑️</button></span>) : ''}</td>
                        <td style={{ ...td, color: C.text2, borderTop: i === 0 ? `1px solid ${C.borderSoft}` : 'none' }}>{matpunktNamn(d.matare_id)}</td>
                        <td style={{ ...td, borderTop: i === 0 ? `1px solid ${C.borderSoft}` : 'none' }}>{d.forbrukning != null ? fmtKwh(d.forbrukning) : <span style={{ fontSize: 11, color: C.warn }}>Avläsning saknas</span>}</td>
                        <td style={{ ...td, borderTop: i === 0 ? `1px solid ${C.borderSoft}` : 'none' }}>{d.pris_per_kwh.toFixed(4)} kr</td>
                        <td style={{ ...td, fontWeight: 700, color: C.text, borderTop: i === 0 ? `1px solid ${C.borderSoft}` : 'none' }}>{formatSEK(d.belopp)}</td>
                        <td style={{ ...td, borderTop: i === 0 ? `1px solid ${C.borderSoft}` : 'none' }}>
                          {d.status === 'fakturerad'
                            ? <span style={pill('rgba(74,222,128,0.12)', C.ok)}>Fakturerad</span>
                            : <span style={pill('rgba(251,146,60,0.12)', C.warn)}>Ej fakturerad</span>}
                        </td>
                      </tr>
                    ))}
                    {g.rader.length >= 1 && (
                      <tr>
                        <td style={{ ...td, borderTop: 'none' }}></td>
                        <td style={{ ...td, color: C.muted2, fontSize: 12, borderTop: 'none' }}>Summa {g.namn}</td>
                        <td style={{ ...td, color: C.text2, fontWeight: 600, borderTop: 'none' }}>{fmtKwh(gKwh)}</td>
                        <td style={{ ...td, borderTop: 'none' }}></td>
                        <td style={{ ...td, fontWeight: 700, color: C.gold, borderTop: 'none' }}>{formatSEK(gBelopp)}</td>
                        <td style={{ ...td, borderTop: 'none' }}></td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#000' }}>
                <td colSpan={2} style={{ ...td, fontWeight: 700, color: C.text, borderTop: `1px solid ${C.border}` }}>Totalt utdebiterat</td>
                <td style={{ ...td, color: C.text2, borderTop: `1px solid ${C.border}` }}>{fmtKwh(utdebKwh)}</td>
                <td style={{ ...td, borderTop: `1px solid ${C.border}` }}></td>
                <td style={{ ...td, fontWeight: 700, color: C.gold, borderTop: `1px solid ${C.border}` }}>{formatSEK(utdeb)}</td>
                <td style={{ ...td, borderTop: `1px solid ${C.border}` }}></td>
              </tr>
              <tr style={{ background: '#000' }}>
                <td colSpan={2} style={{ ...td, color: C.muted, borderTop: 'none' }}>Differens mot total kostnad</td>
                <td style={{ ...td, borderTop: 'none' }}></td>
                <td style={{ ...td, borderTop: 'none' }}></td>
                <td style={{ ...td, fontWeight: 700, borderTop: 'none', color: differens >= 0 ? C.blue : C.danger }}>{differens >= 0 ? '+' : ''}{formatSEK(differens)}</td>
                <td style={{ ...td, borderTop: 'none' }}></td>
              </tr>
            </tfoot>
          </table>
          </div>
            )
          })()}
        </div>
      )
    })}
  </div>
  )
}
