'use client'

// TEMPLATE-SIDA (mönster för resten av migrationen).
// Källa: src/app/fastigheter/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold-styles, emoji-ikoner, @/lib/supabase-baserad data via
// /api/fastigheter/objekt. useBolag från porterad context. SlideOver + tokens från
// @/components/fastigheter.
//
// VIKTIGT om fältnamn: Supabase returnerar snake_case-kolumner (f_byggnad: ombyggnads_ar,
// uthyrbar_yta ...). Käll-appens UI använde camelCase. Här är render-koden anpassad till
// snake_case. Byggnadsformuläret POSTar camelCase → parseByggnadBody() översätter.

import { useEffect, useState } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useBolag } from '@/components/fastigheter/BolagContext'
import SlideOver from '@/components/fastigheter/SlideOver'
import Sokfalt from '@/components/Sokfalt'
import { useConfirm } from '@/components/ConfirmDialog'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost, btnDanger, fmtKvm, energiColor } from '@/components/fastigheter/styles'

interface Byggnad {
  id: string
  namn: string
  adress: string | null
  byggnadsar: number | null
  ombyggnads_ar: number | null
  totalyta: number | null
  uthyrbar_yta: number | null
  energiklass: string | null
  uppvarmning: string | null
  hiss: boolean
  oljeavskiljare: boolean
  sprinkler: boolean
  laddstolpar: boolean
  fiber: boolean
  manuellaportar: number | null
  elportar: number | null
  beskrivning: string | null
  beteckning_id?: string | null
}

interface Beteckning { id: string; beteckning: string; taxeringsvarde: number | null }

interface Fastighet {
  id: string
  namn: string
  adress: string
  stad: string
  postnummer: string
  bolag_id?: string | null
  bolag?: { id: string; namn: string } | null
  fastighetsbeteckning?: string | null
  beteckningar?: Beteckning[]
  taxeringsvarde?: number | null
  kommentar?: string | null
  lokaler?: { id: string }[]
  byggnader?: Byggnad[]
}

interface FormData {
  namn: string; adress: string; stad: string; postnummer: string; bolagId: string
  fastighetsbeteckning: string; taxeringsvarde: string; kommentar: string
}

interface ByggnadForm {
  namn: string; beteckningId: string; adress: string; byggnadsar: string; ombyggnadsAr: string
  totalyta: string; uthyrbarYta: string; energiklass: string; uppvarmning: string
  hiss: boolean; oljeavskiljare: boolean; sprinkler: boolean; laddstolpar: boolean; fiber: boolean
  manuellaportar: string; elportar: string; beskrivning: string
}

const emptyByggnadForm: ByggnadForm = {
  namn: '', beteckningId: '', adress: '', byggnadsar: '', ombyggnadsAr: '',
  totalyta: '', uthyrbarYta: '', energiklass: '', uppvarmning: '',
  hiss: false, oljeavskiljare: false, sprinkler: false, laddstolpar: false, fiber: false,
  manuellaportar: '', elportar: '', beskrivning: '',
}

const empty: FormData = {
  namn: '', adress: '', stad: '', postnummer: '', bolagId: '',
  fastighetsbeteckning: '', taxeringsvarde: '', kommentar: '',
}

const energiklasser = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const uppvarmningar = ['Fjärrvärme', 'Bergvärme', 'Luft/vatten', 'El', 'Olja', 'Gas', 'Pellets']

const formatSEK = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)

const section: React.CSSProperties = { marginBottom: 28 }
const secLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: C.muted2, textTransform: 'uppercase', marginBottom: 14 }
const gridInput: React.CSSProperties = { ...inp, background: C.panel }

