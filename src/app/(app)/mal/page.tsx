'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useConfirm } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { fmtKr } from '@/lib/format'

type FakturaRad = { order_id: string | null; totalt: number; typ: string }
type OrderRad = { id: string; created_at: string; status: string }
type InkopRad = { order_id: string; belopp: number }
type Mal = { id: string; namn: string; typ: string; ar: number; mal_varde: number; manuellt_varde: number }

const G = '#E8C96A'
const TYP_ICON: Record<string, string> = { omsattning: '💰', antal_ordrar: '📋', vinst: '📈', fritt: '✏️' }
const TYP_NAMN: Record<string, string> = { omsattning: 'Omsättning', antal_ordrar: 'Antal ordrar', vinst: 'Vinst', fritt: 'Fritt mål' }

export default function MalPage() {
  const isMobile = useIsMobile()
  const confirm = useConfirm()
  const toast = useToast()
  const [mal, setMal] = useState<Mal[]>([])
  const [fakturor, setFakturor] = useState<FakturaRad[]>([])
  const [orders, setOrders] = useState<OrderRad[]>([])
  const [inkop, setInkop] = useState<InkopRad[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editMal, setEditMal] = useState<Mal | null>(null)

  const fetchAll = async () => {
    const sb = createClient()
    const [m, f, o, i] = await Promise.all([
      sb.from('mal').select('*').order('ar', { ascending: false }),
      sb.from('fakturor').select('order_id,totalt,typ'),
      sb.from('orders').select('id,created_at,status'),
      sb.from('order_inkop').select('order_id,belopp'),
    ])
    setMal(m.data || []); setFakturor(f.data || []); setOrders(o.data || []); setInkop(i.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const kostnadPerOrder = useMemo(() => {
    const m: Record<string, number> = {}
    inkop.forEach(i => { m[i.order_id] = (m[i.order_id] || 0) + i.belopp })
    return m
  }, [inkop])

  const progress = (m: Mal) => {
    const arsOrders = orders.filter(o => new Date(o.created_at).getFullYear() === m.ar && o.status !== 'inaktiv')
    const arsOrderIds = new Set(arsOrders.map(o => o.id))
    const arsFakturor = fakturor.filter(f => f.typ === 'faktura' && f.order_id && arsOrderIds.has(f.order_id))
    if (m.typ === 'omsattning') return arsFakturor.reduce((s, f) => s + f.totalt, 0)
    if (m.typ === 'antal_ordrar') return arsOrders.length
    if (m.typ === 'vinst') {
      const intakt = arsFakturor.reduce((s, f) => s + f.totalt, 0)
      const kostnad = arsOrders.reduce((s, o) => s + (kostnadPerOrder[o.id] || 0), 0)
      return intakt - kostnad
    }
    return m.manuellt_varde || 0
  }

  const taBort = async (id: string) => {
    if (!(await confirm({ message: 'Ta bort målet?', danger: true, confirmLabel: 'Ta bort' }))) return
    const { error: err } = await createClient().from('mal').delete().eq('id', id)
    if (err) { toast.error('Kunde inte ta bort målet: ' + err.message); return }
    fetchAll()
  }

  const uppdateraManuellt = async (m: Mal) => {
    const v = window.prompt('Uppdatera nuläge:', String(m.manuellt_varde || 0))
    if (v === null) return
    const { error: err } = await createClient().from('mal').update({ manuellt_varde: Number(v) }).eq('id', m.id)
    if (err) { toast.error('Kunde inte uppdatera nuläget: ' + err.message); return }
    fetchAll()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 0, marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: G }}>Mål</div>
        <button onClick={() => { setEditMal(null); setShowModal(true) }}
          style={{ background: G, color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Nytt mål
        </button>
      </div>

      {mal.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#555', background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div><div>Inga mål ännu</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
          {mal.map(m => {
            const prog = progress(m)
            const pct = m.mal_varde > 0 ? Math.min(100, Math.round((prog / m.mal_varde) * 100)) : 0
            const fmt = m.typ === 'antal_ordrar' ? (v: number) => v + ' st' : fmtKr
            const onTrack = pct >= Math.round(((new Date().getMonth() + 1) / 12) * 100) - 5
            const barColor = pct >= 100 ? '#4ade80' : onTrack ? G : '#f87171'
            return (
              <div key={m.id} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>{TYP_ICON[m.typ] || '🎯'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#e0e0e0', marginBottom: 3 }}>{m.namn}</div>
                    <div style={{ fontSize: 10, color: '#555' }}>{TYP_NAMN[m.typ]} · {m.ar}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {m.typ === 'fritt' && (
                      <button onClick={() => uppdateraManuellt(m)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: 10 }}>Uppdatera</button>
                    )}
                    <button onClick={() => { setEditMal(m); setShowModal(true) }} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                    <button onClick={() => taBort(m.id)} style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#888', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>🗑</button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: barColor }}>{fmt(prog)}</span>
                  <span style={{ fontSize: 11, color: '#555' }}>av {fmt(m.mal_varde)}</span>
                </div>
                <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width 0.3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && <MalModal existing={editMal} isMobile={isMobile} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchAll() }} />}
    </div>
  )
}

function MalModal({ existing, isMobile, onClose, onSaved }: { existing: Mal | null; isMobile: boolean; onClose: () => void; onSaved: () => void }) {
  const arNu = new Date().getFullYear()
  const [form, setForm] = useState({
    namn: existing?.namn || '',
    typ: existing?.typ || 'omsattning',
    mal_varde: existing?.mal_varde || 0,
    ar: existing?.ar || arNu,
    manuellt_varde: existing?.manuellt_varde || 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const spara = async () => {
    if (!form.namn.trim()) { setError('Namn krävs'); return }
    setSaving(true); setError('')
    const sb = createClient()
    const { error: err } = existing
      ? await sb.from('mal').update(form).eq('id', existing.id)
      : await sb.from('mal').insert(form)
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
  const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = G }
  const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => { e.target.style.borderColor = '#2a2a2a' }

  const TYP_OPTS = [
    { v: 'omsattning', l: '💰 Omsättning (fakturerat)' },
    { v: 'antal_ordrar', l: '📋 Antal ordrar' },
    { v: 'vinst', l: '📈 Vinst (intäkt − kostnad)' },
    { v: 'fritt', l: '✏️ Fritt mål (manuell)' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: isMobile ? 'none' : '1px solid #2a2a2a', borderRadius: isMobile ? 0 : 14, width: '100%', maxWidth: isMobile ? '100vw' : 480, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{existing ? 'Redigera mål' : 'Nytt mål'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12, ...(isMobile ? { flex: 1, overflowY: 'auto' } : {}) }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>NAMN</label>
            <input style={inp} value={form.namn} onChange={e => set('namn', e.target.value)} placeholder="T.ex. Årsomsättning 2026" onFocus={fo} onBlur={fb} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>TYP</label>
            <select style={inp} value={form.typ} onChange={e => set('typ', e.target.value)} onFocus={fo} onBlur={fb}>
              {TYP_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>MÅLVÄRDE</label>
              <input type="number" style={inp} value={form.mal_varde} onChange={e => set('mal_varde', parseFloat(e.target.value) || 0)} onFocus={fo} onBlur={fb} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>ÅR</label>
              <input type="number" style={inp} value={form.ar} onChange={e => set('ar', parseInt(e.target.value) || arNu)} onFocus={fo} onBlur={fb} />
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: '#f87171' }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end', ...(isMobile ? { position: 'sticky', bottom: 0, background: '#1a1a1a' } : {}) }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
          <button onClick={spara} disabled={saving} style={{ padding: '9px 24px', background: G, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}
