'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useMediaQuery'
import Sokfalt from '@/components/Sokfalt'

type Leverantor = { id: string; leverantorsnummer: number | null; namn: string; orgnummer: string | null; telefon: string | null; epost: string | null; adress: string | null; kategori: string | null; anteckningar: string | null; created_at: string }

const EMPTY = { namn: '', orgnummer: '', telefon: '', epost: '', adress: '', kategori: 'material', anteckningar: '' }

export default function LeverantorerPage() {
  const isMobile = useIsMobile()
  const [leverantorer, setLeverantorer] = useState<Leverantor[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [edit, setEdit] = useState<Leverantor | null>(null)
  const [search, setSearch] = useState('')

  const fetch = async () => {
    const { data } = await createClient().from('suppliers').select('*').order('namn')
    setLeverantorer(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const filtered = leverantorer.filter(l =>
    !search || l.namn.toLowerCase().includes(search.toLowerCase()) || l.kategori?.includes(search.toLowerCase())
  )

  return (
    <div style={isMobile ? { overflowX: 'hidden' } : undefined}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0, marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A' }}>Leverantörer</div>
        <button onClick={() => { setEdit(null); setShowModal(true) }}
          style={{ background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: isMobile ? '11px 18px' : '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Ny leverantör
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Sokfalt value={search} onChange={setSearch} placeholder="Sök leverantör, kategori..." style={{ width: isMobile ? '100%' : 260 }} />
      </div>

      <div style={isMobile
        ? { background: 'transparent', border: 'none', borderRadius: 0 }
        : { background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            {leverantorer.length === 0 ? <><div style={{ fontSize: 32, marginBottom: 10 }}>🏭</div><div>Inga leverantörer ännu</div></> : 'Inga träffar'}
          </div>
        ) : isMobile ? (
          <div>
            {filtered.map(l => (
              <div key={l.id} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '12px 14px', marginBottom: 8, cursor: 'pointer' }}
                onClick={() => { setEdit(l); setShowModal(true) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>{l.namn}</div>
                  <button onClick={e => { e.stopPropagation(); setEdit(l); setShowModal(true) }} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '8px 12px', color: '#888', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>Redigera</button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  {l.leverantorsnummer && <span style={{ fontSize: 11, color: '#E8C96A', fontWeight: 700 }}>#{l.leverantorsnummer}</span>}
                  {l.orgnummer && <span style={{ fontSize: 11, color: '#555', fontWeight: 400 }}>{l.orgnummer}</span>}
                  <span style={{ fontSize: 12, color: '#888' }}>{l.kategori || '—'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  {l.telefon && <a href={`tel:${l.telefon}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 13 }} onClick={e => e.stopPropagation()}>{l.telefon}</a>}
                  {l.epost && <a href={`mailto:${l.epost}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 12, wordBreak: 'break-all' as const }} onClick={e => e.stopPropagation()}>{l.epost}</a>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr>
                {['NAMN', 'KATEGORI', 'TELEFON', 'E-POST', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{ cursor: 'pointer' }}
                  onClick={() => { setEdit(l); setShowModal(true) }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>
                    <div>{l.namn}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      {l.leverantorsnummer && <span style={{ fontSize: 11, color: '#E8C96A', fontWeight: 700 }}>#{l.leverantorsnummer}</span>}
                      {l.orgnummer && <span style={{ fontSize: 11, color: '#555', fontWeight: 400 }}>{l.orgnummer}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 12, color: '#888' }}>{l.kategori || '—'}</td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0' }}>
                    {l.telefon ? <a href={`tel:${l.telefon}`} style={{ color: '#60a5fa', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{l.telefon}</a> : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 12, color: '#d0d0d0' }}>
                    {l.epost ? <a href={`mailto:${l.epost}`} style={{ color: '#60a5fa', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>{l.epost}</a> : '—'}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
                    <button onClick={e => { e.stopPropagation(); setEdit(l); setShowModal(true) }} style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', color: '#888', fontSize: 11, cursor: 'pointer' }}>Redigera</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && <LeverantorModal leverantor={edit} onClose={() => setShowModal(false)} onSaved={() => { fetch(); setShowModal(false) }} />}
    </div>
  )
}

function LeverantorModal({ leverantor, onClose, onSaved }: { leverantor: Leverantor | null; onClose: () => void; onSaved: () => void }) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState(leverantor ? { ...leverantor } : { ...EMPTY })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))

  const spara = async () => {
    if (!(form as any).namn.trim()) return
    setSaving(true)
    const sb = createClient()
    const { id: _id, created_at: _ca, ...payload } = form as any
    const { error } = leverantor
      ? await sb.from('suppliers').update(payload).eq('id', leverantor.id)
      : await sb.from('suppliers').insert(payload)
    setSaving(false)
    if (!error) onSaved()
  }

  const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#2a2a2a' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={isMobile
        ? { background: '#1a1a1a', border: 'none', borderRadius: 0, width: '100%', maxWidth: '100vw', display: 'flex', flexDirection: 'column' as const }
        : { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 480 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>
            {leverantor ? 'Redigera' : 'Ny leverantör'}
            {leverantor?.leverantorsnummer && <span style={{ fontSize: 12, color: '#E8C96A', fontWeight: 700, marginLeft: 8 }}>#{leverantor.leverantorsnummer}</span>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12, ...(isMobile ? { flex: 1, overflowY: 'auto' as const } : {}) }}>
          {[
            { key: 'namn', label: 'NAMN *', placeholder: 'Bauhaus, Ahlsell...' },
            { key: 'orgnummer', label: 'ORG.NUMMER', placeholder: '556123-4567' },
            { key: 'telefon', label: 'TELEFON', placeholder: '010-XXX XX XX' },
            { key: 'epost', label: 'E-POST', placeholder: 'info@ex.se' },
            { key: 'adress', label: 'ADRESS', placeholder: 'Gatuadress' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{label}</label>
              <input spellCheck={false} style={inp} value={(form as any)[key] || ''} onChange={e => set(key, e.target.value)} placeholder={placeholder} onFocus={fo} onBlur={fb} />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>KATEGORI</label>
            <select style={inp} value={(form as any).kategori || 'material'} onChange={e => set('kategori', e.target.value)} onFocus={fo} onBlur={fb}>
              {['material', 'verktyg', 'transport', 'tjänst', 'övrigt'].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>ANTECKNINGAR</label>
            <textarea spellCheck={true} style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} value={(form as any).anteckningar || ''} onChange={e => set('anteckningar', e.target.value)} onFocus={fo} onBlur={fb} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end', ...(isMobile ? { position: 'sticky' as const, bottom: 0, background: '#1a1a1a' } : {}) }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
          <button onClick={spara} disabled={saving} style={{ padding: '9px 24px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}
