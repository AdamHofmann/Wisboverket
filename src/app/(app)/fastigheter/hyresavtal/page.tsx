'use client'

// Migrerad sida. Källa: src/app/hyresavtal/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold-styles + tokens (@/components/fastigheter/styles),
// emoji-ikoner, SlideOver, och /api/fastigheter/*-routes.
//
// VIKTIGT om fältnamn: Supabase returnerar snake_case-kolumner. Käll-UI:t använde
// camelCase. Render-koden nedan läser snake_case (anvand_index, uppsagningstid_hg,
// basindex_ar/manad/varde, el_abonnemang, va_abonnemang, varme_abonnemang,
// byggnad.uthyrbar_yta, indexhojning.bashyra_gammal/bashyra_ny/skapad_av).
// Formulär-POST/PUT skickar camelCase → routernas parser översätter till snake_case.

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost, btnDanger } from '@/components/fastigheter/styles'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useConfirm } from '@/components/ConfirmDialog'

interface Byggnad { uthyrbar_yta?: number | null }
interface Bolag { id: string; namn: string; fastighetsskattesats?: number }
interface Beteckning { taxeringsvarde?: number | null }
interface Fastighet {
  namn: string
  taxeringsvarde?: number | null
  byggnader?: Byggnad[]
  beteckningar?: Beteckning[]
  bolag?: Bolag | null
}
interface Lokal { id: string; namn: string; yta: number; typ: string; fastighet: Fastighet }
interface HyresavtalLokal { lokal: Lokal }
interface Hyresgast { id: string; namn: string }
interface Indexhojning { id: string; datum: string; procent: number; bashyra_gammal: number; bashyra_ny: number; skapad_av: string }
interface Hyresavtal {
  id: string; startdatum: string; slutdatum: string | null; bashyra: number; arshyra: number | null
  indexupprakning: number; status: string; uppsagningstid: number
  uppsagningstid_hg: number | null; uppsagningstid_hv: number | null
  hyrestid: string; forlangning: number | null
  faktureringsfrekvens: string
  forfallotyp: string; forfallodagar: number
  anvand_index: boolean
  avtalsdatum: string | null
  avtalsnummer: string | null
  anvandning: string | null
  el_abonnemang: string; va_abonnemang: string; varme_abonnemang: string; ventilation: string
  kostnadsandel: number | null; underhallsansvar: string
  sakerhet: string | null; specialvillkor: string | null
  basindex_ar: number | null; basindex_manad: string | null; basindex_varde: number | null
  lokaler: HyresavtalLokal[]; hyresgast: Hyresgast
  indexhojningar?: Indexhojning[]
}

interface Dokument {
  id: string; namn: string; typ: string; filnamn: string; filstorlek: number; sokvag: string; created_at: string
}

// Artikel ur artikelregistret (f_artikel) — används för att autofylla avtalsrader.
interface Artikel {
  id: string; kod: string; benamning: string
  apris: number | null; moms: number
}

const statusColors: Record<string, { bg: string; color: string }> = {
  utkast: { bg: 'rgba(96,165,250,0.12)', color: C.blue },
  aktiv: { bg: 'rgba(74,222,128,0.12)', color: C.ok },
  uppsagd: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24' },
  avslutad: { bg: C.field, color: C.muted },
}
const statusLabels: Record<string, string> = { utkast: 'Utkast', aktiv: 'Aktiv', uppsagd: 'Uppsagd', avslutad: 'Avslutad' }

