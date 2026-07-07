'use client'

// Migrerad från käll-appens src/app/fakturering/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold-styles + emoji-ikoner, data via /api/fastigheter/fakturor.
//
// VIKTIGT om fältnamn: Supabase-routen returnerar snake_case-kolumner. Käll-UI:t använde
// samma nästlade struktur (rader, hyresavtal.lokaler[].lokal.fastighet, hyresgast) och de
// fälten (fakturanummer, forfallodag, faktureringsfrekvens, personnummer ...) är redan
// snake_case/lowercase i schemat → ingen fält-remap behövs här utöver render-anpassningen.

import { useEffect, useState } from 'react'
import React from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost, btnDanger } from '@/components/fastigheter/styles'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useConfirm } from '@/components/ConfirmDialog'
import { useBolag } from '@/components/fastigheter/BolagContext'
import Sokfalt from '@/components/Sokfalt'
import { createClient } from '@/lib/supabase/client'

interface FakturaRad {
  id: string; artikelkod: string; beskrivning: string
  antal: number; apris: number; belopp: number; moms: number
}

// Artikel ur artikelregistret (f_artikel) — används för att autofylla manuella rader.
interface Artikel {
  id: string; kod: string; benamning: string
  apris: number | null; moms: number
}

interface FakturaHandelse {
  id: string; typ: string; meddelande: string | null; created_at: string
}

interface Faktura {
  id: string; fakturanummer: string; belopp: number; period: string
  forfallodag: string; status: string
  typ: string; original_faktura_id: string | null
  created_at: string
  handelser: FakturaHandelse[]
  rader: FakturaRad[]
  hyresavtal: {
    lokaler: { lokal: { namn: string; fastighet: { namn: string; bolag_id: string | null } } }[]
    hyresgast: { id: string; namn: string; epost: string | null; personnummer: string | null }
    faktureringsfrekvens: string
  } | null
  hyresgast: { id: string; namn: string; personnummer: string | null; epost: string | null } | null
  hyresgast_id: string | null
  bolag_id: string | null
}

interface Preview {
  antalNya: number; skippade: number; manadsavtal: number; kvartalsavtal: number
}

const statusConfig: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  ej_skickad: { label: 'Ej skickad', bg: C.field, color: C.muted, icon: '🕒' },
  skickad: { label: 'Skickad', bg: 'rgba(96,165,250,0.12)', color: C.blue, icon: '📤' },
  betald: { label: 'Betald', bg: 'rgba(74,222,128,0.12)', color: C.ok, icon: '✅' },
  krediterad: { label: 'Krediterad', bg: 'rgba(136,136,136,0.12)', color: C.muted, icon: '↩️' },
}

// En faktura är förfallen om förfallodag passerat och den varken är betald eller krediterad.
const isForfallen = (f: Faktura) => {
  if (f.status === 'betald' || f.status === 'krediterad') return false
  return new Date(f.forfallodag) < new Date(new Date().toDateString())
}

const formatSEK = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)
// À-pris kan vara brutet (t.ex. el 2,38 kr/kWh) → visa ören men bara när det behövs.
const formatApris = (n: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
const formatDate = (d: string) => new Date(d).toLocaleDateString('sv-SE')
// Belopp inkl. moms — raderna bär moms% per rad (hyra ofta 0%, lokal 25%)
const beloppInkl = (f: { rader: { belopp: number; moms: number }[] }) => f.rader.reduce((s, r) => s + r.belopp * (1 + r.moms / 100), 0)
const formatDateTime = (d: string) => new Date(d).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })

// ---- Null-säkra hjälpare (manuella fakturor saknar hyresavtal/lokal) --------
const hyresgastNamn = (f: Faktura) => f.hyresavtal?.hyresgast.namn ?? f.hyresgast?.namn ?? '—'
const lokalText = (f: Faktura) => f.hyresavtal?.lokaler.map(l => l.lokal.namn).join(', ') || '—'
const fastighetNamn = (f: Faktura) => f.hyresavtal?.lokaler?.[0]?.lokal.fastighet.namn ?? ''
const bolagId = (f: Faktura) => f.hyresavtal?.lokaler?.[0]?.lokal.fastighet.bolag_id ?? f.bolag_id ?? null
const kundId = (f: Faktura) => f.hyresavtal?.hyresgast.id ?? f.hyresgast?.id ?? f.hyresgast_id ?? ''
const hyresgastPnr = (f: Faktura) => f.hyresavtal?.hyresgast.personnummer ?? f.hyresgast?.personnummer ?? null

// Ikon + etikett per tidslinje-händelsetyp.
const handelseConfig: Record<string, { icon: string; label: string }> = {
  skapad: { icon: '📝', label: 'Skapad' },
  skickad: { icon: '📤', label: 'Skickad' },
  betald: { icon: '✅', label: 'Betald' },
  krediterad: { icon: '↩️', label: 'Krediterad' },
  oppnad: { icon: '👁️', label: 'Öppnad av kund' },
}

// Quarter options for a given year
function kvartalOptions(year: number) {
  return [
    { label: `Q1 ${year} (Jan–Mar)`, period: `${year}-01` },
    { label: `Q2 ${year} (Apr–Jun)`, period: `${year}-04` },
    { label: `Q3 ${year} (Jul–Sep)`, period: `${year}-07` },
    { label: `Q4 ${year} (Okt–Dec)`, period: `${year}-10` },
  ]
}

// Vilket kvartal en periodetikett tillhör, t.ex. '2026-Q1'. Hanterar både
// månadsetikett ('2026-02') och kvartalsetikett ('2026-01 – 2026-03') — vi tar
// alltid startmånaden (de sju första tecknen 'YYYY-MM').
function periodKvartal(period: string): string {
  const [y, m] = period.slice(0, 7).split('-').map(Number)
  if (!y || !m) return period
  return `${y}-Q${Math.ceil(m / 3)}`
}

// '2026-Q1' → 'Q1 2026'
function kvartalKeyLabel(key: string): string {
  const [y, q] = key.split('-')
  return `${q} ${y}`
}

const selStyle: React.CSSProperties = { ...inp, width: 'auto', minWidth: 150 }

