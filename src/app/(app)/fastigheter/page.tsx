'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Fastighet, FastighetUnderhall, Order } from '@/types'
import AdressInput from '@/components/AdressInput'

const PRIO_COLOR: Record<string, string> = { låg: '#636366', normal: '#60a5fa', hög: '#fb923c', akut: '#f87171' }
const STATUS_ICON: Record<string, string> = { öppen: '🔴', pågående: '🟡', stängd: '✅' }
const PERSONAL = ['Adam', 'Isabelle', 'Kalle', 'Maria', 'Erik', 'Sofia']

const inp: React.CSSProperties = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }
const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#E8C96A' }
const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#2a2a2a' }
const fmtKr = (n: number) => n.toLocaleString('sv-SE') + ' kr'

type FastighetMedStats = Fastighet & { _ordrar: number; _underhall: number; _intakt: number; _kostnad: number; _tb: number }

export default function FastigheterPage() {
  const [fastigheter, setFastigheter] = useState<FastighetMedStats[]>([])
  const [vald, setVald] = useState<Fastighet | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Fastighet | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchFastigheter = async () => {
    const sb = createClient()
    const { data: f } = await sb.from('fastigheter').select('*').order('namn')
    if (!f) { setLoading(false); return }

    const enriched = await Promise.all(f.map(async (fst) => {
      const [{ data: fstOrdrar }, { count: underhall }] = await Promise.all([
        sb.from('orders').select('id, fakturerat_belopp').eq('fastighet_id', fst.id),
        sb.from('fastighet_underhall').select('*', { count: 'exact', head: true }).eq('fastighet_id', fst.id).neq('status', 'stängd'),
      ])

      const orderIds = (fstOrdrar || []).map(o => o.id)
      const intakt = (fstOrdrar || []).reduce((s, o) => s + (o.fakturerat_belopp || 0), 0)

      let kostnad = 0
      if (orderIds.length > 0) {
        const [{ data: tid }, { data: inkop }] = await Promise.all([
          sb.from('order_tid_rader').select('total_kostnad').in('order_id', orderIds),
          sb.from('order_inkop').select('belopp').in('order_id', orderIds),
        ])
        kostnad = (tid || []).reduce((s, r) => s + (r.total_kostnad || 0), 0)
          + (inkop || []).reduce((s, r) => s + (r.belopp || 0), 0)
      }

      return {
        ...fst,
        _ordrar: orderIds.length,
        _underhall: underhall || 0,
        _intakt: intakt,
        _kostnad: kostnad,
        _tb: intakt - kostnad,
      }
    }))

    setFastigheter(enriched)
    setLoading(false)
  }

  useEffect(() => { fetchFastigheter() }, [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A' }}>
          Fastigheter <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({fastigheter.length})</span>
        </div>
        <button onClick={() => { setEditTarget(null); setShowModal(true) }}
          style={{ background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Ny fastighet
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
      ) : fastigheter.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <div>Inga fastigheter registrerade ännu</div>
          <div style={{ fontSize: 12, color: '#333', marginTop: 6 }}>Lägg till en fastighet som projekt</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {fastigheter.map(f => (
            <div key={f.id} onClick={() => setVald(f)}
              style={{ background: '#141414', border: `1px solid ${vald?.id === f.id ? '#E8C96A55' : '#1e1e1e'}`, borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseEnter={e => { if (vald?.id !== f.id) e.currentTarget.style.borderColor = '#2a2a2a' }}
              onMouseLeave={e => { if (vald?.id !== f.id) e.currentTarget.style.borderColor = '#1e1e1e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#f2f2f7' }}>{f.namn}</div>
                  <div style={{ fontSize: 12, color: '#636366', marginTop: 2 }}>{f.adress}{f.ort ? `, ${f.ort}` : ''}</div>
                  {f.beteckning && <div style={{ fontSize: 11, color: '#E8C96A88', marginTop: 2 }}>{f.beteckning}</div>}
                </div>
                <button onClick={e => { e.stopPropagation(); setEditTarget(f); setShowModal(true) }}
                  style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, padding: 4 }}>✏️</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 3 }}>ORDRAR</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#aeaeb2' }}>{f._ordrar}</div>
                </div>
                <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 3 }}>UNDERHÅLL</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: f._underhall > 0 ? '#fb923c' : '#636366' }}>{f._underhall}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 3 }}>INTÄKT</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#4ade80' }}>{fmtKr(f._intakt)}</div>
                </div>
                <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 3 }}>KOSTNAD</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#f87171' }}>{fmtKr(f._kostnad)}</div>
                </div>
                <div style={{ background: '#0d0d0d', borderRadius: 8, padding: '8px 10px', border: `1px solid ${(f._tb >= 0 ? '#4ade80' : '#f87171')}33` }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 3 }}>TB</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: f._tb >= 0 ? '#4ade80' : '#f87171' }}>
                    {fmtKr(f._tb)}
                    {f._intakt > 0 && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75, marginLeft: 5 }}>({((f._tb / f._intakt) * 100).toFixed(0)}%)</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sidopanel */}
      {vald && <div onClick={() => setVald(null)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />}
      {vald && <FastighetPanel fastighet={vald} onClose={() => setVald(null)} onUpdated={fetchFastigheter} />}

      {showModal && (
        <FastighetModal fastighet={editTarget} onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchFastigheter() }} />
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────
function FastighetPanel({ fastighet, onClose, onUpdated }: { fastighet: Fastighet; onClose: () => void; onUpdated: () => void }) {
  const [tab, setTab] = useState<'ordrar' | 'underhall'>('ordrar')
  const [ordrar, setOrdrar] = useState<any[]>([])
  const [underhall, setUnderhall] = useState<FastighetUnderhall[]>([])
  const [nyUnderhall, setNyUnderhall] = useState(false)
  const [uForm, setUForm] = useState({ titel: '', beskrivning: '', prioritet: 'normal', assignad_till: '' })
  const [sparar, setSparar] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.from('orders').select('*, customer:customers(namn)').eq('fastighet_id', fastighet.id).order('created_at', { ascending: false })
      .then(({ data }) => setOrdrar(data || []))
    sb.from('fastighet_underhall').select('*').eq('fastighet_id', fastighet.id).order('created_at', { ascending: false })
      .then(({ data }) => setUnderhall(data || []))
  }, [fastighet.id])

  const laggTillUnderhall = async () => {
    if (!uForm.titel) return
    setSparar(true)
    await createClient().from('fastighet_underhall').insert({
      fastighet_id: fastighet.id,
      titel: uForm.titel,
      beskrivning: uForm.beskrivning || null,
      prioritet: uForm.prioritet,
      assignad_till: uForm.assignad_till || null,
    })
    const { data } = await createClient().from('fastighet_underhall').select('*').eq('fastighet_id', fastighet.id).order('created_at', { ascending: false })
    setUnderhall(data || [])
    setUForm({ titel: '', beskrivning: '', prioritet: 'normal', assignad_till: '' })
    setNyUnderhall(false)
    setSparar(false)
    onUpdated()
  }

  const byttStatus = async (id: string, status: string) => {
    await createClient().from('fastighet_underhall').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setUnderhall(u => u.map(r => r.id === id ? { ...r, status: status as any } : r))
    onUpdated()
  }

  const STATUS_COLOR: Record<string, string> = { aktiv: '#4ade80', slutförd: '#60a5fa', inaktiv: '#555' }

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 680, background: '#1a1a1a', zIndex: 200, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.6)', borderLeft: '1px solid #222' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #222', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f2f2f7' }}>{fastighet.namn}</div>
            <div style={{ fontSize: 12, color: '#636366', marginTop: 3 }}>
              {fastighet.adress}{fastighet.postnummer ? ` · ${fastighet.postnummer}` : ''}{fastighet.ort ? ` ${fastighet.ort}` : ''}
            </div>
            {fastighet.beteckning && <div style={{ fontSize: 11, color: '#E8C96A', marginTop: 2 }}>{fastighet.beteckning}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#636366', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
          {[{ id: 'ordrar', label: `Ordrar (${ordrar.length})` }, { id: 'underhall', label: `Underhåll (${underhall.filter(u => u.status !== 'stängd').length} öppna)` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: tab === t.id ? '#E8C96A' : '#252528', color: tab === t.id ? '#000' : '#8e8e93' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {tab === 'ordrar' && (
          ordrar.length === 0
            ? <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>Inga ordrar kopplade till denna fastighet</div>
            : ordrar.map((o: any) => (
              <div key={o.id} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f2f2f7' }}>{o.titel}</div>
                    <div style={{ fontSize: 11, color: '#636366', marginTop: 2 }}>
                      {o.order_number && `${o.order_number} · `}
                      {o.bokad_datum ? new Date(o.bokad_datum).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : ''}
                      {o.customer?.namn ? ` · ${o.customer.namn}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 8, background: (STATUS_COLOR[o.status] || '#555') + '22', color: STATUS_COLOR[o.status] || '#555', border: `1px solid ${STATUS_COLOR[o.status] || '#555'}44` }}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))
        )}

        {tab === 'underhall' && (
          <div>
            <button onClick={() => setNyUnderhall(v => !v)}
              style={{ width: '100%', padding: '10px', background: nyUnderhall ? 'none' : '#E8C96A', color: nyUnderhall ? '#8e8e93' : '#000', border: nyUnderhall ? '1px solid #2a2a2a' : 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14 }}>
              {nyUnderhall ? 'Avbryt' : '+ Nytt underhållsärende'}
            </button>

            {nyUnderhall && (
              <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input style={inp} placeholder="Titel *" value={uForm.titel} onChange={e => setUForm(f => ({ ...f, titel: e.target.value }))} onFocus={fo} onBlur={fb} />
                <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Beskrivning..." value={uForm.beskrivning} onChange={e => setUForm(f => ({ ...f, beskrivning: e.target.value }))} onFocus={fo} onBlur={fb} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <select style={inp} value={uForm.prioritet} onChange={e => setUForm(f => ({ ...f, prioritet: e.target.value }))} onFocus={fo} onBlur={fb}>
                    <option value="låg">Låg</option>
                    <option value="normal">Normal</option>
                    <option value="hög">Hög</option>
                    <option value="akut">Akut 🚨</option>
                  </select>
                  <select style={inp} value={uForm.assignad_till} onChange={e => setUForm(f => ({ ...f, assignad_till: e.target.value }))} onFocus={fo} onBlur={fb}>
                    <option value="">— Tilldela —</option>
                    {PERSONAL.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <button onClick={laggTillUnderhall} disabled={sparar || !uForm.titel}
                  style={{ padding: '9px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', opacity: !uForm.titel ? 0.5 : 1 }}>
                  {sparar ? 'Sparar...' : 'Lägg till'}
                </button>
              </div>
            )}

            {underhall.length === 0 && !nyUnderhall
              ? <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>Inga underhållsärenden</div>
              : underhall.map(u => (
                <div key={u.id} style={{ background: '#141414', border: `1px solid ${u.status === 'stängd' ? '#1e1e1e' : PRIO_COLOR[u.prioritet] + '33'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 8, opacity: u.status === 'stängd' ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span>{STATUS_ICON[u.status]}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f2f2f7' }}>{u.titel}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: PRIO_COLOR[u.prioritet] + '22', color: PRIO_COLOR[u.prioritet] }}>{u.prioritet}</span>
                      </div>
                      {u.beskrivning && <div style={{ fontSize: 11, color: '#636366', marginTop: 4, marginLeft: 22 }}>{u.beskrivning}</div>}
                      {u.assignad_till && <div style={{ fontSize: 11, color: '#aeaeb2', marginTop: 4, marginLeft: 22 }}>→ {u.assignad_till}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginLeft: 10 }}>
                      {u.status === 'öppen' && <SBtn label="Påbörja" color="#fb923c" onClick={() => byttStatus(u.id, 'pågående')} />}
                      {u.status === 'pågående' && <SBtn label="Stäng" color="#4ade80" onClick={() => byttStatus(u.id, 'stängd')} />}
                      {u.status === 'stängd' && <SBtn label="Öppna" color="#60a5fa" onClick={() => byttStatus(u.id, 'öppen')} />}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}

function SBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color}44`, background: color + '11', color, cursor: 'pointer' }}>
      {label}
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function FastighetModal({ fastighet, onClose, onSaved }: { fastighet: Fastighet | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ namn: fastighet?.namn || '', adress: fastighet?.adress || '', postnummer: fastighet?.postnummer || '', ort: fastighet?.ort || '', beteckning: fastighet?.beteckning || '', anteckningar: fastighet?.anteckningar || '' })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const spara = async () => {
    if (!form.namn || !form.adress) return
    setSaving(true)
    const sb = createClient()
    const payload = { ...form, postnummer: form.postnummer || null, ort: form.ort || null, beteckning: form.beteckning || null, anteckningar: form.anteckningar || null }
    if (fastighet) await sb.from('fastigheter').update(payload).eq('id', fastighet.id)
    else await sb.from('fastigheter').insert(payload)
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 500 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{fastighet ? 'Redigera fastighet' : 'Ny fastighet'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['NAMN *', 'namn', 'Vägmästarvägen 7'], ['FASTIGHETSBETECKNING', 'beteckning', 't.ex. Indelningen 1:1']].map(([lbl, key, ph]) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>{lbl}</label>
              <input style={inp} value={(form as any)[key]} placeholder={ph} onChange={e => set(key, e.target.value)} onFocus={fo} onBlur={fb} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>ADRESS *</label>
            <AdressInput
              value={form.adress}
              onChange={v => set('adress', v)}
              onPick={(adress, postnummer, ort) => setForm(f => ({ ...f, adress, postnummer: postnummer || f.postnummer, ort: ort || f.ort }))}
              style={inp}
              onFocus={fo}
              onBlur={fb}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            {[['POSTNUMMER', 'postnummer'], ['ORT', 'ort']].map(([lbl, key]) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>{lbl}</label>
                <input style={inp} value={(form as any)[key]} onChange={e => set(key, e.target.value)} onFocus={fo} onBlur={fb} />
              </div>
            ))}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>ANTECKNINGAR</label>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }} value={form.anteckningar} onChange={e => set('anteckningar', e.target.value)} onFocus={fo} onBlur={fb} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
          <button onClick={spara} disabled={saving || !form.namn || !form.adress}
            style={{ padding: '9px 24px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: !form.namn || !form.adress ? 0.5 : 1 }}>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}
