'use client'

// Migrerad: src/app/hyresgaster/page.tsx (Tailwind, lucide, blå/ljus)
// → Order-appen: inline dark/gold-styles (styles.ts-tokens), emoji-ikoner,
//   namespacade API-routes /api/fastigheter/*.
//
// Datafält: Supabase returnerar snake_case-kolumner. Aliaserade relationer behåller
// käll-UI:ts nycklar (hyresavtal / lokaler / lokal / fastighet / kontaktpersoner /
// byggnader / beteckningar / bolag), men kolumnerna inuti är snake_case:
//   byggnad.uthyrbar_yta, beteckning.taxeringsvarde, bolag.fastighetsskattesats.
// AddressAutocomplete är inte porterad → ersatt med vanligt textfält.
// BolagAutocomplete återanvänds (porterad, mappar ort→stad, returnerar orgnummer).

import { useEffect, useState } from 'react'
import BolagAutocomplete from '@/components/fastigheter/BolagAutocomplete'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useConfirm } from '@/components/ConfirmDialog'
import { useBolag } from '@/components/fastigheter/BolagContext'
import Sokfalt from '@/components/Sokfalt'

interface HyresavtalInfo {
  id: string; status: string; bashyra: number
  lokaler: { lokal: { namn: string; fastighet: { namn: string; bolag_id?: string | null } } }[]
}

interface Kontaktperson { id: string; namn: string; roll: string | null; telefon: string | null; epost: string | null }

interface Hyresgast {
  id: string; namn: string; personnummer: string | null; epost: string | null
  fakturamail: string | null; telefon: string | null; adress: string | null
  samfakturering?: boolean
  fakturaleverans?: string
  hyresavtal?: HyresavtalInfo[]
  kontaktpersoner?: Kontaktperson[]
  _count?: { hyresavtal: number }
}

interface Lokal {
  id: string; namn: string; yta: number; typ: string; bashyra: number | null
  status: string
  fastighet: { namn: string; taxeringsvarde?: number | null; bolag?: { fastighetsskattesats?: number } | null; byggnader?: { uthyrbar_yta?: number | null }[]; beteckningar?: { taxeringsvarde?: number | null }[] }
}

const formatSEK = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const MONTHS_SV = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December']