const hyrestidColors: Record<string, { bg: string; color: string }> = {
  tillsvidare: { bg: 'rgba(96,165,250,0.1)', color: C.blue },
  tidsbegransat: { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
  forlangning: { bg: 'rgba(251,146,60,0.12)', color: C.warn },
}
const hyrestidLabels: Record<string, string> = {
  tillsvidare: 'Tillsvidare',
  tidsbegransat: 'Tidsbegränsat',
  forlangning: 'Förlängning',
}

const formatDate = (d: string) => new Date(d).toLocaleDateString('sv-SE')
const formatSEK = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

// ---- Lokala stil-hjälpare (inline dark/gold) --------------------------------
const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: C.text2, verticalAlign: 'top' }
const secH: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}` }
const smallLbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: C.text2, marginBottom: 4 }
const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: bg, color, width: 'fit-content' })
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 14, padding: 6, borderRadius: 6 }
const tabBtn = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', fontSize: 13, fontWeight: 600,
  background: 'none', border: 'none', borderBottom: `2px solid ${active ? C.gold : 'transparent'}`,
  color: active ? C.gold : C.muted, cursor: 'pointer', marginBottom: -1,
})
const radInp: React.CSSProperties = { ...inp, background: C.panel, padding: '6px 10px', fontSize: 12 }

export default function HyresavtalPage() {
  const isMobile = useIsMobile()
  const confirm = useConfirm()
  // SWR-cache: hyresavtal-listan visas direkt vid återbesök. load() = revalidera.
  const { data: items = [], isLoading, mutate } = useSWR('hyresavtal', () =>
    fetch('/api/fastigheter/hyresavtal').then(r => r.json()).then(d => (Array.isArray(d) ? d : []) as Hyresavtal[]))
  const loading = isLoading && !items.length
  const [sagaUpAvtal, setSagaUpAvtal] = useState<Hyresavtal | null>(null)
  const [sagaUpSaving, setSagaUpSaving] = useState(false)
  const [sagaUpForm, setSagaUpForm] = useState({ uppsagningsdatum: '', slutdatum: '', kommentar: '' })
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBolag, setFilterBolag] = useState('')
  const [editAvtal, setEditAvtal] = useState<Hyresavtal | null>(null)
  const [editLokalIds, setEditLokalIds] = useState<string[]>([])
  const [allaLokaler, setAllaLokaler] = useState<{ id: string; namn: string; yta: number; typ: string; status: string; fastighet: { namn: string } }[]>([])
  const [editForm, setEditForm] = useState({
    status: '', avtalsdatum: '', startdatum: '', slutdatum: '',
    hyrestid: '', forlangning: '',
    uppsagningstidHG: '', uppsagningstidHV: '',
    bashyra: '', faktureringsfrekvens: '',
    forfallotyp: 'fore_period', forfallodagar: '30',
    basindexAr: '', basindexManad: 'Oktober', basindexVarde: '',
    avtalsnummer: '', anvandning: '',
    elAbonnemang: 'hyresgast', vaAbonnemang: 'ingar', varmeAbonnemang: 'ingar', ventilation: 'ingar',
    kostnadsandel: '', underhallsansvar: 'hyresgast_ytskikt', sakerhet: '', specialvillkor: '',
  })
  const [editSaving, setEditSaving] = useState(false)
  const [editKpiLoading, setEditKpiLoading] = useState(false)
  const [editKpiInfo, setEditKpiInfo] = useState<{ value: number; period: string } | null>(null)
  const [editAktuellKpi, setEditAktuellKpi] = useState<{ value: number; period: string } | null>(null)
  const [editRader, setEditRader] = useState<{ id?: string; artikelkod: string; beskrivning: string; belopp: string; arsbelopp: string; moms: string }[]>([])
  const [editTab, setEditTab] = useState<'avtal' | 'dokument' | 'historik'>('avtal')
  const [editAnvandIndex, setEditAnvandIndex] = useState(true)
  const [dokument, setDokument] = useState<Dokument[]>([])
  const [uploadingDok, setUploadingDok] = useState(false)
  const [artiklar, setArtiklar] = useState<Artikel[]>([])
  const MONTHS_SV = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']
  const AVTALSRAD_TYPER = [
    { kod: 'HYR', label: 'Hyra' },
    { kod: 'FSKATT', label: 'Fastighetsskatt' },
    { kod: 'LARM', label: 'Larm' },
    { kod: 'FIBER', label: 'Fiber/Internet' },
    { kod: 'EL', label: 'El-abonnemang' },
    { kod: 'PARK', label: 'Parkering' },
    { kod: 'SOPOR', label: 'Sophämtning' },
    { kod: 'TILLAGG', label: 'Övrigt tillägg' },
  ]

  const load = () => { mutate() }

  // Hämta aktiva artiklar ur artikelregistret för radväljaren (autofyller beskrivning/á-pris/moms).
  useEffect(() => {
    fetch('/api/fastigheter/artiklar')
      .then(r => r.json())
      .then((data: Artikel[]) => { if (Array.isArray(data)) setArtiklar(data.filter(a => (a as unknown as { aktiv: boolean }).aktiv !== false)) })
      .catch(() => {})
  }, [])

  // Beräknar rätt sista hyresdag vid uppsägning.
  // Om uppsägningstiden redan passerat och avtalet har förlängning → nästa period.
  const beraknaSlutdatum = (a: Hyresavtal): string => {
    const idag = new Date()
    if (a.slutdatum && a.forlangning) {
      const slut = new Date(a.slutdatum)
      const deadline = new Date(slut)
      deadline.setMonth(deadline.getMonth() - a.uppsagningstid)
      if (idag > deadline) {
        const nastaSlut = new Date(slut)
        nastaSlut.setMonth(nastaSlut.getMonth() + a.forlangning * 12)
        return nastaSlut.toISOString().split('T')[0]
      }
      return slut.toISOString().split('T')[0]
    }
    if (a.slutdatum) return new Date(a.slutdatum).toISOString().split('T')[0]
    const beraknat = new Date()
    beraknat.setMonth(beraknat.getMonth() + a.uppsagningstid)
    return beraknat.toISOString().split('T')[0]
  }

  const sagaUp = async () => {
    if (!sagaUpAvtal) return
    setSagaUpSaving(true)
    await fetch(`/api/fastigheter/hyresavtal/${sagaUpAvtal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uppsagningsdatum: sagaUpForm.uppsagningsdatum || null,
        slutdatum: sagaUpForm.slutdatum || null,
        kommentar: sagaUpForm.kommentar || null,
      }),
    })
    setSagaUpSaving(false)
    setSagaUpAvtal(null)
    load()
  }

  const openEditAvtal = async (a: Hyresavtal) => {
    setEditAvtal(a)
    setEditLokalIds(a.lokaler.map(l => l.lokal.id))
    setEditTab('avtal')
    fetch('/api/fastigheter/lokaler').then(r => r.json()).then(d => { if (Array.isArray(d)) setAllaLokaler(d) })
    setEditAnvandIndex(a.anvand_index)
    const hyra = String(a.bashyra)
    setEditForm({
      status: a.status,
      avtalsdatum: a.avtalsdatum ? new Date(a.avtalsdatum).toISOString().split('T')[0] : '',
      startdatum: new Date(a.startdatum).toISOString().split('T')[0],
      slutdatum: a.slutdatum ? new Date(a.slutdatum).toISOString().split('T')[0] : '',
      hyrestid: a.hyrestid,
      forlangning: a.forlangning ? String(a.forlangning) : '',
      uppsagningstidHG: a.uppsagningstid_hg ? String(a.uppsagningstid_hg) : '',
      uppsagningstidHV: a.uppsagningstid_hv ? String(a.uppsagningstid_hv) : '',
      bashyra: hyra,
      faktureringsfrekvens: a.faktureringsfrekvens,
      forfallotyp: a.forfallotyp || 'fore_period',
      forfallodagar: String(a.forfallodagar || 30),
      basindexAr: a.basindex_ar ? String(a.basindex_ar) : '',
      basindexManad: a.basindex_manad || 'Oktober',
      basindexVarde: a.basindex_varde ? String(a.basindex_varde) : '',
      avtalsnummer: a.avtalsnummer || '',
      anvandning: a.anvandning || '',
      elAbonnemang: a.el_abonnemang || 'hyresgast',
      vaAbonnemang: a.va_abonnemang || 'ingar',
      varmeAbonnemang: a.varme_abonnemang || 'ingar',
      ventilation: a.ventilation || 'ingar',
      kostnadsandel: a.kostnadsandel != null ? String(a.kostnadsandel) : '',
      underhallsansvar: a.underhallsansvar || 'hyresgast_ytskikt',
      sakerhet: a.sakerhet || '',
      specialvillkor: a.specialvillkor || '',
    })
    setEditKpiInfo(null)
    setEditAktuellKpi(null)
    // Alla oberoende hämtningar parallellt (avtalsrader, dokument, KPI bas + aktuell)
    // istället för fyra sekventiella await → ~halverad öppningstid.
    const manad = a.basindex_manad || 'Oktober'
    const nu = new Date()
    const senAr = nu.getMonth() >= 10 ? nu.getFullYear() : nu.getFullYear() - 1
    const [raderRes, dokRes, basRes, akRes] = await Promise.all([
      fetch(`/api/fastigheter/avtalsrader?hyresavtalId=${a.id}`),
      fetch(`/api/fastigheter/avtalsdokument?hyresavtalId=${a.id}`),
      (a.basindex_ar && !a.basindex_varde) ? fetch(`/api/fastigheter/kpi?year=${a.basindex_ar}&month=${manad}`) : Promise.resolve(null),
      a.basindex_ar ? fetch(`/api/fastigheter/kpi?year=${senAr}&month=Oktober`) : Promise.resolve(null),
    ])

    // Avtalsrader
    const rader = raderRes.ok ? await raderRes.json() : []
    const mappedRader = (Array.isArray(rader) ? rader : []).map((r: { id: string; artikelkod: string; beskrivning: string; belopp: number; arsbelopp: number | null; moms: number }) => ({
      id: r.id, artikelkod: r.artikelkod, beskrivning: r.beskrivning,
      belopp: String(r.belopp), arsbelopp: String(r.arsbelopp ?? Math.round(r.belopp * 12 * 100) / 100),
      moms: String(r.moms),
    }))
    setEditRader([
      { artikelkod: 'HYR', beskrivning: 'Hyra lokal', belopp: hyra, arsbelopp: String(a.arshyra ?? Math.round(a.bashyra * 12 * 100) / 100), moms: '25' },
      ...mappedRader,
    ])

    // KPI basindex (om avtalet saknar lagrat basindex-värde)
    if (basRes && basRes.ok) {
      const bd = await basRes.json()
      if (bd.value) {
        setEditForm(prev => ({ ...prev, basindexVarde: String(bd.value) }))
        setEditKpiInfo({ value: bd.value, period: `${manad} ${a.basindex_ar}` })
      }
    }
    // KPI aktuell
    if (akRes && akRes.ok) {
      const ak = await akRes.json()
      if (ak.value) setEditAktuellKpi({ value: ak.value, period: `Oktober ${senAr}` })
    }
    // Dokument
    if (dokRes.ok) {
      const d = await dokRes.json()
      setDokument(Array.isArray(d) ? d : [])
    }
  }

  const uploadDokument = async (file: File, typ: string) => {
    if (!editAvtal) return
    setUploadingDok(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('hyresavtalId', editAvtal.id)
    fd.append('typ', typ)
    fd.append('namn', file.name)
    const res = await fetch('/api/fastigheter/avtalsdokument', { method: 'POST', body: fd })
    if (res.ok) {
      const dok = await res.json()
      setDokument(prev => [dok, ...prev])
    }
    setUploadingDok(false)
  }

  const deleteDokument = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort dokument?', danger: true, confirmLabel: 'Ta bort' }))) return
    await fetch(`/api/fastigheter/avtalsdokument?id=${id}`, { method: 'DELETE' })
    setDokument(prev => prev.filter(d => d.id !== id))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const saveEdit = async () => {
    if (!editAvtal) return
    setEditSaving(true)
    const hyraRad = editRader.find(r => r.artikelkod === 'HYR')
    const bashyra = hyraRad?.belopp || editForm.bashyra
    const arshyra = hyraRad?.arsbelopp && hyraRad.arsbelopp !== '' ? hyraRad.arsbelopp : null
    await fetch(`/api/fastigheter/hyresavtal/${editAvtal.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        arshyra,
        status: editForm.status || undefined,
        anvandIndex: editAnvandIndex,
        avtalsdatum: editForm.avtalsdatum || null,
        startdatum: editForm.startdatum,
        slutdatum: editForm.slutdatum || null,
        bashyra,
        faktureringsfrekvens: editForm.faktureringsfrekvens,
        forfallotyp: editForm.forfallotyp,
        forfallodagar: editForm.forfallodagar,
        hyrestid: editForm.hyrestid,
        forlangning: editForm.forlangning || null,
        uppsagningstidHG: editForm.uppsagningstidHG || null,
        uppsagningstidHV: editForm.uppsagningstidHV || null,
        basindexAr: editForm.basindexAr || null,
        basindexManad: editForm.basindexManad || null,
        basindexVarde: editForm.basindexVarde || null,
        avtalsnummer: editForm.avtalsnummer || null,
        anvandning: editForm.anvandning || null,
        elAbonnemang: editForm.elAbonnemang,
        vaAbonnemang: editForm.vaAbonnemang,
        varmeAbonnemang: editForm.varmeAbonnemang,
        ventilation: editForm.ventilation,
        kostnadsandel: editForm.kostnadsandel || null,
        underhallsansvar: editForm.underhallsansvar,
        sakerhet: editForm.sakerhet || null,
        specialvillkor: editForm.specialvillkor || null,
        lokalIds: editLokalIds,
      }),
    })
    // Synka avtalsrader: ta bort gamla, skapa nya (exkl HYR)
    const extraRader = editRader.filter(r => r.artikelkod !== 'HYR' && r.belopp)
    const existing = editRader.filter(r => r.id)
    await Promise.all(existing.map(r => fetch(`/api/fastigheter/avtalsrader?id=${r.id}`, { method: 'DELETE' })))
    await Promise.all(extraRader.map(r =>
      fetch('/api/fastigheter/avtalsrader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hyresavtalId: editAvtal.id, artikelkod: r.artikelkod, beskrivning: r.beskrivning, belopp: r.belopp, arsbelopp: r.arsbelopp, moms: r.moms }),
      })
    ))
    setEditSaving(false)
    setEditAvtal(null)
    load()
  }

  const fetchEditKpi = async (year: string, month: string) => {
    if (!year || !month) return
    setEditKpiLoading(true)
    try {
      const res = await fetch(`/api/fastigheter/kpi?year=${year}&month=${month}`)
      if (res.ok) {
        const d = await res.json()
        if (d.value) {
          setEditForm(prev => ({ ...prev, basindexVarde: String(d.value) }))
          setEditKpiInfo({ value: d.value, period: `${month} ${year}` })
        }
      }
      const nu = new Date()
      const senAr = nu.getMonth() >= 10 ? nu.getFullYear() : nu.getFullYear() - 1
      const akRes = await fetch(`/api/fastigheter/kpi?year=${senAr}&month=Oktober`)
      if (akRes.ok) {
        const ak = await akRes.json()
        if (ak.value) setEditAktuellKpi({ value: ak.value, period: `Oktober ${senAr}` })
      }
    } finally {
      setEditKpiLoading(false)
    }
  }

  // Unika bolag från avtalens lokaler
  const bolagAlternativ = Array.from(new Map(
    items.flatMap(a => a.lokaler.map(l => l.lokal.fastighet.bolag)).filter(Boolean).map(b => [b!.id, b!])
  ).values())

  const filtered = items.filter(a => {
    if (filterBolag && !a.lokaler.some(l => l.lokal.fastighet.bolag?.id === filterBolag)) return false
    if (filterStatus === 'galler' && a.status !== 'aktiv') return false
    if (filterStatus === 'uppsagd' && a.status !== 'uppsagd') return false
    if (filterStatus === 'galler-inte' && !['avslutad', 'utkast'].includes(a.status)) return false
    if (filterStatus && !['galler', 'uppsagd', 'galler-inte'].includes(filterStatus) && a.status !== filterStatus) return false
    return true
  })
  const aktivaCount = items.filter(a => a.status === 'aktiv').length

  type ColKey = 'hyresgast' | 'avtalsnr' | 'lokal' | 'period' | 'hyrestid' | 'bashyra' | 'arshyra' | 'hyresutveckling' | 'index' | 'uppsagn' | 'fakturering' | 'status'
  const allColumns: { key: ColKey; label: string; default: boolean }[] = [
    { key: 'hyresgast', label: 'Hyresgäst', default: true },
    { key: 'avtalsnr', label: 'Avtalsnr', default: false },
    { key: 'lokal', label: 'Lokal', default: true },
    { key: 'period', label: 'Period', default: true },
    { key: 'hyrestid', label: 'Hyrestid', default: true },
    { key: 'bashyra', label: 'Bashyra/mån', default: true },
    { key: 'arshyra', label: 'Årshyra', default: false },
    { key: 'hyresutveckling', label: 'Hyresutveckling', default: false },
    { key: 'index', label: 'Index', default: false },
    { key: 'uppsagn', label: 'Uppsägn.', default: true },
    { key: 'fakturering', label: 'Fakturering', default: false },
    { key: 'status', label: 'Status', default: true },
  ]
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(allColumns.filter(c => c.default).map(c => c.key)))
  const [showColPicker, setShowColPicker] = useState(false)
  const toggleCol = (key: ColKey) => setVisibleCols(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })

  const selectStyle: React.CSSProperties = isMobile
    ? { ...inp, width: '100%', fontWeight: 500 }
    : { ...inp, width: 'auto', minWidth: 150, fontWeight: 500 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(isMobile ? { overflowX: 'hidden' } : {}) }}>
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Hyresavtal</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{aktivaCount} aktiva avtal · {items.length} totalt</p>
        </div>
        <p style={{ fontSize: 12, color: C.muted2, fontStyle: 'italic', margin: 0 }}>Avtal skapas från Hyresgäster-sidan</p>
      </div>

      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', gap: 12, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
        {bolagAlternativ.length > 1 && (
          <select value={filterBolag} onChange={e => setFilterBolag(e.target.value)} onFocus={fo} onBlur={fb} style={selectStyle}>
            <option value="">Alla bolag</option>
            {bolagAlternativ.map(b => <option key={b.id} value={b.id}>{b.namn}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} onFocus={fo} onBlur={fb} style={selectStyle}>
          <option value="">Alla statusar</option>
          <option value="galler">Gäller</option>
          <option value="uppsagd">Uppsagda</option>
          <option value="galler-inte">Gäller inte</option>
        </select>
        <div style={{ position: 'relative', marginLeft: isMobile ? 0 : 'auto' }}>
          <button onClick={() => setShowColPicker(!showColPicker)} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
            🎚️ Kolumner
          </button>
          {showColPicker && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 20, width: 224, borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', padding: 8 }}>
              {allColumns.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: C.text2 }}>
                  <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : isMobile ? (
        filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2, borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel }}>Inga hyresavtal</div>
        ) : (
          <div>
            {filtered.map((a) => {
              const arshyra = a.arshyra ?? a.bashyra * 12
              const originalHyra = a.indexhojningar && a.indexhojningar.length > 0
                ? a.indexhojningar[a.indexhojningar.length - 1].bashyra_gammal
                : null
              const hyraForandring = originalHyra ? ((a.bashyra - originalHyra) / originalHyra * 100) : null
              const sc = statusColors[a.status] || { bg: C.field, color: C.muted }
              const hc = hyrestidColors[a.hyrestid] || { bg: C.field, color: C.muted }
              const rowLbl: React.CSSProperties = { fontSize: 12, color: C.muted, flexShrink: 0 }
              const rowWrap: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }
              return (
                <div key={a.id} onClick={() => openEditAvtal(a)} style={{ borderRadius: 10, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 12, marginBottom: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{a.hyresgast.namn}</div>
                    {visibleCols.has('status') && <span style={pill(sc.bg, sc.color)}>{statusLabels[a.status] || a.status}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visibleCols.has('avtalsnr') && (
                      <div style={rowWrap}><span style={rowLbl}>Avtalsnr</span><span style={{ fontSize: 13, color: C.muted, textAlign: 'right' }}>{a.avtalsnummer || '—'}</span></div>
                    )}
                    {visibleCols.has('lokal') && (
                      <div style={rowWrap}><span style={rowLbl}>Lokal</span><span style={{ fontSize: 13, color: C.text2, textAlign: 'right' }}>{a.lokaler.map(l => l.lokal.namn).join(', ')}<div style={{ fontSize: 12, color: C.muted2 }}>{a.lokaler[0]?.lokal.fastighet.namn}</div></span></div>
                    )}
                    {visibleCols.has('period') && (
                      <div style={rowWrap}><span style={rowLbl}>Period</span><span style={{ fontSize: 13, color: C.text2, textAlign: 'right' }}>{formatDate(a.startdatum)}<div style={{ fontSize: 12, color: C.muted2 }}>{a.slutdatum ? `Slutar ${formatDate(a.slutdatum)}` : 'Tillsvidare'}</div></span></div>
                    )}
                    {visibleCols.has('hyrestid') && (
                      <div style={rowWrap}><span style={rowLbl}>Hyrestid</span><span style={{ textAlign: 'right' }}><span style={pill(hc.bg, hc.color)}>{hyrestidLabels[a.hyrestid] || a.hyrestid}</span>{a.forlangning ? <div style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>{a.forlangning} år förl.</div> : null}</span></div>
                    )}
                    {visibleCols.has('bashyra') && (
                      <div style={rowWrap}><span style={rowLbl}>Bashyra/mån</span><span style={{ textAlign: 'right' }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{formatSEK(a.bashyra)}</div><div style={{ fontSize: 12, color: '#a78bfa' }}>{a.faktureringsfrekvens === 'kvartalsvis' ? 'Kvartalsvis' : 'Månadsvis'}</div></span></div>
                    )}
                    {visibleCols.has('arshyra') && (
                      <div style={rowWrap}><span style={rowLbl}>Årshyra</span><span style={{ fontSize: 13, fontWeight: 600, color: C.text, textAlign: 'right' }}>{formatSEK(arshyra)}</span></div>
                    )}
                    {visibleCols.has('hyresutveckling') && (
                      <div style={rowWrap}><span style={rowLbl}>Utveckling</span><span style={{ textAlign: 'right' }}>{originalHyra ? (<><div style={{ fontSize: 12, color: C.muted2 }}>Start: {formatSEK(originalHyra)}</div><div style={{ fontSize: 12, fontWeight: 600, color: hyraForandring && hyraForandring > 0 ? C.ok : C.muted }}>{hyraForandring !== null ? `${hyraForandring > 0 ? '+' : ''}${hyraForandring.toFixed(1)}%` : '—'}</div></>) : <span style={{ fontSize: 12, color: C.muted2 }}>Ingen höjning</span>}</span></div>
                    )}
                    {visibleCols.has('index') && (
                      <div style={rowWrap}><span style={rowLbl}>Index</span><span style={{ fontSize: 13, color: C.muted, textAlign: 'right' }}>{a.anvand_index ? (a.basindex_varde ? `${a.basindex_varde}` : 'Aktiv') : 'Av'}</span></div>
                    )}
                    {visibleCols.has('uppsagn') && (
                      <div style={rowWrap}><span style={rowLbl}>Uppsägn.</span><span style={{ fontSize: 13, color: C.muted, textAlign: 'right' }}>{a.uppsagningstid_hg ?? a.uppsagningstid} mån</span></div>
                    )}
                    {visibleCols.has('fakturering') && (
                      <div style={rowWrap}><span style={rowLbl}>Fakturering</span><span style={{ fontSize: 13, color: C.muted, textAlign: 'right' }}>{a.faktureringsfrekvens === 'kvartalsvis' ? 'Kvartal' : 'Månad'}</span></div>
                    )}
                    {visibleCols.has('status') && a.slutdatum && (() => {
                      const dagar = Math.ceil((new Date(a.slutdatum).getTime() - Date.now()) / 86400000)
                      if (dagar <= 0) return null
                      const manad = Math.round(dagar / 30.5)
                      return (
                        <div style={rowWrap}><span style={rowLbl}>Kvar</span><span style={{ fontSize: 12, color: C.muted2, textAlign: 'right' }}>{manad >= 2 ? `${manad} mån kvar` : `${dagar} dagar kvar`}</span></div>
                      )
                    })()}
                  </div>
                  {a.status === 'aktiv' && (
                    <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${C.borderSoft}`, paddingTop: 8 }}>
                      <button onClick={(e) => {
                        e.stopPropagation()
                        setSagaUpAvtal(a)
                        setSagaUpForm({
                          uppsagningsdatum: new Date().toISOString().split('T')[0],
                          slutdatum: beraknaSlutdatum(a),
                          kommentar: '',
                        })
                      }} style={{ ...btnGhost, flex: 1, fontSize: 12 }}>🚫 Säg upp</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2 }}>
                {visibleCols.has('hyresgast') && <th style={th}>Hyresgäst</th>}
                {visibleCols.has('avtalsnr') && <th style={th}>Avtalsnr</th>}
                {visibleCols.has('lokal') && <th style={th}>Lokal</th>}
                {visibleCols.has('period') && <th style={th}>Period</th>}
                {visibleCols.has('hyrestid') && <th style={th}>Hyrestid</th>}
                {visibleCols.has('bashyra') && <th style={th}>Bashyra/mån</th>}
                {visibleCols.has('arshyra') && <th style={th}>Årshyra</th>}
                {visibleCols.has('hyresutveckling') && <th style={th}>Utveckling</th>}
                {visibleCols.has('index') && <th style={th}>Index</th>}
                {visibleCols.has('uppsagn') && <th style={th}>Uppsägn.</th>}
                {visibleCols.has('fakturering') && <th style={th}>Fakturering</th>}
                {visibleCols.has('status') && <th style={th}>Status</th>}
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={visibleCols.size + 1} style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Inga hyresavtal</td></tr>
              ) : filtered.map((a) => {
                const arshyra = a.arshyra ?? a.bashyra * 12
                const originalHyra = a.indexhojningar && a.indexhojningar.length > 0
                  ? a.indexhojningar[a.indexhojningar.length - 1].bashyra_gammal
                  : null
                const hyraForandring = originalHyra ? ((a.bashyra - originalHyra) / originalHyra * 100) : null
                const sc = statusColors[a.status] || { bg: C.field, color: C.muted }
                const hc = hyrestidColors[a.hyrestid] || { bg: C.field, color: C.muted }
                return (
                  <tr key={a.id} onClick={() => openEditAvtal(a)} style={{ borderBottom: `1px solid ${C.borderSoft}`, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {visibleCols.has('hyresgast') && <td style={{ ...td, fontWeight: 600, color: C.text }}>{a.hyresgast.namn}</td>}
                    {visibleCols.has('avtalsnr') && <td style={{ ...td, color: C.muted }}>{a.avtalsnummer || '—'}</td>}
                    {visibleCols.has('lokal') && <td style={td}>
                      <div style={{ color: C.text2 }}>{a.lokaler.map(l => l.lokal.namn).join(', ')}</div>
                      <div style={{ fontSize: 12, color: C.muted2 }}>{a.lokaler[0]?.lokal.fastighet.namn}</div>
                    </td>}
                    {visibleCols.has('period') && <td style={td}>
                      <div style={{ color: C.text2 }}>{formatDate(a.startdatum)}</div>
                      <div style={{ fontSize: 12, color: C.muted2 }}>{a.slutdatum ? `Slutar ${formatDate(a.slutdatum)}` : 'Tillsvidare'}</div>
                    </td>}
                    {visibleCols.has('hyrestid') && <td style={td}>
                      <span style={pill(hc.bg, hc.color)}>{hyrestidLabels[a.hyrestid] || a.hyrestid}</span>
                      {a.forlangning ? <div style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>{a.forlangning} år förl.</div> : null}
                    </td>}
                    {visibleCols.has('bashyra') && <td style={td}>
                      <div style={{ fontWeight: 600, color: C.text }}>{formatSEK(a.bashyra)}</div>
                      <div style={{ fontSize: 12, color: '#a78bfa' }}>{a.faktureringsfrekvens === 'kvartalsvis' ? 'Kvartalsvis' : 'Månadsvis'}</div>
                    </td>}
                    {visibleCols.has('arshyra') && <td style={{ ...td, fontWeight: 600, color: C.text }}>{formatSEK(arshyra)}</td>}
                    {visibleCols.has('hyresutveckling') && <td style={td}>
                      {originalHyra ? (
                        <div>
                          <div style={{ fontSize: 12, color: C.muted2 }}>Start: {formatSEK(originalHyra)}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: hyraForandring && hyraForandring > 0 ? C.ok : C.muted }}>
                            {hyraForandring !== null ? `${hyraForandring > 0 ? '+' : ''}${hyraForandring.toFixed(1)}%` : '—'}
                          </div>
                        </div>
                      ) : <span style={{ fontSize: 12, color: C.muted2 }}>Ingen höjning</span>}
                    </td>}
                    {visibleCols.has('index') && <td style={{ ...td, color: C.muted }}>{a.anvand_index ? (a.basindex_varde ? `${a.basindex_varde}` : 'Aktiv') : 'Av'}</td>}
                    {visibleCols.has('uppsagn') && <td style={{ ...td, color: C.muted }}>{a.uppsagningstid_hg ?? a.uppsagningstid} mån</td>}
                    {visibleCols.has('fakturering') && <td style={{ ...td, color: C.muted }}>{a.faktureringsfrekvens === 'kvartalsvis' ? 'Kvartal' : 'Månad'}</td>}
                    {visibleCols.has('status') && <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={pill(sc.bg, sc.color)}>{statusLabels[a.status] || a.status}</span>
                        {a.slutdatum && (() => {
                          const dagar = Math.ceil((new Date(a.slutdatum).getTime() - Date.now()) / 86400000)
                          if (dagar <= 0) return null
                          const manad = Math.round(dagar / 30.5)
                          return (
                            <span style={{ fontSize: 12, color: C.muted2 }}>
                              {manad >= 2 ? `${manad} mån kvar` : `${dagar} dagar kvar`}
                            </span>
                          )
                        })()}
                      </div>
                    </td>}
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {a.status === 'aktiv' && (
                          <>
                            <button onClick={(e) => {
                              e.stopPropagation()
                              setSagaUpAvtal(a)
                              setSagaUpForm({
                                uppsagningsdatum: new Date().toISOString().split('T')[0],
                                slutdatum: beraknaSlutdatum(a),
                                kommentar: '',
                              })
                            }} title="Säg upp avtal" style={iconBtn}>🚫</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Säg upp avtal SlideOver */}
      <SlideOver
        open={!!sagaUpAvtal}
        onClose={() => setSagaUpAvtal(null)}
        title="Säg upp avtal"
        subtitle={sagaUpAvtal ? `${sagaUpAvtal.hyresgast.namn} – ${sagaUpAvtal.lokaler.map(l => l.lokal.namn).join(', ')}` : undefined}
        width="md"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setSagaUpAvtal(null)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button
              onClick={sagaUp}
              disabled={sagaUpSaving}
              style={{ ...btnDanger, flex: 1, background: C.danger, color: '#000', border: 'none', fontWeight: 700, opacity: sagaUpSaving ? 0.5 : 1 }}
            >
              {sagaUpSaving ? 'Säger upp...' : 'Säg upp avtal'}
            </button>
          </div>
        }
      >
        {sagaUpAvtal && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {(() => {
              if (!sagaUpAvtal.slutdatum || !sagaUpAvtal.forlangning) return (
                <div style={{ borderRadius: 8, background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', padding: '12px 16px', fontSize: 13, color: '#fbbf24' }}>
                  Avtalad uppsägningstid: <strong>{sagaUpAvtal.uppsagningstid} månader</strong>. Kontrollera och justera datumen nedan vid behov.
                </div>
              )
              const slut = new Date(sagaUpAvtal.slutdatum)
              const deadline = new Date(slut)
              deadline.setMonth(deadline.getMonth() - sagaUpAvtal.uppsagningstid)
              const forSent = new Date() > deadline
              return (
                <div style={{ borderRadius: 8, padding: '12px 16px', fontSize: 13, ...(forSent ? { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: C.danger } : { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }) }}>
                  {forSent ? (
                    <>
                      <p style={{ margin: 0 }}><strong>Uppsägningstiden har passerat</strong> — deadline var {deadline.toLocaleDateString('sv-SE')}.</p>
                      <p style={{ margin: '4px 0 0' }}>Avtalet förlängs automatiskt med {sagaUpAvtal.forlangning} år. Sista hyresdagen är förhandsifylld med nästa periods slut.</p>
                    </>
                  ) : (
                    <p style={{ margin: 0 }}>Avtalad uppsägningstid: <strong>{sagaUpAvtal.uppsagningstid} månader</strong>. Kontrollera och justera datumen nedan vid behov.</p>
                  )}
                </div>
              )
            })()}
            <div>
              <label style={smallLbl}>Uppsägningsdatum</label>
              <input spellCheck={false} type="date" value={sagaUpForm.uppsagningsdatum} onChange={e => setSagaUpForm(f => ({ ...f, uppsagningsdatum: e.target.value }))} style={inp} onFocus={fo} onBlur={fb} />
              <p style={{ marginTop: 4, fontSize: 12, color: C.muted2 }}>Datum när uppsägningen lämnades in</p>
            </div>
            <div>
              <label style={smallLbl}>Sista hyresdag (slutdatum)</label>
              <input spellCheck={false} type="date" value={sagaUpForm.slutdatum} onChange={e => setSagaUpForm(f => ({ ...f, slutdatum: e.target.value }))} style={inp} onFocus={fo} onBlur={fb} />
              <p style={{ marginTop: 4, fontSize: 12, color: C.muted2 }}>Förhandsifyllt med befintligt slutdatum eller beräknad uppsägningstid</p>
            </div>
            <div>
              <label style={smallLbl}>Kommentar (valfritt)</label>
              <textarea spellCheck={true} value={sagaUpForm.kommentar} onChange={e => setSagaUpForm(f => ({ ...f, kommentar: e.target.value }))} placeholder="t.ex. Överenskommelse om avflyttning vid årsskiftet" rows={2} style={{ ...inp, resize: 'none' }} onFocus={fo} onBlur={fb} />
            </div>
          </div>
        )}
      </SlideOver>

      {/* Redigera hyresavtal */}
      <SlideOver
        open={!!editAvtal}
        onClose={() => setEditAvtal(null)}
        title={editAvtal ? `${editAvtal.hyresgast.namn}` : ''}
        subtitle={editAvtal ? `${editAvtal.lokaler.map(l => l.lokal.namn).join(', ')} · ${editAvtal.lokaler[0]?.lokal.fastighet.namn}` : undefined}
        width="xl"
        footer={editTab === 'avtal' ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setEditAvtal(null)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={saveEdit} disabled={editSaving} style={{ ...btnPrimary, flex: 1, opacity: editSaving ? 0.5 : 1 }}>
              {editSaving ? 'Sparar...' : 'Spara ändringar'}
            </button>
          </div>
        ) : undefined}
      >
        {editAvtal && (
          <div>
            {/* Flikar */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${C.borderSoft}`, padding: '16px 24px 0' }}>
              {([
                { id: 'avtal' as const, label: 'Avtal', icon: '📋' },
                { id: 'dokument' as const, label: 'Dokument', icon: '📄' },
                { id: 'historik' as const, label: 'Historik', icon: '🕑' },
              ]).map(t => (
                <button key={t.id} onClick={() => setEditTab(t.id)} style={tabBtn(editTab === t.id)}>
                  <span>{t.icon}</span> {t.label}
                  {t.id === 'dokument' && dokument.length > 0 && <span style={{ marginLeft: 4, fontSize: 11, background: C.field, color: C.muted, borderRadius: 999, padding: '1px 6px' }}>{dokument.length}</span>}
                </button>
              ))}
            </div>

            {/* Avtal-flik */}
            {editTab === 'avtal' && <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 28 }}>
              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>Status:</label>
                <select style={{ ...inp, width: 'auto' }} onFocus={fo} onBlur={fb} value={editForm.status || editAvtal?.status || 'aktiv'} onChange={e => {
                  const val = e.target.value
                  if (val === 'uppsagd' && editAvtal && (editForm.status || editAvtal.status) !== 'uppsagd') {
                    setSagaUpAvtal(editAvtal)
                    setSagaUpForm({
                      uppsagningsdatum: new Date().toISOString().split('T')[0],
                      slutdatum: beraknaSlutdatum(editAvtal),
                      kommentar: '',
                    })
                    setEditAvtal(null)
                  } else {
                    setEditForm({ ...editForm, status: val })
                  }
                }}>
                  <option value="utkast">Utkast</option>
                  <option value="aktiv">Aktiv</option>
                  <option value="uppsagd">Uppsagd</option>
                  <option value="avslutad">Avslutad</option>
                </select>
              </div>

              {/* Lokaler */}
              <div>
                <h4 style={secH}>Lokaler i avtalet</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 192, overflowY: 'auto' }}>
                  {allaLokaler
                    .filter(l => l.fastighet.namn === editAvtal.lokaler[0]?.lokal.fastighet.namn || editLokalIds.includes(l.id))
                    .map(l => {
                      const vald = editLokalIds.includes(l.id)
                      const upptagen = !vald && l.status === 'uthyrd'
                      return (
                        <label key={l.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12, borderRadius: 8, padding: '8px 12px',
                          cursor: upptagen ? 'not-allowed' : 'pointer',
                          border: `1px solid ${vald ? C.gold : C.border}`,
                          background: vald ? C.goldSoft : C.field,
                          opacity: upptagen ? 0.5 : 1,
                        }}>
                          <input type="checkbox" checked={vald} disabled={upptagen}
                            onChange={() => setEditLokalIds(ids => vald ? ids.filter(id => id !== l.id) : [...ids, l.id])} />
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text2 }}>{l.namn}</span>
                          <span style={{ fontSize: 12, color: C.muted2 }}>{l.yta} kvm</span>
                          {l.typ === 'mark' && <span style={{ fontSize: 11, borderRadius: 999, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', padding: '2px 6px' }}>Mark</span>}
                          {upptagen && <span style={{ fontSize: 11, color: C.muted2 }}>Uthyrd</span>}
                        </label>
                      )
                    })}
                </div>
                {editLokalIds.length === 0 && <p style={{ marginTop: 8, fontSize: 12, color: C.danger }}>Minst en lokal måste väljas</p>}
              </div>

              {/* Kontraktstid */}
              <div>
                <h4 style={secH}>Kontraktstid</h4>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={smallLbl}>Avtalsdatum <span style={{ color: C.muted2, fontWeight: 400 }}>(valfritt)</span></label>
                    <input spellCheck={false} type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={editForm.avtalsdatum} onChange={e => setEditForm({ ...editForm, avtalsdatum: e.target.value })} />
                  </div>
                  <div>
                    <label style={smallLbl}>Hyrestid</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={editForm.hyrestid} onChange={e => setEditForm({ ...editForm, hyrestid: e.target.value })}>
                      <option value="tillsvidare">Tillsvidare</option>
                      <option value="tidsbegransat">Tidsbegränsat</option>
                      <option value="forlangning">Förlängning</option>
                    </select>
                  </div>
                  <div>
                    <label style={smallLbl}>Kontraktsstart</label>
                    <input spellCheck={false} type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={editForm.startdatum} onChange={e => setEditForm({ ...editForm, startdatum: e.target.value })} />
                  </div>
                  <div>
                    <label style={smallLbl}>Slutdatum <span style={{ color: C.muted2, fontWeight: 400 }}>(tomt = tillsvidare)</span></label>
                    <input spellCheck={false} type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={editForm.slutdatum} onChange={e => setEditForm({ ...editForm, slutdatum: e.target.value })} />
                  </div>
                  <div>
                    <label style={smallLbl}>Förlängningstid (år)</label>
                    <input spellCheck={false} type="number" min="1" style={inp} onFocus={fo} onBlur={fb} value={editForm.forlangning} onChange={e => setEditForm({ ...editForm, forlangning: e.target.value })} placeholder="t.ex. 3" />
                  </div>
                  <div>
                    <label style={smallLbl}>Uppsägningstid hyresgäst (mån)</label>
                    <input spellCheck={false} type="number" min="0" style={inp} onFocus={fo} onBlur={fb} value={editForm.uppsagningstidHG} onChange={e => setEditForm({ ...editForm, uppsagningstidHG: e.target.value })} />
                  </div>
                  <div>
                    <label style={smallLbl}>Uppsägningstid hyresvärd (mån)</label>
                    <input spellCheck={false} type="number" min="0" style={inp} onFocus={fo} onBlur={fb} value={editForm.uppsagningstidHV} onChange={e => setEditForm({ ...editForm, uppsagningstidHV: e.target.value })} />
                  </div>
                  <div>
                    <label style={smallLbl}>Faktureringsintervall</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={editForm.faktureringsfrekvens} onChange={e => setEditForm({ ...editForm, faktureringsfrekvens: e.target.value })}>
                      <option value="månadsvis">Månadsvis</option>
                      <option value="kvartalsvis">Kvartalsvis</option>
                    </select>
                  </div>
                  <div>
                    <label style={smallLbl}>Förfallodatum</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={editForm.forfallotyp} onChange={e => setEditForm({ ...editForm, forfallotyp: e.target.value })}>
                      <option value="fore_period">Före nästa hyresperiods start</option>
                      <option value="dagar_efter">Dagar efter fakturadatum</option>
                    </select>
                  </div>
                  {editForm.forfallotyp === 'dagar_efter' && (
                    <div>
                      <label style={smallLbl}>Antal dagar</label>
                      <input spellCheck={false} type="number" min="1" max="90" style={inp} onFocus={fo} onBlur={fb} value={editForm.forfallodagar} onChange={e => setEditForm({ ...editForm, forfallodagar: e.target.value })} placeholder="30" />
                    </div>
                  )}
                </div>
              </div>

              {/* Avtalsdetaljer */}
              <div>
                <h4 style={secH}>Avtalsdetaljer</h4>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={smallLbl}>Avtalsnummer</label>
                    <input spellCheck={false} style={inp} onFocus={fo} onBlur={fb} value={editForm.avtalsnummer || ''} onChange={e => setEditForm({ ...editForm, avtalsnummer: e.target.value })} placeholder="Sätts automatiskt" />
                  </div>
                  <div>
                    <label style={smallLbl}>Användningsändamål</label>
                    <input spellCheck={true} style={inp} onFocus={fo} onBlur={fb} value={editForm.anvandning || ''} onChange={e => setEditForm({ ...editForm, anvandning: e.target.value })} placeholder="T.ex. Kontor, Lager, Bilförädling" />
                  </div>
                  <div>
                    <label style={smallLbl}>El</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={editForm.elAbonnemang || 'hyresgast'} onChange={e => setEditForm({ ...editForm, elAbonnemang: e.target.value })}>
                      <option value="hyresgast">Eget abonnemang (hyresgäst)</option>
                      <option value="na">N/A</option>
                      <option value="ingar">Ingår i hyran</option>
                      <option value="hyresvard">Hyresvärden</option>
                      <option value="vidarefakturering">Vidarefakturering</option>
                      <option value="schablon">Enligt schablon</option>
                    </select>
                  </div>
                  <div>
                    <label style={smallLbl}>VA</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={editForm.vaAbonnemang || 'ingar'} onChange={e => setEditForm({ ...editForm, vaAbonnemang: e.target.value })}>
                      <option value="na">N/A</option>
                      <option value="ingar">Ingår i hyran</option>
                      <option value="hyresgast">Eget abonnemang</option>
                      <option value="hyresvard">Hyresvärden</option>
                      <option value="vidarefakturering">Vidarefakturering</option>
                      <option value="schablon">Enligt schablon</option>
                    </select>
                  </div>
                  <div>
                    <label style={smallLbl}>Värme</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={editForm.varmeAbonnemang || 'ingar'} onChange={e => setEditForm({ ...editForm, varmeAbonnemang: e.target.value })}>
                      <option value="na">N/A</option>
                      <option value="ingar">Ingår i hyran</option>
                      <option value="hyresgast">Eget abonnemang</option>
                      <option value="hyresvard">Hyresvärden</option>
                      <option value="vidarefakturering">Vidarefakturering</option>
                      <option value="schablon">Enligt schablon</option>
                    </select>
                  </div>
                  <div>
                    <label style={smallLbl}>Ventilation</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={editForm.ventilation || 'ingar'} onChange={e => setEditForm({ ...editForm, ventilation: e.target.value })}>
                      <option value="na">N/A</option>
                      <option value="ingar">Ingår i hyran</option>
                      <option value="hyresgast">Eget abonnemang</option>
                      <option value="hyresvard">Hyresvärden</option>
                      <option value="vidarefakturering">Vidarefakturering</option>
                      <option value="schablon">Enligt schablon</option>
                    </select>
                  </div>
                  <div>
                    <label style={smallLbl}>Kostnadsandel (%)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input spellCheck={false} type="number" step="0.1" style={inp} onFocus={fo} onBlur={fb} value={editForm.kostnadsandel || ''} onChange={e => {
                        const val = e.target.value
                        setEditForm(prev => ({ ...prev, kostnadsandel: val }))
                        if (val && editAvtal) {
                          const f0 = editAvtal.lokaler[0]?.lokal.fastighet
                          const tax = f0?.taxeringsvarde || 0
                          const sats = (f0?.bolag?.fastighetsskattesats ?? 0.5) / 100
                          const andel = parseFloat(val) / 100
                          const skattAr = Math.round(tax * sats * andel * 100) / 100
                          const skattMan = Math.round(skattAr / 12 * 100) / 100
                          setEditRader(prev => prev.map(r => r.artikelkod === 'FSKATT' ? { ...r, belopp: String(skattMan), arsbelopp: String(skattAr) } : r))
                        }
                      }} placeholder="Beräknas" />
                      <button type="button" onClick={() => {
                        if (!editAvtal) return
                        const f0 = editAvtal.lokaler[0]?.lokal
                        const totalLOA = f0?.fastighet.byggnader?.reduce((s, b) => s + (b.uthyrbar_yta ?? 0), 0) || 0
                        const totalYta = editAvtal.lokaler.reduce((s, l) => s + l.lokal.yta, 0)
                        if (totalLOA > 0 && totalYta > 0) {
                          const andel = Math.round((totalYta / totalLOA) * 1000) / 10
                          setEditForm(prev => ({ ...prev, kostnadsandel: String(andel) }))
                          const tax = f0?.fastighet.taxeringsvarde || 0
                          const sats = (f0?.fastighet.bolag?.fastighetsskattesats ?? 0.5) / 100
                          const skattAr = Math.round(tax * sats * (andel / 100) * 100) / 100
                          const skattMan = Math.round(skattAr / 12 * 100) / 100
                          setEditRader(prev => prev.map(r => r.artikelkod === 'FSKATT' ? { ...r, belopp: String(skattMan), arsbelopp: String(skattAr) } : r))
                        }
                      }} style={{ ...btnGhost, color: C.gold, borderColor: C.gold, whiteSpace: 'nowrap', fontSize: 12 }}>Beräkna</button>
                    </div>
                    {editForm.kostnadsandel && <p style={{ marginTop: 4, fontSize: 12, color: C.muted2 }}>Lokaler {editAvtal?.lokaler.reduce((s, l) => s + l.lokal.yta, 0)} kvm av fastighetens totala uthyrbara yta</p>}
                  </div>
                  <div style={{ gridColumn: '1 / -1', borderRadius: 8, border: `1px solid ${C.border}`, padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>Fastighetsskatt debiteras hyresgäst</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <div style={{ position: 'relative', width: 36, height: 20 }}>
                          <input type="checkbox" style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} checked={editRader.some(r => r.artikelkod === 'FSKATT')} onChange={e => {
                            if (e.target.checked) {
                              const _f = editAvtal?.lokaler[0]?.lokal.fastighet
                              const tax = (_f?.beteckningar?.reduce((s, b) => s + (b.taxeringsvarde ?? 0), 0) || _f?.taxeringsvarde || 0)
                              const sats = (_f?.bolag?.fastighetsskattesats ?? 0.5) / 100
                              const andel = editForm.kostnadsandel ? parseFloat(editForm.kostnadsandel) / 100 : 0
                              const skattAr = Math.round(tax * sats * andel * 100) / 100
                              const skattMan = Math.round(skattAr / 12 * 100) / 100
                              setEditRader(prev => [...prev, {
                                artikelkod: 'FSKATT',
                                beskrivning: 'Fastighetsskatt',
                                belopp: skattMan > 0 ? String(skattMan) : '',
                                arsbelopp: skattAr > 0 ? String(skattAr) : '',
                                moms: '25',
                              }])
                            } else {
                              setEditRader(prev => prev.filter(r => r.artikelkod !== 'FSKATT'))
                            }
                          }} />
                          <div style={{ width: 36, height: 20, borderRadius: 999, background: editRader.some(r => r.artikelkod === 'FSKATT') ? C.gold : C.border, transition: 'background 0.2s' }} />
                          <div style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.4)', transition: 'transform 0.2s', transform: editRader.some(r => r.artikelkod === 'FSKATT') ? 'translateX(16px)' : 'none' }} />
                        </div>
                      </label>
                    </div>
                    {editRader.some(r => r.artikelkod === 'FSKATT') && (() => {
                      const _f2 = editAvtal?.lokaler[0]?.lokal.fastighet
                      const tax = _f2?.beteckningar?.reduce((s, b) => s + (b.taxeringsvarde ?? 0), 0) || _f2?.taxeringsvarde || 0
                      const sats = _f2?.bolag?.fastighetsskattesats ?? 0.5
                      const andel = editForm.kostnadsandel ? parseFloat(editForm.kostnadsandel) : 0
                      const fskattRad = editRader.find(r => r.artikelkod === 'FSKATT')
                      return (
                        <div style={{ fontSize: 12, color: C.muted2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {tax ? (
                            <p style={{ margin: 0 }}>Taxeringsvärde {tax.toLocaleString('sv-SE')} kr × {sats}% × {andel}% = {fskattRad?.arsbelopp || '?'} kr/år</p>
                          ) : (
                            <p style={{ margin: 0, color: '#fbbf24' }}>Taxeringsvärde saknas på fastigheten — fyll i under Fastigheter.</p>
                          )}
                          <p style={{ margin: 0 }}>Beloppet kan justeras manuellt i faktureringsraden nedan.</p>
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <label style={smallLbl}>Underhållsansvar</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={editForm.underhallsansvar || 'hyresgast_ytskikt'} onChange={e => setEditForm({ ...editForm, underhallsansvar: e.target.value })}>
                      <option value="hyresvard">Hyresvärden — allt underhåll</option>
                      <option value="hyresgast_ytskikt">Hyresgästen — ytskikt (golv, väggar, tak)</option>
                      <option value="hyresgast_allt">Hyresgästen — allt underhåll</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={smallLbl}>Säkerhet</label>
                    <input spellCheck={true} style={inp} onFocus={fo} onBlur={fb} value={editForm.sakerhet || ''} onChange={e => setEditForm({ ...editForm, sakerhet: e.target.value })} placeholder="T.ex. Bankgaranti 100 000 kr" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={smallLbl}>Särskilda villkor</label>
                    <textarea spellCheck={true} rows={3} style={{ ...inp, resize: 'none' }} onFocus={fo} onBlur={fb} value={editForm.specialvillkor || ''} onChange={e => setEditForm({ ...editForm, specialvillkor: e.target.value })} placeholder="Fritext för särskilda avtalsvillkor..." />
                  </div>
                </div>
              </div>

              {/* Faktureringsrader */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}` }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>Faktureringsrader</h4>
                  <button type="button" onClick={() => setEditRader(prev => [...prev, { artikelkod: 'TILLAGG', beskrivning: '', belopp: '', arsbelopp: '', moms: '25' }])} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ＋ Lägg till rad
                  </button>
                </div>

                <p style={{ fontSize: 12, color: C.muted2, marginBottom: 12 }}>Alla belopp anges per månad.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {editRader.map((rad, i) => (
                    <div key={i} style={{ borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${rad.artikelkod === 'HYR' ? C.gold : C.border}`, background: rad.artikelkod === 'HYR' ? C.goldSoft : C.field }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <select style={{ ...radInp, width: 'auto', fontWeight: 600 }} onFocus={fo} onBlur={fb} value={rad.artikelkod} onChange={e => {
                          const kod = e.target.value
                          const typ = AVTALSRAD_TYPER.find(t => t.kod === kod)
                          setEditRader(prev => prev.map((r, idx) => idx === i ? { ...r, artikelkod: kod, beskrivning: !r.beskrivning && typ ? typ.label : r.beskrivning } : r))
                        }}>
                          {AVTALSRAD_TYPER.map(t => <option key={t.kod} value={t.kod}>{t.label}</option>)}
                        </select>
                        {rad.artikelkod !== 'HYR' && (
                          <button type="button" onClick={() => setEditRader(prev => prev.filter((_, idx) => idx !== i))} style={iconBtn}>✕</button>
                        )}
                      </div>
                      {/* Artikelväljare — autofyller beskrivning/belopp/moms ur artikelregistret. Fälten går att redigera fritt efteråt. */}
                      {artiklar.length > 0 && (
                        <select
                          style={radInp}
                          onFocus={fo}
                          onBlur={fb}
                          value=""
                          onChange={e => {
                            const art = artiklar.find(x => x.id === e.target.value)
                            if (!art) return
                            const m = art.apris != null ? String(art.apris) : ''
                            const ar = art.apris != null ? String(Math.round(art.apris * 12 * 100) / 100) : ''
                            setEditRader(prev => prev.map((r, idx) => idx === i ? {
                              ...r,
                              beskrivning: art.benamning,
                              ...(art.apris != null ? { belopp: m, arsbelopp: ar } : {}),
                              moms: String(art.moms),
                            } : r))
                            if (rad.artikelkod === 'HYR' && art.apris != null) setEditForm(prev => ({ ...prev, bashyra: m }))
                          }}
                        >
                          <option value="">Välj artikel...</option>
                          {artiklar.map(a => <option key={a.id} value={a.id}>{a.kod} – {a.benamning}</option>)}
                        </select>
                      )}
                      <input spellCheck={true} style={radInp} onFocus={fo} onBlur={fb} value={rad.beskrivning} onChange={e => setEditRader(prev => prev.map((r, idx) => idx === i ? { ...r, beskrivning: e.target.value } : r))} placeholder="Beskrivning" />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: C.muted, marginBottom: 2 }}>Per månad exkl. moms</label>
                          <input spellCheck={false} type="number" style={radInp} onFocus={fo} onBlur={fb} value={rad.belopp} onChange={e => {
                            const m = e.target.value
                            const a = m ? String(Math.round(parseFloat(m) * 12 * 100) / 100) : ''
                            setEditRader(prev => prev.map((r, idx) => idx === i ? { ...r, belopp: m, arsbelopp: a } : r))
                            if (rad.artikelkod === 'HYR') setEditForm(prev => ({ ...prev, bashyra: m }))
                          }} placeholder="8 500" />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: C.muted, marginBottom: 2 }}>Per år exkl. moms</label>
                          <input spellCheck={false} type="number" style={radInp} onFocus={fo} onBlur={fb} value={rad.arsbelopp} onChange={e => {
                            const a = e.target.value
                            const m = a ? String(Math.round(parseFloat(a) / 12 * 100) / 100) : ''
                            setEditRader(prev => prev.map((r, idx) => idx === i ? { ...r, belopp: m, arsbelopp: a } : r))
                            if (rad.artikelkod === 'HYR') setEditForm(prev => ({ ...prev, bashyra: m }))
                          }} placeholder="102 000" />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: C.muted, marginBottom: 2 }}>Moms</label>
                          <select style={radInp} onFocus={fo} onBlur={fb} value={rad.moms} onChange={e => setEditRader(prev => prev.map((r, idx) => idx === i ? { ...r, moms: e.target.value } : r))}>
                            <option value="0">0 %</option>
                            <option value="25">25 %</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summering */}
                {editRader.some(r => r.belopp) && (() => {
                  const r2 = (n: number) => Math.round(n * 100) / 100
                  let totalArExkl = 0
                  editRader.forEach(r => {
                    if (!r.arsbelopp && !r.belopp) return
                    const ar = r.arsbelopp ? parseFloat(r.arsbelopp) : parseFloat(r.belopp) * 12
                    totalArExkl += ar
                  })

                  let indexAr = 0
                  const hyraRad = editRader.find(r => r.artikelkod === 'HYR')
                  const hyraAr = hyraRad?.arsbelopp ? parseFloat(hyraRad.arsbelopp) : (hyraRad?.belopp ? parseFloat(hyraRad.belopp) * 12 : 0)
                  if (editAnvandIndex && editForm.basindexVarde && editAktuellKpi && hyraAr > 0) {
                    const bas = parseFloat(editForm.basindexVarde)
                    const procent = (editAktuellKpi.value - bas) / bas
                    indexAr = r2(hyraAr * procent)
                  }

                  const totalArMedIndex = totalArExkl + indexAr
                  const totalManadMedIndex = r2(totalArMedIndex / 12)
                  const totalManadExkl = r2(totalArExkl / 12)

                  const rowLbl: React.CSSProperties = { color: C.muted, margin: 0 }
                  const rowVal: React.CSSProperties = { fontWeight: 600, textAlign: 'right', margin: 0, color: C.text }
                  const brd = `1px solid ${C.borderStrong}`
                  return (
                    <div style={{ marginTop: 16, borderRadius: 8, background: '#000', color: C.text, padding: '12px 16px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 16, rowGap: 6, fontSize: 13 }}>
                        <p style={rowLbl}>Avtalat/mån exkl. moms:</p>
                        <p style={rowVal}>{formatSEK(totalManadExkl)}</p>
                        {indexAr !== 0 && <>
                          <p style={{ ...rowLbl, color: C.ok }}>Indextillägg/mån:</p>
                          <p style={{ ...rowVal, color: C.ok }}>+{formatSEK(r2(indexAr / 12))}</p>
                          <p style={{ ...rowLbl, color: C.text, fontWeight: 600, borderTop: brd, paddingTop: 6 }}>Med index/mån exkl.:</p>
                          <p style={{ ...rowVal, fontWeight: 700, borderTop: brd, paddingTop: 6 }}>{formatSEK(totalManadMedIndex)}</p>
                          <p style={rowLbl}>Med index/mån inkl.:</p>
                          <p style={rowVal}>{formatSEK(r2(totalManadMedIndex * 1.25))}</p>
                        </>}
                        {indexAr === 0 && <>
                          <p style={rowLbl}>Total/mån inkl. moms:</p>
                          <p style={rowVal}>{formatSEK(r2(totalManadExkl * 1.25))}</p>
                        </>}
                        <p style={{ ...rowLbl, borderTop: brd, paddingTop: 6 }}>Total/år exkl. moms:</p>
                        <p style={{ ...rowVal, fontWeight: 700, borderTop: brd, paddingTop: 6 }}>{formatSEK(totalArMedIndex)}</p>
                        <p style={rowLbl}>Total/år inkl. moms:</p>
                        <p style={{ ...rowVal, fontWeight: 700 }}>{formatSEK(r2(totalArMedIndex * 1.25))}</p>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* KPI-indexering */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}` }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>KPI-indexering</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{editAnvandIndex ? 'Aktiv' : 'Av'}</span>
                    <div style={{ position: 'relative', width: 36, height: 20 }}>
                      <input type="checkbox" style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} checked={editAnvandIndex} onChange={() => setEditAnvandIndex(!editAnvandIndex)} />
                      <div style={{ width: 36, height: 20, borderRadius: 999, background: editAnvandIndex ? C.gold : C.border, transition: 'background 0.2s' }} />
                      <div style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.4)', transition: 'transform 0.2s', transform: editAnvandIndex ? 'translateX(16px)' : 'none' }} />
                    </div>
                  </label>
                </div>
                {!editAnvandIndex ? (
                  <p style={{ fontSize: 12, color: C.muted2, fontStyle: 'italic' }}>Indexreglering är avstängd för detta avtal.</p>
                ) : <>
                  <p style={{ fontSize: 12, color: C.muted2, marginBottom: 12 }}>Ange basindex från kontraktsdatumet. Indextillägg beräknas automatiskt vid fakturering.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={smallLbl}>Basår</label>
                      <input spellCheck={false} type="number" min="1980" max="2030" style={inp} onFocus={fo} onBlur={fb} value={editForm.basindexAr} onChange={e => {
                        const ar = e.target.value
                        setEditForm(prev => ({ ...prev, basindexAr: ar }))
                        if (ar.length === 4) fetchEditKpi(ar, editForm.basindexManad)
                      }} placeholder="2023" />
                    </div>
                    <div>
                      <label style={smallLbl}>Basmånad</label>
                      <select style={inp} onFocus={fo} onBlur={fb} value={editForm.basindexManad} onChange={e => {
                        const manad = e.target.value
                        setEditForm(prev => ({ ...prev, basindexManad: manad }))
                        if (editForm.basindexAr) fetchEditKpi(editForm.basindexAr, manad)
                      }}>
                        {MONTHS_SV.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={smallLbl}>Basindextal {editKpiLoading && <span style={{ color: C.gold }}>⏳</span>}</label>
                      <input spellCheck={false} type="number" step="0.01" style={inp} onFocus={fo} onBlur={fb} value={editForm.basindexVarde} onChange={e => { setEditForm({ ...editForm, basindexVarde: e.target.value }); setEditKpiInfo(null) }} placeholder="Hämtas automatiskt" />
                      {editKpiInfo && <p style={{ fontSize: 12, color: C.ok, marginTop: 4 }}>SCB: {editKpiInfo.period} = {editKpiInfo.value}</p>}
                    </div>
                  </div>

                  {editForm.basindexVarde && editAktuellKpi && (() => {
                    const r2 = (n: number) => Math.round(n * 100) / 100
                    const bas = parseFloat(editForm.basindexVarde)
                    const nu = editAktuellKpi.value
                    const procent = ((nu - bas) / bas) * 100
                    const hyraRadEdit = editRader.find(r => r.artikelkod === 'HYR')
                    const arshyra = hyraRadEdit?.arsbelopp ? parseFloat(hyraRadEdit.arsbelopp) : (hyraRadEdit?.belopp ? parseFloat(hyraRadEdit.belopp) * 12 : 0)
                    if (arshyra <= 0) return null
                    const hojningAr = r2(arshyra * (procent / 100))
                    const nyHyraAr = arshyra + hojningAr
                    const gL: React.CSSProperties = { color: C.ok, margin: 0 }
                    const gV: React.CSSProperties = { fontWeight: 600, color: C.text, margin: 0 }
                    const brd = '1px solid rgba(74,222,128,0.25)'
                    return (
                      <div style={{ marginTop: 12, borderRadius: 8, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', padding: '12px 16px' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: C.ok, marginBottom: 8 }}>Beräknad indexhöjning</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', columnGap: 16, rowGap: 4, fontSize: 13 }}>
                          <p style={gL}>Basindex ({editKpiInfo?.period || `${editForm.basindexManad} ${editForm.basindexAr}`}):</p>
                          <p style={gV}>{bas.toFixed(2)}</p>
                          <p style={gL}>Aktuellt ({editAktuellKpi.period}):</p>
                          <p style={gV}>{nu.toFixed(2)}</p>
                          <p style={gL}>Förändring:</p>
                          <p style={{ ...gV, color: procent >= 0 ? C.ok : C.danger, fontWeight: 700 }}>{procent >= 0 ? '+' : ''}{procent.toFixed(2)} %</p>
                          <p style={{ ...gL, borderTop: brd, paddingTop: 6 }}>Indextillägg/år:</p>
                          <p style={{ ...gV, fontWeight: 700, borderTop: brd, paddingTop: 6 }}>{formatSEK(hojningAr)}</p>
                          <p style={gL}>Ny hyra/år:</p>
                          <p style={{ ...gV, fontWeight: 700 }}>{formatSEK(nyHyraAr)}</p>
                          <p style={gL}>Ny hyra/mån:</p>
                          <p style={{ ...gV, fontWeight: 700 }}>{formatSEK(r2(nyHyraAr / 12))}</p>
                        </div>
                      </div>
                    )
                  })()}
                </>}
              </div>
            </div>}

            {/* Dokument-flik */}
            {editTab === 'dokument' && <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{dokument.length} dokument</p>
                <label style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', opacity: uploadingDok ? 0.5 : 1 }}>
                  ⬆️ {uploadingDok ? 'Laddar upp...' : 'Ladda upp'}
                  <input type="file" style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} disabled={uploadingDok} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) uploadDokument(f, 'ovrigt')
                    e.target.value = ''
                  }} />
                </label>
              </div>

              {dokument.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', borderRadius: 8, border: `1px dashed ${C.border}` }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <p style={{ fontSize: 13, color: C.muted2, margin: 0 }}>Inga dokument uppladdade</p>
                  <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Ladda upp hyresavtal, ritningar, bilder etc.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dokument.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.field, padding: '12px 16px' }}>
                      <a href={d.sokvag} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, textDecoration: 'none', color: C.text2 }}>
                        <span style={{ flexShrink: 0, color: C.muted }}>📄</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.namn}</p>
                          <p style={{ fontSize: 12, color: C.muted2, margin: 0 }}>{formatFileSize(d.filstorlek)} · {new Date(d.created_at).toLocaleDateString('sv-SE')}</p>
                        </div>
                      </a>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                        <select style={{ ...radInp, width: 'auto' }} defaultValue={d.typ}>
                          <option value="hyresavtal">Hyresavtal</option>
                          <option value="ritning">Ritning</option>
                          <option value="bild">Bild</option>
                          <option value="ovrigt">Övrigt</option>
                        </select>
                        <button onClick={() => deleteDokument(d.id)} style={iconBtn}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>}

            {/* Historik-flik */}
            {editTab === 'historik' && <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>Indexhöjningar</h4>
              {(!editAvtal.indexhojningar || editAvtal.indexhojningar.length === 0) ? (
                <p style={{ fontSize: 12, color: C.muted2, fontStyle: 'italic' }}>Inga indexhöjningar gjorda ännu.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {editAvtal.indexhojningar.map(ih => (
                    <div key={ih.id} style={{ borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.field, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: C.muted }}>{new Date(ih.datum).toLocaleDateString('sv-SE')}</span>
                        <span style={{ fontWeight: 600, color: C.ok }}>+{ih.procent.toFixed(2)} %</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted2, marginTop: 4 }}>
                        <span>{formatSEK(ih.bashyra_gammal)} → {formatSEK(ih.bashyra_ny)}</span>
                        <span>{ih.skapad_av}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 12, marginBottom: 0 }}>Avtalsinfo</h4>
              <div style={{ borderRadius: 8, background: C.field, border: `1px solid ${C.borderSoft}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Status</span><span style={pill((statusColors[editAvtal.status] || { bg: C.field, color: C.muted }).bg, (statusColors[editAvtal.status] || { bg: C.field, color: C.muted }).color)}>{statusLabels[editAvtal.status]}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Skapad</span><span style={{ color: C.text2 }}>{new Date(editAvtal.startdatum).toLocaleDateString('sv-SE')}</span></div>
                {editAvtal.slutdatum && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Slutdatum</span><span style={{ color: C.text2 }}>{new Date(editAvtal.slutdatum).toLocaleDateString('sv-SE')}</span></div>}
              </div>
            </div>}
          </div>
        )}
      </SlideOver>
    </div>
  )
}
