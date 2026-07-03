'use client'

// Migrerad. Källa: src/app/driftskostnader/page.tsx (Tailwind, lucide, blå/ljus).
// Portad till: inline dark/gold via styles.ts-tokens, emoji-ikoner, SlideOver från
// @/components/fastigheter. Data via /api/fastigheter/driftskostnader + /api/fastigheter/objekt.
//
// Fältnamn: Supabase returnerar snake_case (fastighet_id, fakturadatum). Käll-UI:t använde
// camelCase (fastighetId). Här är render/state anpassade: läser d.fastighet_id, formuläret
// POSTar fastighetId (route-parsern läser båda).

import { useEffect, useState } from 'react'
import SlideOver from '@/components/fastigheter/SlideOver'
import { C, inp, lbl, fo, fb, btnPrimary, btnGhost, btnDanger, fmtDatum } from '@/components/fastigheter/styles'

interface Fastighet { id: string; namn: string }
interface Driftskostnad {
  id: string; typ: string; belopp: number; period: string; fastighet_id: string
  fakturadatum: string; leverantor: string | null; kommentar: string | null
  fastighet: Fastighet | null
}

const typLabels: Record<string, string> = {
  el: 'El', 'värme': 'Värme', vatten: 'Vatten', sopor: 'Sopor', 'försäkring': 'Försäkring', 'övrigt': 'Övrigt',
}
// Emoji + tonad chip-färg per typ (ersätter Tailwind bg-*-100 text-*-700).
const typStyle: Record<string, { bg: string; color: string; icon: string }> = {
  el: { bg: 'rgba(234,179,8,0.12)', color: '#eab308', icon: '⚡' },
  'värme': { bg: 'rgba(248,113,113,0.12)', color: C.danger, icon: '🔥' },
  vatten: { bg: 'rgba(96,165,250,0.12)', color: C.blue, icon: '💧' },
  sopor: { bg: 'rgba(74,222,128,0.12)', color: C.ok, icon: '🗑️' },
  'försäkring': { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', icon: '🛡️' },
  'övrigt': { bg: C.field, color: C.muted, icon: '📦' },
}

const formatSEK = (n: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n)

const th: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
  color: C.muted2, textTransform: 'uppercase', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 13, color: C.text2 }

