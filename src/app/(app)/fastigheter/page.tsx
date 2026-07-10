'use client'

// MODULROT /fastigheter — Dashboard/Översikt.
// Källa: src/app/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold-styles + emoji-ikoner. Data via den migrerade
// Supabase-routen /api/fastigheter/dashboard (svarskontraktet oförändrat).
// useBolag från porterad context. Bolagsväxlaren sitter redan i Subnav (layout.tsx),
// därför ingen egen <select> i headern (undviker dubbla växlare).
//
// Färgremap: blue/purple/indigo/orange-kort → guld/mörka paneler via C-tokens;
// grön/gul/röd highlight → C.ok/C.gold/C.danger; lucide-ikoner → emoji.

import { useEffect, useState } from 'react'
import { useBolag } from '@/components/fastigheter/BolagContext'
import { C, fmtKvm } from '@/components/fastigheter/styles'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface KommandeAvtal {
  id: string
  slutdatum: string
  status: string
  bashyra: number
  arshyra: number | null
  uppsagningstidHG: number | null
  uppsagningstidHV: number | null
  uppsagningstid: number
  hyresgast: { namn: string }
  lokaler: { lokal: { namn: string; fastighet: { namn: string } } }[]
}

interface VakansFastighet {
  fastighetId: string
  fastighetNamn: string
  antalByggnader: number
  totalBTA: number
  uthyrbarYta: number
  uthyrdYta: number
  vakantYta: number
  vakansgrad: number
  forloradHyra: number
  antalLokaler: number
  ledigaLokaler: number
}

interface DashboardData {
  totalLokaler: number
  uthyrdaLokaler: number
  ledigaLokaler: number
  belaggningsgrad: number
  totalHyraPerManad: number
  obetalda: number
  driftskostnaderManad: number
  aktiva_hyresgaster: number
  kommandeAvtal: KommandeAvtal[]
  totalBTA: number
  totalLOA: number
  totalUthyrdYta: number
  totalVakantYta: number
  totalVakansgrad: number
  totalForloradHyra: number
  vakansPerFastighet: VakansFastighet[]
}

const formatSEK = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)
const formatDate = (d: string) => new Date(d).toLocaleDateString('sv-SE')
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)

// Färg per vakansnivå (grön ≤5% · guld ≤15% · röd över)
const vakansFarg = (pct: number) => (pct <= 5 ? C.ok : pct <= 15 ? C.gold : C.danger)

