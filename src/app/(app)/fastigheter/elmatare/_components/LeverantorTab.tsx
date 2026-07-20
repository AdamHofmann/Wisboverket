import { C, inp, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'
import { useConfirm } from '@/components/ConfirmDialog'
import Sokfalt from '@/components/Sokfalt'
import {
  LevFaktura, Fastighet, LevForm, Sort,
  TYP_LABELS, typPill, formatSEK, formatDate,
  card, th, td, pill, iconBtn,
} from './shared'

interface Props {
  isMobile: boolean
  levFakturor: LevFaktura[]
  fastigheter: Fastighet[]
  sok: string
  setSok: (v: string) => void
  levSort: Sort
  toggleLevSort: (key: string) => void
  levSortVal: (f: LevFaktura, key: string) => string | number
  levFilterFastighet: string
  setLevFilterFastighet: (v: string) => void
  levFilterLeverantor: string
  setLevFilterLeverantor: (v: string) => void
  levFilterStatus: string
  setLevFilterStatus: (v: string) => void
  levFilterTyp: string
  setLevFilterTyp: (v: string) => void
  bolagMatch: (fastighetId: string | null | undefined) => boolean
  confirm: ReturnType<typeof useConfirm>
  load: () => void
  oppnaRedigeraLev: (f: LevFaktura) => void
  setShowNewLev: (v: boolean) => void
  setLevEditId: (v: string | null) => void
  setLevSkannadAdress: (v: string | null) => void
  setLevMatchStatus: (v: 'match' | 'ingen' | null) => void
  setLevForm: (v: LevForm) => void
}

export default function LeverantorTab({
  isMobile, levFakturor, fastigheter, sok, setSok, levSort, toggleLevSort, levSortVal,
  levFilterFastighet, setLevFilterFastighet, levFilterLeverantor, setLevFilterLeverantor,
  levFilterStatus, setLevFilterStatus, levFilterTyp, setLevFilterTyp, bolagMatch,
  confirm, load, oppnaRedigeraLev, setShowNewLev, setLevEditId, setLevSkannadAdress,
  setLevMatchStatus, setLevForm,
}: Props) {
  const iBolag = levFakturor.filter(f => bolagMatch(f.fastighet_id))
  const distinctFast = [...new Set(iBolag.map(f => f.fastighet?.namn).filter(Boolean))].sort()
  const distinctLev = [...new Set(iBolag.map(f => f.leverantor).filter((n): n is string => !!n))].sort()
  const sokQ = sok.trim().toLowerCase()
  const visade = levFakturor
    .filter(f => bolagMatch(f.fastighet_id))
    .filter(f => !levFilterFastighet || f.fastighet?.namn === levFilterFastighet)
    .filter(f => !levFilterLeverantor || f.leverantor === levFilterLeverantor)
    .filter(f => !levFilterTyp || f.typ === levFilterTyp)
    .filter(f => !levFilterStatus || (levFilterStatus === 'debiterad' ? f.debiteringar.length > 0 : f.debiteringar.length === 0))
    .filter(f => !sokQ || [f.fastighet?.namn, f.leverantor, f.fakturanummer].some(v => (v || '').toLowerCase().includes(sokQ)))
    .slice()
    .sort((a, b) => {
      const va = levSortVal(a, levSort.key), vb = levSortVal(b, levSort.key)
      const c = va < vb ? -1 : va > vb ? 1 : 0
      return levSort.dir === 'asc' ? c : -c
    })
  const filterAktivt = levFilterFastighet || levFilterLeverantor || levFilterTyp || levFilterStatus
  const COLS: { label: string; key: string | null }[] = [
    { label: 'Fastighet', key: 'fastighet' }, { label: 'Leverantör', key: 'leverantor' },
    { label: 'Typ', key: 'typ' },
    { label: 'Period', key: 'period' }, { label: 'Tot. kWh', key: 'total_kwh' },
    { label: 'Belopp exkl.', key: 'total_belopp' }, { label: 'Pris/kWh', key: 'pris_per_kwh' },
    { label: 'Status', key: 'status' }, { label: '', key: null },
  ]
  const selStyle = { ...inp, width: 'auto', minWidth: 150, paddingTop: 6, paddingBottom: 6, fontSize: 12, ...(isMobile ? { width: '100%', minWidth: 0 } : {}) }
  return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', width: '100%' } : {}) }}>
        <Sokfalt value={sok} onChange={setSok} placeholder="Sök fastighet, leverantör, fakturanr..." style={{ width: isMobile ? '100%' : 240 }} />
        <select style={selStyle} value={levFilterFastighet} onChange={e => setLevFilterFastighet(e.target.value)} onFocus={fo} onBlur={fb}>
          <option value="">Alla fastigheter</option>
          {distinctFast.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select style={selStyle} value={levFilterLeverantor} onChange={e => setLevFilterLeverantor(e.target.value)} onFocus={fo} onBlur={fb}>
          <option value="">Alla leverantörer</option>
          {distinctLev.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select style={selStyle} value={levFilterTyp} onChange={e => setLevFilterTyp(e.target.value)} onFocus={fo} onBlur={fb}>
          <option value="">Alla typer</option>
          <option value="nat">Nät</option>
          <option value="handel">Handel</option>
          <option value="kombinerad">Nät + handel</option>
          <option value="ovrigt">Övrigt</option>
        </select>
        <select style={selStyle} value={levFilterStatus} onChange={e => setLevFilterStatus(e.target.value)} onFocus={fo} onBlur={fb}>
          <option value="">Alla statusar</option>
          <option value="ej">Ej debiterad</option>
          <option value="debiterad">Debitering klar</option>
        </select>
        {filterAktivt && (
          <button onClick={() => { setLevFilterFastighet(''); setLevFilterLeverantor(''); setLevFilterTyp(''); setLevFilterStatus('') }}
            style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>Rensa filter</button>
        )}
        <span style={{ fontSize: 12, color: C.muted2 }}>{visade.length} av {iBolag.length}</span>
      </div>
      <button onClick={() => { setShowNewLev(true); setLevEditId(null); setLevSkannadAdress(null); setLevMatchStatus(null); setLevForm({ fastighetId: fastigheter[0]?.id || '', periodFran: '', periodTill: '', totalKwh: '', totalBelopp: '', fakturanummer: '', leverantor: '', typ: '' }) }} style={{ ...btnPrimary, ...(isMobile ? { width: '100%' } : {}) }}>
        + Ny faktura
      </button>
    </div>
    {isMobile ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visade.length === 0 ? (
          <div style={{ ...card, padding: 16, textAlign: 'center', color: C.muted2, fontSize: 13 }}>{levFakturor.length === 0 ? 'Inga leverantörsfakturor' : 'Inga träffar med valt filter'}</div>
        ) : visade.map(f => (
          <div key={f.id} onClick={() => oppnaRedigeraLev(f)}
            style={{ borderRadius: 10, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 12, marginBottom: 0, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{f.fastighet.namn}</div>
              <button onClick={async e => { e.stopPropagation(); if (await confirm({ message: 'Ta bort?', danger: true, confirmLabel: 'Ta bort' })) { await fetch(`/api/fastigheter/el-leverantor/${f.id}`, { method: 'DELETE' }); load() } }} style={iconBtn}>🗑️</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 6 }}>
              {f.typ && typPill(f.typ) ? <span style={pill(typPill(f.typ)!.background as string, typPill(f.typ)!.color as string)}>{TYP_LABELS[f.typ]}</span> : null}
              {f.debiteringar.length > 0
                ? <span style={pill('rgba(74,222,128,0.12)', C.ok)}>Debitering klar</span>
                : <span style={pill('rgba(251,146,60,0.12)', C.warn)}>Ej debiterad</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 10, fontSize: 12 }}>
              <div><span style={{ color: C.muted2 }}>Leverantör: </span><span style={{ color: C.text2 }}>{f.leverantor || '—'}</span></div>
              <div><span style={{ color: C.muted2 }}>Tot. kWh: </span><span style={{ color: C.text2 }}>{f.total_kwh ? f.total_kwh.toLocaleString('sv-SE') : '—'}</span></div>
              <div><span style={{ color: C.muted2 }}>Period: </span><span style={{ color: C.text2 }}>{formatDate(f.period_fran)} – {formatDate(f.period_till)}</span></div>
              <div><span style={{ color: C.muted2 }}>Pris/kWh: </span><span style={{ color: C.text2 }}>{f.pris_per_kwh ? f.pris_per_kwh.toFixed(4) + ' kr' : '—'}</span></div>
              <div><span style={{ color: C.muted2 }}>Belopp exkl.: </span><span style={{ color: C.text, fontWeight: 600 }}>{formatSEK(f.total_belopp)}</span></div>
              {f.fakturanummer ? <div><span style={{ color: C.muted2 }}>Fakturanr: </span><span style={{ color: C.text2 }}>{f.fakturanummer}</span></div> : null}
            </div>
          </div>
        ))}
      </div>
    ) : (
    <div style={card}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: C.panel2 }}>
            {COLS.map((c, i) => {
              const aktiv = c.key && levSort.key === c.key
              return (
                <th key={i} onClick={() => c.key && toggleLevSort(c.key)}
                  style={{ ...th, cursor: c.key ? 'pointer' : 'default', color: aktiv ? C.gold : th.color, userSelect: 'none', whiteSpace: 'nowrap' }}>
                  {c.label}{aktiv ? (levSort.dir === 'asc' ? ' ▲' : ' ▼') : c.key ? <span style={{ opacity: 0.25 }}> ⇅</span> : ''}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {visade.length === 0 ? (
            <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: C.muted2 }}>{levFakturor.length === 0 ? 'Inga leverantörsfakturor' : 'Inga träffar med valt filter'}</td></tr>
          ) : visade.map(f => (
            <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => oppnaRedigeraLev(f)}
              onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ ...td, fontWeight: 600, color: C.text }}>{f.fastighet.namn}</td>
              <td style={td}>{f.leverantor || <span style={{ color: C.muted2 }}>—</span>}</td>
              <td style={td}>{f.typ && typPill(f.typ) ? <span style={pill(typPill(f.typ)!.background as string, typPill(f.typ)!.color as string)}>{TYP_LABELS[f.typ]}</span> : <span style={{ color: C.muted2 }}>—</span>}</td>
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
                  <button onClick={async e => { e.stopPropagation(); if (await confirm({ message: 'Ta bort?', danger: true, confirmLabel: 'Ta bort' })) { await fetch(`/api/fastigheter/el-leverantor/${f.id}`, { method: 'DELETE' }); load() } }} style={iconBtn}>🗑️</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    )}
  </div>
  )
}
