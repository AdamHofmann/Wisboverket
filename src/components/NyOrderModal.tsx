'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types'

const KATEGORIER = ['Rondering', 'Städning', 'El', 'Rör', 'Bygg', 'Mark', 'Övrigt']
const PERSONAL = ['Adam Hofmann', 'Maria Johansson', 'Erik Lindgren', 'Sara Nilsson']

const S: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'auto' },
  header: { padding: '20px 24px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: 700, color: '#e0e0e0' },
  closeBtn: { background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer', lineHeight: 1 },
  body: { padding: '20px 24px', display: 'flex', flexDirection: 'column' as const, gap: 16 },
  footer: { padding: '16px 24px', borderTop: '1px solid #222', display: 'flex', gap: 10, justifyContent: 'flex-end' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: '#666', letterSpacing: 0.5 },
  input: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  textarea: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: 90 },
  select: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  chips: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  chip: { padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid #2a2a2a', background: '#111', color: '#888', transition: 'all 0.1s' },
  chipActive: { background: 'rgba(232,201,106,0.12)', borderColor: '#E8C96A', color: '#E8C96A' },
  saveBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 18px', color: '#888', fontSize: 13, cursor: 'pointer' },
  section: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', borderBottom: '1px solid #1e1e1e', paddingBottom: 6, marginBottom: 4 },
  suggestions: { position: 'absolute' as const, top: '100%', left: 0, right: 0, background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, zIndex: 10, maxHeight: 180, overflowY: 'auto' as const },
  suggestion: { padding: '9px 12px', fontSize: 12, color: '#d0d0d0', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' },
  addKundBtn: { background: 'none', border: 'none', color: '#E8C96A', fontSize: 11, cursor: 'pointer', padding: '2px 0', textDecoration: 'underline', alignSelf: 'flex-start' },
  miniForm: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column' as const, gap: 10 },
  miniFormTitle: { fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 },
  miniRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  miniSaveBtn: { background: '#333', border: 'none', borderRadius: 6, padding: '7px 14px', color: '#E8C96A', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' },
}

type AdressSuggestion = { display_name: string; address: { road?: string; house_number?: string; postcode?: string; city?: string; town?: string; village?: string } }

type MiniKalenderProps = {
  ordrar: { bokad_datum: string; titel: string; tilldelad: string[] | null }[]
  valtDatum: string
  onPickDatum: (d: string) => void
}

function MiniKalender({ ordrar, valtDatum, onPickDatum }: MiniKalenderProps) {
  const [månOffset, setMånOffset] = useState(0)
  const idag = new Date()
  const år = new Date(idag.getFullYear(), idag.getMonth() + månOffset, 1)
  const månad = år.getMonth()
  const månadsår = år.getFullYear()
  const förstaVeckodag = (new Date(månadsår, månad, 1).getDay() + 6) % 7
  const antalDagar = new Date(månadsår, månad + 1, 0).getDate()
  const månNamn = år.toLocaleString('sv-SE', { month: 'long', year: 'numeric' })

  const bokadeDatum = new Set(ordrar.map(o => o.bokad_datum))
  const dagar = Array.from({ length: förstaVeckodag }, () => null).concat(Array.from({ length: antalDagar }, (_, i) => i + 1))

  return (
    <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button onClick={() => setMånOffset(o => o - 1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#d0d0d0', textTransform: 'capitalize' }}>{månNamn}</span>
        <button onClick={() => setMånOffset(o => o + 1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {['M','T','O','T','F','L','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 9, fontWeight: 700, color: '#555', padding: '2px 0' }}>{d}</div>
        ))}
        {dagar.map((dag, i) => {
          if (!dag) return <div key={i} />
          const ds = `${månadsår}-${String(månad + 1).padStart(2, '0')}-${String(dag).padStart(2, '0')}`
          const belagd = bokadeDatum.has(ds)
          const vald = valtDatum === ds
          const past = new Date(ds) < new Date(new Date().toDateString())
          return (
            <div key={i} onClick={() => !past && onPickDatum(ds)}
              style={{
                fontSize: 11, padding: '4px 2px', borderRadius: 5, cursor: past ? 'default' : 'pointer',
                background: vald ? '#E8C96A' : belagd ? 'rgba(239,68,68,0.2)' : 'transparent',
                color: vald ? '#000' : past ? '#333' : belagd ? '#ef4444' : '#ccc',
                fontWeight: vald || belagd ? 700 : 400,
                border: belagd && !vald ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
                position: 'relative',
              }}
              title={belagd ? ordrar.filter(o => o.bokad_datum === ds).map(o => o.titel).join(', ') : ''}>
              {dag}
              {belagd && !vald && <span style={{ position: 'absolute', bottom: 1, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#ef4444', display: 'block' }} />}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10, color: '#555' }}>
        <span><span style={{ color: '#ef4444' }}>●</span> Belagd</span>
        <span><span style={{ color: '#E8C96A' }}>●</span> Valt datum</span>
      </div>
    </div>
  )
}

type Props = { onClose: () => void; onSaved: () => void }

export default function NyOrderModal({ onClose, onSaved }: Props) {
  const [kunder, setKunder] = useState<Customer[]>([])
  const [saving, setSaving] = useState(false)
  const [showNyKund, setShowNyKund] = useState(false)
  const [adressSuggestions, setAdressSuggestions] = useState<AdressSuggestion[]>([])
  const adressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showKalender, setShowKalender] = useState(false)
  const [kalenderOrdrar, setKalenderOrdrar] = useState<{ bokad_datum: string; titel: string; tilldelad: string[] | null }[]>([])
  const [form, setForm] = useState({
    titel: '', kategori: 'Rondering', status: 'aktiv', customer_id: '',
    fastighet: '', postnummer: '', ort: '',
    bokad_datum: '', bokad_start: '', bokad_slut: '',
    tilldelad: [] as string[],
    arbetsinstruktion: '', pris: '',
  })

  const [nyKund, setNyKund] = useState({ namn: '', telefon: '', epost: '', typ: 'företag' })

  const fetchKunder = () => createClient().from('customers').select('id,namn').order('namn').then(({ data }) => setKunder(data || []))

  const openKalender = async () => {
    if (!showKalender) {
      const { data } = await createClient().from('orders').select('bokad_datum,titel,tilldelad').not('bokad_datum', 'is', null).eq('status', 'aktiv')
      setKalenderOrdrar(data || [])
    }
    setShowKalender(v => !v)
  }

  useEffect(() => { fetchKunder() }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const onAdressChange = (v: string) => {
    set('fastighet', v)
    setAdressSuggestions([])
    if (adressTimer.current) clearTimeout(adressTimer.current)
    if (v.length < 3) return
    adressTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=se&limit=5&q=${encodeURIComponent(v)}`)
        const data = await res.json()
        setAdressSuggestions(data)
      } catch {}
    }, 400)
  }

  const pickAdress = (s: AdressSuggestion) => {
    const a = s.address
    // Behåll användarens inmatning (inkl. husnummer) men fyll på postnummer/ort
    const gata = [a.road, a.house_number].filter(Boolean).join(' ')
    // Om Nominatim har husnummer, använd det — annars behåll vad användaren skrev
    set('fastighet', (a.house_number ? gata : form.fastighet) || gata)
    set('postnummer', a.postcode?.replace(' ', '') || '')
    set('ort', a.city || a.town || a.village || '')
    setAdressSuggestions([])
  }

  const togglePerson = (p: string) => setForm(f => ({
    ...f, tilldelad: f.tilldelad.includes(p) ? f.tilldelad.filter(x => x !== p) : [...f.tilldelad, p]
  }))

  const sparaNyKund = async () => {
    if (!nyKund.namn.trim()) return
    const { data } = await createClient().from('customers').insert({ ...nyKund }).select('id,namn').single()
    if (data) {
      await fetchKunder()
      set('customer_id', data.id)
      setShowNyKund(false)
      setNyKund({ namn: '', telefon: '', epost: '', typ: 'företag' })
    }
  }

  const handleSave = async () => {
    if (!form.titel.trim()) return
    setSaving(true)
    const { error } = await createClient().from('orders').insert({
      titel: form.titel, kategori: form.kategori, status: form.status,
      customer_id: form.customer_id || null,
      fastighet: form.fastighet || null, postnummer: form.postnummer || null, ort: form.ort || null,
      bokad_datum: form.bokad_datum || null, bokad_start: form.bokad_start || null, bokad_slut: form.bokad_slut || null,
      tilldelad: form.tilldelad.length > 0 ? form.tilldelad : null,
      beskrivning: form.arbetsinstruktion || null,
      pris: form.pris ? parseFloat(form.pris) : null,
    })
    setSaving(false)
    if (!error) { onSaved(); onClose() }
  }

  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.target.style.borderColor = '#2a2a2a' }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <div style={S.title}>Ny order</div>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>
        <div style={S.body}>
          <div style={S.section}>GRUNDINFO</div>

          <div style={S.field}>
            <label style={S.label}>TITEL *</label>
            <input style={S.input} value={form.titel} onChange={e => set('titel', e.target.value)}
              placeholder="T.ex. Rondering Björkalléen 8" onFocus={fo} onBlur={fb} />
          </div>

          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>KATEGORI</label>
              <select style={S.select} value={form.kategori} onChange={e => set('kategori', e.target.value)} onFocus={fo} onBlur={fb}>
                {KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>STATUS</label>
              <select style={S.select} value={form.status} onChange={e => set('status', e.target.value)} onFocus={fo} onBlur={fb}>
                <option value="aktiv">Aktiv</option>
                <option value="slutförd">Slutförd</option>
                <option value="inaktiv">Inaktiv</option>
              </select>
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>KUND</label>
            <select style={S.select} value={form.customer_id} onChange={e => set('customer_id', e.target.value)} onFocus={fo} onBlur={fb}>
              <option value="">— Välj kund —</option>
              {kunder.map(k => <option key={k.id} value={k.id}>{k.namn}</option>)}
            </select>
            <button style={S.addKundBtn} onClick={() => setShowNyKund(v => !v)}>
              {showNyKund ? '− Avbryt' : '+ Lägg till ny kund'}
            </button>
            {showNyKund && (
              <div style={S.miniForm}>
                <div style={S.miniFormTitle}>NY KUND</div>
                <div style={S.miniRow}>
                  <div style={S.field}>
                    <label style={S.label}>TYP</label>
                    <select style={S.select} value={nyKund.typ} onChange={e => setNyKund(k => ({ ...k, typ: e.target.value }))} onFocus={fo} onBlur={fb}>
                      <option value="företag">Företag</option>
                      <option value="privat">Privat</option>
                    </select>
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>NAMN *</label>
                    <input style={S.input} value={nyKund.namn} onChange={e => setNyKund(k => ({ ...k, namn: e.target.value }))}
                      placeholder="Företagsnamn / Namn" onFocus={fo} onBlur={fb} />
                  </div>
                </div>
                <div style={S.miniRow}>
                  <div style={S.field}>
                    <label style={S.label}>TELEFON</label>
                    <input style={S.input} value={nyKund.telefon} onChange={e => setNyKund(k => ({ ...k, telefon: e.target.value }))}
                      placeholder="07X-XXX XX XX" onFocus={fo} onBlur={fb} />
                  </div>
                  <div style={S.field}>
                    <label style={S.label}>E-POST</label>
                    <input style={S.input} value={nyKund.epost} onChange={e => setNyKund(k => ({ ...k, epost: e.target.value }))}
                      placeholder="epost@exempel.se" onFocus={fo} onBlur={fb} />
                  </div>
                </div>
                <button style={S.miniSaveBtn} onClick={sparaNyKund}>Spara kund →</button>
              </div>
            )}
          </div>

          <div style={S.section}>FASTIGHET</div>

          <div style={{ ...S.field, position: 'relative' }}>
            <label style={S.label}>ADRESS</label>
            <input style={S.input} value={form.fastighet} onChange={e => onAdressChange(e.target.value)}
              placeholder="Sök adress..." onFocus={fo} onBlur={e => { fb(e); setTimeout(() => setAdressSuggestions([]), 200) }} />
            {adressSuggestions.length > 0 && (
              <div style={S.suggestions}>
                {adressSuggestions.map((s, i) => (
                  <div key={i} style={S.suggestion} onMouseDown={() => pickAdress(s)}
                    onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {s.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>POSTNUMMER</label>
              <input style={S.input} value={form.postnummer} onChange={e => set('postnummer', e.target.value)}
                placeholder="123 45" onFocus={fo} onBlur={fb} />
            </div>
            <div style={S.field}>
              <label style={S.label}>ORT</label>
              <input style={S.input} value={form.ort} onChange={e => set('ort', e.target.value)}
                placeholder="Stockholm" onFocus={fo} onBlur={fb} />
            </div>
          </div>

          <div style={{ ...S.section, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>PLANERING</span>
            <button onClick={openKalender} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, color: '#E8C96A', fontSize: 10, fontWeight: 700, padding: '3px 10px', cursor: 'pointer', letterSpacing: 0.5 }}>
              {showKalender ? '− Stäng kalender' : '📅 Visa beläggning'}
            </button>
          </div>

          {showKalender && <MiniKalender ordrar={kalenderOrdrar} valtDatum={form.bokad_datum} onPickDatum={d => set('bokad_datum', d)} />}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={S.field}>
              <label style={S.label}>DATUM</label>
              <input type="date" style={S.input} value={form.bokad_datum} onChange={e => set('bokad_datum', e.target.value)} onFocus={fo} onBlur={fb} />
            </div>
            <div style={S.field}>
              <label style={S.label}>STARTTID</label>
              <input type="time" style={S.input} value={form.bokad_start} onChange={e => set('bokad_start', e.target.value)} onFocus={fo} onBlur={fb} />
            </div>
            <div style={S.field}>
              <label style={S.label}>SLUTTID</label>
              <input type="time" style={S.input} value={form.bokad_slut} onChange={e => set('bokad_slut', e.target.value)} onFocus={fo} onBlur={fb} />
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>PRIS (exkl. moms)</label>
            <input type="number" style={S.input} value={form.pris} onChange={e => set('pris', e.target.value)}
              placeholder="0" onFocus={fo} onBlur={fb} />
          </div>

          <div style={S.field}>
            <label style={S.label}>TILLDELAD PERSONAL</label>
            <div style={S.chips}>
              {PERSONAL.map(p => (
                <div key={p} onClick={() => togglePerson(p)}
                  style={{ ...S.chip, ...(form.tilldelad.includes(p) ? S.chipActive : {}) }}>
                  {p.split(' ')[0]}
                </div>
              ))}
            </div>
          </div>

          <div style={S.section}>INSTRUKTION</div>

          <div style={S.field}>
            <label style={S.label}>ARBETSINSTRUKTION</label>
            <textarea style={S.textarea} value={form.arbetsinstruktion} onChange={e => set('arbetsinstruktion', e.target.value)}
              placeholder="Beskriv vad som ska utföras..." onFocus={fo} onBlur={fb} />
          </div>
        </div>

        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose}>Avbryt</button>
          <button style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Sparar...' : 'Spara order'}
          </button>
        </div>
      </div>
    </div>
  )
}