// ---- lokala stilar (utöver delade tokens) ---------------------------------
const secTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: C.text2, margin: 0, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}`, marginBottom: 12 }
const smallLbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block' }
const inpSm: React.CSSProperties = { ...inp, padding: '6px 10px', fontSize: 12 }
const tinyLbl: React.CSSProperties = { fontSize: 10, color: C.muted2, marginBottom: 2, display: 'block' }

// Enkel toggle (ersätter Tailwind-switchen)
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'relative', width: 38, height: 21, borderRadius: 999, border: 'none', cursor: 'pointer',
        background: on ? C.gold : C.border, transition: 'background .15s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2.5, left: on ? 19 : 2.5, width: 16, height: 16, borderRadius: '50%',
        background: on ? '#000' : '#888', transition: 'left .15s',
      }} />
    </button>
  )
}

export default function HyresgasterPage() {
  const isMobile = useIsMobile()
  const confirm = useConfirm()
  const { valtBolagId, bolagLista } = useBolag()
  const valtBolagNamn = valtBolagId ? bolagLista.find(b => b.id === valtBolagId)?.namn : null
  const [items, setItems] = useState<Hyresgast[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Hyresgast | null>(null)
  const [form, setForm] = useState({ namn: '', personnummer: '', epost: '', fakturamail: '', telefon: '', adress: '' })
  const [hyresgastTyp, setHyresgastTyp] = useState<'foretag' | 'privat'>('foretag')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [showNewKontakt, setShowNewKontakt] = useState(false)
  const [kontaktForm, setKontaktForm] = useState({ namn: '', roll: '', telefon: '', epost: '' })

  const [placeraOpen, setPlaceraOpen] = useState(false)
  const [placeraHyresgast, setPlaceraHyresgast] = useState<Hyresgast | null>(null)
  const [ledigaLokaler, setLedigaLokaler] = useState<Lokal[]>([])

  const [selectedLokalIds, setSelectedLokalIds] = useState<string[]>([])
  const [placeraForm, setPlaceraForm] = useState({
    avtalsdatum: '',
    hyrestid: 'tillsvidare',
    startdatum: new Date().toISOString().split('T')[0],
    slutdatum: '',
    forlangning: '',
    uppsagningstidHG: '3',
    uppsagningstidHV: '3',
    bashyra: '',
    indexupprakning: '0',
    faktureringsfrekvens: 'månadsvis',
    forfallotyp: 'fore_period',
    forfallodagar: '30',
    basindexAr: '',
    basindexManad: 'Oktober',
    basindexVarde: '',
  })
  const [placeraSaving, setPlaceraSaving] = useState(false)
  const [kpiLoading, setKpiLoading] = useState(false)
  const [kpiInfo, setKpiInfo] = useState<{ value: number; period: string } | null>(null)
  const [aktuellKpi, setAktuellKpi] = useState<{ value: number; period: string } | null>(null)
  const [anvandIndex, setAnvandIndex] = useState(true)
  const [avtalsrader, setAvtalsrader] = useState<{ artikelkod: string; beskrivning: string; belopp: string; arsbelopp: string; moms: string }[]>([])

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

  const addAvtalsrad = () => {
    setAvtalsrader(prev => [...prev, { artikelkod: 'TILLAGG', beskrivning: '', belopp: '', arsbelopp: '', moms: '25' }])
  }

  const removeAvtalsrad = (i: number) => {
    setAvtalsrader(prev => prev.filter((_, idx) => idx !== i))
  }

  const updateAvtalsrad = (i: number, field: string, value: string) => {
    setAvtalsrader(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, [field]: value }
      if (field === 'artikelkod') {
        const typ = AVTALSRAD_TYPER.find(t => t.kod === value)
        if (typ && !r.beskrivning) updated.beskrivning = typ.label
      }
      return updated
    }))
  }

  const load = () => {
    fetch('/api/fastigheter/hyresgaster').then(r => r.json()).then(data => { if (Array.isArray(data)) setItems(data) }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ namn: '', personnummer: '', epost: '', fakturamail: '', telefon: '', adress: '' })
    setHyresgastTyp('foretag')
    setEditOpen(true)
  }

  const openEdit = (h: Hyresgast) => {
    setEditing(h)
    setForm({ namn: h.namn, personnummer: h.personnummer || '', epost: h.epost || '', fakturamail: h.fakturamail || '', telefon: h.telefon || '', adress: h.adress || '' })
    const pnr = h.personnummer || ''
    setHyresgastTyp(pnr.length === 11 && pnr.includes('-') ? 'foretag' : pnr.length > 0 ? 'privat' : 'foretag')
    setShowNewKontakt(false)
    setEditOpen(true)
  }

  const save = async () => {
    setSaving(true)
    const url = editing ? `/api/fastigheter/hyresgaster/${editing.id}` : '/api/fastigheter/hyresgaster'
    const method = editing ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setEditOpen(false); load()
  }

  const remove = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort hyresgäst?', danger: true, confirmLabel: 'Ta bort' }))) return
    await fetch(`/api/fastigheter/hyresgaster/${id}`, { method: 'DELETE' })
    setEditOpen(false); load()
  }

  const fetchKpiForBasindex = async (year: string, month: string) => {
    if (!year || !month) return
    setKpiLoading(true)
    try {
      const res = await fetch(`/api/fastigheter/kpi?year=${year}&month=${month}`)
      if (res.ok) {
        const d = await res.json()
        if (d.value) {
          setPlaceraForm(prev => ({ ...prev, basindexVarde: String(d.value) }))
          setKpiInfo({ value: d.value, period: `${month} ${year}` })
        }
      }
      // Hämta senaste oktober-KPI för jämförelse
      const nu = new Date()
      const senAr = nu.getMonth() >= 10 ? nu.getFullYear() : nu.getFullYear() - 1
      const aktuellRes = await fetch(`/api/fastigheter/kpi?year=${senAr}&month=Oktober`)
      if (aktuellRes.ok) {
        const ak = await aktuellRes.json()
        if (ak.value) setAktuellKpi({ value: ak.value, period: `Oktober ${senAr}` })
      }
    } finally {
      setKpiLoading(false)
    }
  }

  const openPlacer = async (h: Hyresgast) => {
    const res = await fetch('/api/fastigheter/lokaler')
    const alla: Lokal[] = await res.json()
    const lediga = alla.filter(l => l.status === 'ledig')
    setLedigaLokaler(lediga)
    setPlaceraHyresgast(h)
    setKpiInfo(null)
    const nu = new Date()
    const basAr = String(nu.getMonth() >= 10 ? nu.getFullYear() : nu.getFullYear() - 1)
    const forstaLediga = lediga[0]?.id ? [lediga[0].id] : []
    setSelectedLokalIds(forstaLediga)
    setPlaceraForm({
      avtalsdatum: '',
      hyrestid: 'tillsvidare',
      startdatum: nu.toISOString().split('T')[0],
      slutdatum: '',
      forlangning: '',
      uppsagningstidHG: '3',
      uppsagningstidHV: '3',
      bashyra: lediga[0]?.bashyra ? String(lediga[0].bashyra) : '',
      indexupprakning: '0',
      faktureringsfrekvens: 'månadsvis',
      forfallotyp: 'fore_period',
      forfallodagar: '30',
      basindexAr: basAr,
      basindexManad: 'Oktober',
      basindexVarde: '',
    })
    fetchKpiForBasindex(basAr, 'Oktober')
    const initHyra = lediga[0]?.bashyra ? String(lediga[0].bashyra) : ''
    setAvtalsrader([
      { artikelkod: 'HYR', beskrivning: 'Hyra lokal', belopp: initHyra, arsbelopp: initHyra ? String(Math.round(parseFloat(initHyra) * 12)) : '', moms: '25' },
    ])
    setPlaceraOpen(true)
  }

  const toggleLokal = (lokalId: string) => {
    setSelectedLokalIds(prev => {
      if (prev.includes(lokalId)) return prev.filter(id => id !== lokalId)
      return [...prev, lokalId]
    })
  }

  const submitPlacer = async () => {
    const hyraRad = avtalsrader.find(r => r.artikelkod === 'HYR')
    const bashyra = hyraRad?.belopp || placeraForm.bashyra
    if (!placeraHyresgast || selectedLokalIds.length === 0 || !bashyra) return
    setPlaceraSaving(true)
    const avtalRes = await fetch('/api/fastigheter/hyresavtal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lokalIds: selectedLokalIds,
        hyresgastId: placeraHyresgast.id,
        avtalsdatum: placeraForm.avtalsdatum || null,
        hyrestid: placeraForm.hyrestid,
        startdatum: placeraForm.startdatum,
        slutdatum: placeraForm.slutdatum || null,
        forlangning: placeraForm.forlangning || null,
        bashyra: bashyra,
        arshyra: hyraRad?.arsbelopp || null,
        indexupprakning: placeraForm.indexupprakning || '0',
        status: (placeraForm as Record<string, string>).status || 'aktiv',
        uppsagningstidHG: placeraForm.uppsagningstidHG || '3',
        uppsagningstidHV: placeraForm.uppsagningstidHV || '3',
        uppsagningstid: placeraForm.uppsagningstidHG || '3',
        faktureringsfrekvens: placeraForm.faktureringsfrekvens,
        forfallotyp: placeraForm.forfallotyp,
        forfallodagar: placeraForm.forfallodagar,
        anvandIndex,
        basindexAr: placeraForm.basindexAr || null,
        basindexManad: placeraForm.basindexManad || null,
        basindexVarde: placeraForm.basindexVarde || null,
        anvandning: (placeraForm as Record<string, string>).anvandning || null,
        kostnadsandel: (placeraForm as Record<string, string>).kostnadsandel || null,
        elAbonnemang: (placeraForm as Record<string, string>).elAbonnemang || 'hyresgast',
        vaAbonnemang: (placeraForm as Record<string, string>).vaAbonnemang || 'ingar',
        varmeAbonnemang: (placeraForm as Record<string, string>).varmeAbonnemang || 'ingar',
        ventilation: (placeraForm as Record<string, string>).ventilation || 'ingar',
        underhallsansvar: (placeraForm as Record<string, string>).underhallsansvar || 'hyresgast_ytskikt',
        sakerhet: (placeraForm as Record<string, string>).sakerhet || null,
        specialvillkor: (placeraForm as Record<string, string>).specialvillkor || null,
      }),
    })
    if (avtalRes.ok) {
      const avtal = await avtalRes.json()
      const extraRader = avtalsrader.filter(r => r.artikelkod !== 'HYR' && r.belopp)
      if (extraRader.length > 0) {
        await Promise.all(extraRader.map(r =>
          fetch('/api/fastigheter/avtalsrader', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...r, hyresavtalId: avtal.id }),
          })
        ))
      }
    }
    setPlaceraSaving(false)
    setPlaceraOpen(false)
    setPlaceraHyresgast(null)
    load()
  }

  const [sortCol, setSortCol] = useState<'namn' | 'avtal' | 'hyra'>('namn')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [filterFastighet, setFilterFastighet] = useState('')

  const toggleSort = (col: 'namn' | 'avtal' | 'hyra') => {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortCol(col); setSortDir(col === 'namn' ? 1 : -1) }
  }

  // Aktiv månadshyra (summa av aktiva avtal) — används för sortering.
  const aktivHyra = (h: Hyresgast) =>
    (h.hyresavtal ?? []).filter(a => a.status === 'aktiv').reduce((s, a) => s + (a.bashyra || 0), 0)

  // En hyresgäst hör till valt bolag om något av dess avtals lokaler ligger på en
  // fastighet i det bolaget. Hyresgäster utan avtal (utan bolagskoppling) döljs när
  // ett bolag är valt.
  const tillhorBolag = (h: Hyresgast) =>
    !valtBolagId || (h.hyresavtal ?? []).some(a => a.lokaler.some(l => l.lokal.fastighet.bolag_id === valtBolagId))

  const filtered = items
    .filter(h => {
      if (!tillhorBolag(h)) return false
      if (search) {
        const q = search.toLowerCase()
        const match =
          h.namn.toLowerCase().includes(q)
          || (h.personnummer ?? '').toLowerCase().includes(q)
          || (h.epost ?? '').toLowerCase().includes(q)
          || (h.telefon ?? '').toLowerCase().includes(q)
          || (h.adress ?? '').toLowerCase().includes(q)
          || (h.hyresavtal ?? []).some(a => a.lokaler.some(l =>
            l.lokal.namn.toLowerCase().includes(q) || l.lokal.fastighet.namn.toLowerCase().includes(q)))
          || (h.kontaktpersoner ?? []).some(k => k.namn.toLowerCase().includes(q))
        if (!match) return false
      }
      if (filterFastighet && !h.hyresavtal?.some(a => a.lokaler.some(l => l.lokal.fastighet.namn === filterFastighet))) return false
      return true
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortCol === 'avtal') cmp = (a._count?.hyresavtal ?? 0) - (b._count?.hyresavtal ?? 0)
      else if (sortCol === 'hyra') cmp = aktivHyra(a) - aktivHyra(b)
      else cmp = a.namn.localeCompare(b.namn)
      // Sekundär sortering på namn för stabil ordning
      if (cmp === 0 && sortCol !== 'namn') cmp = a.namn.localeCompare(b.namn)
      return cmp * sortDir
    })

  // Endast fastigheter i valt bolag när ett bolag är valt.
  const uniktaFastigheter = [...new Set(
    items.flatMap(h => h.hyresavtal?.flatMap(a =>
      a.lokaler.filter(l => !valtBolagId || l.lokal.fastighet.bolag_id === valtBolagId).map(l => l.lokal.fastighet.namn)) || [])
  )].sort()

  // Kolumnknappar för sortering (ersätter tidigare sort-dropdown, samma toggle-mönster som fakturering).
  const sortKnappar: { key: 'namn' | 'avtal' | 'hyra'; label: string }[] = [
    { key: 'namn', label: 'Namn' },
    { key: 'avtal', label: 'Antal avtal' },
    { key: 'hyra', label: 'Aktiv hyra' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(isMobile ? { overflowX: 'hidden' } : {}) }}>
      <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', ...(isMobile ? { flexDirection: 'column', gap: 12 } : {}) }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Hyresgäster</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            {filtered.length} {filtered.length === 1 ? 'hyresgäst' : 'hyresgäster'}
            {valtBolagNamn ? ` · ${valtBolagNamn}` : ''}
          </p>
        </div>
        <button onClick={openNew} style={{ ...btnPrimary, ...(isMobile ? { width: '100%' } : {}) }}>+ Ny hyresgäst</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
        <Sokfalt
          value={search}
          onChange={setSearch}
          placeholder="Sök namn, org.nr, adress, lokal..."
          style={{ width: isMobile ? '100%' : 320 }}
        />
        <select value={filterFastighet} onChange={e => setFilterFastighet(e.target.value)} onFocus={fo} onBlur={fb} style={{ ...inp, ...(isMobile ? { width: '100%' } : { width: 'auto' }) }}>
          <option value="">Alla fastigheter</option>
          {uniktaFastigheter.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        {/* Sorterbara kolumner — klickbara knappar med asc/desc-pil (samma mönster som fakturering) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', ...(isMobile ? { width: '100%' } : { marginLeft: 'auto' }) }}>
          <span style={{ fontSize: 11, color: C.muted2, ...(isMobile ? { width: '100%' } : {}) }}>Sortera:</span>
          {sortKnappar.map(k => {
            const active = sortCol === k.key
            return (
              <button
                key={k.key}
                onClick={() => toggleSort(k.key)}
                style={{
                  flex: isMobile ? 1 : undefined,
                  padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  borderRadius: 8, border: `1px solid ${active ? C.gold : C.border}`,
                  background: active ? C.goldSoft : 'transparent',
                  color: active ? C.gold : C.muted,
                  whiteSpace: 'nowrap', userSelect: 'none',
                }}
              >
                {k.label}{active ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Inga hyresgäster hittades</div>
          ) : filtered.map((h) => (
            <div key={h.id} onClick={() => openEdit(h)} style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <div style={{ display: 'flex', height: 36, width: 36, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: C.goldSoft, color: C.gold, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                    {h.namn.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.namn}</h3>
                    {h.personnummer && <p style={{ fontSize: 11, color: C.muted2, margin: 0 }}>{h.personnummer}</p>}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); remove(h.id) }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 14, padding: 4, flexShrink: 0 }}>🗑️</button>
              </div>

              {/* Kontakter */}
              {h.kontaktpersoner && h.kontaktpersoner.length > 0 && (
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {h.kontaktpersoner.slice(0, 2).map(k => (
                    <div key={k.id}>{k.namn}{k.roll ? <span style={{ fontSize: 11, color: C.muted2, marginLeft: 4 }}>({k.roll})</span> : ''}</div>
                  ))}
                  {h.kontaktpersoner.length > 2 && <span style={{ fontSize: 11, color: C.muted2 }}>+{h.kontaktpersoner.length - 2} till</span>}
                </div>
              )}

              {/* Placeringar */}
              {h.hyresavtal && h.hyresavtal.filter(a => a.status === 'aktiv').length > 0 && (
                <div style={{ paddingTop: 8, borderTop: `1px solid ${C.borderSoft}`, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {h.hyresavtal.filter(a => a.status === 'aktiv').map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                      <span style={{ color: C.text2, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.lokaler.map(l => l.lokal.namn).join(', ')} <span style={{ color: C.muted2, fontWeight: 400 }}>· {a.lokaler[0]?.lokal.fastighet.namn}</span></span>
                      <span style={{ color: C.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>{formatSEK(a.bashyra)}/mån</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer — alltid i botten */}
              <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${C.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: C.muted2 }}>{h._count?.hyresavtal ?? 0} avtal</span>
                <button
                  onClick={(e) => { e.stopPropagation(); openPlacer(h) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, background: C.ok, color: '#000', border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  🏠 {h.hyresavtal && h.hyresavtal.filter(a => a.status === 'aktiv').length > 0 ? 'Ny lokal' : 'Placera i lokal'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Redigera/skapa hyresgäst */}
      <SlideOver
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editing ? editing.namn : 'Ny hyresgäst'}
        subtitle={editing ? (editing.personnummer || undefined) : undefined}
        width="md"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            {editing && (
              <button onClick={() => remove(editing.id)} style={{ background: 'transparent', color: C.danger, border: `1px solid rgba(248,113,113,0.4)`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Ta bort</button>
            )}
            <button onClick={() => setEditOpen(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={save} disabled={saving || !form.namn} style={{ ...btnPrimary, flex: 1, opacity: saving || !form.namn ? 0.5 : 1 }}>
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        }
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Typ-flikar */}
          {!editing && (
            <div style={{ display: 'flex', gap: 4, borderRadius: 8, background: C.field, padding: 4 }}>
              <button
                type="button"
                onClick={() => { setHyresgastTyp('foretag'); setForm(f => ({ ...f, personnummer: '' })) }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: hyresgastTyp === 'foretag' ? C.gold : 'transparent', color: hyresgastTyp === 'foretag' ? '#000' : C.muted }}
              >
                🏢 Företag
              </button>
              <button
                type="button"
                onClick={() => { setHyresgastTyp('privat'); setForm(f => ({ ...f, personnummer: '' })) }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: hyresgastTyp === 'privat' ? C.gold : 'transparent', color: hyresgastTyp === 'privat' ? '#000' : C.muted }}
              >
                👤 Privatperson
              </button>
            </div>
          )}

          {/* Företagssök — bara för företag */}
          {hyresgastTyp === 'foretag' && (
            <BolagAutocomplete
              onSelect={(res) => setForm(f => ({
                ...f,
                namn: res.namn || f.namn,
                personnummer: res.orgnummer || f.personnummer,
                epost: res.epost || f.epost,
                adress: [res.adress, res.postnummer, res.stad].filter(Boolean).join(', ') || f.adress,
              }))}
            />
          )}

          <div>
            <label style={lbl}>{hyresgastTyp === 'foretag' ? 'Företagsnamn' : 'Namn'}</label>
            <input
              spellCheck={false}
              style={inp}
              onFocus={fo}
              onBlur={fb}
              value={form.namn}
              onChange={e => setForm({ ...form, namn: e.target.value })}
              placeholder={hyresgastTyp === 'foretag' ? 'AB Exempel' : 'För- och efternamn'}
            />
          </div>
          <div>
            <label style={lbl}>{hyresgastTyp === 'foretag' ? 'Organisationsnummer' : 'Personnummer'}</label>
            <input
              spellCheck={false}
              style={inp}
              onFocus={fo}
              onBlur={fb}
              value={form.personnummer}
              onChange={e => setForm({ ...form, personnummer: e.target.value })}
              placeholder={hyresgastTyp === 'foretag' ? '556xxx-xxxx' : 'YYYYMMDD-XXXX'}
            />
          </div>
          <div>
            <label style={lbl}>Fakturamail</label>
            <input
              spellCheck={false}
              style={inp}
              onFocus={fo}
              onBlur={fb}
              value={form.fakturamail}
              onChange={e => setForm({ ...form, fakturamail: e.target.value })}
              placeholder="faktura@exempel.se"
            />
          </div>
          <div>
            <label style={lbl}>Adress</label>
            <input
              spellCheck={false}
              style={inp}
              onFocus={fo}
              onBlur={fb}
              value={form.adress}
              onChange={e => setForm({ ...form, adress: e.target.value })}
              placeholder="Gatuadress, postnummer, ort"
            />
          </div>

          {/* Fakturaleverans */}
          {editing && (
            <div>
              <label style={lbl}>Fakturaleverans</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={editing.fakturaleverans || 'epost'} onChange={async e => {
                await fetch(`/api/fastigheter/hyresgaster/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fakturaleverans: e.target.value }) })
                load()
              }}>
                <option value="epost">E-post (PDF)</option>
                <option value="brev">Brevpost</option>
                <option value="efaktura">E-faktura (Peppol)</option>
              </select>
            </div>
          )}

          {/* Samfakturering */}
          {editing && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, border: `1px solid ${C.border}`, padding: 12 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text2, margin: 0 }}>Samfakturering</p>
                <p style={{ fontSize: 11, color: C.muted2, margin: 0 }}>Slå ihop fakturor för alla lokaler till en faktura</p>
              </div>
              <Toggle on={editing.samfakturering || false} onClick={async () => {
                await fetch(`/api/fastigheter/hyresgaster/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ samfakturering: !editing.samfakturering }) })
                load()
              }} />
            </div>
          )}

          {/* Kontaktpersoner */}
          {editing && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Kontaktpersoner</label>
                {!showNewKontakt && (
                  <button type="button" onClick={() => { setShowNewKontakt(true); setKontaktForm({ namn: '', roll: '', telefon: '', epost: '' }) }} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12 }}>+ Lägg till</button>
                )}
              </div>

              {/* Befintliga */}
              {(editing.kontaktpersoner?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {editing.kontaktpersoner!.map(k => (
                    <div key={k.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.field, padding: '10px 12px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{k.namn}</p>
                          {k.roll && <span style={{ fontSize: 11, background: C.goldSoft, color: C.gold, borderRadius: 4, padding: '1px 6px' }}>{k.roll}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                          {k.telefon && <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>📞 {k.telefon}</span>}
                          {k.epost && <span style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>✉️ {k.epost}</span>}
                        </div>
                      </div>
                      <button onClick={async () => { await fetch(`/api/fastigheter/kontaktpersoner?id=${k.id}`, { method: 'DELETE' }); load() }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {(editing.kontaktpersoner?.length ?? 0) === 0 && !showNewKontakt && (
                <p style={{ fontSize: 11, color: C.muted2, fontStyle: 'italic' }}>Inga kontaktpersoner registrerade</p>
              )}

              {/* Nytt formulär */}
              {showNewKontakt && (
                <div style={{ borderRadius: 8, border: `1px solid ${C.gold}`, background: C.goldSoft, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={smallLbl}>Namn *</label>
                      <input spellCheck={false} style={{ ...inpSm, background: C.panel }} onFocus={fo} onBlur={fb} value={kontaktForm.namn} onChange={e => setKontaktForm({ ...kontaktForm, namn: e.target.value })} placeholder="För- och efternamn" autoFocus />
                    </div>
                    <div>
                      <label style={smallLbl}>Roll</label>
                      <input spellCheck={true} style={{ ...inpSm, background: C.panel }} onFocus={fo} onBlur={fb} value={kontaktForm.roll} onChange={e => setKontaktForm({ ...kontaktForm, roll: e.target.value })} placeholder="T.ex. VD, Ekonomi" />
                    </div>
                    <div>
                      <label style={smallLbl}>Telefon</label>
                      <input spellCheck={false} style={{ ...inpSm, background: C.panel }} onFocus={fo} onBlur={fb} value={kontaktForm.telefon} onChange={e => setKontaktForm({ ...kontaktForm, telefon: e.target.value })} placeholder="070-123 45 67" />
                    </div>
                    <div>
                      <label style={smallLbl}>E-post</label>
                      <input spellCheck={false} style={{ ...inpSm, background: C.panel }} onFocus={fo} onBlur={fb} value={kontaktForm.epost} onChange={e => setKontaktForm({ ...kontaktForm, epost: e.target.value })} placeholder="namn@foretag.se" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setShowNewKontakt(false)} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>Avbryt</button>
                    <button type="button" disabled={!kontaktForm.namn} onClick={async () => {
                      await fetch('/api/fastigheter/kontaktpersoner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hyresgastId: editing.id, ...kontaktForm }) })
                      setShowNewKontakt(false)
                      load()
                    }} style={{ ...btnPrimary, padding: '6px 12px', fontSize: 12, opacity: !kontaktForm.namn ? 0.5 : 1 }}>Spara kontakt</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SlideOver>

      {/* Placera i lokal */}
      <SlideOver
        open={placeraOpen}
        onClose={() => { setPlaceraOpen(false); setPlaceraHyresgast(null) }}
        title="Placera i lokal"
        subtitle={placeraHyresgast ? `Skapar hyresavtal för ${placeraHyresgast.namn}` : undefined}
        width="lg"
        footer={
          ledigaLokaler.length > 0 ? (
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setPlaceraOpen(false); setPlaceraHyresgast(null) }} style={btnGhost}>Avbryt</button>
              <button
                onClick={() => { setPlaceraForm(prev => ({ ...prev, status: 'utkast' })); submitPlacer() }}
                disabled={placeraSaving || selectedLokalIds.length === 0}
                style={{ background: C.goldSoft, color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: placeraSaving || selectedLokalIds.length === 0 ? 0.5 : 1 }}
              >
                Spara som utkast
              </button>
              <button
                onClick={submitPlacer}
                disabled={placeraSaving || selectedLokalIds.length === 0 || !placeraForm.bashyra}
                style={{ flex: 1, background: C.ok, color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: placeraSaving || selectedLokalIds.length === 0 || !placeraForm.bashyra ? 0.5 : 1 }}
              >
                {placeraSaving ? 'Skapar...' : 'Skapa hyresavtal'}
              </button>
            </div>
          ) : (
            <button onClick={() => { setPlaceraOpen(false); setPlaceraHyresgast(null) }} style={{ ...btnGhost, width: '100%' }}>Stäng</button>
          )
        }
      >
        <div style={{ padding: 24 }}>
          {ledigaLokaler.length === 0 ? (
            <div style={{ borderRadius: 8, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', padding: '12px 16px', fontSize: 13, color: C.warn }}>
              Det finns inga lediga lokaler just nu. Lägg till lokaler eller avsluta befintliga avtal.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              <div>
                <label style={lbl}>Lokaler (endast lediga)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 192, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }}>
                  {ledigaLokaler.map(l => {
                    const vald = selectedLokalIds.includes(l.id)
                    return (
                      <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px', borderRadius: 8, cursor: 'pointer', background: vald ? C.goldSoft : 'transparent', border: `1px solid ${vald ? C.gold : 'transparent'}` }}>
                        <input
                          type="checkbox"
                          checked={vald}
                          onChange={() => toggleLokal(l.id)}
                          style={{ width: 16, height: 16, accentColor: C.gold }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text2 }}>{l.namn}</div>
                          <div style={{ fontSize: 11, color: C.muted2 }}>{l.fastighet.namn} · {l.yta} kvm{l.bashyra ? ` · ${l.bashyra.toLocaleString('sv-SE')} kr/mån` : ''}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
                {selectedLokalIds.length > 0 && (
                  <p style={{ marginTop: 6, fontSize: 11, color: C.gold, fontWeight: 600 }}>{selectedLokalIds.length} lokal{selectedLokalIds.length > 1 ? 'er' : ''} vald{selectedLokalIds.length > 1 ? 'a' : ''} · Total yta: {ledigaLokaler.filter(l => selectedLokalIds.includes(l.id)).reduce((s, l) => s + l.yta, 0)} kvm</p>
                )}
              </div>

              <div>
                <h4 style={secTitle}>Kontraktstid</h4>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Avtalsdatum <span style={{ color: C.muted2, fontWeight: 400 }}>(valfritt)</span></label>
                    <input spellCheck={false} type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={placeraForm.avtalsdatum} onChange={e => setPlaceraForm({ ...placeraForm, avtalsdatum: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Hyrestid</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={placeraForm.hyrestid} onChange={e => setPlaceraForm({ ...placeraForm, hyrestid: e.target.value })}>
                      <option value="tillsvidare">Tillsvidare</option>
                      <option value="tidsbegransat">Tidsbegränsat</option>
                      <option value="forlangning">Förlängning</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Kontraktsstart</label>
                    <input spellCheck={false} type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={placeraForm.startdatum} onChange={e => {
                      const datum = e.target.value
                      if (datum && datum.length === 10) {
                        const d = new Date(datum)
                        const basAr = String(d.getMonth() >= 10 ? d.getFullYear() : d.getFullYear() - 1)
                        setPlaceraForm(prev => ({ ...prev, startdatum: datum, basindexAr: basAr, basindexManad: 'Oktober' }))
                        fetchKpiForBasindex(basAr, 'Oktober')
                      } else {
                        setPlaceraForm(prev => ({ ...prev, startdatum: datum }))
                      }
                    }} />
                  </div>
                  <div>
                    <label style={lbl}>Slutdatum <span style={{ color: C.muted2, fontWeight: 400 }}>(tomt = tillsvidare)</span></label>
                    <input spellCheck={false} type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={placeraForm.slutdatum} onChange={e => setPlaceraForm({ ...placeraForm, slutdatum: e.target.value })} />
                  </div>
                  {(placeraForm.hyrestid === 'forlangning' || placeraForm.hyrestid === 'tillsvidare') && (
                    <div>
                      <label style={lbl}>Förlängningstid (år)</label>
                      <input spellCheck={false} type="number" min="1" style={inp} onFocus={fo} onBlur={fb} value={placeraForm.forlangning} onChange={e => setPlaceraForm({ ...placeraForm, forlangning: e.target.value })} placeholder="t.ex. 36" />
                    </div>
                  )}
                  <div>
                    <label style={lbl}>Uppsägningstid hyresgäst (mån)</label>
                    <input spellCheck={false} type="number" min="0" style={inp} onFocus={fo} onBlur={fb} value={placeraForm.uppsagningstidHG} onChange={e => setPlaceraForm({ ...placeraForm, uppsagningstidHG: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Uppsägningstid hyresvärd (mån)</label>
                    <input spellCheck={false} type="number" min="0" style={inp} onFocus={fo} onBlur={fb} value={placeraForm.uppsagningstidHV} onChange={e => setPlaceraForm({ ...placeraForm, uppsagningstidHV: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Avtalsdetaljer */}
              <div>
                <h4 style={secTitle}>Avtalsdetaljer</h4>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Användningsändamål</label>
                    <input spellCheck={true} style={inp} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).anvandning || ''} onChange={e => setPlaceraForm(prev => ({ ...prev, anvandning: e.target.value }))} placeholder="T.ex. Kontor, Lager" />
                  </div>
                  <div>
                    <label style={lbl}>Kostnadsandel (%)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input spellCheck={false} type="number" step="0.1" style={inp} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).kostnadsandel || ''} onChange={e => {
                        const val = e.target.value
                        setPlaceraForm(prev => ({ ...prev, kostnadsandel: val }))
                        // Uppdatera FSKATT-rad
                        if (val) {
                          const lokal = ledigaLokaler.find(l => l.id === selectedLokalIds[0])
                          const tax = (() => { const f = lokal?.fastighet; return f?.beteckningar?.reduce((s: number, b: { taxeringsvarde?: number | null }) => s + (b.taxeringsvarde ?? 0), 0) || f?.taxeringsvarde || 0 })()
                          const sats = (lokal?.fastighet.bolag?.fastighetsskattesats ?? 0.5) / 100
                          const andel = parseFloat(val) / 100
                          const skattAr = Math.round(tax * sats * andel * 100) / 100
                          const skattMan = Math.round(skattAr / 12 * 100) / 100
                          setAvtalsrader(prev => prev.map(r => r.artikelkod === 'FSKATT' ? { ...r, belopp: String(skattMan), arsbelopp: String(skattAr) } : r))
                        }
                      }} placeholder="Beräknas" />
                      <button type="button" onClick={() => {
                        const lokal = ledigaLokaler.find(l => l.id === selectedLokalIds[0])
                        const totalLOA = lokal?.fastighet.byggnader?.reduce((s, b) => s + (b.uthyrbar_yta ?? 0), 0) || 0
                        const totalYtaVald = ledigaLokaler.filter(l => selectedLokalIds.includes(l.id)).reduce((s, l) => s + l.yta, 0)
                        if (totalLOA > 0 && totalYtaVald > 0) {
                          const andel = Math.round((totalYtaVald / totalLOA) * 1000) / 10
                          setPlaceraForm(prev => ({ ...prev, kostnadsandel: String(andel) }))
                          const tax = (() => { const f = lokal?.fastighet; return f?.beteckningar?.reduce((s: number, b: { taxeringsvarde?: number | null }) => s + (b.taxeringsvarde ?? 0), 0) || f?.taxeringsvarde || 0 })()
                          const sats = (lokal?.fastighet.bolag?.fastighetsskattesats ?? 0.5) / 100
                          const skattAr = Math.round(tax * sats * (andel / 100) * 100) / 100
                          const skattMan = Math.round(skattAr / 12 * 100) / 100
                          setAvtalsrader(prev => prev.map(r => r.artikelkod === 'FSKATT' ? { ...r, belopp: String(skattMan), arsbelopp: String(skattAr) } : r))
                        }
                      }} style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', padding: '8px 12px', fontSize: 11, color: C.gold, cursor: 'pointer', whiteSpace: 'nowrap' }}>Beräkna</button>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>El</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).elAbonnemang || 'hyresgast'} onChange={e => setPlaceraForm(prev => ({ ...prev, elAbonnemang: e.target.value }))}>
                      <option value="hyresgast">Eget abonnemang (hyresgäst)</option>
                      <option value="na">N/A</option>
                      <option value="ingar">Ingår i hyran</option>
                      <option value="hyresvard">Hyresvärden</option>
                      <option value="vidarefakturering">Vidarefakturering</option>
                      <option value="schablon">Enligt schablon</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Värme</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).varmeAbonnemang || 'ingar'} onChange={e => setPlaceraForm(prev => ({ ...prev, varmeAbonnemang: e.target.value }))}>
                      <option value="na">N/A</option>
                      <option value="ingar">Ingår i hyran</option>
                      <option value="hyresgast">Eget abonnemang</option>
                      <option value="hyresvard">Hyresvärden</option>
                      <option value="vidarefakturering">Vidarefakturering</option>
                      <option value="schablon">Enligt schablon</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>VA</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).vaAbonnemang || 'ingar'} onChange={e => setPlaceraForm(prev => ({ ...prev, vaAbonnemang: e.target.value }))}>
                      <option value="na">N/A</option>
                      <option value="ingar">Ingår i hyran</option>
                      <option value="hyresgast">Eget abonnemang</option>
                      <option value="hyresvard">Hyresvärden</option>
                      <option value="vidarefakturering">Vidarefakturering</option>
                      <option value="schablon">Enligt schablon</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Ventilation</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).ventilation || 'ingar'} onChange={e => setPlaceraForm(prev => ({ ...prev, ventilation: e.target.value }))}>
                      <option value="na">N/A</option>
                      <option value="ingar">Ingår i hyran</option>
                      <option value="hyresgast">Eget abonnemang</option>
                      <option value="hyresvard">Hyresvärden</option>
                      <option value="vidarefakturering">Vidarefakturering</option>
                      <option value="schablon">Enligt schablon</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Underhållsansvar</label>
                    <select style={inp} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).underhallsansvar || 'hyresgast_ytskikt'} onChange={e => setPlaceraForm(prev => ({ ...prev, underhallsansvar: e.target.value }))}>
                      <option value="hyresvard">Hyresvärden — allt underhåll</option>
                      <option value="hyresgast_ytskikt">Hyresgästen — ytskikt</option>
                      <option value="hyresgast_allt">Hyresgästen — allt</option>
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Säkerhet</label>
                    <input spellCheck={true} style={inp} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).sakerhet || ''} onChange={e => setPlaceraForm(prev => ({ ...prev, sakerhet: e.target.value }))} placeholder="T.ex. Bankgaranti 100 000 kr" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Särskilda villkor</label>
                    <textarea spellCheck={true} rows={2} style={{ ...inp, resize: 'none' }} onFocus={fo} onBlur={fb} value={(placeraForm as Record<string, string>).specialvillkor || ''} onChange={e => setPlaceraForm(prev => ({ ...prev, specialvillkor: e.target.value }))} placeholder="Fritext..." />
                  </div>
                </div>
              </div>

              {/* Fastighetsskatt */}
              {(() => {
                const lokal = ledigaLokaler.find(l => l.id === selectedLokalIds[0])
                const tax = (() => { const f = lokal?.fastighet; return f?.beteckningar?.reduce((s: number, b: { taxeringsvarde?: number | null }) => s + (b.taxeringsvarde ?? 0), 0) || f?.taxeringsvarde || 0 })()
                const sats = (lokal?.fastighet.bolag?.fastighetsskattesats ?? 0.5) / 100
                const totalLOA = lokal?.fastighet.byggnader?.reduce((s, b) => s + (b.uthyrbar_yta ?? 0), 0) || 0
                const totalValdYta = ledigaLokaler.filter(l => selectedLokalIds.includes(l.id)).reduce((s, l) => s + l.yta, 0)
                const autoAndel = totalLOA > 0 && totalValdYta > 0 ? Math.round((totalValdYta / totalLOA) * 1000) / 10 : 0
                const hasFskatt = avtalsrader.some(r => r.artikelkod === 'FSKATT')

                return (
                  <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text2, margin: 0 }}>Fastighetsskatt</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.muted2 }}>{hasFskatt ? 'Ja' : 'Nej'}</span>
                        <Toggle on={hasFskatt} onClick={() => {
                          if (!hasFskatt) {
                            const andel = autoAndel / 100
                            const skattAr = Math.round(tax * sats * andel * 100) / 100
                            const skattMan = Math.round(skattAr / 12 * 100) / 100
                            setAvtalsrader(prev => [...prev, { artikelkod: 'FSKATT', beskrivning: 'Fastighetsskatt', belopp: skattMan > 0 ? String(skattMan) : '', arsbelopp: skattAr > 0 ? String(skattAr) : '', moms: '25' }])
                          } else {
                            setAvtalsrader(prev => prev.filter(r => r.artikelkod !== 'FSKATT'))
                          }
                        }} />
                      </div>
                    </div>
                    {hasFskatt && tax > 0 && (
                      <p style={{ fontSize: 11, color: C.muted2, margin: 0 }}>
                        Taxeringsvärde {tax.toLocaleString('sv-SE')} kr × {(sats * 100).toFixed(1)}% × {autoAndel}% = {(() => { const r = avtalsrader.find(r => r.artikelkod === 'FSKATT'); return r?.arsbelopp || '?' })()}&nbsp;kr/år
                      </p>
                    )}
                    {hasFskatt && !tax && (
                      <p style={{ fontSize: 11, color: C.warn, margin: 0 }}>Taxeringsvärde saknas — fyll i beloppet manuellt i raden nedan.</p>
                    )}
                  </div>
                )
              })()}

              {/* Faktureringsrader */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}` }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text2, margin: 0 }}>Faktureringsrader</h4>
                  <button type="button" onClick={addAvtalsrad} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: C.gold, cursor: 'pointer' }}>
                    + Lägg till
                  </button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Faktureringsintervall</label>
                  <select style={inp} onFocus={fo} onBlur={fb} value={placeraForm.faktureringsfrekvens} onChange={e => setPlaceraForm({ ...placeraForm, faktureringsfrekvens: e.target.value })}>
                    <option value="månadsvis">Månadsvis — 1 faktura skickas varje månad</option>
                    <option value="kvartalsvis">Kvartalsvis — 1 faktura per kvartal med 3 månaders belopp</option>
                  </select>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Förfallodatum</label>
                  <select style={inp} onFocus={fo} onBlur={fb} value={placeraForm.forfallotyp} onChange={e => setPlaceraForm({ ...placeraForm, forfallotyp: e.target.value })}>
                    <option value="fore_period">Före nästa hyresperiods start</option>
                    <option value="dagar_efter">Antal dagar efter fakturadatum</option>
                  </select>
                  {placeraForm.forfallotyp === 'dagar_efter' && (
                    <input spellCheck={false} type="number" min="1" max="90" style={{ ...inp, marginTop: 8 }} onFocus={fo} onBlur={fb} value={placeraForm.forfallodagar} onChange={e => setPlaceraForm({ ...placeraForm, forfallodagar: e.target.value })} placeholder="30" />
                  )}
                </div>

                <p style={{ fontSize: 11, color: C.muted2, marginBottom: 12 }}>Alla belopp anges per månad.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {avtalsrader.map((rad, i) => (
                    <div key={i} style={{ borderRadius: 8, border: `1px solid ${rad.artikelkod === 'HYR' ? C.gold : C.border}`, background: rad.artikelkod === 'HYR' ? C.goldSoft : C.field, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <select style={{ ...inpSm, width: 'auto', background: C.panel, fontWeight: 600 }} onFocus={fo} onBlur={fb} value={rad.artikelkod} onChange={e => updateAvtalsrad(i, 'artikelkod', e.target.value)}>
                          {AVTALSRAD_TYPER.map(t => <option key={t.kod} value={t.kod}>{t.label}</option>)}
                        </select>
                        {rad.artikelkod !== 'HYR' && (
                          <button type="button" onClick={() => removeAvtalsrad(i)} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', padding: 4 }}>✕</button>
                        )}
                      </div>
                      <input spellCheck={true} style={{ ...inpSm, background: C.panel }} onFocus={fo} onBlur={fb} value={rad.beskrivning} onChange={e => updateAvtalsrad(i, 'beskrivning', e.target.value)} placeholder="Beskrivning" />
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                        <div>
                          <label style={tinyLbl}>Per månad exkl. moms</label>
                          <input spellCheck={false} type="number" style={{ ...inpSm, background: C.panel }} onFocus={fo} onBlur={fb} value={rad.belopp} onChange={e => {
                            const m = e.target.value
                            const a = m ? String(Math.round(parseFloat(m) * 12 * 100) / 100) : ''
                            setAvtalsrader(prev => prev.map((r, idx) => idx === i ? { ...r, belopp: m, arsbelopp: a } : r))
                            if (rad.artikelkod === 'HYR') setPlaceraForm(prev => ({ ...prev, bashyra: m }))
                          }} placeholder="8 500" />
                        </div>
                        <div>
                          <label style={tinyLbl}>Per år exkl. moms</label>
                          <input spellCheck={false} type="number" style={{ ...inpSm, background: C.panel }} onFocus={fo} onBlur={fb} value={rad.arsbelopp} onChange={e => {
                            const a = e.target.value
                            const m = a ? String(Math.round(parseFloat(a) / 12 * 100) / 100) : ''
                            setAvtalsrader(prev => prev.map((r, idx) => idx === i ? { ...r, belopp: m, arsbelopp: a } : r))
                            if (rad.artikelkod === 'HYR') setPlaceraForm(prev => ({ ...prev, bashyra: m }))
                          }} placeholder="102 000" />
                        </div>
                      </div>
                      <div>
                        <label style={tinyLbl}>Moms</label>
                        <select style={{ ...inpSm, background: C.panel }} onFocus={fo} onBlur={fb} value={rad.moms} onChange={e => updateAvtalsrad(i, 'moms', e.target.value)}>
                          <option value="0">0 %</option>
                          <option value="25">25 %</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summering */}
                {avtalsrader.some(r => r.belopp) && (() => {
                  const r2 = (n: number) => Math.round(n * 100) / 100
                  const valdaLokaler = ledigaLokaler.filter(l => selectedLokalIds.includes(l.id))
                  const lokalYta = valdaLokaler.filter(l => l.typ !== 'mark').reduce((s, l) => s + l.yta, 0)
                  const markYta = valdaLokaler.filter(l => l.typ === 'mark').reduce((s, l) => s + l.yta, 0)
                  const yta = lokalYta + markYta
                  let totalArExkl = 0
                  avtalsrader.forEach(r => {
                    if (!r.arsbelopp && !r.belopp) return
                    const ar = r.arsbelopp ? parseFloat(r.arsbelopp) : parseFloat(r.belopp) * 12
                    totalArExkl += ar
                  })

                  // Index beräknas på årsbeloppet för hyra
                  let indexAr = 0
                  const hyraRad = avtalsrader.find(r => r.artikelkod === 'HYR')
                  const hyraAr = hyraRad?.arsbelopp ? parseFloat(hyraRad.arsbelopp) : (hyraRad?.belopp ? parseFloat(hyraRad.belopp) * 12 : 0)
                  if (anvandIndex && placeraForm.basindexVarde && aktuellKpi && hyraAr > 0) {
                    const bas = parseFloat(placeraForm.basindexVarde)
                    const procent = (aktuellKpi.value - bas) / bas
                    indexAr = r2(hyraAr * procent)
                  }

                  const totalArMedIndex = totalArExkl + indexAr
                  const totalManadMedIndex = r2(totalArMedIndex / 12)
                  const totalManadExkl = r2(totalArExkl / 12)

                  const gridCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 6, fontSize: 13 }
                  const topBorder: React.CSSProperties = { borderTop: `1px solid ${C.border}`, paddingTop: 6 }

                  return (
                    <div style={{ marginTop: 16, borderRadius: 8, background: '#000', color: C.text, border: `1px solid ${C.border}`, padding: '12px 16px' }}>
                      <div style={gridCol}>
                        <p style={{ color: C.muted, margin: 0 }}>Avtalat/mån exkl. moms:</p>
                        <p style={{ fontWeight: 600, textAlign: 'right', margin: 0 }}>{formatSEK(totalManadExkl)}</p>
                        {indexAr !== 0 && <>
                          <p style={{ color: C.ok, margin: 0 }}>Indextillägg/mån:</p>
                          <p style={{ fontWeight: 600, color: C.ok, textAlign: 'right', margin: 0 }}>+{formatSEK(r2(indexAr / 12))}</p>
                          <p style={{ color: C.text, fontWeight: 600, margin: 0, ...topBorder }}>Med index/mån exkl.:</p>
                          <p style={{ fontWeight: 700, textAlign: 'right', margin: 0, ...topBorder }}>{formatSEK(totalManadMedIndex)}</p>
                          <p style={{ color: C.muted, margin: 0 }}>Med index/mån inkl.:</p>
                          <p style={{ fontWeight: 600, textAlign: 'right', margin: 0 }}>{formatSEK(r2(totalManadMedIndex * 1.25))}</p>
                        </>}
                        {indexAr === 0 && <>
                          <p style={{ color: C.muted, margin: 0 }}>Total/mån inkl. moms:</p>
                          <p style={{ fontWeight: 600, textAlign: 'right', margin: 0 }}>{formatSEK(r2(totalManadExkl * 1.25))}</p>
                        </>}
                        <p style={{ color: C.muted, margin: 0, ...topBorder }}>Total/år exkl. moms:</p>
                        <p style={{ fontWeight: 700, textAlign: 'right', margin: 0, ...topBorder }}>{formatSEK(totalArMedIndex)}</p>
                        <p style={{ color: C.muted, margin: 0 }}>Total/år inkl. moms:</p>
                        <p style={{ fontWeight: 700, textAlign: 'right', margin: 0 }}>{formatSEK(r2(totalArMedIndex * 1.25))}</p>
                        {yta > 0 && <>
                          <p style={{ color: C.muted, margin: 0, ...topBorder }}>kr/kvm/år {markYta > 0 && lokalYta > 0 ? '(snitt exkl.):' : markYta > 0 ? 'mark (exkl.):' : 'lokal (exkl.):'}</p>
                          <p style={{ fontWeight: 600, color: C.blue, textAlign: 'right', margin: 0, ...topBorder }}>{r2(totalArMedIndex / yta).toLocaleString('sv-SE')} kr</p>
                          {markYta > 0 && lokalYta > 0 && <p style={{ fontSize: 11, color: C.muted2, gridColumn: '1 / -1', margin: 0 }}>Lokal {lokalYta} kvm + Mark {markYta} kvm = {yta} kvm total — hyra ej specificerad per yttyp.</p>}
                        </>}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* KPI-indexering */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}` }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: C.text2, margin: 0 }}>KPI-indexering</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: C.muted2 }}>{anvandIndex ? 'Aktiv' : 'Av'}</span>
                    <Toggle on={anvandIndex} onClick={() => setAnvandIndex(!anvandIndex)} />
                  </div>
                </div>
                {!anvandIndex ? (
                  <p style={{ fontSize: 11, color: C.muted2, fontStyle: 'italic' }}>Indexreglering är avstängd för detta avtal.</p>
                ) : <>
                  <p style={{ fontSize: 11, color: C.muted2, marginBottom: 12 }}>Ange basindex från kontraktsdatumet. Indextillägg beräknas automatiskt vid fakturering.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={lbl}>Basår</label>
                      <input spellCheck={false} type="number" min="1980" max="2030" style={inp} onFocus={fo} onBlur={fb} value={placeraForm.basindexAr} onChange={e => {
                        const ar = e.target.value
                        setPlaceraForm(prev => ({ ...prev, basindexAr: ar }))
                        if (ar.length === 4) fetchKpiForBasindex(ar, placeraForm.basindexManad)
                      }} placeholder="2023" />
                    </div>
                    <div>
                      <label style={lbl}>Basmånad</label>
                      <select style={inp} onFocus={fo} onBlur={fb} value={placeraForm.basindexManad} onChange={e => {
                        const manad = e.target.value
                        setPlaceraForm(prev => ({ ...prev, basindexManad: manad }))
                        if (placeraForm.basindexAr) fetchKpiForBasindex(placeraForm.basindexAr, manad)
                      }}>
                        {MONTHS_SV.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Basindextal {kpiLoading && <span style={{ color: C.gold }}>⏳</span>}</label>
                      <input spellCheck={false} type="number" step="0.01" style={inp} onFocus={fo} onBlur={fb} value={placeraForm.basindexVarde} onChange={e => { setPlaceraForm({ ...placeraForm, basindexVarde: e.target.value }); setKpiInfo(null) }} placeholder="Hämtas automatiskt" />
                      {kpiInfo && <p style={{ fontSize: 11, color: C.ok, marginTop: 4 }}>SCB: {kpiInfo.period} = {kpiInfo.value}</p>}
                    </div>
                  </div>

                  {placeraForm.basindexVarde && aktuellKpi && (() => {
                    const r2 = (n: number) => Math.round(n * 100) / 100
                    const bas = parseFloat(placeraForm.basindexVarde)
                    const nu = aktuellKpi.value
                    const procent = ((nu - bas) / bas) * 100
                    const hyraRadP = avtalsrader.find(r => r.artikelkod === 'HYR')
                    const arshyra = hyraRadP?.arsbelopp ? parseFloat(hyraRadP.arsbelopp) : (hyraRadP?.belopp ? parseFloat(hyraRadP.belopp) * 12 : 0)
                    if (arshyra <= 0) return null
                    const hojningAr = r2(arshyra * (procent / 100))
                    const nyHyraAr = arshyra + hojningAr
                    const gridCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: 4, fontSize: 13 }
                    const topB: React.CSSProperties = { borderTop: '1px solid rgba(74,222,128,0.25)', paddingTop: 6 }
                    return (
                      <div style={{ marginTop: 12, borderRadius: 8, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', padding: '12px 16px' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: C.ok, marginBottom: 8 }}>Beräknad indexhöjning</p>
                        <div style={gridCol}>
                          <p style={{ color: C.ok, margin: 0 }}>Basindex ({kpiInfo?.period}):</p>
                          <p style={{ fontWeight: 500, color: C.text, textAlign: 'right', margin: 0 }}>{bas.toFixed(2)}</p>
                          <p style={{ color: C.ok, margin: 0 }}>Aktuellt ({aktuellKpi.period}):</p>
                          <p style={{ fontWeight: 500, color: C.text, textAlign: 'right', margin: 0 }}>{nu.toFixed(2)}</p>
                          <p style={{ color: C.ok, margin: 0 }}>Förändring:</p>
                          <p style={{ fontWeight: 600, color: procent >= 0 ? C.ok : C.danger, textAlign: 'right', margin: 0 }}>{procent >= 0 ? '+' : ''}{procent.toFixed(2)} %</p>
                          <p style={{ color: C.ok, margin: 0, ...topB }}>Indextillägg/år:</p>
                          <p style={{ fontWeight: 700, color: C.text, textAlign: 'right', margin: 0, ...topB }}>{formatSEK(hojningAr)}</p>
                          <p style={{ color: C.ok, margin: 0 }}>Ny hyra/år:</p>
                          <p style={{ fontWeight: 700, color: C.text, textAlign: 'right', margin: 0 }}>{formatSEK(nyHyraAr)}</p>
                          <p style={{ color: C.ok, margin: 0 }}>Ny hyra/mån:</p>
                          <p style={{ fontWeight: 700, color: C.text, textAlign: 'right', margin: 0 }}>{formatSEK(r2(nyHyraAr / 12))}</p>
                        </div>
                      </div>
                    )
                  })()}
                </>}
              </div>

            </div>
          )}
        </div>
      </SlideOver>
    </div>
  )
}
