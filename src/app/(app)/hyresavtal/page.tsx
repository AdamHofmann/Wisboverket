'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lease, Tenant, Unit, Property } from '@/types'

type LeaseWithJoins = Lease & {
  tenant: Pick<Tenant, 'namn'> | null
  unit: (Pick<Unit, 'beteckning' | 'typ'> & { property: Pick<Property, 'adress'> | null }) | null
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

function LeaseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [form, setForm] = useState({
    tenant_id: '',
    unit_id: '',
    startdatum: '',
    slutdatum: '',
    bashyra: '',
    uppsagningstid_manader: '3',
    indexklausul: false,
    aktiv: true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const sb = createClient()
    sb.from('tenants').select('*').order('namn').then(({ data }) => setTenants(data || []))
    sb.from('units').select('*').order('beteckning').then(({ data }) => setUnits(data || []))
  }, [])

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const spara = async () => {
    if (!form.tenant_id || !form.unit_id || !form.startdatum || !form.bashyra) {
      setError('Hyresgäst, enhet, startdatum och bashyra krävs'); return
    }
    setSaving(true); setError('')
    const { error: err } = await createClient().from('leases').insert({
      tenant_id: form.tenant_id,
      unit_id: form.unit_id,
      startdatum: form.startdatum,
      slutdatum: form.slutdatum || null,
      bashyra: parseFloat(form.bashyra),
      uppsagningstid_manader: parseInt(form.uppsagningstid_manader),
      indexklausul: form.indexklausul,
      aktiv: form.aktiv,
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
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>Nytt hyresavtal</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <MF label="HYRESGÄST *">
            <select style={inp} value={form.tenant_id} onChange={e => set('tenant_id', e.target.value)} onFocus={fo} onBlur={fb}>
              <option value="">Välj hyresgäst...</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.namn}</option>)}
            </select>
          </MF>
          <MF label="ENHET *">
            <select style={inp} value={form.unit_id} onChange={e => set('unit_id', e.target.value)} onFocus={fo} onBlur={fb}>
              <option value="">Välj enhet...</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.beteckning}{u.typ ? ` (${u.typ})` : ''}</option>)}
            </select>
          </MF>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="STARTDATUM *">
              <input style={inp} type="date" value={form.startdatum} onChange={e => set('startdatum', e.target.value)} onFocus={fo} onBlur={fb} />
            </MF>
            <MF label="SLUTDATUM (tom = tillsvidare)">
              <input style={inp} type="date" value={form.slutdatum} onChange={e => set('slutdatum', e.target.value)} onFocus={fo} onBlur={fb} />
            </MF>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="BASHYRA (kr/mån) *">
              <input style={inp} type="number" value={form.bashyra} onChange={e => set('bashyra', e.target.value)} placeholder="5000" onFocus={fo} onBlur={fb} />
            </MF>
            <MF label="UPPSÄGNINGSTID (månader)">
              <input style={inp} type="number" value={form.uppsagningstid_manader} onChange={e => set('uppsagningstid_manader', e.target.value)} placeholder="3" onFocus={fo} onBlur={fb} />
            </MF>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#d0d0d0' }}>
              <input type="checkbox" checked={form.indexklausul} onChange={e => set('indexklausul', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#E8C96A', cursor: 'pointer' }} />
              Indexklausul
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#d0d0d0' }}>
              <input type="checkbox" checked={form.aktiv} onChange={e => set('aktiv', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#E8C96A', cursor: 'pointer' }} />
              Aktivt avtal
            </label>
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

export default function HyresavtalPage() {
  const [leases, setLeases] = useState<LeaseWithJoins[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'aktiva' | 'alla'>('aktiva')

  const fetchLeases = async () => {
    const query = createClient()
      .from('leases')
      .select('*, tenant:tenants(namn), unit:units(beteckning, typ, property:properties(adress))')
      .order('created_at', { ascending: false })
    const { data } = await query
    setLeases((data || []) as LeaseWithJoins[])
    setLoading(false)
  }

  useEffect(() => { fetchLeases() }, [])

  const displayed = leases.filter(l => filter === 'alla' || l.aktiv)

  const chipStyle = (active: boolean) => ({
    padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: active ? '#E8C96A22' : 'transparent',
    color: active ? '#E8C96A' : '#555',
    border: `1px solid ${active ? '#E8C96A44' : '#2a2a2a'}`,
  })

  return (
    <div>
      <div style={S.header}>
        <div style={S.title}>Hyresavtal <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({displayed.length})</span></div>
        <button style={S.newBtn} onClick={() => setShowModal(true)}>+ Nytt avtal</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={chipStyle(filter === 'aktiva')} onClick={() => setFilter('aktiva')}>Aktiva</button>
        <button style={chipStyle(filter === 'alla')} onClick={() => setFilter('alla')}>Alla</button>
      </div>

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Inga hyresavtal</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>HYRESGÄST</th>
                <th style={S.th}>ENHET / FASTIGHET</th>
                <th style={S.th}>BASHYRA</th>
                <th style={S.th}>PERIOD</th>
                <th style={S.th}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(l => (
                <tr key={l.id}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#e0e0e0' }}>{l.tenant?.namn || '—'}</div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#e0e0e0' }}>{l.unit?.beteckning || '—'}</div>
                    {l.unit?.property?.adress && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{l.unit.property.adress}</div>}
                  </td>
                  <td style={S.td}>
                    <div style={{ fontWeight: 700, color: '#E8C96A' }}>{l.bashyra.toLocaleString('sv-SE')} kr</div>
                    <div style={{ fontSize: 11, color: '#555' }}>per månad</div>
                  </td>
                  <td style={S.td}>
                    <div style={{ fontSize: 12 }}>{l.startdatum}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>→ {l.slutdatum || 'tillsvidare'}</div>
                  </td>
                  <td style={S.td}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: l.aktiv ? '#4ade8022' : '#33333322',
                      color: l.aktiv ? '#4ade80' : '#555',
                      border: `1px solid ${l.aktiv ? '#4ade8044' : '#33333344'}`,
                    }}>
                      {l.aktiv ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <LeaseModal
          onClose={() => setShowModal(false)}
          onSaved={() => { fetchLeases(); setShowModal(false) }}
        />
      )}
    </div>
  )
}
