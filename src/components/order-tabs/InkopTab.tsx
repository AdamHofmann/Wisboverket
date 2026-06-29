'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Inkop = { id: string; beskrivning: string; leverantor: string | null; belopp: number; datum: string | null; kategori: string }

const KAT: { id: string; label: string; icon: string }[] = [
  { id: 'material', label: 'Material', icon: '📦' },
  { id: 'verktyg', label: 'Verktyg', icon: '🔧' },
  { id: 'konsumtion', label: 'Konsumtionsmaterial', icon: '🛒' },
  { id: 'transport', label: 'Transporter', icon: '🚗' },
  { id: 'ovrigt', label: 'Övrigt', icon: '☑️' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  card: { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 18px', marginBottom: 14 },
  cardTitle: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 14 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: '#555' },
  input: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  select: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  addBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginTop: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, marginBottom: 6 },
  delBtn: { background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', color: '#f87171', fontSize: 11, cursor: 'pointer', marginLeft: 8 },
  tot: { display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid #1e1e1e', marginTop: 8 },
}

const fmtKr = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 0 }) + ' kr'

export default function InkopTab({ orderId }: { orderId: string }) {
  const [inkop, setInkop] = useState<Inkop[]>([])
  const [beskrivning, setBeskrivning] = useState('')
  const [leverantor, setLeverantor] = useState('')
  const [belopp, setBelopp] = useState('')
  const [datum, setDatum] = useState('')
  const [kategori, setKategori] = useState('material')
  const [saving, setSaving] = useState(false)

  const fetchInkop = async () => {
    const { data } = await createClient().from('order_inkop').select('*').eq('order_id', orderId).order('created_at')
    setInkop(data || [])
  }

  useEffect(() => { fetchInkop() }, [orderId])

  const laggTill = async () => {
    if (!beskrivning || !belopp) return
    setSaving(true)
    await createClient().from('order_inkop').insert({
      order_id: orderId,
      beskrivning,
      leverantor: leverantor || null,
      belopp: parseFloat(belopp),
      datum: datum || null,
      kategori,
    })
    setBeskrivning(''); setLeverantor(''); setBelopp(''); setDatum('')
    await fetchInkop()
    setSaving(false)
  }

  const taBort = async (id: string) => {
    await createClient().from('order_inkop').delete().eq('id', id)
    fetchInkop()
  }

  const tot = inkop.reduce((s, i) => s + i.belopp, 0)
  const katInfo = (id: string) => KAT.find(k => k.id === id) || KAT[0]

  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#2a2a2a' }

  return (
    <div>
      <div style={S.card}>
        <div style={S.cardTitle}>LÄGG TILL INKÖP</div>

        <div style={{ ...S.field, marginBottom: 10 }}>
          <label style={S.label}>BESKRIVNING</label>
          <input style={S.input} value={beskrivning} onChange={e => setBeskrivning(e.target.value)} placeholder="Vad köptes in?" onFocus={fo} onBlur={fb} />
        </div>

        <div style={S.grid2}>
          <div style={S.field}>
            <label style={S.label}>LEVERANTÖR</label>
            <input style={S.input} value={leverantor} onChange={e => setLeverantor(e.target.value)} placeholder="Bauhaus, Ahlsell..." onFocus={fo} onBlur={fb} />
          </div>
          <div style={S.field}>
            <label style={S.label}>BELOPP (inkl. moms)</label>
            <input type="number" style={S.input} value={belopp} onChange={e => setBelopp(e.target.value)} placeholder="0" onFocus={fo} onBlur={fb} />
          </div>
        </div>

        <div style={S.grid2}>
          <div style={S.field}>
            <label style={S.label}>DATUM</label>
            <input type="date" style={S.input} value={datum} onChange={e => setDatum(e.target.value)} onFocus={fo} onBlur={fb} />
          </div>
          <div style={S.field}>
            <label style={S.label}>KATEGORI</label>
            <select style={S.select} value={kategori} onChange={e => setKategori(e.target.value)} onFocus={fo} onBlur={fb}>
              {KAT.map(k => <option key={k.id} value={k.id}>{k.icon} {k.label}</option>)}
            </select>
          </div>
        </div>

        <button style={S.addBtn} onClick={laggTill} disabled={saving || !beskrivning || !belopp}>
          {saving ? 'Sparar...' : '+ Lägg till inköp'}
        </button>
      </div>

      {inkop.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>INKÖP ({inkop.length})</div>
          {inkop.map(i => {
            const k = katInfo(i.kategori)
            return (
              <div key={i.id} style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#d0d0d0' }}>{k.icon} {i.beskrivning}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                    {i.leverantor && `${i.leverantor} · `}
                    {i.datum ? new Date(i.datum).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : ''}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f87171', marginLeft: 16 }}>{fmtKr(i.belopp)}</div>
                <button style={S.delBtn} onClick={() => taBort(i.id)}>✕</button>
              </div>
            )
          })}
          <div style={S.tot}>
            <div style={{ fontSize: 12, color: '#555' }}>Totalt inköp</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171' }}>{fmtKr(tot)}</div>
          </div>
        </div>
      )}

      {inkop.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
          <div style={{ fontSize: 13 }}>Inga inköp registrerade</div>
        </div>
      )}
    </div>
  )
}
