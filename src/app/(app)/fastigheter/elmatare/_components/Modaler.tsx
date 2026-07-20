import React from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'
import { elKvartalKostnadsGap, elMatpunkterUtanAvlasning, KOMBINERAD } from '@/lib/fastigheter/elKostnad'
import {
  Matare, Fastighet, Lokal, LevFaktura, MatareForm, LevForm,
  TYP_LABELS, typPill, formatSEK, formatDate, fmtKwh, pill,
} from './shared'

interface Props {
  isMobile: boolean
  saving: boolean
  skannar: boolean
  matare: Matare[]
  fastigheter: Fastighet[]
  lokaler: Lokal[]
  levFakturor: LevFaktura[]

  getHyresgast: (m: Matare) => string
  getSenaste: (m: Matare) => { id: string; datum: string; varde: number; avlast_av: string | null } | null
  hyresgasterUtanMatare: string[]
  matchaFastighet: (adr: string) => Fastighet | null
  kvartalPeriod: (ar: number, q: 1 | 2 | 3 | 4) => { fran: string; till: string }
  fakturorForKvartal: () => LevFaktura[]

  // Ny mätpunkt
  showNewMatare: boolean
  setShowNewMatare: (v: boolean) => void
  matareForm: MatareForm
  setMatareForm: React.Dispatch<React.SetStateAction<MatareForm>>
  saveMatare: () => void

  // Ny avläsning
  showNewAvl: boolean
  setShowNewAvl: (v: boolean) => void
  avlHyresgast: string
  setAvlHyresgast: (v: string) => void
  avlValues: Record<string, string>
  setAvlValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  avlPrev: Record<string, string>
  setAvlPrev: React.Dispatch<React.SetStateAction<Record<string, string>>>
  avlDatum: string
  setAvlDatum: (v: string) => void
  avlPrevDatum: string
  setAvlPrevDatum: (v: string) => void
  avlAvlastAv: string
  setAvlAvlastAv: (v: string) => void
  saveAvl: () => void

  // Ny leverantörsfaktura
  showNewLev: boolean
  setShowNewLev: (v: boolean) => void
  levEditId: string | null
  setLevEditId: (v: string | null) => void
  levForm: LevForm
  setLevForm: React.Dispatch<React.SetStateAction<LevForm>>
  levSkannadAdress: string | null
  setLevSkannadAdress: (v: string | null) => void
  levMatchStatus: 'match' | 'ingen' | null
  setLevMatchStatus: (v: 'match' | 'ingen' | null) => void
  setSkannar: (v: boolean) => void
  saveLev: () => void

  // Ny debiteringsomgång
  showNewOmgang: boolean
  setShowNewOmgang: (v: boolean) => void
  omgangFastighetId: string
  setOmgangFastighetId: (v: string) => void
  omgangAr: number
  setOmgangAr: (v: number) => void
  omgangKvartal: 1 | 2 | 3 | 4
  setOmgangKvartal: (v: 1 | 2 | 3 | 4) => void
  omgangValda: Set<string>
  setOmgangValda: React.Dispatch<React.SetStateAction<Set<string>>>
  saveOmgang: () => void
}