export default function FaktureringPage() {
  const isMobile = useIsMobile()
  const confirm = useConfirm()
  const { valtBolagId, bolagLista } = useBolag()
  const valtBolagNamn = valtBolagId ? bolagLista.find(b => b.id === valtBolagId)?.namn : null
  // Engångsmeddelande för DENNA genereringsomgång — bakas in på fakturorna, sparas inte.
  const [omgangMsg, setOmgangMsg] = useState('')
  const [fakturor, setFakturor] = useState<Faktura[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterHyresgast, setFilterHyresgast] = useState('')
  const [previewFaktura, setPreviewFaktura] = useState<Faktura | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [sortCol, setSortCol] = useState<string>('period')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [vy, setVy] = useState<'attskicka' | 'vantar' | 'betalda' | 'alla'>('attskicka')
  const [search, setSearch] = useState('')

  // ---- Manuell faktura ------------------------------------------------------
  const [hyresgaster, setHyresgaster] = useState<{ id: string; namn: string }[]>([])
  const [artiklar, setArtiklar] = useState<Artikel[]>([])
  const [manuellOpen, setManuellOpen] = useState(false)
  const [manuellSparar, setManuellSparar] = useState(false)
  const idag = () => new Date().toISOString().slice(0, 10)
  const idagPlus = (dagar: number) => { const d = new Date(); d.setDate(d.getDate() + dagar); return d.toISOString().slice(0, 10) }
  const [mHyresgastId, setMHyresgastId] = useState('')
  const [mBolagId, setMBolagId] = useState('') // '' = automatiskt (härleds från hyresavtal)
  const [mFakturadatum, setMFakturadatum] = useState(idag())
  const [mForfallodatum, setMForfallodatum] = useState(idagPlus(30))
  const [mRader, setMRader] = useState<{ beskrivning: string; antal: number; apris: number; moms: number; fritext?: boolean }[]>([
    { beskrivning: '', antal: 1, apris: 0, moms: 25 },
  ])

  // ---- Redigera befintlig faktura: lägg till/ta bort fritextrad ------------
  // Fokuserat på fritext (artikelkod 'TEXT') — rör inte belopps-rader/summan.
  const [redigeraFaktura, setRedigeraFaktura] = useState<Faktura | null>(null)
  const [nyFritext, setNyFritext] = useState('')
  const [fritextSparar, setFritextSparar] = useState(false)

  const now = new Date()
  const currentYear = now.getFullYear()

  // Monthly period options (12 months back + 3 ahead)
  const monthlyPeriods = Array.from({ length: 15 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - 12 + i)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Kvartalsval: innevarande + nästa år (alla fyra kvartal per år)
  const kvartalOpts = [...kvartalOptions(currentYear), ...kvartalOptions(currentYear + 1)]

  const currentPeriod = monthlyPeriods[12]

  useEffect(() => {
    setSelectedPeriod(currentPeriod)
    setFilterPeriod('') // visa alla kvartal som default (annars döljs fakturor från andra kvartal)
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const load = (period?: string) => {
    const url = period ? `/api/fastigheter/fakturor?period=${period}` : '/api/fastigheter/fakturor'
    fetch(url).then(r => r.json()).then(data => { if (Array.isArray(data)) setFakturor(data) }).finally(() => setLoading(false))
  }

  // Förhandsvisa vad en generering för vald period skulle skapa (respekterar bolagsväljaren).
  useEffect(() => {
    if (!selectedPeriod) { setPreview(null); return }
    let cancelled = false
    const bolagParam = valtBolagId ? `&bolagId=${valtBolagId}` : ''
    fetch(`/api/fastigheter/fakturor/preview?period=${selectedPeriod}${bolagParam}`)
      .then(r => r.json())
      .then(data => { if (!cancelled && data && typeof data.antalNya === 'number') setPreview(data) })
      .catch(() => { if (!cancelled) setPreview(null) })
    return () => { cancelled = true }
  }, [selectedPeriod, valtBolagId])

  // Hämta hyresgäst-listan (id + namn) för manuell-faktura-väljaren.
  useEffect(() => {
    const sb = createClient()
    sb.from('f_hyresgast').select('id, namn').order('namn')
      .then(({ data }) => { if (Array.isArray(data)) setHyresgaster(data as { id: string; namn: string }[]) })
  }, [])

  // Hämta aktiva artiklar ur artikelregistret för radväljaren (autofyller beskrivning/á-pris/moms).
  useEffect(() => {
    fetch('/api/fastigheter/artiklar')
      .then(r => r.json())
      .then((data: Artikel[]) => { if (Array.isArray(data)) setArtiklar(data.filter(a => (a as unknown as { aktiv: boolean }).aktiv !== false)) })
      .catch(() => {})
  }, [])

  // ---- Manuell faktura: rad-hjälpare + summering ----------------------------
  const setRad = (i: number, patch: Partial<{ beskrivning: string; antal: number; apris: number; moms: number }>) =>
    setMRader(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const laggTillRad = () => setMRader(prev => [...prev, { beskrivning: '', antal: 1, apris: 0, moms: 25 }])
  // Fritextrad: bara text, ingen kostnad – visas på fakturan som en textrad.
  const laggTillFritext = () => setMRader(prev => [...prev, { beskrivning: '', antal: 0, apris: 0, moms: 0, fritext: true }])
  const taBortRad = (i: number) => setMRader(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i))
  // Flytta en rad upp/ner (så t.ex. fritextraden kan placeras var som helst).
  const flyttaRad = (i: number, dir: -1 | 1) => setMRader(prev => {
    const j = i + dir
    if (j < 0 || j >= prev.length) return prev
    const next = [...prev]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  // Autofyll en rad från en vald artikel. Användaren kan redigera fritt efteråt.
  const valjArtikel = (i: number, artikelId: string) => {
    const a = artiklar.find(x => x.id === artikelId)
    if (!a) return
    setRad(i, { beskrivning: a.benamning, apris: a.apris ?? 0, moms: a.moms })
  }

  const mSummaExkl = mRader.reduce((s, r) => s + (r.antal || 0) * (r.apris || 0), 0)
  const mMoms = mRader.reduce((s, r) => s + (r.antal || 0) * (r.apris || 0) * ((r.moms || 0) / 100), 0)
  const mTotalInkl = mSummaExkl + mMoms
  const mGiltigaRader = mRader.filter(r => (r.antal || 0) * (r.apris || 0) !== 0)
  const manuellGiltig = !!mHyresgastId && mGiltigaRader.length > 0

  const oppnaManuell = () => {
    setMHyresgastId('')
    setMBolagId('')
    setMFakturadatum(idag())
    setMForfallodatum(idagPlus(30))
    setMRader([{ beskrivning: '', antal: 1, apris: 0, moms: 25 }])
    setManuellOpen(true)
  }

  const skapaManuell = async () => {
    if (!manuellGiltig) return
    setManuellSparar(true)
    setMessage(null)
    const res = await fetch('/api/fastigheter/fakturor/manuell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hyresgastId: mHyresgastId,
        bolagId: mBolagId || null,
        fakturadatum: mFakturadatum,
        forfallodatum: mForfallodatum,
        rader: mRader
          .filter(r => r.beskrivning?.trim()) // hoppa helt tomma rader
          .map(r => ({ beskrivning: r.beskrivning, antal: Number(r.antal) || 0, apris: Number(r.apris) || 0, moms: Number(r.moms) || 0, fritext: !!r.fritext })),
      }),
    })
    setManuellSparar(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setMessage({ text: 'Kunde inte skapa fakturan: ' + (d.error || res.statusText), type: 'info' })
      return
    }
    setManuellOpen(false)
    setMessage({ text: 'Manuell faktura skapad', type: 'success' })
    load()
  }

  // ---- Redigera fritextrader på en befintlig faktura ------------------------
  // Öppna redigeringspanelen (från förhandsvisningen). Stäng preview så panelerna inte krockar.
  const oppnaRedigera = (f: Faktura) => {
    setPreviewFaktura(null)
    setNyFritext('')
    setRedigeraFaktura(f)
  }

  // Efter en ändring: läs om listan och synka den öppna redigeringspanelen mot färska rader.
  const laddaOmOchSynka = async (fakturaId: string) => {
    const data: Faktura[] = await fetch('/api/fastigheter/fakturor').then(r => r.json()).catch(() => [])
    if (Array.isArray(data)) {
      setFakturor(data)
      const farsk = data.find(f => f.id === fakturaId)
      if (farsk) setRedigeraFaktura(farsk)
    }
  }

  const laggTillFritextPaFaktura = async () => {
    if (!redigeraFaktura || !nyFritext.trim()) return
    setFritextSparar(true)
    setMessage(null)
    const res = await fetch(`/api/fastigheter/fakturor/${redigeraFaktura.id}/rader`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ beskrivning: nyFritext.trim() }),
    })
    setFritextSparar(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setMessage({ text: 'Kunde inte lägga till raden: ' + (d.error || res.statusText), type: 'info' })
      return
    }
    setNyFritext('')
    await laddaOmOchSynka(redigeraFaktura.id)
    setMessage({ text: 'Fritextrad tillagd', type: 'success' })
  }

  const taBortFritextPaFaktura = async (radId: string) => {
    if (!redigeraFaktura) return
    const res = await fetch(`/api/fastigheter/fakturor/${redigeraFaktura.id}/rader?radId=${radId}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setMessage({ text: 'Kunde inte ta bort raden: ' + (d.error || res.statusText), type: 'info' })
      return
    }
    await laddaOmOchSynka(redigeraFaktura.id)
  }

  const generate = async () => {
    if (!selectedPeriod) return
    setGenerating(true)
    setMessage(null)
    const res = await fetch('/api/fastigheter/fakturor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: selectedPeriod, bolagId: valtBolagId ?? null, meddelande: omgangMsg.trim() || null }),
    })
    const data = await res.json()
    const skippedMsg = data.skippade?.length > 0 ? ` (${data.skippade.length} redan fakturerade hoppades över)` : ''
    setMessage({ text: (data.message || 'Klart') + skippedMsg, type: data.count > 0 ? 'success' : 'info' })
    setGenerating(false)
    setOmgangMsg('') // engångsmeddelandet gäller bara denna omgång
    // Scrolla listan till just det kvartal vi genererade + visa "Att skicka" (nya = ej skickade)
    setFilterPeriod(periodKvartal(selectedPeriod))
    setVy('attskicka')
    setSelected(new Set()) // rensa markeringar så inget hänger kvar efter generering
    load()
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/fastigheter/fakturor/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }

  // Markera betald + tydlig återkoppling (fakturan lämnar "Väntar betalning" och hamnar under Betalda).
  const markeraBetald = async (id: string) => {
    await updateStatus(id, 'betald')
    setMessage({ text: 'Faktura markerad som betald – finns nu under Betalda-fliken', type: 'success' })
  }

  // "Skicka" = skicka på riktigt. När Hogia-synken är live sker pushen till Hogia HÄR (bokför + distribuerar). Enda hooken för synk — även bulk går via denna.
  const skickaFaktura = async (id: string) => {
    await fetch(`/api/fastigheter/fakturor/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'skickad' }) })
    load()
  }

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const deleteFaktura = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort faktura?', danger: true, confirmLabel: 'Ta bort' }))) return
    const res = await fetch(`/api/fastigheter/fakturor/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setMessage({ text: 'Kunde inte ta bort fakturan: ' + (d.error || res.statusText), type: 'info' })
      return
    }
    load()
  }

  const krediteraFaktura = async (id: string) => {
    if (!(await confirm({ message: 'Kreditera fakturan? En kreditnota skapas och originalet markeras som krediterat.', danger: true, confirmLabel: 'Kreditera' }))) return
    await fetch(`/api/fastigheter/fakturor/${id}/kreditera`, { method: 'POST' })
    load()
  }

  // Antal skickade påminnelser (från händelseloggen).
  const paminnelseAntal = (f: Faktura) => (f.handelser ?? []).filter(h => h.typ === 'paminnelse').length
  // Betalningspåminnelse: logga + öppna utskriften (avgift + dröjsmålsränta beräknas i routen).
  const skickaPaminnelse = async (id: string) => {
    await fetch(`/api/fastigheter/fakturor/${id}/paminnelse`, { method: 'POST' })
    window.open(`/api/fastigheter/fakturor/${id}/paminnelse`, '_blank')
    setMessage({ text: 'Betalningspåminnelse skapad och loggad', type: 'success' })
    load()
  }
  const bulkPaminn = async () => {
    const mål = selectedFakturor.filter(isForfallen)
    if (mål.length === 0) return
    if (!(await confirm({ message: `Skapa betalningspåminnelse för ${mål.length} förfallna ${mål.length === 1 ? 'faktura' : 'fakturor'}?`, confirmLabel: 'Skapa påminnelser' }))) return
    for (const f of mål) await fetch(`/api/fastigheter/fakturor/${f.id}/paminnelse`, { method: 'POST' })
    setSelected(new Set())
    setMessage({ text: `${mål.length} påminnelser skapade och loggade (skriv ut från respektive faktura)`, type: 'success' })
    load()
  }

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const exportHogia = () => {
    const data = {
      exportdatum: new Date().toISOString(),
      period: filterPeriod,
      system: 'Wisboverket',
      fakturor: filtered.map(f => ({
        fakturanummer: f.fakturanummer,
        kundnummer: kundId(f).slice(0, 8).toUpperCase(),
        kundnamn: hyresgastNamn(f),
        forfallodag: f.forfallodag.split('T')[0],
        period: f.period,
        rader: f.rader.length > 0
          ? f.rader.map(r => ({
              artikelkod: r.artikelkod,
              beskrivning: r.beskrivning,
              antal: r.antal,
              apris: r.apris,
              belopp: r.belopp,
              moms: r.moms,
              konto: r.artikelkod === 'HYR' ? '3010' : '3011',
            }))
          : [{
              artikelkod: 'HYR',
              beskrivning: `Hyra – ${lokalText(f)} (${fastighetNamn(f)}) ${f.period}`,
              antal: 1, apris: f.belopp, belopp: f.belopp, moms: 0, konto: '3010',
            }],
        totalbelopp: f.belopp,
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `hogia-${filterPeriod || 'export'}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const filtered = fakturor.filter(f => {
    // Respektera bolagsväljaren uppe till höger (fastighetens bolag via lokal → fastighet)
    if (valtBolagId && bolagId(f) !== valtBolagId) return false
    if (search) {
      const q = search.toLowerCase()
      const match = f.fakturanummer.toLowerCase().includes(q)
        || hyresgastNamn(f).toLowerCase().includes(q)
        || (f.hyresavtal?.lokaler ?? []).some(l => l.lokal.namn.toLowerCase().includes(q) || l.lokal.fastighet.namn.toLowerCase().includes(q))
      if (!match) return false
    }
    if (filterPeriod && periodKvartal(f.period) !== filterPeriod) return false
    if (filterHyresgast && hyresgastNamn(f) !== filterHyresgast) return false
    // Vy = fakturans livscykel: att skicka (ej_skickad) → väntar betalning (skickad) → betalda (betald/krediterad)
    if (vy === 'attskicka' && f.status !== 'ej_skickad') return false
    if (vy === 'vantar' && f.status !== 'skickad') return false
    if (vy === 'betalda' && !(f.status === 'betald' || f.status === 'krediterad')) return false
    return true
  })

  const uniqueHyresgaster = [...new Set(fakturor.map(f => hyresgastNamn(f)))].sort()
  const uniqueKvartal = [...new Set(fakturor.map(f => periodKvartal(f.period)))].sort().reverse()

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortCol(col); setSortDir(1) }
  }

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = '', bv: string | number = ''
    switch (sortCol) {
      case 'fakturanr': av = a.fakturanummer; bv = b.fakturanummer; break
      case 'hyresgast': av = hyresgastNamn(a); bv = hyresgastNamn(b); break
      case 'lokal': av = a.hyresavtal?.lokaler[0]?.lokal.namn ?? ''; bv = b.hyresavtal?.lokaler[0]?.lokal.namn ?? ''; break
      case 'period': av = a.period; bv = b.period; break
      case 'belopp': av = a.belopp; bv = b.belopp; break
      case 'forfall': av = a.forfallodag; bv = b.forfallodag; break
      case 'status': av = a.status; bv = b.status; break
    }
    return av < bv ? -sortDir : av > bv ? sortDir : 0
  })

  // ---- Bulk-actions --------------------------------------------------------
  const allVisibleSelected = sorted.length > 0 && sorted.every(f => selected.has(f.id))
  const toggleSelectAll = () => {
    setSelected(prev => {
      if (sorted.every(f => prev.has(f.id))) {
        const next = new Set(prev)
        sorted.forEach(f => next.delete(f.id))
        return next
      }
      const next = new Set(prev)
      sorted.forEach(f => next.add(f.id))
      return next
    })
  }
  const selectedFakturor = filtered.filter(f => selected.has(f.id))
  const bulkSkickaAntal = selectedFakturor.filter(f => f.status === 'ej_skickad' && (f.typ === 'faktura' || f.typ === 'el')).length
  const bulkBetalaAntal = selectedFakturor.filter(f => f.status === 'skickad').length
  const bulkPaminnAntal = selectedFakturor.filter(isForfallen).length

  const bulkSkicka = async () => {
    const mål = selectedFakturor.filter(f => f.status === 'ej_skickad' && (f.typ === 'faktura' || f.typ === 'el'))
    if (mål.length === 0) return
    if (!(await confirm({ message: `Skicka ${mål.length} ${mål.length === 1 ? 'faktura' : 'fakturor'}?`, confirmLabel: 'Skicka' }))) return
    // Sekventiell await räcker — varje anrop går via skickaFaktura (enda synk-hooken).
    for (const f of mål) await skickaFaktura(f.id)
    setSelected(new Set())
    load()
  }

  const bulkBetalda = async () => {
    const mål = selectedFakturor.filter(f => f.status === 'skickad')
    if (mål.length === 0) return
    if (!(await confirm({ message: `Markera ${mål.length} ${mål.length === 1 ? 'faktura' : 'fakturor'} som betalda?`, confirmLabel: 'Markera betalda' }))) return
    const antal = mål.length
    for (const f of mål) await updateStatus(f.id, 'betald')
    setSelected(new Set())
    setMessage({ text: `${antal} ${antal === 1 ? 'faktura' : 'fakturor'} markerade som betalda – finns under Betalda`, type: 'success' })
    load()
  }

  const bulkTaBort = async () => {
    // Bara utkast (ej skickade) får tas bort — skickade fakturor krediteras istället.
    const mål = selectedFakturor.filter(f => f.status === 'ej_skickad')
    if (mål.length === 0) {
      setMessage({ text: 'Endast utkast (ej skickade) kan tas bort. Skickade fakturor krediteras istället.', type: 'error' })
      return
    }
    if (!(await confirm({ message: `Ta bort ${mål.length} ${mål.length === 1 ? 'utkast' : 'utkast'}?${mål.length < selectedFakturor.length ? ' (skickade fakturor i urvalet hoppas över)' : ''}`, danger: true, confirmLabel: 'Ta bort' }))) return
    for (const f of mål) await fetch(`/api/fastigheter/fakturor/${f.id}`, { method: 'DELETE' })
    setSelected(new Set())
    load()
  }

  const totalBelopp = filtered.reduce((s, f) => s + f.belopp, 0)
  const totalBeloppInkl = filtered.reduce((s, f) => s + beloppInkl(f), 0)
  const obetalda = filtered.filter(f => f.status !== 'betald').reduce((s, f) => s + f.belopp, 0)
  const obetaldaInkl = filtered.filter(f => f.status !== 'betald').reduce((s, f) => s + beloppInkl(f), 0)
  const forfallnaFakturor = filtered.filter(isForfallen)
  const forfallnaBelopp = forfallnaFakturor.reduce((s, f) => s + f.belopp, 0)

  // Tomt-läge-text som passar vald livscykel-flik.
  const tomText = vy === 'attskicka' ? 'Inga fakturor att skicka just nu. Generera fakturor ovan.'
    : vy === 'vantar' ? 'Inga fakturor väntar på betalning.'
    : vy === 'betalda' ? 'Inga betalda fakturor än.'
    : 'Inga fakturor för vald period. Generera fakturor ovan.'

  // Slå upp originalfakturans nummer för kreditnotor (om det finns bland laddade fakturor).
  const fakturorById = new Map(fakturor.map(f => [f.id, f]))

  const th: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: C.muted, textTransform: 'uppercase' }
  const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: C.text2 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(isMobile ? { overflowX: 'hidden' } : {}) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Fakturering</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>Generera och hantera hyresavier</p>
        </div>
      </div>

      {/* Generate section */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 20 }}>
        <h3 style={{ fontWeight: 700, color: C.text, margin: 0, marginBottom: 4 }}>Generera fakturor</h3>
        <p style={{ fontSize: 12, color: C.muted2, marginBottom: 16 }}>Kvartalsavtal: välj kvartalets startmånad (Jan/Apr/Jul/Okt) – systemet skapar automatiskt tre fakturor med rätt förfallodatum.</p>
        <p style={{ fontSize: 12, color: valtBolagNamn ? C.gold : C.muted2, marginBottom: 16 }}>
          {valtBolagNamn ? `Genererar endast för: ${valtBolagNamn} (styrs av bolagsväljaren uppe till höger)` : 'Genererar för alla bolag – välj ett bolag uppe till höger för att begränsa.'}
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
          <div>
            <label style={lbl}>Månadsfaktura</label>
            <select value={selectedPeriod} onChange={e => { setSelectedPeriod(e.target.value); setFilterPeriod(periodKvartal(e.target.value)) }} onFocus={fo} onBlur={fb} style={isMobile ? { ...selStyle, width: '100%' } : selStyle}>
              {monthlyPeriods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ color: C.muted2, fontSize: 13, paddingBottom: 10, ...(isMobile ? { paddingBottom: 0, textAlign: 'center' } : {}) }}>eller</div>
          <div>
            <label style={lbl}>Kvartalsfaktura</label>
            <select value={kvartalOpts.some(k => k.period === selectedPeriod) ? selectedPeriod : ''} onChange={e => { if (e.target.value) { setSelectedPeriod(e.target.value); setFilterPeriod(periodKvartal(e.target.value)) } }} onFocus={fo} onBlur={fb} style={isMobile ? { ...selStyle, width: '100%' } : selStyle}>
              <option value="">Välj kvartal...</option>
              {kvartalOpts.map(k => <option key={k.period} value={k.period}>{k.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, ...(isMobile ? { flexDirection: 'column', width: '100%' } : {}) }}>
            <button onClick={generate} disabled={generating} style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 8, opacity: generating ? 0.5 : 1, ...(isMobile ? { justifyContent: 'center' } : {}) }}>
              <span style={{ display: 'inline-block', animation: generating ? 'spin 1s linear infinite' : undefined }}>🔄</span>
              {generating ? 'Genererar...' : `Generera för ${selectedPeriod}`}
            </button>
            {filtered.length > 0 && (
              <button onClick={exportHogia} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 8, ...(isMobile ? { justifyContent: 'center' } : {}) }}>
                ⬇️ Exportera Hogia JSON
              </button>
            )}
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={lbl}>✉️ Meddelande på denna omgång</label>
          <input
            type="text"
            value={omgangMsg}
            onChange={e => setOmgangMsg(e.target.value)}
            onFocus={fo} onBlur={fb}
            placeholder="T.ex. God Jul & Gott Nytt År – eller OBS! Nytt bankgiro 123-4567"
            style={{ ...inp, maxWidth: isMobile ? '100%' : 540 }}
          />
          <p style={{ fontSize: 11, color: C.muted2, marginTop: 4 }}>Valfritt — visas överst på fakturorna du genererar nu. Sparas inte, gäller bara denna omgång.</p>
        </div>
        {preview && (
          <p style={{ marginTop: 12, fontSize: 12, color: C.muted2 }}>
            {preview.antalNya === 0
              ? 'Inga nya fakturor att skapa (alla redan fakturerade för perioden)'
              : `För ${selectedPeriod}: skapar ${preview.antalNya} ${preview.antalNya === 1 ? 'faktura' : 'fakturor'} (${preview.manadsavtal} månadsavtal, ${preview.kvartalsavtal} kvartalsavtal)${preview.skippade > 0 ? `, ${preview.skippade} redan fakturerade hoppas över` : ''}`}
          </p>
        )}
        {message && (
          <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: message.type === 'success' ? C.ok : C.blue }}>
            {message.text}
          </p>
        )}
        {/* Manuell faktura — tydligt separerad från kvartals-genereringen */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
          <p style={{ fontSize: 12, color: C.muted2, margin: 0 }}>Skapa en enskild faktura manuellt (t.ex. engångskostnad eller kund utan hyresavtal).</p>
          <button onClick={oppnaManuell} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 8, ...(isMobile ? { justifyContent: 'center' } : {}) }}>
            ＋ Ny faktura (manuell)
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: 0 }}>{filtered.length}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Fakturor</p>
        </div>
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: 0 }}>{formatSEK(totalBelopp)}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Totalt exkl. moms</p>
          <p style={{ fontSize: 12, color: C.muted2, margin: '2px 0 0' }}>{formatSEK(totalBeloppInkl)} ink. moms</p>
        </div>
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: obetalda > 0 ? C.danger : C.ok, margin: 0 }}>{formatSEK(obetalda)}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Obetalt exkl. moms</p>
          <p style={{ fontSize: 12, color: C.muted2, margin: '2px 0 0' }}>{formatSEK(obetaldaInkl)} ink. moms</p>
        </div>
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: forfallnaFakturor.length > 0 ? C.danger : C.ok, margin: 0 }}>{forfallnaFakturor.length}</p>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Förfallna{forfallnaFakturor.length > 0 ? ` · ${formatSEK(forfallnaBelopp)}` : ''}</p>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
        <Sokfalt value={search} onChange={v => { setSearch(v); setSelected(new Set()) }} placeholder="Sök fakturanr, hyresgäst, lokal..." style={{ width: isMobile ? '100%' : 260 }} />
        {/* Vy-uppdelning efter fakturans livscykel */}
        <div style={{ display: 'inline-flex', borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', ...(isMobile ? { width: '100%' } : {}) }}>
          {([
            { key: 'attskicka', label: 'Att skicka' },
            { key: 'vantar', label: 'Väntar betalning' },
            { key: 'betalda', label: 'Betalda' },
            { key: 'alla', label: 'Alla' },
          ] as const).map((v, i) => {
            const active = vy === v.key
            return (
              <button
                key={v.key}
                onClick={() => { setVy(v.key); setSelected(new Set()) }}
                style={{
                  flex: isMobile ? 1 : undefined,
                  padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  border: 'none', borderLeft: i > 0 ? `1px solid ${C.border}` : 'none',
                  background: active ? C.gold : 'transparent',
                  color: active ? '#000' : C.muted,
                }}
              >
                {v.label}
              </button>
            )
          })}
        </div>
        <select value={filterPeriod} onChange={e => { setFilterPeriod(e.target.value); setSelected(new Set()) }} onFocus={fo} onBlur={fb} style={isMobile ? { ...selStyle, width: '100%' } : selStyle}>
          <option value="">Alla kvartal</option>
          {uniqueKvartal.map(k => <option key={k} value={k}>{kvartalKeyLabel(k)}</option>)}
        </select>
        <select value={filterHyresgast} onChange={e => { setFilterHyresgast(e.target.value); setSelected(new Set()) }} onFocus={fo} onBlur={fb} style={isMobile ? { ...selStyle, width: '100%' } : selStyle}>
          <option value="">Alla hyresgäster</option>
          {uniqueHyresgaster.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>

      {/* Sticky bulk-rad (visas när något är valt) */}
      {selected.size > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel, padding: '10px 14px', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text, ...(isMobile ? { textAlign: 'center' } : {}) }}>{selected.size} valda</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', ...(isMobile ? { flexDirection: 'column' } : { marginLeft: 'auto' }) }}>
            <button onClick={bulkSkicka} disabled={bulkSkickaAntal === 0} style={{ ...btnPrimary, opacity: bulkSkickaAntal === 0 ? 0.4 : 1, cursor: bulkSkickaAntal === 0 ? 'not-allowed' : 'pointer', ...(isMobile ? { textAlign: 'center' } : {}) }}>Skicka valda{bulkSkickaAntal > 0 ? ` (${bulkSkickaAntal})` : ''}</button>
            <button onClick={bulkBetalda} disabled={bulkBetalaAntal === 0} style={{ ...btnGhost, color: C.ok, borderColor: 'rgba(74,222,128,0.4)', opacity: bulkBetalaAntal === 0 ? 0.4 : 1, cursor: bulkBetalaAntal === 0 ? 'not-allowed' : 'pointer', ...(isMobile ? { textAlign: 'center' } : {}) }}>Markera betalda{bulkBetalaAntal > 0 ? ` (${bulkBetalaAntal})` : ''}</button>
            <button onClick={bulkPaminn} disabled={bulkPaminnAntal === 0} style={{ ...btnGhost, color: '#fb923c', borderColor: 'rgba(251,146,60,0.4)', opacity: bulkPaminnAntal === 0 ? 0.4 : 1, cursor: bulkPaminnAntal === 0 ? 'not-allowed' : 'pointer', ...(isMobile ? { textAlign: 'center' } : {}) }}>🔔 Påminn valda{bulkPaminnAntal > 0 ? ` (${bulkPaminnAntal})` : ''}</button>
            <button onClick={bulkTaBort} style={{ ...btnGhost, color: C.danger, borderColor: 'rgba(248,113,113,0.4)', ...(isMobile ? { textAlign: 'center' } : {}) }}>Ta bort valda ({selectedFakturor.length})</button>
            <button onClick={() => setSelected(new Set())} style={{ ...btnGhost, ...(isMobile ? { textAlign: 'center' } : {}) }}>Avmarkera</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : isMobile ? (
        sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>
            {tomText}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((f) => {
              const sc = statusConfig[f.status] || statusConfig.ej_skickad
              const expanded = expandedRows.has(f.id)
              const hasRader = f.rader && f.rader.length > 0
              const forfallen = isForfallen(f)
              const isKreditnota = f.typ === 'kreditnota'
              const isKrediterad = f.status === 'krediterad'
              const original = f.original_faktura_id ? fakturorById.get(f.original_faktura_id) : null
              const canKreditera = f.typ === 'faktura' && (f.status === 'skickad' || f.status === 'betald')
              return (
                <div
                  key={f.id}
                  onClick={() => setPreviewFaktura(f)}
                  style={{ border: `1px solid ${C.borderSoft}`, borderRadius: 10, background: C.panel, padding: 12, marginBottom: 0, cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={selected.has(f.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); toggleSelected(f.id) }}
                        style={{ width: 16, height: 16, accentColor: C.gold, cursor: 'pointer' }}
                      />
                      <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{hyresgastNamn(f)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {forfallen && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(248,113,113,0.12)', color: C.danger, whiteSpace: 'nowrap' }}>Förfallen</span>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', color: C.muted, fontSize: 12, marginTop: 2 }}>
                    {f.fakturanummer}
                    {isKreditnota && <span style={{ marginLeft: 6, fontFamily: 'inherit', color: C.danger, fontWeight: 600 }}>Kreditnota</span>}
                    {f.typ === 'el' && <span style={{ marginLeft: 6, fontFamily: 'inherit', color: C.gold, fontWeight: 600 }}>El-faktura</span>}
                  </div>
                  {isKreditnota && original && (
                    <div style={{ color: C.muted2, fontSize: 11, marginTop: 2 }}>Avser {original.fakturanummer}</div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4, marginTop: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: C.muted }}>Lokal</span>
                      <span style={{ color: C.text2, textAlign: 'right' }}>
                        {lokalText(f)}
                        <span style={{ color: C.muted2, display: 'block', fontSize: 11 }}>{fastighetNamn(f)}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: C.muted }}>Period</span>
                      <span style={{ color: C.text2 }}>
                        {f.period}
                        {f.hyresavtal?.faktureringsfrekvens === 'kvartalsvis' && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', borderRadius: 4, padding: '1px 5px' }}>Kvartal</span>
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: C.muted }}>Belopp</span>
                      <span style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: isKreditnota ? C.danger : C.text, textDecoration: isKrediterad ? 'line-through' : undefined }}>{formatSEK(f.belopp)}</span>
                        {beloppInkl(f) !== f.belopp && <span style={{ display: 'block', fontSize: 11, color: C.muted2 }}>{formatSEK(beloppInkl(f))} ink. moms</span>}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: C.muted }}>Förfallodatum</span>
                      <span style={{ color: forfallen ? C.danger : C.text2, fontWeight: forfallen ? 600 : undefined }}>{formatDate(f.forfallodag)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                    {hasRader && (
                      <button onClick={(e) => { e.stopPropagation(); toggleRow(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: C.field, color: C.muted2, border: 'none', cursor: 'pointer' }}>
                        {expanded ? '▾ Dölj rader' : '▸ Visa rader'}
                      </button>
                    )}
                    {f.status === 'ej_skickad' && (
                      <button onClick={(e) => { e.stopPropagation(); skickaFaktura(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(96,165,250,0.12)', color: C.blue, border: 'none', cursor: 'pointer' }}>Skicka</button>
                    )}
                    {f.status === 'skickad' && (
                      <button onClick={(e) => { e.stopPropagation(); markeraBetald(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(74,222,128,0.12)', color: C.ok, border: 'none', cursor: 'pointer' }}>Markera betald</button>
                    )}
                    {isForfallen(f) && (
                      <button onClick={(e) => { e.stopPropagation(); skickaPaminnelse(f.id) }} title="Skapa betalningspåminnelse" style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(251,146,60,0.14)', color: '#fb923c', border: 'none', cursor: 'pointer' }}>🔔 Påminn{paminnelseAntal(f) > 0 ? ` (${paminnelseAntal(f)})` : ''}</button>
                    )}
                    {canKreditera && (
                      <button onClick={(e) => { e.stopPropagation(); krediteraFaktura(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: C.field, color: C.muted2, border: `1px solid ${C.border}`, cursor: 'pointer' }}>Kreditera</button>
                    )}
                    {f.status === 'ej_skickad' && (
                      <button onClick={(e) => { e.stopPropagation(); deleteFaktura(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(248,113,113,0.1)', color: C.danger, border: 'none', cursor: 'pointer' }}>Ta bort</button>
                    )}
                  </div>

                  {expanded && hasRader && (
                    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default' }}>
                      {f.rader.map(r => (
                        <div key={r.id} style={{ borderRadius: 8, background: C.panel2, padding: 10, fontSize: 12 }}>
                          {r.artikelkod === 'TEXT' ? (
                            <div style={{ color: C.muted, fontStyle: 'italic' }}>{r.beskrivning}</div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontFamily: 'monospace', color: C.muted }}>{r.artikelkod}</span>
                                <span style={{ fontWeight: 600, color: C.text }}>{formatSEK(r.belopp)}</span>
                              </div>
                              <div style={{ color: C.text2, marginTop: 2 }}>{r.beskrivning}</div>
                              <div style={{ display: 'flex', gap: 12, marginTop: 4, color: C.muted2 }}>
                                <span>{r.antal} × {formatApris(r.apris)}</span>
                                <span>Moms {r.moms}%</span>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2 }}>
                  <th style={{ ...th, width: 32, padding: '12px 8px' }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ ...th, width: 32, padding: '12px 8px' }}></th>
                  {([
                    { key: 'fakturanr', label: 'Fakturanr' },
                    { key: 'hyresgast', label: 'Hyresgäst' },
                    { key: 'lokal', label: 'Lokal' },
                    { key: 'period', label: 'Period' },
                    { key: 'belopp', label: 'Belopp exkl.' },
                    { key: 'forfall', label: 'Förfallodatum' },
                    { key: 'status', label: 'Status' },
                    { key: '', label: 'Åtgärd' },
                  ] as const).map(h => (
                    <th key={h.label} onClick={() => h.key && toggleSort(h.key)} style={{ ...th, cursor: h.key ? 'pointer' : 'default', userSelect: 'none' }}>
                      {h.label}{sortCol === h.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>
                    {tomText}
                  </td></tr>
                ) : sorted.map((f) => {
                  const sc = statusConfig[f.status] || statusConfig.ej_skickad
                  const expanded = expandedRows.has(f.id)
                  const hasRader = f.rader && f.rader.length > 0
                  const forfallen = isForfallen(f)
                  const isKreditnota = f.typ === 'kreditnota'
                  const isKrediterad = f.status === 'krediterad'
                  const original = f.original_faktura_id ? fakturorById.get(f.original_faktura_id) : null
                  const canKreditera = f.typ === 'faktura' && (f.status === 'skickad' || f.status === 'betald')
                  return (
                    <React.Fragment key={f.id}>
                      <tr
                        style={{ borderTop: `1px solid ${C.borderSoft}`, cursor: 'pointer' }}
                        onClick={() => setPreviewFaktura(f)}
                        onMouseEnter={e => (e.currentTarget.style.background = C.panel2)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ ...td, padding: '12px 8px' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(f.id)}
                            onChange={(e) => { e.stopPropagation(); toggleSelected(f.id) }}
                            style={{ width: 15, height: 15, accentColor: C.gold, cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ ...td, padding: '12px 8px' }}>
                          {hasRader && (
                            <button onClick={(e) => { e.stopPropagation(); toggleRow(f.id) }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 12 }}>
                              {expanded ? '▾' : '▸'}
                            </button>
                          )}
                        </td>
                        <td style={{ ...td, fontFamily: 'monospace', color: C.text }}>
                          <div>{f.fakturanummer}</div>
                          {isKreditnota && (
                            <span style={{ fontFamily: 'sans-serif', fontSize: 10, color: C.danger, fontWeight: 600 }}>
                              Kreditnota{original ? ` · avser ${original.fakturanummer}` : ''}
                            </span>
                          )}
                        </td>
                        <td style={{ ...td, fontWeight: 600, color: C.text }}>{hyresgastNamn(f)}</td>
                        <td style={td}>
                          <div>{lokalText(f)}</div>
                          <div style={{ fontSize: 11, color: C.muted2 }}>{fastighetNamn(f)}</div>
                        </td>
                        <td style={td}>
                          <div>{f.period}</div>
                          {f.hyresavtal?.faktureringsfrekvens === 'kvartalsvis' && (
                            <span style={{ fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.12)', borderRadius: 4, padding: '1px 5px' }}>Kvartal</span>
                          )}
                        </td>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: isKreditnota ? C.danger : C.text, textDecoration: isKrediterad ? 'line-through' : undefined }}>{formatSEK(f.belopp)}</div>
                          {beloppInkl(f) !== f.belopp && <div style={{ fontSize: 11, color: C.muted2 }}>{formatSEK(beloppInkl(f))} ink. moms</div>}
                        </td>
                        <td style={{ ...td, color: forfallen ? C.danger : C.text2, fontWeight: forfallen ? 600 : undefined }}>
                          {formatDate(f.forfallodag)}
                          {forfallen && (
                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: C.danger, background: 'rgba(248,113,113,0.12)', borderRadius: 4, padding: '1px 5px' }}>Förfallen</span>
                          )}
                        </td>
                        <td style={td}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                            {sc.icon} {sc.label}
                          </span>
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {f.status === 'ej_skickad' && (
                              <button onClick={(e) => { e.stopPropagation(); skickaFaktura(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(96,165,250,0.12)', color: C.blue, border: 'none', cursor: 'pointer' }}>Skicka</button>
                            )}
                            {f.status === 'skickad' && (
                              <button onClick={(e) => { e.stopPropagation(); markeraBetald(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(74,222,128,0.12)', color: C.ok, border: 'none', cursor: 'pointer' }}>Markera betald</button>
                            )}
                            {isForfallen(f) && (
                              <button onClick={(e) => { e.stopPropagation(); skickaPaminnelse(f.id) }} title="Skapa betalningspåminnelse" style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(251,146,60,0.14)', color: '#fb923c', border: 'none', cursor: 'pointer' }}>🔔 Påminn{paminnelseAntal(f) > 0 ? ` (${paminnelseAntal(f)})` : ''}</button>
                            )}
                            {canKreditera && (
                              <button onClick={(e) => { e.stopPropagation(); krediteraFaktura(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: C.field, color: C.muted2, border: `1px solid ${C.border}`, cursor: 'pointer' }}>Kreditera</button>
                            )}
                            {f.status === 'ej_skickad' && (
                      <button onClick={(e) => { e.stopPropagation(); deleteFaktura(f.id) }} style={{ borderRadius: 6, padding: '4px 8px', fontSize: 11, background: 'rgba(248,113,113,0.1)', color: C.danger, border: 'none', cursor: 'pointer' }}>Ta bort</button>
                    )}
                          </div>
                        </td>
                      </tr>
                      {expanded && hasRader && (
                        <tr style={{ background: C.panel2 }}>
                          <td colSpan={10} style={{ padding: '12px 32px' }}>
                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ color: C.muted2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Artikel</th>
                                  <th style={{ textAlign: 'left', paddingBottom: 4, fontWeight: 600 }}>Beskrivning</th>
                                  <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 600 }}>Antal</th>
                                  <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 600 }}>À-pris</th>
                                  <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 600 }}>Belopp</th>
                                  <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 600 }}>Moms</th>
                                </tr>
                              </thead>
                              <tbody>
                                {f.rader.map(r => (
                                  r.artikelkod === 'TEXT' ? (
                                    <tr key={r.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                                      <td colSpan={6} style={{ padding: '4px 0', color: C.muted, fontStyle: 'italic' }}>{r.beskrivning}</td>
                                    </tr>
                                  ) : (
                                  <tr key={r.id} style={{ borderTop: `1px solid ${C.borderSoft}` }}>
                                    <td style={{ padding: '4px 0', fontFamily: 'monospace', color: C.muted }}>{r.artikelkod}</td>
                                    <td style={{ padding: '4px 0', color: C.text2 }}>{r.beskrivning}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', color: C.muted }}>{r.antal}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', color: C.muted }}>{formatApris(r.apris)}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 600, color: C.text }}>{formatSEK(r.belopp)}</td>
                                    <td style={{ padding: '4px 0', textAlign: 'right', color: C.muted2 }}>{r.moms}%</td>
                                  </tr>
                                  )
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ny manuell faktura */}
      <SlideOver
        open={manuellOpen}
        onClose={() => setManuellOpen(false)}
        title="Ny manuell faktura"
        width="lg"
        footer={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: C.muted }}>
              Att betala <span style={{ fontWeight: 700, color: C.gold }}>{formatSEK(mTotalInkl)}</span>
            </div>
            <button
              onClick={skapaManuell}
              disabled={!manuellGiltig || manuellSparar}
              style={{ ...btnPrimary, marginLeft: 'auto', opacity: (!manuellGiltig || manuellSparar) ? 0.4 : 1, cursor: (!manuellGiltig || manuellSparar) ? 'not-allowed' : 'pointer' }}
            >
              {manuellSparar ? 'Skapar...' : 'Skapa faktura'}
            </button>
          </div>
        )}
      >
        <div style={{ padding: isMobile ? '20px 16px' : '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={lbl}>Hyresgäst</label>
            <select value={mHyresgastId} onChange={e => setMHyresgastId(e.target.value)} onFocus={fo} onBlur={fb} style={inp}>
              <option value="">Välj hyresgäst...</option>
              {hyresgaster.map(h => <option key={h.id} value={h.id}>{h.namn}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>Avsändarbolag</label>
            <select value={mBolagId} onChange={e => setMBolagId(e.target.value)} onFocus={fo} onBlur={fb} style={inp}>
              <option value="">Automatiskt (från hyresavtal)</option>
              {bolagLista.map(b => <option key={b.id} value={b.id}>{b.namn}</option>)}
            </select>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Lämna på &quot;Automatiskt&quot; så härleds bolaget från hyresgästens avtal. Välj manuellt om kunden saknar avtal eller har avtal i flera bolag.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Fakturadatum</label>
              <input type="date" value={mFakturadatum} onChange={e => setMFakturadatum(e.target.value)} onFocus={fo} onBlur={fb} style={inp} />
            </div>
            <div>
              <label style={lbl}>Förfallodatum</label>
              <input type="date" value={mForfallodatum} onChange={e => setMForfallodatum(e.target.value)} onFocus={fo} onBlur={fb} style={inp} />
            </div>
          </div>

          <div>
            <label style={lbl}>Rader</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mRader.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.panel2, padding: 10 }}>
                  {r.fritext ? (
                    <div style={{ flex: '1 1 100%', minWidth: 120 }}>
                      <label style={{ ...lbl, marginBottom: 4 }}>Fritext (visas på fakturan, ingen kostnad)</label>
                      <input type="text" value={r.beskrivning} onChange={e => setRad(i, { beskrivning: e.target.value })} onFocus={fo} onBlur={fb} style={inp} placeholder="T.ex. Avser reparation efter vattenskada mars 2026" />
                    </div>
                  ) : (
                    <>
                      {artiklar.length > 0 && (
                        <div style={{ flex: '1 1 130px', minWidth: 110 }}>
                          <label style={{ ...lbl, marginBottom: 4 }}>Artikel</label>
                          {/* Autofyller beskrivning/á-pris/moms — fälten går att redigera efteråt. */}
                          <select value="" onChange={e => { if (e.target.value) valjArtikel(i, e.target.value) }} onFocus={fo} onBlur={fb} style={inp}>
                            <option value="">Välj artikel...</option>
                            {artiklar.map(a => <option key={a.id} value={a.id}>{a.kod} – {a.benamning}</option>)}
                          </select>
                        </div>
                      )}
                      <div style={{ flex: '2 1 160px', minWidth: 120 }}>
                        <label style={{ ...lbl, marginBottom: 4 }}>Beskrivning</label>
                        <input type="text" value={r.beskrivning} onChange={e => setRad(i, { beskrivning: e.target.value })} onFocus={fo} onBlur={fb} style={inp} placeholder="Beskrivning" />
                      </div>
                      <div style={{ flex: '0 1 70px', minWidth: 60 }}>
                        <label style={{ ...lbl, marginBottom: 4 }}>Antal</label>
                        <input type="number" value={r.antal} onChange={e => setRad(i, { antal: e.target.valueAsNumber || 0 })} onFocus={fo} onBlur={fb} style={inp} />
                      </div>
                      <div style={{ flex: '0 1 100px', minWidth: 80 }}>
                        <label style={{ ...lbl, marginBottom: 4 }}>À-pris</label>
                        <input type="number" value={r.apris === 0 ? '' : r.apris} placeholder="0" onChange={e => setRad(i, { apris: e.target.valueAsNumber || 0 })} onFocus={fo} onBlur={fb} style={inp} />
                      </div>
                      <div style={{ flex: '0 1 80px', minWidth: 64 }}>
                        <label style={{ ...lbl, marginBottom: 4 }}>Moms %</label>
                        <input type="number" value={r.moms} onChange={e => setRad(i, { moms: e.target.valueAsNumber || 0 })} onFocus={fo} onBlur={fb} style={inp} />
                      </div>
                    </>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => flyttaRad(i, -1)} disabled={i === 0} title="Flytta upp"
                      style={{ borderRadius: 5, padding: '2px 8px', fontSize: 11, background: C.field, color: C.muted, border: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.35 : 1, lineHeight: 1.2 }}>▲</button>
                    <button onClick={() => flyttaRad(i, 1)} disabled={i === mRader.length - 1} title="Flytta ner"
                      style={{ borderRadius: 5, padding: '2px 8px', fontSize: 11, background: C.field, color: C.muted, border: 'none', cursor: i === mRader.length - 1 ? 'not-allowed' : 'pointer', opacity: i === mRader.length - 1 ? 0.35 : 1, lineHeight: 1.2 }}>▼</button>
                  </div>
                  <button
                    onClick={() => taBortRad(i)}
                    disabled={mRader.length <= 1}
                    title="Ta bort rad"
                    style={{ borderRadius: 6, padding: '8px 10px', fontSize: 13, background: 'rgba(248,113,113,0.1)', color: C.danger, border: 'none', cursor: mRader.length <= 1 ? 'not-allowed' : 'pointer', opacity: mRader.length <= 1 ? 0.4 : 1 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button onClick={laggTillRad} style={btnGhost}>＋ Lägg till rad</button>
              <button onClick={laggTillFritext} style={btnGhost}>＋ Fritextrad</button>
            </div>
          </div>

          {/* Summering */}
          <div style={{ borderTop: `2px solid ${C.borderStrong}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: C.muted }}>Summa exkl. moms</span>
              <span style={{ fontWeight: 600, color: C.text2 }}>{formatSEK(mSummaExkl)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: C.muted }}>Moms</span>
              <span style={{ fontWeight: 600, color: C.text2 }}>{formatSEK(mMoms)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8, color: C.text }}>
              <span>Att betala</span>
              <span style={{ color: C.gold }}>{formatSEK(mTotalInkl)}</span>
            </div>
          </div>
        </div>
      </SlideOver>

      {/* Förhandsgranskning — fakturavy */}
      <SlideOver
        open={!!previewFaktura}
        onClose={() => setPreviewFaktura(null)}
        title={previewFaktura ? `Faktura ${previewFaktura.fakturanummer}` : 'Faktura'}
        width="lg"
        footer={previewFaktura ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`/api/fastigheter/fakturor/${previewFaktura.id}/print`} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} title="Öppnar den färdiga fakturan (kontrollera + skriv ut / spara PDF)">👁 Visa faktura (PDF)</a>
            <button onClick={() => oppnaRedigera(previewFaktura)} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center' }}>Redigera</button>
            {previewFaktura.status === 'ej_skickad' && <button onClick={() => { skickaFaktura(previewFaktura.id); setPreviewFaktura(null) }} style={{ ...btnPrimary, flex: 1 }}>Skicka</button>}
            {previewFaktura.status === 'skickad' && <button onClick={() => { markeraBetald(previewFaktura.id); setPreviewFaktura(null) }} style={{ ...btnPrimary, flex: 1, background: C.ok }}>Markera betald</button>}
            {isForfallen(previewFaktura) && <button onClick={() => skickaPaminnelse(previewFaktura.id)} style={{ ...btnGhost, color: '#fb923c', borderColor: 'rgba(251,146,60,0.4)' }}>🔔 Påminn{paminnelseAntal(previewFaktura) > 0 ? ` (${paminnelseAntal(previewFaktura)})` : ''}</button>}
            {previewFaktura.typ === 'faktura' && (previewFaktura.status === 'skickad' || previewFaktura.status === 'betald') && (
              <button onClick={() => { krediteraFaktura(previewFaktura.id); setPreviewFaktura(null) }} style={btnGhost}>Kreditera</button>
            )}
            {previewFaktura.status === 'ej_skickad' && <button onClick={() => { deleteFaktura(previewFaktura.id); setPreviewFaktura(null) }} style={btnDanger}>Ta bort</button>}
          </div>
        ) : undefined}
      >
        {previewFaktura && (() => {
          const f = previewFaktura
          const hgNamn = hyresgastNamn(f)
          const hgPnr = hyresgastPnr(f)
          const fastNamn = fastighetNamn(f)
          const avsBolag = bolagLista.find(b => b.id === bolagId(f)) // avsändarbolag (härlett/valt)
          const isKreditnota = f.typ === 'kreditnota'
          const original = f.original_faktura_id ? fakturorById.get(f.original_faktura_id) : null
          const subtotal = f.rader.reduce((s, r) => s + r.belopp, 0)
          const momsBelopp = f.rader.reduce((s, r) => s + r.belopp * (r.moms / 100), 0)
          const totalInkl = subtotal + momsBelopp
          const r2 = (n: number) => Math.round(n * 100) / 100

          return (
            <div>
              {/* Fakturahuvud */}
              <div style={{ padding: isMobile ? '20px 16px' : '24px 32px', borderBottom: `1px solid ${C.borderSoft}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, color: isKreditnota ? C.danger : C.text, margin: 0, letterSpacing: 1 }}>{isKreditnota ? 'KREDITNOTA' : 'FAKTURA'}</h2>
                    <p style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{f.fakturanummer}</p>
                    {isKreditnota && original && <p style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>Avser {original.fakturanummer}</p>}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 2px' }}>Avsändare</p>
                    <p style={{ fontWeight: 700, color: C.gold, margin: 0 }}>{avsBolag?.namn || fastNamn || '—'}</p>
                    {avsBolag?.bankgiro && <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>BG {avsBolag.bankgiro}</p>}
                    {fastNamn && avsBolag && <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>{fastNamn}</p>}
                  </div>
                </div>
              </div>

              <div style={{ padding: isMobile ? '20px 16px' : '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* Mottagare + fakturadata */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 20 : 32 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Faktureras</p>
                    <p style={{ fontWeight: 600, color: C.text, margin: 0 }}>{hgNamn}</p>
                    {hgPnr && <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{hgPnr}</p>}
                  </div>
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Fakturadatum</span><span style={{ color: C.text2 }}>{new Date().toLocaleDateString('sv-SE')}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Förfallodatum</span><span style={{ fontWeight: 600, color: C.text }}>{formatDate(f.forfallodag)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Period</span><span style={{ color: C.text2 }}>{f.period}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Lokal</span><span style={{ color: C.text2 }}>{lokalText(f)}</span></div>
                  </div>
                </div>

                {/* Fakturameddelande (per bolag – visas på alla det bolagets fakturor) */}
                {avsBolag?.faktura_prefix_text && (
                  <div style={{ padding: '12px 16px', background: 'rgba(232,201,106,0.08)', borderLeft: `3px solid ${C.gold}`, borderRadius: 4, fontSize: 13, color: C.text2, whiteSpace: 'pre-wrap' }}>
                    {avsBolag.faktura_prefix_text}
                  </div>
                )}

                {/* Fakturarader */}
                <div style={isMobile ? { overflowX: 'auto' } : undefined}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', ...(isMobile ? { minWidth: 420 } : {}) }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.borderStrong}` }}>
                      <th style={{ textAlign: 'left', padding: '12px 0', fontWeight: 700, color: C.text2 }}>Beskrivning</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: C.text2, width: 64 }}>Antal</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: C.text2, width: 96 }}>À-pris</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: C.text2, width: 40 }}>Moms</th>
                      <th style={{ textAlign: 'right', padding: '12px 0', fontWeight: 700, color: C.text2, width: 112 }}>Belopp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.rader.filter(r => r.artikelkod !== 'ORE' || r.belopp !== 0).map(r => (
                      r.artikelkod === 'TEXT' ? (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                          <td colSpan={5} style={{ padding: '10px 0', color: C.muted, fontStyle: 'italic' }}>{r.beskrivning}</td>
                        </tr>
                      ) : (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                        <td style={{ padding: '10px 0', color: C.text }}>{r.beskrivning}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: C.muted }}>{r.antal}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: C.muted }}>{formatApris(r.apris)}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', color: C.muted2, fontSize: 12 }}>{r.moms > 0 ? `${r.moms}%` : '—'}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: C.text }}>{formatSEK(r.belopp)}</td>
                      </tr>
                      )
                    ))}
                  </tbody>
                </table>
                </div>

                {/* Summering */}
                <div style={{ borderTop: `2px solid ${C.borderStrong}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.muted }}>Summa exkl. moms</span>
                    <span style={{ fontWeight: 600, color: C.text2 }}>{formatSEK(r2(subtotal))}</span>
                  </div>
                  {momsBelopp > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: C.muted }}>Moms 25%</span>
                      <span style={{ fontWeight: 600, color: C.text2 }}>{formatSEK(r2(momsBelopp))}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8, color: C.text }}>
                    <span>Att betala</span>
                    <span style={{ color: C.gold }}>{formatSEK(r2(totalInkl))}</span>
                  </div>
                </div>

                {/* Betalningsinfo */}
                <div style={{ borderRadius: 8, background: C.field, border: `1px solid ${C.border}`, padding: '12px 16px', fontSize: 13 }}>
                  <p style={{ fontWeight: 600, color: C.text2, marginBottom: 4 }}>Betalningsinformation</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2px 16px', color: C.muted }}>
                    <span>Förfallodatum:</span><span style={{ fontWeight: 600, color: C.text2 }}>{formatDate(f.forfallodag)}</span>
                    <span>Fakturanummer:</span><span style={{ fontFamily: 'monospace', color: C.text2 }}>{f.fakturanummer}</span>
                  </div>
                </div>

                {/* Tidslinje / Historik */}
                {(() => {
                  const items = [
                    { key: 'skapad', typ: 'skapad', meddelande: null as string | null, created_at: f.created_at },
                    ...[...(f.handelser ?? [])]
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map(h => ({ key: h.id, typ: h.typ, meddelande: h.meddelande, created_at: h.created_at })),
                  ]
                  return (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: C.muted2, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12 }}>Historik</p>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {items.map((it, i) => {
                          const cfg = handelseConfig[it.typ] || { icon: '•', label: it.typ }
                          const isLast = i === items.length - 1
                          return (
                            <div key={it.key} style={{ display: 'flex', gap: 12 }}>
                              {/* Prick + vertikal linje */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 24, height: 24, borderRadius: 999, background: C.field, border: `1px solid ${C.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
                                  {cfg.icon}
                                </div>
                                {!isLast && <div style={{ flex: 1, width: 1, minHeight: 12, background: C.borderSoft }} />}
                              </div>
                              {/* Etikett + datum + ev. meddelande */}
                              <div style={{ paddingBottom: isLast ? 0 : 16, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>{cfg.label}</div>
                                <div style={{ fontSize: 12, color: C.muted }}>{formatDateTime(it.created_at)}</div>
                                {it.meddelande && <div style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>{it.meddelande}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })()}
      </SlideOver>

      {/* Redigera faktura — lägg till/ta bort fritextrader (rör inte belopp/summa) */}
      <SlideOver
        open={!!redigeraFaktura}
        onClose={() => setRedigeraFaktura(null)}
        title={redigeraFaktura ? `Redigera ${redigeraFaktura.fakturanummer}` : 'Redigera faktura'}
        width="md"
        footer={(
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setRedigeraFaktura(null)} style={{ ...btnGhost, marginLeft: 'auto' }}>Stäng</button>
          </div>
        )}
      >
        {redigeraFaktura && (() => {
          // Bara fritextrader (artikelkod 'TEXT') hanteras här.
          const fritextRader = redigeraFaktura.rader.filter(r => r.artikelkod === 'TEXT')
          return (
            <div style={{ padding: isMobile ? '20px 16px' : '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>
                Lägg till fria textrader på fakturan (t.ex. en notering eller specificering). Fritext visas på fakturan utan kostnad och påverkar inte beloppet.
              </p>

              {/* Befintliga fritextrader */}
              <div>
                <label style={lbl}>Fritextrader</label>
                {fritextRader.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.muted2, margin: '4px 0 0' }}>Inga fritextrader än.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {fritextRader.map(r => (
                      <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.panel2, padding: '10px 12px' }}>
                        <span style={{ flex: 1, fontSize: 13, color: C.muted, fontStyle: 'italic', minWidth: 0, wordBreak: 'break-word' }}>{r.beskrivning}</span>
                        <button
                          onClick={() => taBortFritextPaFaktura(r.id)}
                          title="Ta bort fritextrad"
                          style={{ borderRadius: 6, padding: '6px 10px', fontSize: 13, background: 'rgba(248,113,113,0.1)', color: C.danger, border: 'none', cursor: 'pointer', flexShrink: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ny fritextrad */}
              <div>
                <label style={lbl}>Lägg till fritextrad</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', ...(isMobile ? { flexDirection: 'column' } : {}) }}>
                  <input
                    type="text"
                    value={nyFritext}
                    onChange={e => setNyFritext(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && nyFritext.trim() && !fritextSparar) laggTillFritextPaFaktura() }}
                    onFocus={fo}
                    onBlur={fb}
                    style={inp}
                    placeholder="T.ex. Avser reparation efter vattenskada mars 2026"
                  />
                  <button
                    onClick={laggTillFritextPaFaktura}
                    disabled={!nyFritext.trim() || fritextSparar}
                    style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: (!nyFritext.trim() || fritextSparar) ? 0.4 : 1, cursor: (!nyFritext.trim() || fritextSparar) ? 'not-allowed' : 'pointer', ...(isMobile ? { width: '100%' } : {}) }}
                  >
                    {fritextSparar ? 'Lägger till...' : '＋ Lägg till'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </SlideOver>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