function StatCard({
  title, value, subtitle, icon, highlight,
}: {
  title: string; value: string | number; subtitle?: string
  icon: string; highlight?: 'red' | 'green' | 'gold'
}) {
  const border =
    highlight === 'red' ? 'rgba(248,113,113,0.35)'
      : highlight === 'green' ? 'rgba(74,222,128,0.35)'
      : highlight === 'gold' ? 'rgba(232,201,106,0.35)'
      : C.borderSoft
  const bg =
    highlight === 'red' ? 'rgba(248,113,113,0.06)'
      : highlight === 'green' ? 'rgba(74,222,128,0.06)'
      : highlight === 'gold' ? C.goldSoft
      : C.panel
  const iconColor =
    highlight === 'red' ? C.danger
      : highlight === 'green' ? C.ok
      : highlight === 'gold' ? C.gold
      : C.gold
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${border}`, background: bg, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.muted, margin: 0 }}>{title}</p>
          <p style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 0 }}>{value}</p>
          {subtitle && <p style={{ marginTop: 4, fontSize: 12, color: C.muted, marginBottom: 0 }}>{subtitle}</p>}
        </div>
        <div style={{ borderRadius: 8, background: C.goldSoft, padding: 10, fontSize: 18, lineHeight: 1, color: iconColor, flexShrink: 0 }}>{icon}</div>
      </div>
    </div>
  )
}

function VakansBar({ pct }: { pct: number }) {
  const color = vakansFarg(pct)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: C.field, borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ height: 6, borderRadius: 999, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width .2s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, width: 44, textAlign: 'right', color }}>{pct.toFixed(1)}%</span>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '10px 16px', fontSize: 13, color: C.text2, verticalAlign: 'top' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }

export default function FastigheterDashboard() {
  const { valtBolagId } = useBolag()
  const isMobile = useIsMobile()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const url = valtBolagId ? `/api/fastigheter/dashboard?bolagId=${valtBolagId}` : '/api/fastigheter/dashboard'
    fetch(url).then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [valtBolagId])

  const vakansgrad = data?.totalVakansgrad ?? 0
  const hasYtadata = (data?.totalLOA ?? 0) > 0
  const vakansPerFastighet = data?.vakansPerFastighet ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(isMobile ? { overflowX: 'hidden' } : null) }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Översikt</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: C.muted2 }}>Laddar...</div>
      ) : (
        <>
          {/* KPI-kort rad 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            <StatCard
              title="Totalt lokaler"
              value={data?.totalLokaler ?? 0}
              subtitle={`${data?.ledigaLokaler ?? 0} lediga`}
              icon="🚪"
            />
            <StatCard
              title={hasYtadata ? 'Vakansgrad (yta)' : 'Vakansgrad (antal)'}
              value={hasYtadata ? `${vakansgrad}%` : `${(100 - (data?.belaggningsgrad ?? 0)).toFixed(1)}%`}
              subtitle={hasYtadata
                ? `${fmtKvm(data?.totalVakantYta ?? 0)} vakant av ${fmtKvm(data?.totalLOA ?? 0)}`
                : `${data?.ledigaLokaler ?? 0} av ${data?.totalLokaler ?? 0} lokaler`}
              icon="📉"
              highlight={vakansgrad <= 5 ? 'green' : vakansgrad <= 15 ? 'gold' : 'red'}
            />
            <StatCard
              title="Hyresintäkt/månad"
              value={formatSEK(data?.totalHyraPerManad ?? 0)}
              subtitle={`${formatSEK((data?.totalHyraPerManad ?? 0) * 12)}/år`}
              icon="🧾"
            />
            <StatCard
              title="Aktiva hyresgäster"
              value={data?.aktiva_hyresgaster ?? 0}
              subtitle="Med aktiva avtal"
              icon="👥"
            />
          </div>

          {/* Vakans sammanfattning (ytabaserad) */}
          {hasYtadata && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 0 }}>Total yta BTA</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>{fmtKvm(data?.totalBTA ?? 0)}</p>
                <p style={{ fontSize: 12, color: C.muted2, marginTop: 2, marginBottom: 0 }}>Bruttoarea alla byggnader</p>
              </div>
              <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 0 }}>Uthyrbar yta LOA</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>{fmtKvm(data?.totalLOA ?? 0)}</p>
                <p style={{ fontSize: 12, color: C.muted2, marginTop: 2, marginBottom: 0 }}>{fmtKvm(data?.totalUthyrdYta ?? 0)} uthyrd · {fmtKvm(data?.totalVakantYta ?? 0)} vakant</p>
              </div>
              <div style={{ borderRadius: 12, border: `1px solid ${(data?.totalForloradHyra ?? 0) > 0 ? 'rgba(248,113,113,0.3)' : C.borderSoft}`, background: (data?.totalForloradHyra ?? 0) > 0 ? 'rgba(248,113,113,0.06)' : C.panel, padding: 18 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, marginTop: 0 }}>Estimerad förlorad hyra</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: (data?.totalForloradHyra ?? 0) > 0 ? C.danger : C.text, margin: 0 }}>
                  {formatSEK(data?.totalForloradHyra ?? 0)}
                </p>
                <p style={{ fontSize: 12, color: C.muted2, marginTop: 2, marginBottom: 0 }}>{formatSEK((data?.totalForloradHyra ?? 0) * 12)}/år · Lediga lokalers bashyra</p>
              </div>
            </div>
          )}

          {/* Vakans per fastighet */}
          {vakansPerFastighet.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${C.borderSoft}` }}>
                <div style={{ borderRadius: 8, background: C.goldSoft, padding: 8, fontSize: 15, lineHeight: 1 }}>📐</div>
                <h3 style={{ fontWeight: 600, color: C.text, margin: 0, fontSize: 15 }}>Vakans per fastighet</h3>
              </div>
              {isMobile ? (
                <div style={{ padding: 12 }}>
                  {vakansPerFastighet.map(f => (
                    <div key={f.fastighetId} style={{ border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: 12, marginBottom: 8, background: C.panel2 }}>
                      <p style={{ fontWeight: 600, color: C.text, margin: 0, fontSize: 14 }}>{f.fastighetNamn}</p>
                      {f.antalByggnader > 0 && (
                        <p style={{ fontSize: 12, color: C.muted2, margin: '2px 0 0' }}>{f.antalByggnader} {f.antalByggnader === 1 ? 'byggnad' : 'byggnader'}</p>
                      )}
                      <div style={{ marginTop: 10, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 10 }}>
                        <VakansBar pct={f.uthyrbarYta > 0 ? f.vakansgrad : 0} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: C.muted2 }}>Lokaler</span>
                          <span style={{ color: C.muted }}>
                            {f.uthyrdYta > 0 ? f.antalLokaler - f.ledigaLokaler : '–'}/{f.antalLokaler}
                            {f.ledigaLokaler > 0 && <span style={{ marginLeft: 4, fontSize: 12, color: C.danger }}>({f.ledigaLokaler} ledig{f.vakantYta === 0 ? ' · yta saknas' : ''})</span>}
                          </span>
                        </div>
                        {hasYtadata && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.muted2 }}>BTA</span>
                            <span style={{ color: C.muted2 }}>{f.totalBTA > 0 ? fmtKvm(f.totalBTA) : '–'}</span>
                          </div>
                        )}
                        {hasYtadata && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.muted2 }}>LOA</span>
                            <span style={{ color: C.muted }}>{f.uthyrbarYta > 0 ? fmtKvm(f.uthyrbarYta) : '–'}</span>
                          </div>
                        )}
                        {hasYtadata && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.muted2 }}>Uthyrd yta</span>
                            <span style={{ color: C.muted }}>{f.uthyrdYta > 0 ? fmtKvm(f.uthyrdYta) : '–'}</span>
                          </div>
                        )}
                        {hasYtadata && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.muted2 }}>Vakant yta</span>
                            {f.vakantYta > 0 ? <span style={{ color: C.danger, fontWeight: 500 }}>{fmtKvm(f.vakantYta)}</span> : <span style={{ color: C.ok }}>–</span>}
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: C.muted2 }}>Est. förlorad hyra</span>
                          {f.forloradHyra > 0
                            ? <span style={{ color: C.danger, fontWeight: 500, textAlign: 'right' }}>{formatSEK(f.forloradHyra)}<br /><span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(248,113,113,0.7)' }}>{formatSEK(f.forloradHyra * 12)}/år</span></span>
                            : <span style={{ color: C.ok }}>–</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {vakansPerFastighet.length > 1 && (
                    <div style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: 12, background: C.panel2 }}>
                      <p style={{ fontWeight: 600, color: C.text, margin: 0, fontSize: 14 }}>Totalt</p>
                      <div style={{ marginTop: 10, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 10 }}>
                        <VakansBar pct={data?.totalVakansgrad ?? 0} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: C.muted2 }}>Lokaler</span>
                          <span style={{ color: C.text2, fontWeight: 600 }}>{data?.uthyrdaLokaler}/{data?.totalLokaler}</span>
                        </div>
                        {hasYtadata && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.muted2 }}>BTA</span>
                            <span style={{ color: C.muted2 }}>{(data?.totalBTA ?? 0) > 0 ? fmtKvm(data!.totalBTA) : '–'}</span>
                          </div>
                        )}
                        {hasYtadata && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.muted2 }}>LOA</span>
                            <span style={{ color: C.text2, fontWeight: 600 }}>{fmtKvm(data?.totalLOA ?? 0)}</span>
                          </div>
                        )}
                        {hasYtadata && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.muted2 }}>Uthyrd yta</span>
                            <span style={{ color: C.text2, fontWeight: 600 }}>{fmtKvm(data?.totalUthyrdYta ?? 0)}</span>
                          </div>
                        )}
                        {hasYtadata && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: C.muted2 }}>Vakant yta</span>
                            <span style={{ color: C.danger, fontWeight: 600 }}>{(data?.totalVakantYta ?? 0) > 0 ? fmtKvm(data!.totalVakantYta) : '–'}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: C.muted2 }}>Est. förlorad hyra</span>
                          {(data?.totalForloradHyra ?? 0) > 0
                            ? <span style={{ color: C.danger, fontWeight: 600, textAlign: 'right' }}>{formatSEK(data!.totalForloradHyra)}<br /><span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(248,113,113,0.7)' }}>{formatSEK(data!.totalForloradHyra * 12)}/år</span></span>
                            : <span style={{ color: C.danger, fontWeight: 600 }}>–</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.panel2, borderBottom: `1px solid ${C.borderSoft}` }}>
                      <th style={th}>Fastighet</th>
                      <th style={thR}>Lokaler</th>
                      {hasYtadata && <th style={thR}>BTA</th>}
                      {hasYtadata && <th style={thR}>LOA</th>}
                      {hasYtadata && <th style={thR}>Uthyrd yta</th>}
                      {hasYtadata && <th style={thR}>Vakant yta</th>}
                      <th style={{ ...th, minWidth: 140 }}>Vakansgrad</th>
                      <th style={thR}>Est. förlorad hyra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vakansPerFastighet.map(f => (
                      <tr key={f.fastighetId} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                        <td style={td}>
                          <p style={{ fontWeight: 500, color: C.text, margin: 0 }}>{f.fastighetNamn}</p>
                          {f.antalByggnader > 0 && (
                            <p style={{ fontSize: 12, color: C.muted2, margin: 0 }}>{f.antalByggnader} {f.antalByggnader === 1 ? 'byggnad' : 'byggnader'}</p>
                          )}
                        </td>
                        <td style={{ ...tdR, color: C.muted }}>
                          <span>{f.uthyrdYta > 0 ? f.antalLokaler - f.ledigaLokaler : '–'}/{f.antalLokaler}</span>
                          {f.ledigaLokaler > 0 && (
                            <span style={{ marginLeft: 4, fontSize: 12, color: C.danger }}>({f.ledigaLokaler} ledig)</span>
                          )}
                        </td>
                        {hasYtadata && <td style={{ ...tdR, color: C.muted2 }}>{f.totalBTA > 0 ? fmtKvm(f.totalBTA) : '–'}</td>}
                        {hasYtadata && <td style={{ ...tdR, color: C.muted }}>{f.uthyrbarYta > 0 ? fmtKvm(f.uthyrbarYta) : '–'}</td>}
                        {hasYtadata && <td style={{ ...tdR, color: C.muted }}>{f.uthyrdYta > 0 ? fmtKvm(f.uthyrdYta) : '–'}</td>}
                        {hasYtadata && (
                          <td style={tdR}>
                            {f.vakantYta > 0 ? <span style={{ color: C.danger, fontWeight: 500 }}>{fmtKvm(f.vakantYta)}</span> : <span style={{ color: C.ok }}>–</span>}
                          </td>
                        )}
                        <td style={td}>
                          {f.uthyrbarYta > 0
                            ? <VakansBar pct={f.vakansgrad} />
                            : <span style={{ fontSize: 12, color: C.muted2 }}>Ingen ytadata</span>}
                        </td>
                        <td style={tdR}>
                          {f.forloradHyra > 0
                            ? <span style={{ color: C.danger, fontWeight: 500 }}>{formatSEK(f.forloradHyra)}<br /><span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(248,113,113,0.7)' }}>{formatSEK(f.forloradHyra * 12)}/år</span></span>
                            : <span style={{ color: C.ok, fontSize: 12 }}>–</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {vakansPerFastighet.length > 1 && (
                    <tfoot>
                      <tr style={{ borderTop: `1px solid ${C.borderStrong}`, background: C.panel2, fontWeight: 600, color: C.text2 }}>
                        <td style={{ ...td, fontWeight: 600, color: C.text }}>Totalt</td>
                        <td style={tdR}>{data?.uthyrdaLokaler}/{data?.totalLokaler}</td>
                        {hasYtadata && <td style={{ ...tdR, color: C.muted2 }}>{(data?.totalBTA ?? 0) > 0 ? fmtKvm(data!.totalBTA) : '–'}</td>}
                        {hasYtadata && <td style={tdR}>{fmtKvm(data?.totalLOA ?? 0)}</td>}
                        {hasYtadata && <td style={tdR}>{fmtKvm(data?.totalUthyrdYta ?? 0)}</td>}
                        {hasYtadata && <td style={{ ...tdR, color: C.danger }}>{(data?.totalVakantYta ?? 0) > 0 ? fmtKvm(data!.totalVakantYta) : '–'}</td>}
                        <td style={td}><VakansBar pct={data?.totalVakansgrad ?? 0} /></td>
                        <td style={{ ...tdR, color: C.danger }}>{(data?.totalForloradHyra ?? 0) > 0 ? <>{formatSEK(data!.totalForloradHyra)}<br /><span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(248,113,113,0.7)' }}>{formatSEK(data!.totalForloradHyra * 12)}/år</span></> : '–'}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              )}
            </div>
          )}

          {/* Nedre rad: Ekonomi + Kommande avtal */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Ekonomi */}
            <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ borderRadius: 8, background: C.goldSoft, padding: 8, fontSize: 16, lineHeight: 1 }}>🧾</div>
                <h3 style={{ fontWeight: 600, color: C.text, margin: 0, fontSize: 15 }}>Ekonomi (innevarande månad)</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: C.muted }}>Hyresintäkter</span>
                  <span style={{ fontWeight: 500, color: C.ok }}>{formatSEK(data?.totalHyraPerManad ?? 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: C.muted }}>Driftskostnader</span>
                  <span style={{ fontWeight: 500, color: C.danger }}>{formatSEK(data?.driftskostnaderManad ?? 0)}</span>
                </div>
                {(data?.totalForloradHyra ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.muted2 }}>Förlorad hyra (vakans)</span>
                    <span style={{ fontWeight: 500, color: C.warn }}>−{formatSEK(data?.totalForloradHyra ?? 0)}</span>
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                  <span style={{ color: C.text2 }}>Netto</span>
                  <span style={{ color: (data?.totalHyraPerManad ?? 0) > (data?.driftskostnaderManad ?? 0) ? C.ok : C.danger }}>
                    {formatSEK((data?.totalHyraPerManad ?? 0) - (data?.driftskostnaderManad ?? 0))}
                  </span>
                </div>
                {(data?.obetalda ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, background: 'rgba(248,113,113,0.08)', padding: '8px 12px', marginTop: 4 }}>
                    <span style={{ fontSize: 13 }}>⚠️</span>
                    <span style={{ fontSize: 13, color: C.danger }}>{data?.obetalda} obetalda fakturor</span>
                  </div>
                )}
              </div>
            </div>

            {/* Kommande avtal */}
            <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ borderRadius: 8, background: C.goldSoft, padding: 8, fontSize: 16, lineHeight: 1 }}>📅</div>
                <h3 style={{ fontWeight: 600, color: C.text, margin: 0, fontSize: 15 }}>Avtal som löper ut</h3>
                <span style={{ fontSize: 12, color: C.muted2 }}>inom 12 månader</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data?.kommandeAvtal ?? []).length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, background: 'rgba(74,222,128,0.08)', padding: '8px 12px' }}>
                    <div style={{ height: 8, width: 8, borderRadius: 999, background: C.ok }} />
                    <span style={{ fontSize: 13, color: C.ok }}>Inga avtal löper ut inom 12 månader</span>
                  </div>
                ) : (
                  (data?.kommandeAvtal ?? []).map(a => {
                    const days = daysUntil(a.slutdatum)
                    const uppMån = a.uppsagningstidHG ?? a.uppsagningstid ?? 9
                    const uppDagar = uppMån * 30
                    const uppsagningDeadline = days - uppDagar
                    const isAkut = days <= 90
                    const isUppDeadline = uppsagningDeadline <= 30 && uppsagningDeadline > 0
                    const isPasserad = uppsagningDeadline <= 0
                    const hyra = a.arshyra ?? a.bashyra * 12

                    const cardBg = isPasserad ? 'rgba(248,113,113,0.08)'
                      : isAkut ? 'rgba(251,146,60,0.08)'
                      : isUppDeadline ? C.goldSoft
                      : C.field
                    const cardBorder = isPasserad ? 'rgba(248,113,113,0.3)'
                      : isAkut ? 'rgba(251,146,60,0.3)'
                      : isUppDeadline ? 'rgba(232,201,106,0.3)'
                      : C.borderSoft

                    return (
                      <div key={a.id} style={{ borderRadius: 8, padding: '12px 16px', background: cardBg, border: `1px solid ${cardBorder}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{a.hyresgast.namn}</p>
                            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{a.lokaler[0]?.lokal.fastighet.namn} – {a.lokaler.map(l => l.lokal.namn).join(', ')}</p>
                            <p style={{ fontSize: 12, color: C.muted2, marginTop: 2, marginBottom: 0 }}>{formatSEK(hyra)}/år</p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{formatDate(a.slutdatum)}</p>
                            <p style={{ fontSize: 12, fontWeight: 500, color: isAkut ? C.warn : C.muted, margin: 0 }}>{days} dagar kvar</p>
                          </div>
                        </div>
                        {(isPasserad || isUppDeadline) && (
                          <div style={{ marginTop: 8, borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 500, background: isPasserad ? 'rgba(248,113,113,0.15)' : C.goldSoft, color: isPasserad ? C.danger : C.gold }}>
                            {isPasserad
                              ? `⚠ Uppsägningstid (${uppMån} mån) har passerat — avtalet förlängs om inget görs`
                              : `Uppsägningstid (${uppMån} mån) — senast ${Math.abs(uppsagningDeadline)} dagar kvar att agera`}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