export default function FastigheterObjektPage() {
  const isMobile = useIsMobile()
  const [items, setItems] = useState<Fastighet[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Fastighet | null>(null)
  const [form, setForm] = useState<FormData>(empty)
  const [saving, setSaving] = useState(false)
  const [nyaBeteckningar, setNyaBeteckningar] = useState<{ beteckning: string; taxeringsvarde: string }[]>([{ beteckning: '', taxeringsvarde: '' }])
  const { bolagLista, valtBolagId } = useBolag()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<string>('namn')
  const [sortDir, setSortDir] = useState<1 | -1>(1)

  const [byggnader, setByggnader] = useState<Byggnad[]>([])
  const [addingByggnad, setAddingByggnad] = useState(false)
  const [byggnadForm, setByggnadForm] = useState<ByggnadForm>(emptyByggnadForm)
  const [editingByggnadId, setEditingByggnadId] = useState<string | null>(null)
  const [savingByggnad, setSavingByggnad] = useState(false)

  const load = () => {
    const url = valtBolagId ? `/api/fastigheter/objekt?bolagId=${valtBolagId}` : '/api/fastigheter/objekt'
    fetch(url)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setItems(data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [valtBolagId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    setEditing(null)
    setForm({ ...empty, bolagId: valtBolagId || '' })
    setByggnader([])
    setAddingByggnad(false)
    setEditingByggnadId(null)
    setNyaBeteckningar([{ beteckning: '', taxeringsvarde: '' }])
    setOpen(true)
  }

  const openEdit = (f: Fastighet) => {
    setEditing(f)
    setForm({
      namn: f.namn, adress: f.adress, stad: f.stad, postnummer: f.postnummer,
      bolagId: f.bolag_id || '',
      fastighetsbeteckning: f.fastighetsbeteckning || '',
      taxeringsvarde: f.taxeringsvarde ? String(f.taxeringsvarde) : '',
      kommentar: f.kommentar || '',
    })
    setByggnader(f.byggnader || [])
    setAddingByggnad(false)
    setEditingByggnadId(null)
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    const url = editing ? `/api/fastigheter/objekt/${editing.id}` : '/api/fastigheter/objekt'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!editing && res.ok) {
      const created = await res.json()
      for (const b of nyaBeteckningar.filter(b => b.beteckning)) {
        await fetch('/api/fastigheter/beteckningar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fastighetId: created.id, beteckning: b.beteckning, taxeringsvarde: b.taxeringsvarde }),
        })
      }
    }
    if (addingByggnad && byggnadForm.namn && editing) {
      if (editingByggnadId) {
        await fetch(`/api/fastigheter/byggnader/${editingByggnadId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(byggnadForm),
        })
      } else {
        await fetch('/api/fastigheter/byggnader', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...byggnadForm, fastighetId: editing.id }),
        })
      }
      setAddingByggnad(false)
      setEditingByggnadId(null)
      setByggnadForm(emptyByggnadForm)
    }
    setSaving(false)
    setOpen(false)
    load()
  }

  const remove = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort fastighet? Alla tillhörande lokaler och byggnader tas också bort.', danger: true, confirmLabel: 'Ta bort' }))) return
    await fetch(`/api/fastigheter/objekt/${id}`, { method: 'DELETE' })
    setOpen(false)
    load()
  }

  const set = (key: keyof FormData, value: string) => setForm(f => ({ ...f, [key]: value }))
  const toggleByggnadBool = (key: keyof ByggnadForm) => setByggnadForm(f => ({ ...f, [key]: !f[key] }))

  const saveByggnad = async () => {
    if (!byggnadForm.namn || !editing) return
    setSavingByggnad(true)
    if (editingByggnadId) {
      const res = await fetch(`/api/fastigheter/byggnader/${editingByggnadId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(byggnadForm),
      })
      if (res.ok) {
        const updated = await res.json()
        setByggnader(prev => prev.map(b => b.id === editingByggnadId ? updated : b))
      }
    } else {
      const res = await fetch('/api/fastigheter/byggnader', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...byggnadForm, fastighetId: editing.id }),
      })
      if (res.ok) {
        const created = await res.json()
        setByggnader(prev => [...prev, created])
      }
    }
    setSavingByggnad(false)
    setAddingByggnad(false)
    setEditingByggnadId(null)
    setByggnadForm(emptyByggnadForm)
    load()
  }

  const deleteByggnad = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort byggnad?', danger: true, confirmLabel: 'Ta bort' }))) return
    await fetch(`/api/fastigheter/byggnader/${id}`, { method: 'DELETE' })
    setByggnader(prev => prev.filter(b => b.id !== id))
    load()
  }

  const startEditByggnad = (b: Byggnad) => {
    setEditingByggnadId(b.id)
    setByggnadForm({
      namn: b.namn,
      beteckningId: b.beteckning_id || '',
      adress: b.adress || '',
      byggnadsar: b.byggnadsar != null ? String(b.byggnadsar) : '',
      ombyggnadsAr: b.ombyggnads_ar != null ? String(b.ombyggnads_ar) : '',
      totalyta: b.totalyta != null ? String(b.totalyta) : '',
      uthyrbarYta: b.uthyrbar_yta != null ? String(b.uthyrbar_yta) : '',
      energiklass: b.energiklass || '',
      uppvarmning: b.uppvarmning || '',
      hiss: b.hiss, oljeavskiljare: b.oljeavskiljare,
      sprinkler: b.sprinkler, laddstolpar: b.laddstolpar, fiber: b.fiber,
      manuellaportar: b.manuellaportar != null ? String(b.manuellaportar) : '',
      elportar: b.elportar != null ? String(b.elportar) : '',
      beskrivning: b.beskrivning || '',
    })
    setAddingByggnad(true)
  }

  const cancelByggnad = () => {
    setAddingByggnad(false)
    setEditingByggnadId(null)
    setByggnadForm(emptyByggnadForm)
  }

  const totalBTA = byggnader.reduce((s, b) => s + (b.totalyta ?? 0), 0)
  const totalLOA = byggnader.reduce((s, b) => s + (b.uthyrbar_yta ?? 0), 0)

  const chip = (label: string, bg: string, color: string): React.CSSProperties => ({
    fontSize: 11, background: bg, color, borderRadius: 6, padding: '2px 6px',
  })

  // Sammanlagt taxeringsvärde per fastighet (summan av beteckningarnas värden, annars fältet).
  const taxSumma = (f: Fastighet) =>
    (f.beteckningar || []).reduce((s, b) => s + (b.taxeringsvarde ?? 0), 0) || (f.taxeringsvarde ?? 0)

  // Filtrera på sökord (namn, beteckning, adress, ort). Bolagsfiltret sköts redan
  // serverside via valtBolagId i load(), men vi respekterar det även här som skydd.
  const q = search.trim().toLowerCase()
  const filtered = items.filter(f => {
    if (valtBolagId && (f.bolag_id || '') !== valtBolagId) return false
    if (!q) return true
    const beteckningar = (f.beteckningar?.map(b => b.beteckning).join(' ') || '') + ' ' + (f.fastighetsbeteckning || '')
    return [f.namn, f.adress, f.stad, f.postnummer, beteckningar]
      .some(v => (v || '').toLowerCase().includes(q))
  })

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1))
    else { setSortCol(col); setSortDir(1) }
  }

  const sorted = [...filtered].sort((a, b) => {
    let av: string | number = '', bv: string | number = ''
    switch (sortCol) {
      case 'namn': av = a.namn || ''; bv = b.namn || ''; break
      case 'adress': av = a.adress || ''; bv = b.adress || ''; break
      case 'stad': av = a.stad || ''; bv = b.stad || ''; break
      case 'byggnader': av = a.byggnader?.length ?? 0; bv = b.byggnader?.length ?? 0; break
      case 'lokaler': av = a.lokaler?.length ?? 0; bv = b.lokaler?.length ?? 0; break
      case 'tax': av = taxSumma(a); bv = taxSumma(b); break
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv, 'sv') * sortDir
    }
    return av < bv ? -sortDir : av > bv ? sortDir : 0
  })

  const sortKnappar = [
    { key: 'namn', label: 'Namn' },
    { key: 'adress', label: 'Adress' },
    { key: 'stad', label: 'Ort' },
    { key: 'byggnader', label: 'Byggnader' },
    { key: 'lokaler', label: 'Lokaler' },
    { key: 'tax', label: 'Tax.värde' },
  ] as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, ...(isMobile ? { overflowX: 'hidden' } : {}) }}>
      <div style={{ display: 'flex', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch', gap: 12 } : { alignItems: 'center', justifyContent: 'space-between' }) }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Fastigheter</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            {q || (valtBolagId && filtered.length !== items.length)
              ? `${filtered.length} av ${items.length} fastigheter`
              : `${items.length} fastigheter registrerade`}
          </p>
        </div>
        <button onClick={openNew} style={isMobile ? { ...btnPrimary, width: '100%' } : btnPrimary}>+ Ny fastighet</button>
      </div>

      {/* Sök + sortering */}
      {(items.length > 0 || q) && !loading && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
          <Sokfalt value={search} onChange={setSearch} placeholder="Sök namn, beteckning, adress, ort..." style={{ width: isMobile ? '100%' : 280 }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', ...(isMobile ? { width: '100%' } : {}) }}>
            {sortKnappar.map(s => {
              const active = sortCol === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => toggleSort(s.key)}
                  style={{
                    flex: isMobile ? '1 1 auto' : undefined,
                    padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    borderRadius: 8, border: `1px solid ${active ? C.gold : C.border}`,
                    background: active ? C.goldSoft : 'transparent',
                    color: active ? C.gold : C.muted, whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}{active ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', background: C.panel, borderRadius: 12, border: `1px solid ${C.borderSoft}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <p style={{ color: C.muted }}>Inga fastigheter ännu</p>
          <button onClick={openNew} style={{ ...btnGhost, marginTop: 16, color: C.gold, borderColor: C.gold }}>Lägg till din första fastighet</button>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>
          Inga fastigheter matchar {q ? `sökningen "${search}"` : 'valt bolag'}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {sorted.map((f) => {
            const bBTA = (f.byggnader || []).reduce((s, b) => s + (b.totalyta ?? 0), 0)
            const bLOA = (f.byggnader || []).reduce((s, b) => s + (b.uthyrbar_yta ?? 0), 0)
            const anyHiss = (f.byggnader || []).some(b => b.hiss)
            const anyOlja = (f.byggnader || []).some(b => b.oljeavskiljare)
            const anySprinkler = (f.byggnader || []).some(b => b.sprinkler)
            const anyLadd = (f.byggnader || []).some(b => b.laddstolpar)
            const anyFiber = (f.byggnader || []).some(b => b.fiber)
            const totalManuella = (f.byggnader || []).reduce((s, b) => s + (b.manuellaportar ?? 0), 0)
            const totalElportar = (f.byggnader || []).reduce((s, b) => s + (b.elportar ?? 0), 0)
            const firstEklass = (f.byggnader || []).find(b => b.energiklass)?.energiklass
            return (
              <div key={f.id} onClick={() => openEdit(f)} style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, padding: 20, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ borderRadius: 8, background: C.goldSoft, padding: 8, flexShrink: 0, fontSize: 16, lineHeight: 1 }}>🏢</div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontWeight: 700, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.namn}</h3>
                      {(f.beteckningar?.length ?? 0) > 0
                        ? <p style={{ fontSize: 12, color: C.muted2, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.beteckningar!.map(b => b.beteckning).join(', ')}</p>
                        : f.fastighetsbeteckning && <p style={{ fontSize: 12, color: C.muted2, margin: 0 }}>{f.fastighetsbeteckning}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {firstEklass && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#000', padding: '2px 6px', borderRadius: 4, background: energiColor[firstEklass] || '#888' }}>{firstEklass}</span>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); remove(f.id) }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 14, padding: 4 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.muted, marginBottom: 12 }}>
                  <span>📍</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.adress}, {f.postnummer} {f.stad}</span>
                </div>
                {(f.byggnader?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.muted, marginBottom: 12 }}>
                    <span style={{ color: C.text2, fontWeight: 600 }}>{f.byggnader!.length} {f.byggnader!.length === 1 ? 'byggnad' : 'byggnader'}</span>
                    {bBTA > 0 && <span>BTA {fmtKvm(bBTA)}</span>}
                    {bLOA > 0 && <span style={{ color: C.ok }}>LOA {fmtKvm(bLOA)}</span>}
                  </div>
                )}
                {(anyHiss || anyOlja || anySprinkler || anyLadd || anyFiber || totalManuella > 0 || totalElportar > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {anyHiss && <span style={chip('🛗 Hiss', C.field, C.muted)}>🛗 Hiss</span>}
                    {anyOlja && <span style={chip('', 'rgba(251,191,36,0.1)', '#fbbf24')}>Oljeavsk.</span>}
                    {anySprinkler && <span style={chip('', 'rgba(96,165,250,0.1)', C.blue)}>Sprinkler</span>}
                    {anyLadd && <span style={chip('', 'rgba(74,222,128,0.1)', C.ok)}>⚡ Laddstolpe</span>}
                    {anyFiber && <span style={chip('', 'rgba(167,139,250,0.12)', '#a78bfa')}>Fiber</span>}
                    {totalManuella > 0 && <span style={chip('', C.field, C.muted)}>🚪 {totalManuella} man. port{totalManuella > 1 ? 'ar' : ''}</span>}
                    {totalElportar > 0 && <span style={chip('', 'rgba(234,179,8,0.1)', '#eab308')}>⚡ {totalElportar} el-port{totalElportar > 1 ? 'ar' : ''}</span>}
                  </div>
                )}
                <div style={{ paddingTop: 12, borderTop: `1px solid ${C.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: C.muted2 }}>{f.lokaler?.length ?? 0} lokaler</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const totalTax = (f.beteckningar || []).reduce((s, b) => s + (b.taxeringsvarde ?? 0), 0) || f.taxeringsvarde
                      return totalTax ? <span style={{ fontSize: 12, color: C.muted2 }}>{formatSEK(totalTax)}</span> : null
                    })()}
                    {f.bolag && <span style={{ fontSize: 11, background: C.goldSoft, color: C.gold, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{f.bolag.namn}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? editing.namn : 'Ny fastighet'}
        subtitle={editing?.fastighetsbeteckning || editing?.adress || undefined}
        width="lg"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            {editing && <button onClick={() => remove(editing.id)} style={btnDanger}>Ta bort</button>}
            <button onClick={() => setOpen(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={save} disabled={saving || !form.namn} style={{ ...btnPrimary, flex: 1, opacity: saving || !form.namn ? 0.5 : 1 }}>
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        }
      >
        <div style={{ padding: 24 }}>
          {/* Grunduppgifter */}
          <section style={section}>
            <h4 style={secLabel}>Grunduppgifter</h4>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Fastighetens namn</label>
                <input spellCheck={false} style={inp} onFocus={fo} onBlur={fb} value={form.namn} onChange={e => set('namn', e.target.value)} placeholder="T.ex. Storgatan 12" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={lbl}>Fastighetsbeteckningar</label>
                  {!editing && <button type="button" onClick={() => setNyaBeteckningar(prev => [...prev, { beteckning: '', taxeringsvarde: '' }])} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12 }}>+ Lägg till rad</button>}
                </div>

                {editing && (editing.beteckningar?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {editing.beteckningar!.map(b => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, border: `1px solid ${C.border}`, background: C.field, padding: '8px 12px' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.gold, flex: 1 }}>{b.beteckning}</span>
                        <span style={{ fontSize: 12, color: C.muted }}>{b.taxeringsvarde ? `${b.taxeringsvarde.toLocaleString('sv-SE')} kr` : 'Ej angivet'}</span>
                        <button onClick={async (e) => { e.preventDefault(); await fetch(`/api/fastigheter/beteckningar?id=${b.id}`, { method: 'DELETE' }); const res = await fetch('/api/fastigheter/objekt'); const data = await res.json(); if (Array.isArray(data)) { setItems(data); const upd = data.find((f: Fastighet) => f.id === editing!.id); if (upd) setEditing(upd) } }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {editing && (
                  <div style={{ display: 'flex', gap: 8, ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
                    <input spellCheck={false} style={{ ...inp, flex: 1 }} onFocus={fo} onBlur={fb} value={form.fastighetsbeteckning} onChange={e => set('fastighetsbeteckning', e.target.value)} placeholder="Ny beteckning" />
                    <input spellCheck={false} type="number" style={{ ...inp, ...(isMobile ? { width: '100%' } : { width: 140 }) }} onFocus={fo} onBlur={fb} value={form.taxeringsvarde} onChange={e => set('taxeringsvarde', e.target.value)} placeholder="Tax.värde" />
                    {form.fastighetsbeteckning && (
                      <button type="button" onClick={async () => {
                        await fetch('/api/fastigheter/beteckningar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fastighetId: editing.id, beteckning: form.fastighetsbeteckning, taxeringsvarde: form.taxeringsvarde }) })
                        set('fastighetsbeteckning', ''); set('taxeringsvarde', '')
                        const res = await fetch('/api/fastigheter/objekt'); const data = await res.json()
                        if (Array.isArray(data)) { setItems(data); const upd = data.find((f: Fastighet) => f.id === editing.id); if (upd) setEditing(upd) }
                      }} style={{ ...btnPrimary, whiteSpace: 'nowrap' }}>Lägg till</button>
                    )}
                  </div>
                )}

                {!editing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {nyaBeteckningar.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', ...(isMobile ? { flexDirection: 'column', alignItems: 'stretch' } : {}) }}>
                        <input spellCheck={false} style={{ ...inp, flex: 1 }} onFocus={fo} onBlur={fb} value={b.beteckning} onChange={e => setNyaBeteckningar(prev => prev.map((x, j) => j === i ? { ...x, beteckning: e.target.value } : x))} placeholder="T.ex. Indelningen 1" />
                        <input spellCheck={false} type="number" style={{ ...inp, ...(isMobile ? { width: '100%' } : { width: 140 }) }} onFocus={fo} onBlur={fb} value={b.taxeringsvarde} onChange={e => setNyaBeteckningar(prev => prev.map((x, j) => j === i ? { ...x, taxeringsvarde: e.target.value } : x))} placeholder="Tax.värde" />
                        {nyaBeteckningar.length > 1 && (
                          <button type="button" onClick={() => setNyaBeteckningar(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer' }}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Bolag</label>
                <select style={inp} onFocus={fo} onBlur={fb} value={form.bolagId} onChange={e => set('bolagId', e.target.value)}>
                  <option value="">Inget bolag</option>
                  {bolagLista.map(b => <option key={b.id} value={b.id}>{b.namn}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Adress</label>
                <input spellCheck={false} style={inp} onFocus={fo} onBlur={fb} value={form.adress} onChange={e => set('adress', e.target.value)} placeholder="Gatuadress" />
              </div>
              <div>
                <label style={lbl}>Postnummer</label>
                <input spellCheck={false} style={inp} onFocus={fo} onBlur={fb} value={form.postnummer} onChange={e => set('postnummer', e.target.value)} placeholder="123 45" />
              </div>
              <div>
                <label style={lbl}>Stad</label>
                <input spellCheck={false} style={inp} onFocus={fo} onBlur={fb} value={form.stad} onChange={e => set('stad', e.target.value)} placeholder="Stockholm" />
              </div>
            </div>
          </section>

          {/* Byggnader — endast för sparade fastigheter */}
          {editing && (
            <section style={section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <h4 style={{ ...secLabel, marginBottom: 0 }}>Byggnader</h4>
                  {byggnader.length > 0 && (totalBTA > 0 || totalLOA > 0) && (
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {totalBTA > 0 && <>BTA {fmtKvm(totalBTA)}</>}
                      {totalBTA > 0 && totalLOA > 0 && ' · '}
                      {totalLOA > 0 && <span style={{ color: C.ok }}>LOA {fmtKvm(totalLOA)}</span>}
                    </p>
                  )}
                </div>
                {!addingByggnad && (
                  <button onClick={() => { setAddingByggnad(true); setEditingByggnadId(null); setByggnadForm(emptyByggnadForm) }} style={{ background: 'none', border: 'none', color: C.gold, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    + Lägg till byggnad
                  </button>
                )}
              </div>

              {byggnader.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {byggnader.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.field, padding: '12px 16px' }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{b.namn}</p>
                        {b.adress && <p style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>{b.adress}</p>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 2, fontSize: 12, color: C.muted }}>
                          {b.byggnadsar && <span>Byggd {b.byggnadsar}{b.ombyggnads_ar ? `, ombyggd ${b.ombyggnads_ar}` : ''}</span>}
                          {b.totalyta && <span>BTA {fmtKvm(b.totalyta)}</span>}
                          {b.uthyrbar_yta && <span style={{ color: C.ok }}>LOA {fmtKvm(b.uthyrbar_yta)}</span>}
                          {b.energiklass && <span style={{ fontWeight: 700, color: '#000', padding: '0 4px', borderRadius: 3, fontSize: 10, background: energiColor[b.energiklass] || '#888' }}>{b.energiklass}</span>}
                          {b.uppvarmning && <span style={{ color: C.blue }}>{b.uppvarmning}</span>}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {b.hiss && <span style={{ fontSize: 10, background: C.field, color: C.muted, borderRadius: 4, padding: '2px 6px' }}>🛗 Hiss</span>}
                          {b.oljeavskiljare && <span style={{ fontSize: 10, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderRadius: 4, padding: '2px 6px' }}>Oljeavsk.</span>}
                          {b.sprinkler && <span style={{ fontSize: 10, background: 'rgba(96,165,250,0.1)', color: C.blue, borderRadius: 4, padding: '2px 6px' }}>Sprinkler</span>}
                          {b.laddstolpar && <span style={{ fontSize: 10, background: 'rgba(74,222,128,0.1)', color: C.ok, borderRadius: 4, padding: '2px 6px' }}>⚡ Laddstolpe</span>}
                          {b.fiber && <span style={{ fontSize: 10, background: 'rgba(167,139,250,0.12)', color: '#a78bfa', borderRadius: 4, padding: '2px 6px' }}>Fiber</span>}
                          {b.manuellaportar ? <span style={{ fontSize: 10, background: C.field, color: C.muted, borderRadius: 4, padding: '2px 6px' }}>🚪 {b.manuellaportar} man. port{b.manuellaportar > 1 ? 'ar' : ''}</span> : null}
                          {b.elportar ? <span style={{ fontSize: 10, background: 'rgba(234,179,8,0.1)', color: '#eab308', borderRadius: 4, padding: '2px 6px' }}>⚡ {b.elportar} el-port{b.elportar > 1 ? 'ar' : ''}</span> : null}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
                        <button onClick={() => startEditByggnad(b)} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 13, padding: 4 }}>✏️</button>
                        <button onClick={() => deleteByggnad(b.id)} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 13, padding: 4 }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {addingByggnad && (
                <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.field, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, margin: 0 }}>{editingByggnadId ? 'Redigera byggnad' : 'Ny byggnad'}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={lbl}>Namn *</label>
                      <input spellCheck={false} style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.namn} onChange={e => setByggnadForm(f => ({ ...f, namn: e.target.value }))} placeholder="T.ex. Hus A, Lagerhall" autoFocus />
                    </div>
                    {(editing?.beteckningar?.length ?? 0) > 0 && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={lbl}>Fastighetsbeteckning</label>
                        <select style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.beteckningId} onChange={e => setByggnadForm(f => ({ ...f, beteckningId: e.target.value }))}>
                          <option value="">Ej vald</option>
                          {editing!.beteckningar!.map(b => <option key={b.id} value={b.id}>{b.beteckning}{b.taxeringsvarde ? ` (${b.taxeringsvarde.toLocaleString('sv-SE')} kr)` : ''}</option>)}
                        </select>
                      </div>
                    )}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={lbl}>Adress</label>
                      <input spellCheck={false} style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.adress} onChange={e => setByggnadForm(f => ({ ...f, adress: e.target.value }))} placeholder="T.ex. Storgatan 12 A" />
                    </div>
                    <div><label style={lbl}>Byggår</label><input spellCheck={false} type="number" style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.byggnadsar} onChange={e => setByggnadForm(f => ({ ...f, byggnadsar: e.target.value }))} placeholder="1985" /></div>
                    <div><label style={lbl}>Ombyggnadsår</label><input spellCheck={false} type="number" style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.ombyggnadsAr} onChange={e => setByggnadForm(f => ({ ...f, ombyggnadsAr: e.target.value }))} placeholder="2010" /></div>
                    <div><label style={lbl}>Total area BTA (kvm)</label><input spellCheck={false} type="number" style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.totalyta} onChange={e => setByggnadForm(f => ({ ...f, totalyta: e.target.value }))} placeholder="2 500" /></div>
                    <div><label style={lbl}>Uthyrbar area LOA (kvm)</label><input spellCheck={false} type="number" style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.uthyrbarYta} onChange={e => setByggnadForm(f => ({ ...f, uthyrbarYta: e.target.value }))} placeholder="2 000" /></div>
                    <div>
                      <label style={lbl}>Energiklass</label>
                      <select style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.energiklass} onChange={e => setByggnadForm(f => ({ ...f, energiklass: e.target.value }))}>
                        <option value="">Ej angiven</option>
                        {energiklasser.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Uppvärmning</label>
                      <select style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.uppvarmning} onChange={e => setByggnadForm(f => ({ ...f, uppvarmning: e.target.value }))}>
                        <option value="">Ej angiven</option>
                        {uppvarmningar.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 8 }}>Installationer & egenskaper</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
                      {([
                        { key: 'hiss' as const, label: 'Hiss', icon: '🛗' },
                        { key: 'oljeavskiljare' as const, label: 'Oljeavskiljare', icon: '🛢️' },
                        { key: 'sprinkler' as const, label: 'Sprinkler', icon: '🚿' },
                        { key: 'laddstolpar' as const, label: 'Laddstolpar', icon: '⚡' },
                        { key: 'fiber' as const, label: 'Fiber', icon: '🌐' },
                      ]).map(({ key, label, icon }) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, border: `1px solid ${byggnadForm[key] ? C.gold : C.border}`, background: byggnadForm[key] ? C.goldSoft : C.panel, padding: '8px 10px', cursor: 'pointer' }}>
                          <input type="checkbox" style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} checked={Boolean(byggnadForm[key])} onChange={() => toggleByggnadBool(key)} />
                          <span>{icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: C.text2 }}>{label}</span>
                          <span style={{ marginLeft: 'auto', width: 16, height: 16, borderRadius: 4, border: `1px solid ${byggnadForm[key] ? C.gold : C.border}`, background: byggnadForm[key] ? C.gold : 'transparent', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0 }}>
                            {byggnadForm[key] ? '✓' : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                      <div><label style={lbl}>🚪 Manuella portar</label><input spellCheck={false} type="number" style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.manuellaportar} onChange={e => setByggnadForm(f => ({ ...f, manuellaportar: e.target.value }))} placeholder="0" /></div>
                      <div><label style={lbl}>⚡ El-portar</label><input spellCheck={false} type="number" style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.elportar} onChange={e => setByggnadForm(f => ({ ...f, elportar: e.target.value }))} placeholder="0" /></div>
                    </div>
                  </div>

                  <div>
                    <label style={lbl}>Beskrivning</label>
                    <input spellCheck={true} style={gridInput} onFocus={fo} onBlur={fb} value={byggnadForm.beskrivning} onChange={e => setByggnadForm(f => ({ ...f, beskrivning: e.target.value }))} placeholder="T.ex. Kontorsbyggnad 3 plan" />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelByggnad} style={btnGhost}>✕ Avbryt</button>
                    <button onClick={saveByggnad} disabled={savingByggnad || !byggnadForm.namn} style={{ ...btnPrimary, opacity: savingByggnad || !byggnadForm.namn ? 0.5 : 1 }}>
                      ✓ {savingByggnad ? 'Sparar...' : editingByggnadId ? 'Uppdatera' : 'Lägg till'}
                    </button>
                  </div>
                </div>
              )}

              {byggnader.length === 0 && !addingByggnad && (
                <p style={{ fontSize: 12, color: C.muted2, fontStyle: 'italic' }}>Inga byggnader registrerade ännu. Lägg till byggnader för att spåra teknisk info, total- och uthyrbar yta.</p>
              )}

              {byggnader.length > 0 && (
                <div style={{ marginTop: 12, borderRadius: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)', padding: '10px 16px' }}>
                  <p style={{ fontSize: 12, color: '#fbbf24', margin: 0 }}>💡 <strong>Tips:</strong> Har fastigheten uthyrbar mark (parkering, utomhusupplag)? Lägg till det som en lokal av typ <strong>Mark/Utomhus</strong> under Lokaler.</p>
                </div>
              )}
            </section>
          )}

          {/* Anteckningar */}
          <section>
            <h4 style={secLabel}>Anteckningar</h4>
            <textarea spellCheck={true} rows={4} style={{ ...inp, resize: 'none' }} onFocus={fo} onBlur={fb} value={form.kommentar} onChange={e => set('kommentar', e.target.value)} placeholder="Fritext om fastigheten, t.ex. tillstånd, planstatus, särskilda villkor..." />
          </section>
        </div>
      </SlideOver>
    </div>
  )
}
