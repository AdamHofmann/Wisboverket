'use client'

// Migrerad från käll-appens src/app/underhall/page.tsx.
// Tailwind + lucide → inline dark/gold-tokens (styles.ts) + emoji.
// Data: /api/fastigheter/underhall (arenden) + /api/fastigheter/objekt (fastigheter).
//
// Fältnamn: API returnerar snake_case (nasta_gang, senast_utford, intervall_manader,
// fastighet_id, byggnad_id) + nested fastighet:{id,namn}, logg:[{datum,utford_av,...}],
// _count:{dokument,logg}. Render-koden nedan är anpassad till snake_case; formulär POSTar
// camelCase → route-parsern översätter (se api/fastigheter/underhall/route.ts).

import { useEffect, useState } from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost } from '@/components/fastigheter/styles'

interface Byggnad {
  id: string; namn: string
  hiss: boolean; oljeavskiljare: boolean; sprinkler: boolean
  fiber: boolean; manuellaportar: number | null; elportar: number | null
}
interface Fastighet { id: string; namn: string; byggnader?: Byggnad[] }
interface LoggPost { datum: string; utford_av: string; kommentar: string | null; kostnad: number | null }
interface Arende {
  id: string; typ: string; namn: string; beskrivning: string | null
  intervall_manader: number; senast_utford: string | null; nasta_gang: string
  status: string; ansvarig: string | null; leverantor: string | null
  kostnad: number | null; kommentar: string | null
  fastighet_id: string; byggnad_id: string | null
  fastighet: { id: string; namn: string }
  logg?: LoggPost[]
  _count?: { dokument: number; logg: number }
}

const TYPER = [
  { kod: 'oljeavskiljare', label: 'Oljeavskiljare', intervall: 6, icon: '🛢️' },
  { kod: 'hiss', label: 'Hissbesiktning', intervall: 12, icon: '🛗' },
  { kod: 'port', label: 'Portservice', intervall: 12, icon: '🚪' },
  { kod: 'brandlarm', label: 'Brandlarm', intervall: 12, icon: '🔥' },
  { kod: 'sprinkler', label: 'Sprinkler', intervall: 12, icon: '🚿' },
  { kod: 'ovk', label: 'OVK (ventilation)', intervall: 36, icon: '💨' },
  { kod: 'elrevision', label: 'Elrevision', intervall: 36, icon: '⚡' },
  { kod: 'ovrigt', label: 'Övrigt', intervall: 12, icon: '🔧' },
]

// Statusfärger portade till mörk/guld-tema
const statusStyle: Record<string, React.CSSProperties> = {
  planerad: { background: 'rgba(96,165,250,0.12)', color: C.blue },
  forsenad: { background: 'rgba(248,113,113,0.12)', color: C.danger },
  utford: { background: 'rgba(74,222,128,0.12)', color: C.ok },
}
const statusLabels: Record<string, string> = { planerad: 'Planerad', forsenad: 'Försenad', utford: 'Utförd' }

const formatDate = (d: string) => new Date(d).toLocaleDateString('sv-SE')
const daysUntil = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

const secLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: C.text2, textTransform: 'uppercase', marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${C.borderSoft}` }
const statusChip = (status: string): React.CSSProperties => ({
  display: 'inline-flex', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 600,
  ...(statusStyle[status] || { background: C.field, color: C.muted }),
})

export default function UnderhallPage() {
  const [arenden, setArenden] = useState<Arende[]>([])
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTyp, setFilterTyp] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Skapa ärende
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ typ: 'oljeavskiljare', namn: '', fastighetId: '', intervallManader: '6', nastaGang: '', ansvarig: '', leverantor: '', kommentar: '' })
  const [saving, setSaving] = useState(false)
  // Förslag
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<{ typ: string; namn: string; fastighetId: string; intervall: number; byggnad: string }[]>([])
  const [creatingSuggestions, setCreatingSuggestions] = useState(false)

  // Detalj
  const [selected, setSelected] = useState<Arende | null>(null)
  const [markForm, setMarkForm] = useState({ utfordAv: '', kommentar: '', kostnad: '', datum: new Date().toISOString().split('T')[0] })
  const [markSaving, setMarkSaving] = useState(false)

  const load = () => {
    Promise.all([
      fetch('/api/fastigheter/underhall').then(r => r.json()),
      fetch('/api/fastigheter/objekt').then(r => r.json()),
    ]).then(([u, f]) => {
      if (Array.isArray(u)) setArenden(u)
      if (Array.isArray(f)) setFastigheter(f)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const generateSuggestions = () => {
    const existing = new Set(arenden.map(a => `${a.fastighet_id}-${a.typ}-${a.namn}`))
    const sugg: typeof suggestions = []

    for (const f of fastigheter) {
      if (!f.byggnader) continue
      for (const b of f.byggnader) {
        if (b.oljeavskiljare && !existing.has(`${f.id}-oljeavskiljare-Oljeavskiljare ${b.namn}`)) {
          sugg.push({ typ: 'oljeavskiljare', namn: `Oljeavskiljare ${b.namn}`, fastighetId: f.id, intervall: 6, byggnad: b.namn })
        }
        if (b.hiss && !existing.has(`${f.id}-hiss-Hiss service ${b.namn}`)) {
          sugg.push({ typ: 'hiss', namn: `Hiss service ${b.namn}`, fastighetId: f.id, intervall: 12, byggnad: b.namn })
        }
        if (b.hiss && !existing.has(`${f.id}-hiss-Hiss besiktning ${b.namn}`)) {
          sugg.push({ typ: 'hiss', namn: `Hiss besiktning ${b.namn}`, fastighetId: f.id, intervall: 12, byggnad: b.namn })
        }
        if (b.sprinkler && !existing.has(`${f.id}-sprinkler-Sprinkler ${b.namn}`)) {
          sugg.push({ typ: 'sprinkler', namn: `Sprinkler ${b.namn}`, fastighetId: f.id, intervall: 12, byggnad: b.namn })
        }
        const elportar = b.elportar ?? 0
        if (elportar > 0 && !existing.has(`${f.id}-port-El-port service ${b.namn}`)) {
          sugg.push({ typ: 'port', namn: `El-port service ${b.namn} (${elportar} st)`, fastighetId: f.id, intervall: 12, byggnad: b.namn })
        }
        if (elportar > 0 && !existing.has(`${f.id}-port-El-port besiktning ${b.namn}`)) {
          sugg.push({ typ: 'port', namn: `El-port besiktning ${b.namn} (${elportar} st)`, fastighetId: f.id, intervall: 12, byggnad: b.namn })
        }
      }
      // OVK och brandlarm per fastighet
      if (!existing.has(`${f.id}-ovk-OVK ${f.namn}`)) {
        sugg.push({ typ: 'ovk', namn: `OVK ${f.namn}`, fastighetId: f.id, intervall: 36, byggnad: '' })
      }
      if (!existing.has(`${f.id}-brandlarm-Brandlarm ${f.namn}`)) {
        sugg.push({ typ: 'brandlarm', namn: `Brandlarm ${f.namn}`, fastighetId: f.id, intervall: 12, byggnad: '' })
      }
    }
    setSuggestions(sugg)
    setShowSuggestions(true)
  }

  const createAllSuggestions = async () => {
    setCreatingSuggestions(true)
    const nasta = new Date()
    for (const s of suggestions) {
      const d = new Date(nasta)
      d.setMonth(d.getMonth() + s.intervall)
      await fetch('/api/fastigheter/underhall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fastighetId: s.fastighetId,
          typ: s.typ,
          namn: s.namn,
          intervallManader: s.intervall,
          nastaGang: d.toISOString().split('T')[0],
        }),
      })
    }
    setCreatingSuggestions(false)
    setShowSuggestions(false)
    load()
  }

  const openNew = () => {
    const nasta = new Date()
    nasta.setMonth(nasta.getMonth() + 6)
    setNewForm({ typ: 'oljeavskiljare', namn: '', fastighetId: fastigheter[0]?.id || '', intervallManader: '6', nastaGang: nasta.toISOString().split('T')[0], ansvarig: '', leverantor: '', kommentar: '' })
    setShowNew(true)
  }

  const handleTypChange = (typ: string) => {
    const t = TYPER.find(t => t.kod === typ)
    const nasta = new Date()
    nasta.setMonth(nasta.getMonth() + (t?.intervall || 12))
    setNewForm(prev => ({ ...prev, typ, namn: t?.label || '', intervallManader: String(t?.intervall || 12), nastaGang: nasta.toISOString().split('T')[0] }))
  }

  const saveNew = async () => {
    setSaving(true)
    await fetch('/api/fastigheter/underhall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    setSaving(false)
    setShowNew(false)
    load()
  }

  const markUtford = async () => {
    if (!selected) return
    setMarkSaving(true)
    await fetch(`/api/fastigheter/underhall/${selected.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(markForm),
    })
    setMarkSaving(false)
    setSelected(null)
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Ta bort ärende?')) return
    await fetch(`/api/fastigheter/underhall/${id}`, { method: 'DELETE' })
    setSelected(null)
    load()
  }

  let filtered = arenden
  if (filterTyp) filtered = filtered.filter(a => a.typ === filterTyp)
  if (filterStatus) filtered = filtered.filter(a => a.status === filterStatus)

  const forsenaCount = arenden.filter(a => a.status === 'forsenad').length
  const kommandeCount = arenden.filter(a => a.status === 'planerad' && daysUntil(a.nasta_gang) <= 30).length

  const selStatus = selected?.status ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Underhåll & Besiktning</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            {arenden.length} ärenden
            {forsenaCount > 0 && <span style={{ color: C.danger, fontWeight: 600, marginLeft: 8 }}>{forsenaCount} försenade</span>}
            {kommandeCount > 0 && <span style={{ color: C.warn, marginLeft: 8 }}>{kommandeCount} inom 30 dagar</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={generateSuggestions} style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', gap: 8, color: C.gold, borderColor: C.gold }}>
            🔧 Föreslå från fastigheter
          </button>
          <button onClick={openNew} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            + Nytt ärende
          </button>
        </div>
      </div>

      {/* Varningsbanner */}
      {forsenaCount > 0 && (
        <div style={{ borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.danger, margin: 0 }}>{forsenaCount} försenade ärenden kräver åtgärd</p>
            <p style={{ fontSize: 12, color: 'rgba(248,113,113,0.8)', margin: 0 }}>Besiktningar/underhåll som passerat sitt planerade datum.</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <select value={filterTyp} onChange={e => setFilterTyp(e.target.value)} onFocus={fo} onBlur={fb} style={{ ...inp, width: 'auto' }}>
          <option value="">Alla typer</option>
          {TYPER.map(t => <option key={t.kod} value={t.kod}>{t.icon} {t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} onFocus={fo} onBlur={fb} style={{ ...inp, width: 'auto' }}>
          <option value="">Alla statusar</option>
          <option value="forsenad">Försenade</option>
          <option value="planerad">Planerade</option>
          <option value="utford">Utförda</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', background: C.panel, borderRadius: 12, border: `1px solid ${C.borderSoft}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
          <p style={{ color: C.muted }}>Inga underhållsärenden</p>
          <button onClick={openNew} style={{ ...btnGhost, marginTop: 16, color: C.gold, borderColor: C.gold }}>Skapa första ärendet</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(a => {
            const days = daysUntil(a.nasta_gang)
            const typ = TYPER.find(t => t.kod === a.typ)
            const isForsenad = a.status === 'forsenad'
            const isSnart = !isForsenad && days <= 30 && days >= 0
            const borderColor = isForsenad ? 'rgba(248,113,113,0.35)' : isSnart ? 'rgba(251,146,60,0.35)' : C.borderSoft
            const bg = isForsenad ? 'rgba(248,113,113,0.05)' : isSnart ? 'rgba(251,146,60,0.05)' : C.panel

            return (
              <div key={a.id} onClick={() => { setSelected(a); setMarkForm({ utfordAv: '', kommentar: '', kostnad: '', datum: new Date().toISOString().split('T')[0] }) }} style={{ borderRadius: 12, border: `1px solid ${borderColor}`, background: bg, padding: 16, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{typ?.icon || '🔧'}</span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontWeight: 600, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.namn}</h3>
                      <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{a.fastighet?.namn}{a.leverantor ? ` · ${a.leverantor}` : ''}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={statusChip(a.status)}>{statusLabels[a.status] || a.status}</span>
                    <button onClick={e => { e.stopPropagation(); remove(a.id) }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 13, padding: 4 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, fontSize: 12, color: C.muted }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>🕒 Var {a.intervall_manader} mån</span>
                  {a.senast_utford && <span>Senast: {formatDate(a.senast_utford)}</span>}
                  <span style={{ fontWeight: 600, color: isForsenad ? C.danger : isSnart ? C.warn : C.text2 }}>
                    Nästa: {formatDate(a.nasta_gang)} {isForsenad ? `(${Math.abs(days)} dagar sen)` : days <= 30 ? `(om ${days} dagar)` : ''}
                  </span>
                  {a._count && a._count.logg > 0 && <span>{a._count.logg} utförda</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Skapa nytt ärende */}
      <SlideOver open={showNew} onClose={() => setShowNew(false)} title="Nytt underhållsärende" width="md"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowNew(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={saveNew} disabled={saving || !newForm.namn || !newForm.fastighetId} style={{ ...btnPrimary, flex: 1, opacity: saving || !newForm.namn || !newForm.fastighetId ? 0.5 : 1 }}>
              {saving ? 'Skapar...' : 'Skapa ärende'}
            </button>
          </div>
        }
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>Typ</label>
            <select style={inp} onFocus={fo} onBlur={fb} value={newForm.typ} onChange={e => handleTypChange(e.target.value)}>
              {TYPER.map(t => <option key={t.kod} value={t.kod}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Namn</label>
            <input style={inp} onFocus={fo} onBlur={fb} value={newForm.namn} onChange={e => setNewForm({ ...newForm, namn: e.target.value })} placeholder="T.ex. Oljeavskiljare Hus A" />
          </div>
          <div>
            <label style={lbl}>Fastighet</label>
            <select style={inp} onFocus={fo} onBlur={fb} value={newForm.fastighetId} onChange={e => setNewForm({ ...newForm, fastighetId: e.target.value })}>
              <option value="">Välj fastighet</option>
              {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Intervall (månader)</label>
              <input type="number" min="1" style={inp} onFocus={fo} onBlur={fb} value={newForm.intervallManader} onChange={e => setNewForm({ ...newForm, intervallManader: e.target.value })} />
            </div>
            <div>
              <label style={lbl}>Nästa datum</label>
              <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={newForm.nastaGang} onChange={e => setNewForm({ ...newForm, nastaGang: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Ansvarig</label>
              <input style={inp} onFocus={fo} onBlur={fb} value={newForm.ansvarig} onChange={e => setNewForm({ ...newForm, ansvarig: e.target.value })} placeholder="Namn" />
            </div>
            <div>
              <label style={lbl}>Leverantör</label>
              <input style={inp} onFocus={fo} onBlur={fb} value={newForm.leverantor} onChange={e => setNewForm({ ...newForm, leverantor: e.target.value })} placeholder="T.ex. KONE Hissar" />
            </div>
          </div>
          <div>
            <label style={lbl}>Kommentar</label>
            <textarea rows={2} style={{ ...inp, resize: 'none' }} onFocus={fo} onBlur={fb} value={newForm.kommentar} onChange={e => setNewForm({ ...newForm, kommentar: e.target.value })} placeholder="Eventuella anteckningar..." />
          </div>
        </div>
      </SlideOver>

      {/* Förslag från fastigheter */}
      <SlideOver open={showSuggestions} onClose={() => setShowSuggestions(false)} title="Föreslagna ärenden" subtitle="Baserat på installationer i era byggnader" width="md"
        footer={suggestions.length > 0 ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setShowSuggestions(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={createAllSuggestions} disabled={creatingSuggestions} style={{ ...btnPrimary, flex: 1, opacity: creatingSuggestions ? 0.5 : 1 }}>
              {creatingSuggestions ? 'Skapar...' : `Skapa alla ${suggestions.length} ärenden`}
            </button>
          </div>
        ) : undefined}
      >
        <div style={{ padding: 24 }}>
          {suggestions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 13, color: C.text2, fontWeight: 600, margin: 0 }}>Alla ärenden finns redan!</p>
              <p style={{ fontSize: 12, color: C.muted2, marginTop: 4 }}>Inga nya förslag baserat på era byggnaders installationer.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, color: C.muted2, marginBottom: 4 }}>Följande ärenden föreslås baserat på installationer (hiss, oljeavskiljare, sprinkler, portar) i era byggnader.</p>
              {suggestions.map((s, i) => {
                const typ = TYPER.find(t => t.kod === s.typ)
                const fastighet = fastigheter.find(f => f.id === s.fastighetId)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.field, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{typ?.icon || '🔧'}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0 }}>{s.namn}</p>
                        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{fastighet?.namn} · Var {s.intervall} mån</p>
                      </div>
                    </div>
                    <button onClick={() => setSuggestions(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 13, padding: 4, flexShrink: 0 }}>✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SlideOver>

      {/* Ärendedetalj + markera utförd */}
      <SlideOver open={!!selected} onClose={() => setSelected(null)} title={selected?.namn || ''} subtitle={selected ? `${selected.fastighet?.namn} · Var ${selected.intervall_manader} mån` : undefined} width="md"
        footer={selStatus !== 'utford' && selected ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setSelected(null)} style={{ ...btnGhost, flex: 1 }}>Stäng</button>
            <button onClick={markUtford} disabled={markSaving} style={{ background: C.ok, color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 1, opacity: markSaving ? 0.5 : 1 }}>
              ✓ {markSaving ? 'Sparar...' : 'Markera utförd'}
            </button>
          </div>
        ) : undefined}
      >
        {selected && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Info */}
            <div style={{ borderRadius: 8, background: C.field, border: `1px solid ${C.borderSoft}`, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: C.muted }}>Status</span><span style={statusChip(selected.status)}>{statusLabels[selected.status] || selected.status}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Nästa</span><span style={{ fontWeight: 600, color: C.text2 }}>{formatDate(selected.nasta_gang)}</span></div>
              {selected.senast_utford && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Senast utförd</span><span style={{ color: C.text2 }}>{formatDate(selected.senast_utford)}</span></div>}
              {selected.ansvarig && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Ansvarig</span><span style={{ color: C.text2 }}>{selected.ansvarig}</span></div>}
              {selected.leverantor && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Leverantör</span><span style={{ color: C.text2 }}>{selected.leverantor}</span></div>}
              {selected.kostnad && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.muted }}>Senaste kostnad</span><span style={{ color: C.text2 }}>{selected.kostnad.toLocaleString('sv-SE')} kr</span></div>}
            </div>

            {/* Markera utförd-formulär */}
            {selected.status !== 'utford' && (
              <div>
                <h4 style={secLabel}>Registrera utfört</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Datum</label>
                    <input type="date" min="2000-01-01" max="2099-12-31" style={inp} onFocus={fo} onBlur={fb} value={markForm.datum} onChange={e => setMarkForm({ ...markForm, datum: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Utfört av</label>
                    <input style={inp} onFocus={fo} onBlur={fb} value={markForm.utfordAv} onChange={e => setMarkForm({ ...markForm, utfordAv: e.target.value })} placeholder="Namn / företag" />
                  </div>
                  <div>
                    <label style={lbl}>Kostnad (kr)</label>
                    <input type="number" style={inp} onFocus={fo} onBlur={fb} value={markForm.kostnad} onChange={e => setMarkForm({ ...markForm, kostnad: e.target.value })} placeholder="0" />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={lbl}>Kommentar</label>
                  <textarea rows={2} style={{ ...inp, resize: 'none' }} onFocus={fo} onBlur={fb} value={markForm.kommentar} onChange={e => setMarkForm({ ...markForm, kommentar: e.target.value })} placeholder="Anteckningar om utfört arbete..." />
                </div>
              </div>
            )}

            {/* Historik */}
            {selected.logg && selected.logg.length > 0 && (
              <div>
                <h4 style={secLabel}>Historik</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selected.logg.map((l, i) => (
                    <div key={i} style={{ borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.field, padding: '8px 16px', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 600, color: C.text }}>{formatDate(l.datum)}</span>
                        <span style={{ color: C.muted }}>{l.utford_av}</span>
                      </div>
                      {l.kommentar && <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{l.kommentar}</p>}
                      {l.kostnad && <p style={{ fontSize: 12, color: C.muted2, marginTop: 2 }}>{l.kostnad.toLocaleString('sv-SE')} kr</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  )
}
