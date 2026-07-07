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

import React, { useEffect, useState } from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useConfirm } from '@/components/ConfirmDialog'
import { useBolag } from '@/components/fastigheter/BolagContext'
import Sokfalt from '@/components/Sokfalt'

interface Avlasning { id: string; datum: string; varde: number; avlast_av: string | null }
interface Matare {
  id: string; matarnummer: string; beskrivning: string | null; schablon_kwh: number | null
  fastighet_id: string; lokal_id: string | null; aktiv: boolean
  fastighet: { id: string; namn: string }
  avlasningar: Avlasning[]
  _count: { avlasningar: number }
}
interface Debitering {
  id: string; hyresgast_namn: string; forbrukning: number | null; pris_per_kwh: number; belopp: number; status: string
}
interface LevFaktura {
  id: string; fastighet_id: string; period_fran: string; period_till: string
  total_kwh: number | null; total_belopp: number; pris_per_kwh: number | null
  fakturanummer: string | null; leverantor: string | null; status: string
  typ: 'nat' | 'handel' | 'ovrigt' | null
  fastighet: { id: string; namn: string }
  debiteringar: Debitering[]
}
interface OmgangDebitering {
  id: string; hyresgast_namn: string; forbrukning: number | null; pris_per_kwh: number; belopp: number; status: string
  matare_id: string | null
}
interface Omgang {
  id: string; fastighet_id: string; period_fran: string; period_till: string
  total_kwh: number | null; total_kostnad: number; blandpris: number | null; status: string; created_at: string
  fastighet: { id: string; namn: string }
  fakturor: LevFaktura[]
  debiteringar: OmgangDebitering[]
}

const TYP_LABELS: Record<string, string> = { nat: 'Nät', handel: 'Handel', ovrigt: 'Övrigt' }
const typPill = (typ: string | null): React.CSSProperties | null => {
  if (typ === 'nat') return { background: 'rgba(96,165,250,0.14)', color: '#60a5fa' }
  if (typ === 'handel') return { background: 'rgba(232,201,106,0.14)', color: '#E8C96A' }
  if (typ === 'ovrigt') return { background: 'rgba(136,136,136,0.14)', color: '#aaa' }
  return null
}
interface Fastighet { id: string; namn: string; adress?: string | null; ort?: string | null; bolag_id?: string | null; bolag?: { namn: string } | null }
interface Lokal {
  id: string; namn: string; fastighet_id: string
  hyresavtal?: { hyresavtal: { hyresgast: { namn: string } } }[]
}

type Tab = 'avlasningar' | 'leverantor' | 'debitering' | 'analys'

const formatSEK = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr'
const formatDate = (d: string) => new Date(d).toLocaleDateString('sv-SE')
const fmtKwh = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + ' kWh'