export default function DriftskostnaderPage() {
  const [items, setItems] = useState<Driftskostnad[]>([])
  const [fastigheter, setFastigheter] = useState<Fastighet[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Driftskostnad | null>(null)
  const [form, setForm] = useState({ typ: 'el', belopp: '', period: 'månad', fastighetId: '', fakturadatum: '', leverantor: '', kommentar: '' })
  const [saving, setSaving] = useState(false)
  const [filterFastighet, setFilterFastighet] = useState('')

  const load = () => {
    Promise.all([
      fetch('/api/fastigheter/driftskostnader').then(r => r.json()),
      fetch('/api/fastigheter/objekt').then(r => r.json()),
    ]).then(([d, f]) => {
      setItems(Array.isArray(d) ? d : [])
      setFastigheter(Array.isArray(f) ? f.map((x: Fastighet) => ({ id: x.id, namn: x.namn })) : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    const today = new Date().toISOString().split('T')[0]
    setForm({ typ: 'el', belopp: '', period: 'månad', fastighetId: fastigheter[0]?.id || '', fakturadatum: today, leverantor: '', kommentar: '' })
    setOpen(true)
  }

  const openEdit = (d: Driftskostnad) => {
    setEditing(d)
    setForm({
      typ: d.typ, belopp: String(d.belopp), period: d.period, fastighetId: d.fastighet_id,
      fakturadatum: d.fakturadatum.split('T')[0], leverantor: d.leverantor || '', kommentar: d.kommentar || '',
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    const url = editing ? `/api/fastigheter/driftskostnader/${editing.id}` : '/api/fastigheter/driftskostnader'
    const method = editing ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setSaving(false); setOpen(false); load()
  }

  const remove = async (id: string) => {
    if (!confirm('Ta bort driftskostnad?')) return
    await fetch(`/api/fastigheter/driftskostnader/${id}`, { method: 'DELETE' })
    setOpen(false); load()
  }

  const set = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }))

  const filtered = filterFastighet ? items.filter(d => d.fastighet_id === filterFastighet) : items
  const totalManad = filtered.filter(d => d.period === 'månad').reduce((s, d) => s + d.belopp, 0)
  const totalAr = filtered.filter(d => d.period === 'år').reduce((s, d) => s + d.belopp, 0)

  const chip = (typ: string) => {
    const s = typStyle[typ] || { bg: C.field, color: C.muted, icon: '' }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: s.bg, color: s.color, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
        {s.icon && <span>{s.icon}</span>}{typLabels[typ] || typ}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Driftskostnader</h2>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{filtered.length} poster</p>
        </div>
        <button onClick={openNew} style={btnPrimary}>+ Ny kostnad</button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterFastighet} onChange={e => setFilterFastighet(e.target.value)} onFocus={fo} onBlur={fb} style={{ ...inp, width: 'auto', minWidth: 200 }}>
          <option value="">Alla fastigheter</option>
          {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <span style={{ color: C.muted }}>Månadskostnader: <strong style={{ color: C.text }}>{formatSEK(totalManad)}</strong></span>
          <span style={{ color: C.muted }}>Årskostnader: <strong style={{ color: C.text }}>{formatSEK(totalAr)}</strong></span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Laddar...</div>
      ) : (
        <div style={{ borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.panel, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.borderSoft}`, background: C.panel2 }}>
                {['Typ', 'Fastighet', 'Belopp', 'Period', 'Fakturadatum', 'Leverantör', 'Kommentar', ''].map((h, i) => (
                  <th key={i} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: C.muted2 }}>Inga driftskostnader</td></tr>
              ) : filtered.map((d) => (
                <tr key={d.id} onClick={() => openEdit(d)} style={{ borderTop: `1px solid ${C.borderSoft}`, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.field)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={td}>{chip(d.typ)}</td>
                  <td style={{ ...td, color: C.muted }}>{d.fastighet?.namn || '–'}</td>
                  <td style={{ ...td, fontWeight: 600, color: C.text }}>{formatSEK(d.belopp)}</td>
                  <td style={{ ...td, color: C.muted, textTransform: 'capitalize' }}>{d.period}</td>
                  <td style={{ ...td, color: C.muted }}>{fmtDatum(d.fakturadatum)}</td>
                  <td style={{ ...td, color: C.muted }}>{d.leverantor || '–'}</td>
                  <td style={{ ...td, color: C.muted2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.kommentar || '–'}</td>
                  <td style={td}>
                    <button onClick={(e) => { e.stopPropagation(); remove(d.id) }} style={{ background: 'none', border: 'none', color: C.muted2, cursor: 'pointer', fontSize: 14, padding: 4 }}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `${typLabels[editing.typ] || editing.typ} – ${editing.fastighet?.namn || ''}` : 'Ny driftskostnad'}
        subtitle={editing ? `${formatSEK(editing.belopp)} / ${editing.period}` : undefined}
        width="md"
        footer={
          <div style={{ display: 'flex', gap: 12 }}>
            {editing && <button onClick={() => remove(editing.id)} style={btnDanger}>Ta bort</button>}
            <button onClick={() => setOpen(false)} style={{ ...btnGhost, flex: 1 }}>Avbryt</button>
            <button onClick={save} disabled={saving || !form.belopp || !form.fastighetId} style={{ ...btnPrimary, flex: 1, opacity: saving || !form.belopp || !form.fastighetId ? 0.5 : 1 }}>
              {saving ? 'Sparar...' : 'Spara'}
            </button>
          </div>
        }
      >
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={lbl}>Fastighet</label>
            <select style={inp} onFocus={fo} onBlur={fb} value={form.fastighetId} onChange={e => set('fastighetId', e.target.value)}>
              <option value="">Välj fastighet</option>
              {fastigheter.map(f => <option key={f.id} value={f.id}>{f.namn}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Typ</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={form.typ} onChange={e => set('typ', e.target.value)}>
                {Object.entries(typLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Period</label>
              <select style={inp} onFocus={fo} onBlur={fb} value={form.period} onChange={e => set('period', e.target.value)}>
                <option value="månad">Månad</option>
                <option value="år">År</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={lbl}>Belopp (SEK)</label>
              <input type="number" style={inp} onFocus={fo} onBlur={fb} value={form.belopp} onChange={e => set('belopp', e.target.value)} placeholder="2500" />
            </div>
            <div>
              <label style={lbl}>Fakturadatum</label>
              <input type="date" style={inp} onFocus={fo} onBlur={fb} value={form.fakturadatum} onChange={e => set('fakturadatum', e.target.value)} />
            </div>
          </div>
          <div>
            <label style={lbl}>Leverantör</label>
            <input style={inp} onFocus={fo} onBlur={fb} value={form.leverantor} onChange={e => set('leverantor', e.target.value)} placeholder="T.ex. Vattenfall" />
          </div>
          <div>
            <label style={lbl}>Kommentar</label>
            <textarea rows={3} style={{ ...inp, resize: 'none' }} onFocus={fo} onBlur={fb} value={form.kommentar} onChange={e => set('kommentar', e.target.value)} />
          </div>
        </div>
      </SlideOver>
    </div>
  )
}
