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
//
// REFAKTORERING: flikarna och modalerna är utbrutna till ./_components/* (ingen logik
// ändrad). page.tsx håller all state/effekter/handlers/derived data och skickar ner det
// via props. Delade typer/format/stilar ligger i ./_components/shared.

import React, { useEffect, useState } from 'react'
import { C } from '@/components/fastigheter/styles'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useConfirm } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { useBolag } from '@/components/fastigheter/BolagContext'
import {
  Matare, LevFaktura, Omgang, Fastighet, Lokal, Tab, Sort, MatareForm, LevForm, Avlasning,
} from './_components/shared'
import AvlasningarTab from './_components/AvlasningarTab'
import LeverantorTab from './_components/LeverantorTab'
import DebiteringTab from './_components/DebiteringTab'
import AnalysTab from './_components/AnalysTab'
import Modaler from './_components/Modaler'

export default function ElMatarePage() {
  const isMobile = useIsMobile()
  const confirm = useConfirm()
  const { valtBolagId } = useBolag()
  const [tab, setTab] = useState<Tab>('avlasningar')
  const [matare, setMatare] = useState<Matare[]>([])
  const [levFakturor, setLevFakturor] = useState<LevFaktura[]>([])
  const [omgangar, setOmgangar] = useState<Omgang[]>([])
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [lokaler, setLokaler] = useState<Lokal[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toast = useToast()

  // Fritextsök (delas av mätaravläsnings- och leverantörsflikarna)
  const [sok, setSok] = useState('')
  // Sortering för mätaravläsnings-tabellen (per hyresgästkort)
  const [avlSort, setAvlSort] = useState<Sort>({ key: 'matpunkt', dir: 'asc' })
  const toggleAvlSort = (key: string) => setAvlSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })

  // Fastighet → bolag_id (objekt-routen returnerar bolag_id via SELECT *). Används för
  // att respektera bolagsväljaren på rader som bara bär fastighet_id.
  const fastighetBolag = React.useMemo(() => {
    const m = new Map<string, string | null>()
    fastigheter.forEach(f => m.set(f.id, f.bolag_id ?? null))
    return m
  }, [fastigheter])
  // Matchar en rads fastighet mot valt bolag (om inget bolag valt → allt släpps igenom).
  const bolagMatch = (fastighetId: string | null | undefined) =>
    !valtBolagId || (fastighetId != null && fastighetBolag.get(fastighetId) === valtBolagId)

  // Leverantörsfaktura — filter & sortering
  const [levSort, setLevSort] = useState<Sort>({ key: 'period', dir: 'desc' })
  const [levFilterFastighet, setLevFilterFastighet] = useState('')
  const [levFilterLeverantor, setLevFilterLeverantor] = useState('')
  const [levFilterStatus, setLevFilterStatus] = useState('')
  const [levFilterTyp, setLevFilterTyp] = useState('')
  const toggleLevSort = (key: string) => setLevSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  const levSortVal = (f: LevFaktura, key: string): string | number => {
    switch (key) {
      case 'fastighet': return f.fastighet?.namn?.toLowerCase() || ''
      case 'leverantor': return (f.leverantor || '').toLowerCase()
      case 'typ': return f.typ || ''
      case 'period': return new Date(f.period_fran).getTime()
      case 'total_kwh': return f.total_kwh ?? -1
      case 'total_belopp': return f.total_belopp ?? -1
      case 'pris_per_kwh': return f.pris_per_kwh ?? -1
      case 'status': return f.debiteringar.length > 0 ? 1 : 0
      default: return 0
    }
  }

  const [showNewMatare, setShowNewMatare] = useState(false)
  const [showNewAvl, setShowNewAvl] = useState(false)
  const [showNewLev, setShowNewLev] = useState(false)
  const [levEditId, setLevEditId] = useState<string | null>(null)
  const [matareForm, setMatareForm] = useState<MatareForm>({ matarnummer: '', fastighetId: '', lokalId: '', beskrivning: '', schablonKwh: '' })
  const [avlHyresgast, setAvlHyresgast] = useState('')
  const [avlValues, setAvlValues] = useState<Record<string, string>>({})
  const [avlPrev, setAvlPrev] = useState<Record<string, string>>({})
  const [avlDatum, setAvlDatum] = useState(new Date().toISOString().split('T')[0])
  const [avlPrevDatum, setAvlPrevDatum] = useState('')
  const [avlAvlastAv, setAvlAvlastAv] = useState('')
  const [levForm, setLevForm] = useState<LevForm>({ fastighetId: '', periodFran: '', periodTill: '', totalKwh: '', totalBelopp: '', fakturanummer: '', leverantor: '', typ: '' })

  // Debiteringsomgång — SlideOver
  const [showNewOmgang, setShowNewOmgang] = useState(false)
  const [omgangFastighetId, setOmgangFastighetId] = useState('')
  const [omgangAr, setOmgangAr] = useState(new Date().getFullYear())
  const [omgangKvartal, setOmgangKvartal] = useState<1 | 2 | 3 | 4>(1)
  const [omgangValda, setOmgangValda] = useState<Set<string>>(new Set())
  const [levSkannadAdress, setLevSkannadAdress] = useState<string | null>(null)
  const [levMatchStatus, setLevMatchStatus] = useState<'match' | 'ingen' | null>(null)
  // Matcha AI-avläst anläggningsadress mot en fastighet (adress/namn/ort)
  const matchaFastighet = (adr: string): Fastighet | null => {
    const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const gata = norm(adr.split(',')[0])
    if (!gata) return null
    return fastigheter.find(f => {
      const kandidater = [f.adress, f.namn].filter(Boolean).map(x => norm(x as string))
      return kandidater.some(k => k && (gata.includes(k) || k.includes(gata)))
    }) || null
  }
  const [saving, setSaving] = useState(false)
  const [skannar, setSkannar] = useState(false)

  const load = () => {
    Promise.all([
      fetch('/api/fastigheter/elmatare').then(r => r.json()),
      fetch('/api/fastigheter/el-leverantor').then(r => r.json()),
      fetch('/api/fastigheter/objekt').then(r => r.json()),
      fetch('/api/fastigheter/lokaler').then(r => r.json()),
      fetch('/api/fastigheter/el-omgang').then(r => r.json()),
    ]).then(([m, l, f, lok, om]) => {
      if (Array.isArray(m)) setMatare(m)
      if (Array.isArray(l)) setLevFakturor(l)
      if (Array.isArray(f)) setFastigheter(f)
      if (Array.isArray(lok)) setLokaler(lok)
      if (Array.isArray(om)) setOmgangar(om)
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

  const getSenaste = (m: Matare): Avlasning | null => m.avlasningar?.[0] || null
  const getForeg = (m: Matare): Avlasning | null => m.avlasningar?.[1] || null

  // Mätpunktens beteckning (för debiteringsrader) via matare_id
  const matpunktNamn = (matareId: string | null) => {
    const m = matare.find(x => x.id === matareId)
    return m ? (m.beskrivning || getLokalNamn(m) || 'Huvudmätare') : '—'
  }

  const saveMatare = async () => { setSaving(true); await fetch('/api/fastigheter/elmatare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(matareForm) }); setSaving(false); setShowNewMatare(false); load() }
  const saveAvl = async () => {
    setSaving(true)
    const entries = Object.entries(avlValues).filter(([, v]) => v)
    for (const [matareId, varde] of entries) {
      const m = matare.find(x => x.id === matareId)
      const hadeReadings = (m?.avlasningar?.length || 0) > 0
      const startVal = avlPrev[matareId]
      // Ny mätpunkt utan tidigare avläsning: spara startvärdet som en FÖRSTA avläsning
      // (daterad startdatum) så förbrukningen kan räknas ut som differens.
      if (!hadeReadings && startVal && avlPrevDatum) {
        await fetch(`/api/fastigheter/elmatare/${matareId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ varde: startVal, datum: avlPrevDatum, avlastAv: avlAvlastAv }),
        })
      }
      await fetch(`/api/fastigheter/elmatare/${matareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ varde, datum: avlDatum, avlastAv: avlAvlastAv }),
      })
    }
    setSaving(false); setShowNewAvl(false); setAvlValues({}); setAvlPrev({}); load()
  }
  const saveLev = async () => {
    setSaving(true)
    const url = levEditId ? `/api/fastigheter/el-leverantor/${levEditId}` : '/api/fastigheter/el-leverantor'
    const res = await fetch(url, { method: levEditId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(levForm) })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error('Kunde inte spara fakturan: ' + (data.error || res.statusText))
      return
    }
    setShowNewLev(false); setLevEditId(null); load()
  }

  // Öppna en befintlig leverantörsfaktura för redigering (förifyll formuläret)
  const oppnaRedigeraLev = (f: LevFaktura) => {
    setLevEditId(f.id)
    setLevSkannadAdress(null); setLevMatchStatus(null)
    setLevForm({
      fastighetId: f.fastighet_id,
      periodFran: f.period_fran ? String(f.period_fran).slice(0, 10) : '',
      periodTill: f.period_till ? String(f.period_till).slice(0, 10) : '',
      totalKwh: f.total_kwh != null ? String(f.total_kwh) : '',
      totalBelopp: f.total_belopp != null ? String(f.total_belopp) : '',
      fakturanummer: f.fakturanummer || '',
      leverantor: f.leverantor || '',
      typ: f.typ || '',
    })
    setShowNewLev(true)
  }
  // ---- Debiteringsomgång -----------------------------------------------------
  // Kvartal → [periodFran, periodTill]. Q1=jan–mar … Q4=okt–dec.
  const kvartalPeriod = (ar: number, q: 1 | 2 | 3 | 4) => {
    const startManad = (q - 1) * 3 // 0, 3, 6, 9
    const pad = (n: number) => String(n).padStart(2, '0')
    const fran = `${ar}-${pad(startManad + 1)}-01`
    const slutManad = startManad + 3 // 3, 6, 9, 12 (1-indexerad månad efter perioden)
    const sistaDag = new Date(ar, slutManad, 0).getDate()
    const till = `${ar}-${pad(slutManad)}-${pad(sistaDag)}`
    return { fran, till }
  }
  // Fakturor vars period överlappar det valda kvartalet för vald fastighet.
  const fakturorForKvartal = (): LevFaktura[] => {
    if (!omgangFastighetId) return []
    const { fran, till } = kvartalPeriod(omgangAr, omgangKvartal)
    const qFran = new Date(fran).getTime()
    const qTill = new Date(till).getTime()
    return levFakturor.filter(f => {
      if (f.fastighet_id !== omgangFastighetId) return false
      const pf = new Date(f.period_fran).getTime()
      const pt = new Date(f.period_till).getTime()
      return pf <= qTill && pt >= qFran // överlapp
    })
  }
  const saveOmgang = async () => {
    setSaving(true)
    const { fran, till } = kvartalPeriod(omgangAr, omgangKvartal)
    const fakturaIds = [...omgangValda]
    const res = await fetch('/api/fastigheter/el-omgang', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fastighetId: omgangFastighetId, periodFran: fran, periodTill: till, fakturaIds }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error('Kunde inte skapa debiteringsomgång: ' + (data.error || res.statusText))
      return
    }
    // Varna om mätpunkter som saknar avläsning för perioden — de skapas men kan
    // inte faktureras (ingen förbrukning), så de går tysta annars.
    const skapad = await res.json().catch(() => ({}))
    const utanAvlasning = (skapad?.debiteringar ?? []).filter((d: any) => d.forbrukning == null)
    if (utanAvlasning.length > 0) {
      const namn = utanAvlasning
        .map((d: any) => `${d.hyresgast_namn}${d.matare_beskrivning ? ` (${d.matare_beskrivning})` : ''}`)
        .join(', ')
      toast.error(`Omgången skapades, men ${utanAvlasning.length} mätpunkt${utanAvlasning.length === 1 ? '' : 'er'} saknar avläsning för perioden och kan inte faktureras: ${namn}. Registrera avläsning och skapa om omgången vid behov.`)
    } else {
      toast.success('Debiteringsomgång skapad')
    }
    setShowNewOmgang(false); load()
  }
  const deleteOmgang = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort hela debiteringsomgången?', danger: true, confirmLabel: 'Ta bort' }))) return
    const res = await fetch(`/api/fastigheter/el-omgang/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Kunde inte ta bort debiteringsomgången')
      return
    }
    load()
  }
  // Kör faktureringen för EN omgång; returnerar antal skapade fakturor eller kastar.
  const fakturerOmgang = async (id: string, hyresgastNamn?: string[]): Promise<number> => {
    const res = await fetch(`/api/fastigheter/el-omgang/${id}/fakturera`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hyresgastNamn }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || res.statusText)
    return data.antal ?? 0
  }
  // Skapar el-fakturor för valda hyresgäster (kan spänna över flera omgångar/bolag).
  const skapaElFakturorValda = async (perOmgang: { omgangId: string; hyresgaster: string[] }[]) => {
    const totalHg = perOmgang.reduce((s, g) => s + g.hyresgaster.length, 0)
    if (totalHg === 0) return
    if (!(await confirm({ message: `Skapa el-fakturor för ${totalHg} vald${totalHg === 1 ? '' : 'a'} hyresgäst${totalHg === 1 ? '' : 'er'}? En separat faktura skapas per hyresgäst.`, confirmLabel: 'Skapa fakturor' }))) return
    let totalt = 0
    const fel: string[] = []
    for (const g of perOmgang) {
      try { totalt += await fakturerOmgang(g.omgangId, g.hyresgaster) } catch (e) { fel.push(e instanceof Error ? e.message : 'fel') }
    }
    if (fel.length && !totalt) toast.error('Kunde inte skapa el-fakturor: ' + fel[0])
    else toast.success(`${totalt} el-faktur${totalt === 1 ? 'a' : 'or'} skapad${totalt === 1 ? '' : 'e'}${fel.length ? ` (${fel.length} misslyckades)` : ''} – finns nu under Fakturering`)
    load()
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(isMobile ? { overflowX: 'hidden', maxWidth: '100%' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>⚡ Elförbrukning &amp; Fakturering</h2>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, gap: 4, ...(isMobile ? { overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' } : {}) }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', borderBottom: '2px solid', marginBottom: -1,
              borderColor: tab === t.id ? C.gold : 'transparent',
              color: tab === t.id ? C.gold : C.muted,
              ...(isMobile ? { whiteSpace: 'nowrap', flexShrink: 0 } : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div> : <>

      {tab === 'avlasningar' && (
        <AvlasningarTab
          isMobile={isMobile}
          matare={matare}
          fastigheter={fastigheter}
          sok={sok}
          setSok={setSok}
          avlSort={avlSort}
          toggleAvlSort={toggleAvlSort}
          expanded={expanded}
          setExpanded={setExpanded}
          bolagMatch={bolagMatch}
          getHyresgast={getHyresgast}
          getLokalNamn={getLokalNamn}
          getSenaste={getSenaste}
          getForeg={getForeg}
          confirm={confirm}
          load={load}
          setMatareForm={setMatareForm}
          setShowNewMatare={setShowNewMatare}
          setShowNewAvl={setShowNewAvl}
          setAvlHyresgast={setAvlHyresgast}
          setAvlValues={setAvlValues}
          setAvlPrev={setAvlPrev}
          setAvlDatum={setAvlDatum}
          setAvlPrevDatum={setAvlPrevDatum}
          setAvlAvlastAv={setAvlAvlastAv}
        />
      )}

      {tab === 'leverantor' && (
        <LeverantorTab
          isMobile={isMobile}
          levFakturor={levFakturor}
          fastigheter={fastigheter}
          sok={sok}
          setSok={setSok}
          levSort={levSort}
          toggleLevSort={toggleLevSort}
          levSortVal={levSortVal}
          levFilterFastighet={levFilterFastighet}
          setLevFilterFastighet={setLevFilterFastighet}
          levFilterLeverantor={levFilterLeverantor}
          setLevFilterLeverantor={setLevFilterLeverantor}
          levFilterStatus={levFilterStatus}
          setLevFilterStatus={setLevFilterStatus}
          levFilterTyp={levFilterTyp}
          setLevFilterTyp={setLevFilterTyp}
          bolagMatch={bolagMatch}
          confirm={confirm}
          load={load}
          oppnaRedigeraLev={oppnaRedigeraLev}
          setShowNewLev={setShowNewLev}
          setLevEditId={setLevEditId}
          setLevSkannadAdress={setLevSkannadAdress}
          setLevMatchStatus={setLevMatchStatus}
          setLevForm={setLevForm}
        />
      )}

      {tab === 'debitering' && (
        <DebiteringTab
          isMobile={isMobile}
          omgangar={omgangar}
          fastigheter={fastigheter}
          bolagMatch={bolagMatch}
          matpunktNamn={matpunktNamn}
          skapaElFakturorValda={skapaElFakturorValda}
          deleteOmgang={deleteOmgang}
          setOmgangFastighetId={setOmgangFastighetId}
          setOmgangAr={setOmgangAr}
          setOmgangKvartal={setOmgangKvartal}
          setOmgangValda={setOmgangValda}
          setShowNewOmgang={setShowNewOmgang}
        />
      )}

      {tab === 'analys' && (
        <AnalysTab
          isMobile={isMobile}
          levFakturor={levFakturor}
          omgangar={omgangar}
          bolagMatch={bolagMatch}
        />
      )}

      </>}

      <Modaler
        isMobile={isMobile}
        saving={saving}
        skannar={skannar}
        matare={matare}
        fastigheter={fastigheter}
        lokaler={lokaler}
        levFakturor={levFakturor}
        getHyresgast={getHyresgast}
        getSenaste={getSenaste}
        hyresgasterUtanMatare={hyresgasterUtanMatare}
        matchaFastighet={matchaFastighet}
        kvartalPeriod={kvartalPeriod}
        fakturorForKvartal={fakturorForKvartal}
        showNewMatare={showNewMatare}
        setShowNewMatare={setShowNewMatare}
        matareForm={matareForm}
        setMatareForm={setMatareForm}
        saveMatare={saveMatare}
        showNewAvl={showNewAvl}
        setShowNewAvl={setShowNewAvl}
        avlHyresgast={avlHyresgast}
        setAvlHyresgast={setAvlHyresgast}
        avlValues={avlValues}
        setAvlValues={setAvlValues}
        avlPrev={avlPrev}
        setAvlPrev={setAvlPrev}
        avlDatum={avlDatum}
        setAvlDatum={setAvlDatum}
        avlPrevDatum={avlPrevDatum}
        setAvlPrevDatum={setAvlPrevDatum}
        avlAvlastAv={avlAvlastAv}
        setAvlAvlastAv={setAvlAvlastAv}
        saveAvl={saveAvl}
        showNewLev={showNewLev}
        setShowNewLev={setShowNewLev}
        levEditId={levEditId}
        setLevEditId={setLevEditId}
        levForm={levForm}
        setLevForm={setLevForm}
        levSkannadAdress={levSkannadAdress}
        setLevSkannadAdress={setLevSkannadAdress}
        levMatchStatus={levMatchStatus}
        setLevMatchStatus={setLevMatchStatus}
        setSkannar={setSkannar}
        saveLev={saveLev}
        showNewOmgang={showNewOmgang}
        setShowNewOmgang={setShowNewOmgang}
        omgangFastighetId={omgangFastighetId}
        setOmgangFastighetId={setOmgangFastighetId}
        omgangAr={omgangAr}
        setOmgangAr={setOmgangAr}
        omgangKvartal={omgangKvartal}
        setOmgangKvartal={setOmgangKvartal}
        omgangValda={omgangValda}
        setOmgangValda={setOmgangValda}
        saveOmgang={saveOmgang}
      />
    </div>
  )
}