export default function Modaler(props: Props) {
  const {
    isMobile, saving, skannar, matare, fastigheter, lokaler,
    getHyresgast, getSenaste, hyresgasterUtanMatare, matchaFastighet, kvartalPeriod, fakturorForKvartal,
    showNewMatare, setShowNewMatare, matareForm, setMatareForm, saveMatare,
    showNewAvl, setShowNewAvl, avlHyresgast, setAvlHyresgast, avlValues, setAvlValues,
    avlPrev, setAvlPrev, avlDatum, setAvlDatum, avlPrevDatum, setAvlPrevDatum, avlAvlastAv, setAvlAvlastAv, saveAvl,
    showNewLev, setShowNewLev, levEditId, setLevEditId, levForm, setLevForm,
    levSkannadAdress, setLevSkannadAdress, levMatchStatus, setLevMatchStatus, setSkannar, saveLev,
    showNewOmgang, setShowNewOmgang, omgangFastighetId, setOmgangFastighetId,
    omgangAr, setOmgangAr, omgangKvartal, setOmgangKvartal, omgangValda, setOmgangValda, saveOmgang,
  } = props

  return (
    <>
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
            <input style={inp} onFocus={fo} onBlur={fb} value={matareForm.beskrivning} onChange={e => setMatareForm({ ...matareForm, beskrivning: e.target.value })} placeholder="T.ex. Verkstad, Bod, Uppvärmning" />
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
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div><label style={lbl}>Datum</label>
                <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={avlDatum} onChange={e => setAvlDatum(e.target.value)} /></div>
              <div><label style={lbl}>Avläst av</label>
                <input style={inp} onFocus={fo} onBlur={fb} value={avlAvlastAv} onChange={e => setAvlAvlastAv(e.target.value)} placeholder="Namn" /></div>
            </div>
          )}

          {avlHyresgast && matare.some(m => m.aktiv && !m.schablon_kwh && getHyresgast(m) === avlHyresgast && (m.avlasningar?.length || 0) === 0) && (
            <div>
              <label style={lbl}>Startdatum (nya mätpunkter)</label>
              <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={avlPrevDatum} onChange={e => setAvlPrevDatum(e.target.value)} />
              <p style={{ fontSize: 11, color: C.muted2, margin: '4px 0 0' }}>Startvärdet du fyller i sparas som första avläsning med detta datum, så förbrukningen kan räknas ut.</p>
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
      <SlideOver open={showNewLev} onClose={() => { setShowNewLev(false); setLevEditId(null) }} title={levEditId ? 'Redigera leverantörsfaktura' : 'Ny leverantörsfaktura'} width="md"
        footer={<div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { setShowNewLev(false); setLevEditId(null) }} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
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
                  const matchad = data.anlaggningsadress ? matchaFastighet(data.anlaggningsadress) : null
                  setLevSkannadAdress(data.anlaggningsadress ?? null)
                  setLevMatchStatus(data.anlaggningsadress ? (matchad ? 'match' : 'ingen') : null)
                  setLevForm(prev => ({
                    ...prev,
                    fastighetId: matchad ? matchad.id : prev.fastighetId,
                    periodFran: data.periodFran ?? prev.periodFran,
                    periodTill: data.periodTill ?? prev.periodTill,
                    totalKwh: data.totalKwh?.toString() ?? prev.totalKwh,
                    totalBelopp: data.totalBelopp?.toString() ?? prev.totalBelopp,
                    fakturanummer: data.fakturanummer ?? prev.fakturanummer,
                    leverantor: data.leverantor ?? prev.leverantor,
                    typ: data.typ ?? prev.typ,
                  }))
                } catch { /* låt användaren fylla manuellt */ }
                setSkannar(false)
              }} />
              {skannar ? 'Analyserar...' : 'Välj bild eller PDF'}
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Fastighet</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={levForm.fastighetId} onChange={e => setLevForm({ ...levForm, fastighetId: e.target.value })}>
                {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}{f.bolag?.namn ? ` — ${f.bolag.namn}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Leverantör</label>
              <input style={inp} onFocus={fo} onBlur={fb} value={levForm.leverantor} onChange={e => setLevForm({ ...levForm, leverantor: e.target.value })} placeholder="T.ex. Vattenfall, Eon" />
            </div>
          </div>
          <div>
            <label style={lbl}>Typ</label>
            <select style={inp} onFocus={fo} onBlur={fb} value={levForm.typ} onChange={e => setLevForm({ ...levForm, typ: e.target.value })}>
              <option value="">Ej angiven</option>
              <option value="nat">Nät</option>
              <option value="handel">Handel</option>
              <option value={KOMBINERAD}>Nät + handel (kombinerad)</option>
              <option value="ovrigt">Övrigt</option>
            </select>
          </div>
          {levSkannadAdress && (
            <div style={{ marginTop: -6, fontSize: 12, borderRadius: 8, padding: '8px 12px', background: levMatchStatus === 'match' ? 'rgba(74,222,128,0.08)' : 'rgba(251,146,60,0.08)', border: `1px solid ${levMatchStatus === 'match' ? C.ok : C.warn}33`, color: C.muted }}>
              📍 AI läste anläggningsadress: <span style={{ color: C.text2 }}>{levSkannadAdress}</span>
              {levMatchStatus === 'match'
                ? <span style={{ color: C.ok, marginLeft: 6 }}>→ matchad mot vald fastighet ✓ (kontrollera gärna)</span>
                : <span style={{ color: C.warn, marginLeft: 6 }}>→ ingen fastighet matchade — välj rätt fastighet manuellt ovan</span>}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div><label style={lbl}>Period från</label>
              <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={levForm.periodFran} onChange={e => setLevForm({ ...levForm, periodFran: e.target.value })} /></div>
            <div><label style={lbl}>Period till</label>
              <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={levForm.periodTill} onChange={e => setLevForm({ ...levForm, periodTill: e.target.value })} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16 }}>
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

      {/* NY DEBITERINGSOMGÅNG */}
      {(() => {
        const kandidater = fakturorForKvartal()
        const valda = kandidater.filter(f => omgangValda.has(f.id))
        // Live-summering: total kostnad = alla valda; total kWh = summan PER MÅNAD
        // (inom en månad räknas kWh en gång — nätets, annars största — så nät+handel
        // för samma månad inte dubbelräknas, men olika månader plussas ihop).
        const totalKostnad = valda.reduce((s, f) => s + (f.total_belopp ?? 0), 0)
        const perPeriod = new Map<string, typeof valda>()
        for (const f of valda) {
          const key = `${f.period_fran}|${f.period_till}`
          perPeriod.set(key, [...(perPeriod.get(key) || []), f])
        }
        let totalKwh = 0
        for (const grupp of perPeriod.values()) {
          // Nät OCH kombinerad rapporterar faktisk förbrukning; handel upprepar samma kWh.
          const nat = grupp.filter(f => f.typ === 'nat' || f.typ === KOMBINERAD)
          totalKwh += nat.length > 0
            ? nat.reduce((s, f) => s + (f.total_kwh ?? 0), 0)
            : grupp.reduce((max, f) => Math.max(max, f.total_kwh ?? 0), 0)
        }
        const blandpris = totalKwh > 0 ? totalKostnad / totalKwh : 0
        const { fran, till } = kvartalPeriod(omgangAr, omgangKvartal)
        const arOptions = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i)

        // Varning: täcker de markerade fakturorna hela kvartalet (nät + handel per
        // månad)? Saknas något är kostnadsbasen ofullständig → för lågt blandpris →
        // hyresgästerna underdebiteras. Icke-blockerande banner (bekräftelse krävs
        // vid själva skapandet). Samma logik som saveOmgang via delad hjälpfunktion.
        const saknadeManader = elKvartalKostnadsGap(valda, omgangAr, omgangKvartal)
        const ejFullTackning = saknadeManader.length > 0
        // Förhandsvisa (redan i modalen) vilka mätpunkter som saknar avläsning för
        // perioden och därför inte kan faktureras — samma bracketing som servern.
        const saknarAvlasning = elMatpunkterUtanAvlasning(matare, omgangFastighetId, fran, till)
        return (
          <SlideOver open={showNewOmgang} onClose={() => setShowNewOmgang(false)} title="Ny debiteringsomgång" width="md"
            subtitle={fastigheter.find(f => f.id === omgangFastighetId)?.namn}
            footer={<div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowNewOmgang(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
              <button onClick={saveOmgang} disabled={saving || valda.length === 0} style={{ ...btnPrimary, flex: 1, opacity: saving || valda.length === 0 ? 0.5 : 1 }}>{saving ? 'Skapar...' : 'Skapa debiteringsomgång'}</button>
            </div>}>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={lbl}>Fastighet</label>
                <select style={inp} onFocus={fo} onBlur={fb} value={omgangFastighetId} onChange={e => { setOmgangFastighetId(e.target.value); setOmgangValda(new Set()) }}>
                  {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}{f.bolag?.namn ? ` — ${f.bolag.namn}` : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={lbl}>År</label>
                  <select style={inp} onFocus={fo} onBlur={fb} value={omgangAr} onChange={e => { setOmgangAr(parseInt(e.target.value)); setOmgangValda(new Set()) }}>
                    {arOptions.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Kvartal</label>
                  <select style={inp} onFocus={fo} onBlur={fb} value={omgangKvartal} onChange={e => { setOmgangKvartal(parseInt(e.target.value) as 1 | 2 | 3 | 4); setOmgangValda(new Set()) }}>
                    <option value={1}>Q1 (jan–mar)</option>
                    <option value={2}>Q2 (apr–jun)</option>
                    <option value={3}>Q3 (jul–sep)</option>
                    <option value={4}>Q4 (okt–dec)</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: 12, color: C.muted2, margin: 0 }}>Period: {formatDate(fran)} – {formatDate(till)}</p>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text2, margin: 0 }}>Leverantörsfakturor i kvartalet</h4>
                  {kandidater.length > 0 && (
                    <button type="button" onClick={() => setOmgangValda(omgangValda.size === kandidater.length ? new Set() : new Set(kandidater.map(f => f.id)))}
                      style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {omgangValda.size === kandidater.length ? 'Avmarkera alla' : 'Markera alla'}
                    </button>
                  )}
                </div>
                {kandidater.length === 0 ? (
                  <div style={{ borderRadius: 8, border: `1px dashed ${C.border}`, padding: 16, textAlign: 'center', fontSize: 12, color: C.muted2 }}>
                    Inga leverantörsfakturor med period inom valt kvartal för denna fastighet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {kandidater.map(f => {
                      const vald = omgangValda.has(f.id)
                      return (
                        <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8, border: `1px solid ${vald ? C.gold : C.border}`, background: vald ? C.goldSoft : C.field, padding: '10px 12px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={vald} onChange={() => setOmgangValda(prev => { const n = new Set(prev); n.has(f.id) ? n.delete(f.id) : n.add(f.id); return n })} style={{ accentColor: C.gold }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {f.typ && typPill(f.typ) ? <span style={pill(typPill(f.typ)!.background as string, typPill(f.typ)!.color as string)}>{TYP_LABELS[f.typ]}</span> : <span style={pill('rgba(136,136,136,0.14)', '#aaa')}>Ingen typ</span>}
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{f.leverantor || 'Okänd leverantör'}</span>
                            </div>
                            <p style={{ fontSize: 11, color: C.muted2, margin: '3px 0 0' }}>{formatDate(f.period_fran)} – {formatDate(f.period_till)}{f.total_kwh ? ` · ${f.total_kwh.toLocaleString('sv-SE')} kWh` : ''}</p>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{formatSEK(f.total_belopp)}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              {ejFullTackning && (
                <div style={{ borderRadius: 10, border: '1px solid rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.12)', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fb923c', margin: 0 }}>OBS – alla kostnader är kanske inte inrapporterade</p>
                    <p style={{ fontSize: 12, color: C.text2, margin: '3px 0 0', lineHeight: 1.5 }}>
                      Leverantörsfaktura saknas för: {saknadeManader.join(', ')}. Kontrollera att både nät och handel är med för varje månad innan du skapar omgången — annars blir blandpriset för lågt och hyresgästerna underdebiteras.
                    </p>
                  </div>
                </div>
              )}

              {saknarAvlasning.length > 0 && (
                <div style={{ borderRadius: 10, border: '1px solid rgba(251,146,60,0.4)', background: 'rgba(251,146,60,0.12)', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>⚠️</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#fb923c', margin: 0 }}>{saknarAvlasning.length} mätpunkt{saknarAvlasning.length === 1 ? '' : 'er'} saknar avläsning för perioden</p>
                    <p style={{ fontSize: 12, color: C.text2, margin: '3px 0 0', lineHeight: 1.5 }}>
                      {saknarAvlasning.join(', ')} kan inte faktureras (ingen förbrukning för perioden). Registrera avläsning först om de ska debiteras.
                    </p>
                  </div>
                </div>
              )}

              {/* Live-summering */}
              <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel2, padding: 16, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.muted2, textTransform: 'uppercase', margin: 0 }}>Total kWh</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.blue, margin: '4px 0 0' }}>{totalKwh > 0 ? totalKwh.toLocaleString('sv-SE') : '—'}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.muted2, textTransform: 'uppercase', margin: 0 }}>Total kostnad</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: '4px 0 0' }}>{formatSEK(totalKostnad)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.muted2, textTransform: 'uppercase', margin: 0 }}>Blandpris</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: C.gold, margin: '4px 0 0' }}>{blandpris > 0 ? blandpris.toFixed(4) + ' kr/kWh' : '—'}</p>
                </div>
              </div>
            </div>
          </SlideOver>
        )
      })()}
    </>
  )
}
