'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Maintenance, Property, Unit } from '@/types'

type MaintenanceWithJoins = Maintenance & {
  property: Pick<Property, 'adress'> | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, color: '#E8C96A' },
  newBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '8px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' },
  td: { padding: '12px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0', verticalAlign: 'middle' as const },
}

const PRIORITY_COLOR: Record<string, string> = {
  låg: '#555',
  normal: '#60a5fa',
  hög: '#fb923c',
  akut: '#f87171',
}

const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  öppen: { bg: '#60a5fa22', color: '#60a5fa', label: 'Öppen' },
  pågående: { bg: '#fb923c22', color: '#fb923c', label: 'Pågående' },
  stängd: { bg: '#4ade8022', color: '#4ade80', label: 'Stängd' },
}

const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const }
const fo = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#E8C96A' }
const fb = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.target.style.borderColor = '#2a2a2a' }

function MF({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{label}</label>
      {children}
    </div>
  )
}

function MaintenanceModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [properties, setProperties] = useState<Property[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([])
  const [form, setForm] = useState({
    titel: '',
    beskrivning: '',
    property_id: '',
    unit_id: '',
    prioritet: 'normal' as Maintenance['prioritet'],
    rapporterad_av: '',
    assignad_till: '',
    status: 'öppen' as Maintenance['status'],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.from('properties').select('*').order('adress').then(({ data }) => setProperties(data || []))
    sb.from('units').select('*').order('beteckning').then(({ data }) => setUnits(data || []))
  }, [])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const onPropertyChange = (propertyId: string) => {
    set('property_id', propertyId)
    setForm(f => ({ ...f, property_id: propertyId, unit_id: '' }))
    setFilteredUnits(units.filter(u => u.property_id === propertyId))
  }

  const spara = async () => {
    if (!form.titel.trim() || !form.property_id) { setError('Titel och fastighet krävs'); return }
    setSaving(true); setError('')
    const { error: err } = await createClient().from('maintenance').insert({
      titel: form.titel,
      beskrivning: form.beskrivning || null,
      property_id: form.property_id,
      unit_id: form.unit_id || null,
      prioritet: form.prioritet,
      status: form.status,
      rapporterad_av: form.rapporterad_av || null,
      assignad_till: form.assignad_till || null,
    })
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>Nytt underhållsärende</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MF label="TITEL *">
            <input style={inp} value={form.titel} onChange={e => set('titel', e.target.value)} placeholder="Beskriv problemet kort" onFocus={fo} onBlur={fb} />
          </MF>
          <MF label="BESKRIVNING">
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} value={form.beskrivning} onChange={e => set('beskrivning', e.target.value)} placeholder="Mer detaljerad beskrivning..." onFocus={fo} onBlur={fb} />
          </MF>
          <MF label="FASTIGHET *">
            <select style={inp} value={form.property_id} onChange={e => onPropertyChange(e.target.value)} onFocus={fo} onBlur={fb}>
              <option value="">Välj fastighet...</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.adress}</option>)}
            </select>
          </MF>
          <MF label="ENHET (valfritt)">
            <select style={inp} value={form.unit_id} onChange={e => set('unit_id', e.target.value)} disabled={!form.property_id} onFocus={fo} onBlur={fb}>
              <option value="">Hela fastigheten / ingen specifik enhet</option>
              {filteredUnits.map(u => <option key={u.id} value={u.id}>{u.beteckning}{u.typ ? ` — ${u.typ}` : ''}</option>)}
            </select>
          </MF>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="PRIORITET">
              <select style={{ ...inp, color: PRIORITY_COLOR[form.prioritet] || '#e0e0e0' }} value={form.prioritet} onChange={e => set('prioritet', e.target.value)} onFocus={fo} onBlur={fb}>
                <option value="låg">Låg</option>
                <option value="normal">Normal</option>
                <option value="hög">Hög</option>
                <option value="akut">Akut</option>
              </select>
            </MF>
            <MF label="STATUS">
              <select style={inp} value={form.status} onChange={e => set('status', e.target.value)} onFocus={fo} onBlur={fb}>
                <option value="öppen">Öppen</option>
                <option value="pågående">Pågående</option>
                <option value="stängd">Stängd</option>
              </select>
            </MF>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="RAPPORTERAD AV">
              <input style={inp} value={form.rapporterad_av} onChange={e => set('rapporterad_av', e.target.value)} placeholder="Namn" onFocus={fo} onBlur={fb} />
            </MF>
            <MF label="TILLDELAD TILL">
              <input style={inp} value={form.assignad_till} onChange={e => set('assignad_till', e.target.value)} placeholder="Namn" onFocus={fo} onBlur={fb} />
            </MF>
          </div>
          {error && <div style={{ fontSize: 12, color: '#f87171', background: '#f8717111', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
          <button onClick={spara} disabled={saving} style={{ padding: '9px 24px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sparar...' : 'Lägg till'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusButton({ currentStatus, targetStatus, onUpdate }: { currentStatus: Maintenance['status']; targetStatus: Maintenance['status']; onUpdate: () => void }) {
  if (currentStatus === targetStatus) return null
  const cfg = STATUS_CONFIG[targetStatus]
  return (
    <button onClick={onUpdate} style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44`,
    }}>
      → {cfg.label}
    </button>
  )
}

export default function UnderhallPage() {
  const [items, setItems] = useState<MaintenanceWithJoins[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<Maintenance['status'] | 'alla'>('öppen')

  const fetchItems = async () => {
    const { data } = await createClient()
      .from('maintenance')
      .select('*, property:properties(adress)')
      .order('created_at', { ascending: false })
    setItems((data || []) as MaintenanceWithJoins[])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: Maintenance['status']) => {
    await createClient().from('maintenance').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  useEffect(() => { fetchItems() }, [])

  const displayed = items.filter(i => statusFilter === 'alla' || i.status === statusFilter)

  const chipStyle = (active: boolean, color = '#E8C96A') => ({
    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: active ? `${color}22` : 'transparent',
    color: active ? color : '#555',
    border: `1px solid ${active ? `${color}44` : '#2a2a2a'}`,
  })

  return (
    <div>
      <div style={S.header}>
        <div style={S.title}>Underhåll <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({displayed.length})</span></div>
        <button style={S.newBtn} onClick={() => setShowModal(true)}>+ Nytt ärende</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={chipStyle(statusFilter === 'öppen', '#60a5fa')} onClick={() => setStatusFilter('öppen')}>Öppen</button>
        <button style={chipStyle(statusFilter === 'pågående', '#fb923c')} onClick={() => setStatusFilter('pågående')}>Pågående</button>
        <button style={chipStyle(statusFilter === 'stängd', '#4ade80')} onClick={() => setStatusFilter('stängd')}>Stängd</button>
        <button style={chipStyle(statusFilter === 'alla')} onClick={() => setStatusFilter('alla')}>Alla</button>
      </div>

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Inga ärenden</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>ÄRENDE</th>
                <th style={S.th}>FASTIGHET</th>
                <th style={S.th}>PRIORITET</th>
                <th style={S.th}>STATUS</th>
                <th style={S.th}>TILLDELAD</th>
                <th style={S.th}>ÅTGÄRDER</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(item => {
                const sc = STATUS_CONFIG[item.status]
                const pc = PRIORITY_COLOR[item.prioritet]
                return (
                  <tr key={item.id}
                    onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: '#e0e0e0' }}>{item.titel}</div>
                      {item.beskrivning && <div style={{ fontSize: 11, color: '#555', marginTop: 2, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.beskrivning}</div>}
                      {item.rapporterad_av && <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>av {item.rapporterad_av}</div>}
                    </td>
                    <td style={S.td}>{item.property?.adress || '—'}</td>
                    <td style={S.td}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: pc }}>
                        {item.prioritet.charAt(0).toUpperCase() + item.prioritet.slice(1)}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: sc.bg, color: sc.color, border: `1px solid ${sc.color}44`,
                      }}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={S.td}>{item.assignad_till || <span style={{ color: '#333' }}>—</span>}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <StatusButton currentStatus={item.status} targetStatus="öppen" onUpdate={() => updateStatus(item.id, 'öppen')} />
                        <StatusButton currentStatus={item.status} targetStatus="pågående" onUpdate={() => updateStatus(item.id, 'pågående')} />
                        <StatusButton currentStatus={item.status} targetStatus="stängd" onUpdate={() => updateStatus(item.id, 'stängd')} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <MaintenanceModal
          onClose={() => setShowModal(false)}
          onSaved={() => { fetchItems(); setShowModal(false) }}
        />
      )}
    </div>
  )
}
