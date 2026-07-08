'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'

type Artikel = { id: string; artikelnummer: string | null; namn: string; enhet: string; a_pris: number; kostnad_per_enhet: number; kategori: string | null; aktiv: boolean; konto: string | null; momssats: number; hogia_artikel_id: string | null; hogia_synkad_at: string | null }

const KATEGORIER = ['bemanning', 'fordon', 'material', 'restid', 'tillagg']
const KAT_LABEL: Record<string, string> = { bemanning: 'Bemanning', fordon: 'Fordon', material: 'Material', restid: 'Restid', tillagg: 'Tillägg' }

const fmtKr = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 0 }) + ' kr'

const EMPTY = { artikelnummer: '', namn: '', enhet: 'tim', a_pris: 0, kostnad_per_enhet: 0, kategori: 'bemanning', aktiv: true, konto: '', momssats: 25 }

export default function ArtikalarPage() {
  const toast = useToast()
  const [artiklar, setArtiklar] = useState<Artikel[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Artikel | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [newArtikel, setNewArtikel] = useState(false)

  const fetch = async () => {
    const { data } = await createClient().from('artiklar').select('*').order('kategori').order('namn')
    setArtiklar(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const toggleAktiv = async (a: Artikel) => {
    const { error } = await createClient().from('artiklar').update({ aktiv: !a.aktiv }).eq('id', a.id)
    if (error) { toast.error('Kunde inte uppdatera artikeln: ' + error.message); return }
    fetch()
  }

  // Nästa lediga artikelnummer (A + löpnummer, baserat på befintliga)
  const nastaArtikelnummer = () => {
    const max = artiklar.reduce((m, a) => {
      const n = /^A(\d+)$/i.exec(a.artikelnummer || '')
      return n ? Math.max(m, parseInt(n[1], 10)) : m
    }, 0)
    return 'A' + String(max + 1).padStart(3, '0')
  }

  const grouped = KATEGORIER.reduce((acc, k) => {
    acc[k] = artiklar.filter(a => a.kategori === k)
    return acc
  }, {} as Record<string, Artikel[]>)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A' }}>Artiklar <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({artiklar.length})</span></div>
        <button onClick={() => { setEdit(null); setNewArtikel(true); setShowModal(true) }}
          style={{ background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Ny artikel
        </button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div> : (
        KATEGORIER.map(kat => {
          const rader = grouped[kat] || []
          if (rader.length === 0) return null
          return (
            <div key={kat} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#555', marginBottom: 10 }}>{KAT_LABEL[kat] || kat.toUpperCase()}</div>
              <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>ARTIKEL</th>
                      <th style={{ textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>ENHET</th>
                      <th style={{ textAlign: 'right' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>À-PRIS</th>
                      <th style={{ textAlign: 'right' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>KOSTNAD</th>
                      <th style={{ textAlign: 'right' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>MARGINAL</th>
                      <th style={{ padding: '8px 14px', borderBottom: '1px solid #1e1e1e' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rader.map(a => {
                      const marginal = a.a_pris > 0 ? ((a.a_pris - a.kostnad_per_enhet) / a.a_pris) * 100 : 0
                      const margFarg = marginal >= 30 ? '#4ade80' : marginal >= 15 ? '#fb923c' : '#f87171'
                      return (
                        <tr key={a.id}
                          onClick={() => { setEdit(a); setNewArtikel(false); setShowModal(true) }}
                          style={{ opacity: a.aktiv ? 1 : 0.4, cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0', verticalAlign: 'middle' as const }}>
                            <div style={{ fontWeight: 600 }}>{a.namn}</div>
                            {a.artikelnummer && <div style={{ fontSize: 11, color: '#555' }}>{a.artikelnummer}</div>}
                          </td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#888' }}>{a.enhet}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#4ade80', fontWeight: 600, textAlign: 'right' as const }}>{fmtKr(a.a_pris)}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#f87171', textAlign: 'right' as const }}>{fmtKr(a.kostnad_per_enhet)}</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, fontWeight: 700, color: margFarg, textAlign: 'right' as const }}>{marginal.toFixed(0)}%</td>
                          <td style={{ padding: '11px 14px', borderBottom: '1px solid #1a1a1a', textAlign: 'right' as const }}>
                            <button onClick={e => { e.stopPropagation(); toggleAktiv(a) }}
                              style={{ background: 'none', border: `1px solid ${a.aktiv ? '#2a2a2a' : '#4ade8044'}`, borderRadius: 6, padding: '3px 10px', color: a.aktiv ? '#555' : '#4ade80', fontSize: 11, cursor: 'pointer' }}>
                              {a.aktiv ? 'Inaktivera' : 'Aktivera'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      )}

      {showModal && (
        <ArtikelModal artikel={newArtikel ? null : edit} nastaNummer={nastaArtikelnummer()} onClose={() => setShowModal(false)} onSaved={() => { fetch(); setShowModal(false) }} />
      )}
    </div>
  )
}

function ArtikelModal({ artikel, nastaNummer, onClose, onSaved }: { artikel: Artikel | null; nastaNummer: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(artikel ? { ...artikel } : { ...EMPTY, artikelnummer: nastaNummer })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const spara = async () => {
    if (!form.namn.trim()) { setError('Namn krävs'); return }
    setSaving(true)
    const sb = createClient()
    const { id: _id, ...payload } = form as any
    const { error: err } = artikel
      ? await sb.from('artiklar').update(payload).eq('id', artikel.id)
      : await sb.from('artiklar').insert(payload)
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#E8C96A' }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#2a2a2a' }

  const marginal = parseFloat(String(form.a_pris)) > 0
    ? ((parseFloat(String(form.a_pris)) - parseFloat(String(form.kostnad_per_enhet))) / parseFloat(String(form.a_pris)) * 100).toFixed(0)
    : '0'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 480 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{artikel ? 'Redigera artikel' : 'Ny artikel'}</div>
            {artikel && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: (artikel.hogia_synkad_at ? '#4ade80' : '#666') + '1a', color: artikel.hogia_synkad_at ? '#4ade80' : '#888', border: `1px solid ${artikel.hogia_synkad_at ? '#4ade80' : '#666'}44` }}>
                {artikel.hogia_synkad_at ? 'Synkad' : 'Ej synkad'}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="ARTIKELNUMMER"><input spellCheck={false} style={{ ...inp, color: '#888', cursor: 'not-allowed' }} value={form.artikelnummer || ''} readOnly title="Sätts automatiskt av systemet" /></MF>
            <MF label="KATEGORI">
              <select style={inp} value={form.kategori || 'bemanning'} onChange={e => set('kategori', e.target.value)} onFocus={fo} onBlur={fb}>
                {KATEGORIER.map(k => <option key={k} value={k}>{KAT_LABEL[k]}</option>)}
              </select>
            </MF>
          </div>
          <MF label="NAMN *"><input spellCheck={true} style={inp} value={form.namn} onChange={e => set('namn', e.target.value)} placeholder="Artikelnamn" onFocus={fo} onBlur={fb} /></MF>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <MF label="ENHET">
              <select style={inp} value={form.enhet} onChange={e => set('enhet', e.target.value)} onFocus={fo} onBlur={fb}>
                {['tim', 'dag', 'st', 'kr', 'm2', 'meter'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </MF>
            <MF label="À-PRIS (kr)"><input spellCheck={false} type="number" style={inp} value={form.a_pris} onChange={e => set('a_pris', parseFloat(e.target.value))} onFocus={fo} onBlur={fb} /></MF>
            <MF label="KOSTNAD (kr)"><input spellCheck={false} type="number" style={inp} value={form.kostnad_per_enhet} onChange={e => set('kostnad_per_enhet', parseFloat(e.target.value))} onFocus={fo} onBlur={fb} /></MF>
          </div>
          <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#555' }}>
            Marginal: <strong style={{ color: parseFloat(marginal) >= 30 ? '#4ade80' : parseFloat(marginal) >= 15 ? '#fb923c' : '#f87171' }}>{marginal}%</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="INTÄKTSKONTO"><input spellCheck={false} style={inp} value={form.konto || ''} onChange={e => set('konto', e.target.value)} placeholder="3010" onFocus={fo} onBlur={fb} /></MF>
            <MF label="MOMSSATS">
              <select style={inp} value={form.momssats ?? 25} onChange={e => set('momssats', parseInt(e.target.value))} onFocus={fo} onBlur={fb}>
                {[25, 12, 6, 0].map(m => <option key={m} value={m}>{m}%</option>)}
              </select>
            </MF>
          </div>
          {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
          <button onClick={spara} disabled={saving} style={{ padding: '9px 24px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MF({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{label}</label>{children}</div>
}
