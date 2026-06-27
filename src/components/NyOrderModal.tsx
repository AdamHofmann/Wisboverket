'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types'

const KATEGORIER = ['Flytt', 'Städ', 'El', 'Rör', 'Bygg', 'Mark', 'Övrigt']
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
  textarea: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: 80 },
  select: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  chips: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  chip: { padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid #2a2a2a', background: '#111', color: '#888', transition: 'all 0.1s' },
  chipActive: { background: 'rgba(232,201,106,0.12)', borderColor: '#E8C96A', color: '#E8C96A' },
  saveBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '10px 22px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  cancelBtn: { background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 18px', color: '#888', fontSize: 13, cursor: 'pointer' },
  section: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', borderBottom: '1px solid #1e1e1e', paddingBottom: 6, marginBottom: 4 },
}

type Props = {
  onClose: () => void
  onSaved: () => void
}

export default function NyOrderModal({ onClose, onSaved }: Props) {
  const [kunder, setKunder] = useState<Customer[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titel: '',
    kategori: 'Flytt',
    status: 'aktiv',
    customer_id: '',
    fastighet: '',
    postnummer: '',
    ort: '',
    bokad_datum: '',
    bokad_start: '',
    bokad_slut: '',
    tilldelad: [] as string[],
    beskrivning: '',
    intern_anteckning: '',
    pris: '',
  })

  useEffect(() => {
    createClient().from('customers').select('id,namn').order('namn').then(({ data }) => setKunder(data || []))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const togglePerson = (p: string) => setForm(f => ({
    ...f,
    tilldelad: f.tilldelad.includes(p) ? f.tilldelad.filter(x => x !== p) : [...f.tilldelad, p]
  }))

  const handleSave = async () => {
    if (!form.titel.trim()) return
    setSaving(true)
    const supabase = createClient()
    const payload: Record<string, unknown> = {
      titel: form.titel,
      kategori: form.kategori,
      status: form.status,
      customer_id: form.customer_id || null,
      fastighet: form.fastighet || null,
      postnummer: form.postnummer || null,
      ort: form.ort || null,
      bokad_datum: form.bokad_datum || null,
      bokad_start: form.bokad_start || null,
      bokad_slut: form.bokad_slut || null,
      tilldelad: form.tilldelad.length > 0 ? form.tilldelad : null,
      beskrivning: form.beskrivning || null,
      intern_anteckning: form.intern_anteckning || null,
      pris: form.pris ? parseFloat(form.pris) : null,
    }
    const { error } = await supabase.from('orders').insert(payload)
    setSaving(false)
    if (!error) { onSaved(); onClose() }
  }

  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#E8C96A'
  }
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = '#2a2a2a'
  }

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
              placeholder="T.ex. Flytt Kalkbuksvägen 14" onFocus={inputFocus} onBlur={inputBlur} />
          </div>

          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>KATEGORI</label>
              <select style={S.select} value={form.kategori} onChange={e => set('kategori', e.target.value)}
                onFocus={inputFocus} onBlur={inputBlur}>
                {KATEGORIER.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>STATUS</label>
              <select style={S.select} value={form.status} onChange={e => set('status', e.target.value)}
                onFocus={inputFocus} onBlur={inputBlur}>
                <option value="aktiv">Aktiv</option>
                <option value="slutförd">Slutförd</option>
                <option value="inaktiv">Inaktiv</option>
              </select>
            </div>
          </div>

          <div style={S.field}>
            <label style={S.label}>KUND</label>
            <select style={S.select} value={form.customer_id} onChange={e => set('customer_id', e.target.value)}
              onFocus={inputFocus} onBlur={inputBlur}>
              <option value="">— Välj kund —</option>
              {kunder.map(k => <option key={k.id} value={k.id}>{k.namn}</option>)}
            </select>
          </div>

          <div style={S.section}>FASTIGHET</div>

          <div style={S.field}>
            <label style={S.label}>ADRESS</label>
            <input style={S.input} value={form.fastighet} onChange={e => set('fastighet', e.target.value)}
              placeholder="Gatuadress" onFocus={inputFocus} onBlur={inputBlur} />
          </div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>POSTNUMMER</label>
              <input style={S.input} value={form.postnummer} onChange={e => set('postnummer', e.target.value)}
                placeholder="123 45" onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <div style={S.field}>
              <label style={S.label}>ORT</label>
              <input style={S.input} value={form.ort} onChange={e => set('ort', e.target.value)}
                placeholder="Stockholm" onFocus={inputFocus} onBlur={inputBlur} />
            </div>
          </div>

          <div style={S.section}>PLANERING</div>

          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>DATUM</label>
              <input type="date" style={S.input} value={form.bokad_datum} onChange={e => set('bokad_datum', e.target.value)}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <div style={S.field}>
              <label style={S.label}>PRIS (exkl. moms)</label>
              <input type="number" style={S.input} value={form.pris} onChange={e => set('pris', e.target.value)}
                placeholder="0" onFocus={inputFocus} onBlur={inputBlur} />
            </div>
          </div>
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>STARTTID</label>
              <input type="time" style={S.input} value={form.bokad_start} onChange={e => set('bokad_start', e.target.value)}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>
            <div style={S.field}>
              <label style={S.label}>SLUTTID</label>
              <input type="time" style={S.input} value={form.bokad_slut} onChange={e => set('bokad_slut', e.target.value)}
                onFocus={inputFocus} onBlur={inputBlur} />
            </div>
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

          <div style={S.section}>ANTECKNINGAR</div>

          <div style={S.field}>
            <label style={S.label}>BESKRIVNING (visas för kund)</label>
            <textarea style={S.textarea} value={form.beskrivning} onChange={e => set('beskrivning', e.target.value)}
              placeholder="Beskriv uppdraget..." onFocus={inputFocus} onBlur={inputBlur} />
          </div>
          <div style={S.field}>
            <label style={S.label}>INTERN ANTECKNING</label>
            <textarea style={S.textarea} value={form.intern_anteckning} onChange={e => set('intern_anteckning', e.target.value)}
              placeholder="Intern info, syns ej för kund..." onFocus={inputFocus} onBlur={inputBlur} />
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