// ---- Lokala stilhjälpare (bygger på styles.ts-tokens) ----------------------
const card: React.CSSProperties = { borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '12px 16px', background: C.panel2, borderBottom: `1px solid ${C.borderSoft}` }
const th: React.CSSProperties = { padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.muted2, textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '10px 16px', fontSize: 13, color: C.text2, borderTop: `1px solid ${C.borderSoft}` }
const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600, background: bg, color })
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 13, padding: 4, borderRadius: 6 }

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
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const visaToast = (text: string, type: 'success' | 'error' = 'success') => { setToast({ text, type }); setTimeout(() => setToast(null), 4500) }
  const [valdaOmgangar, setValdaOmgangar] = useState<Set<string>>(new Set())
  const toggleOmgang = (id: string) => setValdaOmgangar(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Fritextsök (delas av mätaravläsnings- och leverantörsflikarna)
  const [sok, setSok] = useState('')
  // Sortering för mätaravläsnings-tabellen (per hyresgästkort)
  const [avlSort, setAvlSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'matpunkt', dir: 'asc' })
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
  const [levSort, setLevSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'period', dir: 'desc' })
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
  const [matareForm, setMatareForm] = useState({ matarnummer: '', fastighetId: '', lokalId: '', beskrivning: '', schablonKwh: '' })
  const [avlHyresgast, setAvlHyresgast] = useState('')
  const [avlValues, setAvlValues] = useState<Record<string, string>>({})
  const [avlPrev, setAvlPrev] = useState<Record<string, string>>({})
  const [avlDatum, setAvlDatum] = useState(new Date().toISOString().split('T')[0])
  const [avlPrevDatum, setAvlPrevDatum] = useState('')
  const [avlAvlastAv, setAvlAvlastAv] = useState('')
  const [levForm, setLevForm] = useState({ fastighetId: '', periodFran: '', periodTill: '', totalKwh: '', totalBelopp: '', fakturanummer: '', leverantor: '', typ: '' })

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

  const getSenaste = (m: Matare) => m.avlasningar?.[0] || null
  const getForeg = (m: Matare) => m.avlasningar?.[1] || null

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
      alert('Kunde inte spara fakturan: ' + (data.error || res.statusText))
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
      alert('Kunde inte skapa debiteringsomgång: ' + (data.error || res.statusText))
      return
    }
    setShowNewOmgang(false); load()
  }
  const deleteOmgang = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort hela debiteringsomgången?', danger: true, confirmLabel: 'Ta bort' }))) return
    await fetch(`/api/fastigheter/el-omgang/${id}`, { method: 'DELETE' })
    load()
  }
  // Kör faktureringen för EN omgång; returnerar antal skapade fakturor eller kastar.
  const fakturerOmgang = async (id: string): Promise<number> => {
    const res = await fetch(`/api/fastigheter/el-omgang/${id}/fakturera`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || res.statusText)
    return data.antal ?? 0
  }
  const skapaElFakturor = async (id: string) => {
    if (!(await confirm({ message: 'Skapa el-fakturor för de ofakturerade debiteringarna? En separat faktura skapas per hyresgäst.', confirmLabel: 'Skapa fakturor' }))) return
    try {
      const antal = await fakturerOmgang(id)
      visaToast(`${antal} el-faktura${antal === 1 ? '' : 'or'} skapad${antal === 1 ? '' : 'e'} – finns nu i Fakturering`)
      load()
    } catch (e) { visaToast('Kunde inte skapa el-fakturor: ' + (e instanceof Error ? e.message : 'fel'), 'error') }
  }
  const skapaElFakturorBulk = async () => {
    const ids = [...valdaOmgangar]
    if (ids.length === 0) return
    if (!(await confirm({ message: `Skapa el-fakturor för ${ids.length} debiteringsomgång${ids.length === 1 ? '' : 'ar'}? En separat faktura skapas per hyresgäst.`, confirmLabel: 'Skapa fakturor' }))) return
    let totalt = 0
    const fel: string[] = []
    for (const id of ids) {
      try { totalt += await fakturerOmgang(id) } catch (e) { fel.push(e instanceof Error ? e.message : 'fel') }
    }
    setValdaOmgangar(new Set())
    if (fel.length && !totalt) visaToast('Kunde inte skapa el-fakturor: ' + fel[0], 'error')
    else visaToast(`${totalt} el-faktura${totalt === 1 ? '' : 'or'} skapad${totalt === 1 ? '' : 'e'}${fel.length ? ` (${fel.length} misslyckades)` : ''} – finns nu i Fakturering`)
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
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 1000, padding: '12px 18px', borderRadius: 10, background: toast.type === 'success' ? 'rgba(74,222,128,0.14)' : 'rgba(248,113,113,0.14)', border: `1px solid ${toast.type === 'success' ? C.ok : C.danger}`, color: toast.type === 'success' ? C.ok : C.danger, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.35)', maxWidth: 380 }}>
          {toast.text}
        </div>
      )}
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

      {/* MÄTARAVLÄSNINGAR */}
      {tab === 'avlasningar' && (() => {
        const sokQ = sok.trim().toLowerCase()
        // Filtrera på bolag (via fastighet) + fritext (mätpunkt, hyresgäst, fastighet, mätarnr)
        const synligaMatare = matare
          .filter(m => bolagMatch(m.fastighet_id))
          .filter(m => {
            if (!sokQ) return true
            return [getHyresgast(m), getLokalNamn(m), m.beskrivning, m.matarnummer, m.fastighet?.namn]
              .some(v => (v || '').toLowerCase().includes(sokQ))
          })
        const grouped: Record<string, { namn: string; matare: Matare[] }> = {}
        synligaMatare.forEach(m => {
          const namn = getHyresgast(m)
          if (!grouped[namn]) grouped[namn] = { namn, matare: [] }
          grouped[namn].matare.push(m)
        })
        const hyresgastLista = Object.values(grouped).sort((a, b) => a.namn.localeCompare(b.namn))

        // Sorteringsnyckel för en mätarrad
        const avlSortVal = (m: Matare, key: string): string | number => {
          const s = getSenaste(m), f = getForeg(m)
          switch (key) {
            case 'matpunkt': return (m.beskrivning || getLokalNamn(m) || 'Huvudmätare').toLowerCase()
            case 'senaste': return s ? new Date(s.datum).getTime() : -1
            case 'varde': return s ? s.varde : -Infinity
            case 'forbrukning': return s && f ? s.varde - f.varde : -Infinity
            default: return 0
          }
        }
        const sorteradeMatare = (rader: Matare[]) => [...rader].sort((a, b) => {
          const va = avlSortVal(a, avlSort.key), vb = avlSortVal(b, avlSort.key)
          const c = va < vb ? -1 : va > vb ? 1 : 0
          return avlSort.dir === 'asc' ? c : -c
        })
        const AVL_COLS: { label: string; key: string | null }[] = [
          { label: 'Mätpunkt', key: 'matpunkt' }, { label: 'Senaste avläsning', key: 'senaste' },
          { label: 'Mätarvärde', key: 'varde' }, { label: 'Förbrukning', key: 'forbrukning' }, { label: '', key: null },
        ]

        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
            <Sokfalt value={sok} onChange={setSok} placeholder="Sök mätpunkt, hyresgäst, fastighet..." style={{ width: isMobile ? '100%' : 280 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, ...(isMobile ? { flexDirection: 'column' } : {}) }}>
            <button
              onClick={() => { setMatareForm({ matarnummer: '', fastighetId: fastigheter[0]?.id || '', lokalId: '', beskrivning: '', schablonKwh: '' }); setShowNewMatare(true) }}
              style={{ ...btnGhost, ...(isMobile ? { width: '100%' } : {}) }}
            >
              + Ny mätpunkt
            </button>
            <button
              onClick={() => { setShowNewAvl(true); setAvlHyresgast(''); setAvlValues({}); setAvlPrev({}); setAvlDatum(new Date().toISOString().split('T')[0]); const pd = new Date(); pd.setMonth(pd.getMonth() - 1); setAvlPrevDatum(pd.toISOString().split('T')[0]); setAvlAvlastAv('') }}
              style={{ ...btnPrimary, opacity: matare.length === 0 ? 0.5 : 1, ...(isMobile ? { width: '100%' } : {}) }}
              disabled={matare.length === 0}
            >
              ⚡ Ny avläsning
            </button>
          </div>

          {matare.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', ...card }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
              <p style={{ color: C.muted, margin: 0 }}>Inga mätare registrerade</p>
              <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Registrera en mätpunkt via en hyresgäst för att komma igång</p>
            </div>
          ) : hyresgastLista.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', ...card }}>
              <p style={{ color: C.muted2, margin: 0, fontSize: 13 }}>Inga mätpunkter matchar filtret</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {hyresgastLista.map(g => (
                <div key={g.namn} style={card}>
                  <div style={{ ...cardHead, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: C.gold }}>⚡</span>
                      <h3 style={{ fontWeight: 700, fontSize: 13, color: C.text, margin: 0 }}>{g.namn}</h3>
                      <span style={{ fontSize: 12, color: C.muted2 }}>{g.matare[0].fastighet.namn}</span>
                    </div>
                    <button onClick={() => {
                      const m = g.matare[0]
                      setMatareForm({ matarnummer: '', fastighetId: m.fastighet_id, lokalId: m.lokal_id || '', beskrivning: '', schablonKwh: '' })
                      setShowNewMatare(true)
                    }} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>+ Ny mätpunkt</button>
                  </div>
                  {isMobile ? (
                    // MOBIL: kortlayout per mätpunkt (ingen horisontell scroll)
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {sorteradeMatare(g.matare).map(m => {
                        const s = getSenaste(m), f = getForeg(m)
                        const diff = s && f ? s.varde - f.varde : null
                        const days = s ? Math.round((Date.now() - new Date(s.datum).getTime()) / 864e5) : null
                        const historik = m.avlasningar || []
                        const oppen = expanded.has(m.id)
                        const kanExpandera = historik.length > 0
                        return (
                          <div key={m.id} style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div
                                onClick={() => kanExpandera && setExpanded(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })}
                                style={{ flex: 1, cursor: kanExpandera ? 'pointer' : 'default' }}
                              >
                                <p style={{ color: C.text, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {kanExpandera && <span style={{ fontSize: 9, color: C.muted2, transform: oppen ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s', display: 'inline-block' }}>▶</span>}
                                  {m.beskrivning || getLokalNamn(m) || 'Huvudmätare'}
                                  {kanExpandera && <span style={{ fontSize: 11, fontWeight: 500, color: C.muted2 }}>({historik.length} avläsn.)</span>}
                                </p>
                                {m.schablon_kwh ? <p style={{ fontSize: 11, color: C.blue, margin: '2px 0 0' }}>Schablon {m.schablon_kwh} kWh/mån</p> : null}
                              </div>
                              <button onClick={async e => { e.stopPropagation(); if (await confirm({ message: 'Ta bort mätpunkt?', danger: true, confirmLabel: 'Ta bort' })) { await fetch(`/api/fastigheter/elmatare/${m.id}`, { method: 'DELETE' }); load() } }} style={iconBtn}>🗑️</button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginTop: 10, fontSize: 12 }}>
                              <div>
                                <span style={{ color: C.muted2 }}>Senaste: </span>
                                {s ? <span style={{ color: C.text2 }}>{formatDate(s.datum)} <span style={{ fontWeight: 600, color: days! > 90 ? C.danger : days! > 30 ? C.warn : C.ok }}>({days}d)</span></span> : <span style={{ color: C.muted2 }}>—</span>}
                              </div>
                              <div>
                                <span style={{ color: C.muted2 }}>Mätarvärde: </span>
                                <span style={{ fontFamily: 'monospace', color: C.text }}>{s ? s.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) : '—'}</span>
                              </div>
                              <div>
                                <span style={{ color: C.muted2 }}>Förbrukning: </span>
                                {diff != null ? <span style={{ fontWeight: 600, color: C.gold }}>{fmtKwh(diff)}</span> : <span style={{ color: C.muted2 }}>—</span>}
                              </div>
                            </div>
                            {oppen && kanExpandera && (
                              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {historik.map((a, i) => {
                                  const foreg = historik[i + 1]
                                  const forb = foreg ? a.varde - foreg.varde : null
                                  return (
                                    <div key={a.id} style={{ borderRadius: 8, background: C.panel2, padding: 10, fontSize: 12 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                        <span style={{ color: C.text2 }}>{formatDate(a.datum)}</span>
                                        <span style={{ fontFamily: 'monospace', color: C.text }}>{a.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 })}</span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4, color: C.muted2 }}>
                                        <span>Avläst av: {a.avlast_av || '—'}</span>
                                        <span style={{ color: forb != null ? C.gold : C.muted2, fontWeight: forb != null ? 600 : 400 }}>{forb != null ? fmtKwh(forb) : '—'}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col />
                      <col style={{ width: 190 }} />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 150 }} />
                      <col style={{ width: 56 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        {AVL_COLS.map((c, i) => {
                          const aktiv = c.key && avlSort.key === c.key
                          return (
                            <th key={i} onClick={() => c.key && toggleAvlSort(c.key)}
                              style={{ ...th, cursor: c.key ? 'pointer' : 'default', color: aktiv ? C.gold : th.color, userSelect: 'none', whiteSpace: 'nowrap' }}>
                              {c.label}{aktiv ? (avlSort.dir === 'asc' ? ' ▲' : ' ▼') : c.key ? <span style={{ opacity: 0.25 }}> ⇅</span> : ''}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sorteradeMatare(g.matare).map(m => {
                        const s = getSenaste(m), f = getForeg(m)
                        const diff = s && f ? s.varde - f.varde : null
                        const days = s ? Math.round((Date.now() - new Date(s.datum).getTime()) / 864e5) : null
                        const historik = m.avlasningar || []
                        const oppen = expanded.has(m.id)
                        const kanExpandera = historik.length > 0
                        return (
                          <React.Fragment key={m.id}>
                          <tr
                            onClick={() => kanExpandera && setExpanded(prev => { const n = new Set(prev); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })}
                            style={{ cursor: kanExpandera ? 'pointer' : 'default' }}
                            onMouseEnter={e => { if (kanExpandera) e.currentTarget.style.background = C.panel2 }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <td style={td}>
                              <p style={{ color: C.text, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {kanExpandera && <span style={{ fontSize: 9, color: C.muted2, transform: oppen ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s', display: 'inline-block' }}>▶</span>}
                                {m.beskrivning || getLokalNamn(m) || 'Huvudmätare'}
                                {kanExpandera && <span style={{ fontSize: 11, fontWeight: 500, color: C.muted2 }}>({historik.length} avläsn.)</span>}
                              </p>
                              {m.schablon_kwh ? <p style={{ fontSize: 11, color: C.blue, margin: 0 }}>Schablon {m.schablon_kwh} kWh/mån</p> : null}
                            </td>
                            <td style={td}>
                              {s ? <span>{formatDate(s.datum)} <span style={{ fontSize: 11, fontWeight: 600, color: days! > 90 ? C.danger : days! > 30 ? C.warn : C.ok }}>({days}d)</span></span>
                                : <span style={{ color: C.muted2 }}>—</span>}
                            </td>
                            <td style={{ ...td, fontFamily: 'monospace', color: C.text }}>{s ? s.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 }) : '—'}</td>
                            <td style={td}>{diff != null ? <span style={{ fontWeight: 600, color: C.gold }}>{fmtKwh(diff)}</span> : '—'}</td>
                            <td style={td}>
                              <button onClick={async e => { e.stopPropagation(); if (await confirm({ message: 'Ta bort mätpunkt?', danger: true, confirmLabel: 'Ta bort' })) { await fetch(`/api/fastigheter/elmatare/${m.id}`, { method: 'DELETE' }); load() } }} style={iconBtn}>🗑️</button>
                            </td>
                          </tr>
                          {oppen && (
                            <tr>
                              <td colSpan={5} style={{ padding: 0, background: C.panel2, borderTop: `1px solid ${C.borderSoft}` }}>
                                <div style={{ padding: '10px 16px 14px 34px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: 8, padding: '4px 0', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.muted2, textTransform: 'uppercase', borderBottom: `1px solid ${C.borderSoft}` }}>
                                    <div>Datum</div><div>Mätarvärde</div><div>Förbrukning</div><div>Avläst av</div>
                                  </div>
                                  {historik.map((a, i) => {
                                    const foreg = historik[i + 1]
                                    const forb = foreg ? a.varde - foreg.varde : null
                                    return (
                                      <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: 8, padding: '6px 0', fontSize: 12, color: C.text2, borderBottom: `1px solid ${C.borderSoft}` }}>
                                        <div>{formatDate(a.datum)}</div>
                                        <div style={{ fontFamily: 'monospace', color: C.text }}>{a.varde.toLocaleString('sv-SE', { maximumFractionDigits: 2 })}</div>
                                        <div style={{ color: forb != null ? C.gold : C.muted2, fontWeight: forb != null ? 600 : 400 }}>{forb != null ? fmtKwh(forb) : '—'}</div>
                                        <div style={{ color: C.muted }}>{a.avlast_av || '—'}</div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        )
      })()}

      {/* LEVERANTÖRSFAKTURA */}
      {tab === 'leverantor' && (() => {
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
      })()}

      {/* DEBITERING — debiteringsomgångar (nät + handel → blandpris) */}
      {tab === 'debitering' && (() => {
        // Respektera bolagsväljaren (omgång bär fastighet_id)
        const synligaOmgangar = omgangar.filter(o => bolagMatch(o.fastighet_id))
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            {valdaOmgangar.size > 0 && (
              <button onClick={skapaElFakturorBulk} style={{ padding: '10px 18px', borderRadius: 8, background: C.gold, border: 'none', color: '#1a1a1a', fontSize: 13, fontWeight: 700, cursor: 'pointer', ...(isMobile ? { width: '100%' } : {}) }}>
                Skapa el-fakturor för {valdaOmgangar.size} omgång{valdaOmgangar.size === 1 ? '' : 'ar'}
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
                      {o.fakturor.map(f => (
                        <span key={f.id} style={pill(typPill(f.typ)?.background as string || 'rgba(136,136,136,0.14)', typPill(f.typ)?.color as string || '#aaa')}>
                          {f.typ ? TYP_LABELS[f.typ] : 'Faktura'} · {formatSEK(f.total_belopp)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={valdaOmgangar.has(o.id)} onClick={e => e.stopPropagation()} onChange={() => toggleOmgang(o.id)} style={{ width: 16, height: 16, accentColor: C.gold, cursor: 'pointer' }} title="Välj för att skapa el-fakturor för flera omgångar" />
                    <span style={pill('rgba(232,201,106,0.12)', C.gold)}>{o.status}</span>
                    <button onClick={() => skapaElFakturor(o.id)} style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(232,201,106,0.12)', border: `1px solid ${C.gold}`, color: C.gold, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Skapa el-fakturor</button>
                    <button onClick={() => deleteOmgang(o.id)} style={iconBtn}>🗑️</button>
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
                          return (
                            <div key={g.namn} style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px' }}>
                              <div style={{ fontWeight: 700, color: C.text, fontSize: 13, marginBottom: 8 }}>{g.namn}</div>
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
                    ) : grupper.map(g => {
                      const gKwh = g.rader.reduce((s, d) => s + (d.forbrukning ?? 0), 0)
                      const gBelopp = g.rader.reduce((s, d) => s + d.belopp, 0)
                      return (
                        <React.Fragment key={g.namn}>
                          {g.rader.map((d, i) => (
                            <tr key={d.id}>
                              <td style={{ ...td, fontWeight: 600, color: C.text, borderTop: i === 0 ? `1px solid ${C.borderSoft}` : 'none' }}>{i === 0 ? g.namn : ''}</td>
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
      })()}

      {/* ANALYS */}
      {tab === 'analys' && (() => {
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
      })()}

      </>}

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
            <input style={inp} onFocus={fo} onBlur={fb} value={matareForm.beskrivning} onChange={e => setMatareForm({ ...matareForm, beskrivning: e.target.value })} placeholder="T.ex. Verkstad, Bod, Uppvärmning" autoFocus />
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
          const nat = grupp.filter(f => f.typ === 'nat')
          totalKwh += nat.length > 0
            ? nat.reduce((s, f) => s + (f.total_kwh ?? 0), 0)
            : grupp.reduce((max, f) => Math.max(max, f.total_kwh ?? 0), 0)
        }
        const blandpris = totalKwh > 0 ? totalKostnad / totalKwh : 0
        const { fran, till } = kvartalPeriod(omgangAr, omgangKvartal)
        const arOptions = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i)
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
    </div>
  )
}
