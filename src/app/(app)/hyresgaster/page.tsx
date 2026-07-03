'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tenant } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S: Record<string, any> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 800, color: '#E8C96A' },
  newBtn: { background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  search: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 14px', color: '#e0e0e0', fontSize: 13, width: 280, outline: 'none' },
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

const EMPTY_FORM = { namn: '', typ: 'företag' as Tenant['typ'], orgnummer: '', personnummer: '', epost: '', telefon: '', adress: '', kontaktperson: '' }

function TenantModal({ tenant, onClose, onSaved }: { tenant: Tenant | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(tenant ? {
    namn: tenant.namn,
    typ: tenant.typ,
    orgnummer: tenant.orgnummer || '',
    personnummer: tenant.personnummer || '',
    epost: tenant.epost || '',
    telefon: tenant.telefon || '',
    adress: tenant.adress || '',
    kontaktperson: tenant.kontaktperson || '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const spara = async () => {
    if (!form.namn.trim()) { setError('Namn krävs'); return }
    setSaving(true); setError('')
    const sb = createClient()
    const payload = {
      namn: form.namn,
      typ: form.typ,
      orgnummer: form.orgnummer || null,
      personnummer: form.personnummer || null,
      epost: form.epost || null,
      telefon: form.telefon || null,
      adress: form.adress || null,
      kontaktperson: form.kontaktperson || null,
    }
    const { error: err } = tenant
      ? await sb.from('tenants').update(payload).eq('id', tenant.id)
      : await sb.from('tenants').insert(payload)
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{tenant ? 'Redigera hyresgäst' : 'Ny hyresgäst'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="TYP">
              <select style={inp} value={form.typ} onChange={e => set('typ', e.target.value)} onFocus={fo} onBlur={fb}>
                <option value="företag">Företag</option>
                <option value="privat">Privat</option>
              </select>
            </MF>
            {form.typ === 'företag' ? (
              <MF label="ORG.NUMMER">
                <input style={inp} value={form.orgnummer} onChange={e => set('orgnummer', e.target.value)} placeholder="556123-4567" onFocus={fo} onBlur={fb} />
              </MF>
            ) : (
              <MF label="PERSONNUMMER">
                <input style={inp} value={form.personnummer} onChange={e => set('personnummer', e.target.value)} placeholder="YYYYMMDD-XXXX" onFocus={fo} onBlur={fb} />
              </MF>
            )}
          </div>
          <MF label="NAMN *">
            <input style={inp} value={form.namn} onChange={e => set('namn', e.target.value)} placeholder={form.typ === 'företag' ? 'Företagsnamn AB' : 'Förnamn Efternamn'} onFocus={fo} onBlur={fb} />
          </MF>
          {form.typ === 'företag' && (
            <MF label="KONTAKTPERSON">
              <input style={inp} value={form.kontaktperson} onChange={e => set('kontaktperson', e.target.value)} placeholder="Anna Svensson" onFocus={fo} onBlur={fb} />
            </MF>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MF label="TELEFON">
              <input style={inp} value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="07X-XXX XX XX" onFocus={fo} onBlur={fb} />
            </MF>
            <MF label="E-POST">
              <input style={inp} value={form.epost} onChange={e => set('epost', e.target.value)} placeholder="kontakt@ex.se" onFocus={fo} onBlur={fb} />
            </MF>
          </div>
          <MF label="ADRESS">
            <input style={inp} value={form.adress} onChange={e => set('adress', e.target.value)} placeholder="Gatuadress, ort" onFocus={fo} onBlur={fb} />
          </MF>
          {error && <div style={{ fontSize: 12, color: '#f87171', background: '#f8717111', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #222', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#888', cursor: 'pointer', fontSize: 13 }}>Avbryt</button>
          <button onClick={spara} disabled={saving} style={{ padding: '9px 24px', background: '#E8C96A', border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Sparar...' : tenant ? 'Spara' : 'Lägg till'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HyresgasterPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTenant, setEditTenant] = useState<Tenant | null>(null)

  const fetchTenants = async () => {
    const { data } = await createClient().from('tenants').select('*').order('namn')
    setTenants(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchTenants() }, [])

  const filtered = useMemo(() => tenants.filter(t => {
    if (!search) return true
    const q = search.toLowerCase()
    return t.namn.toLowerCase().includes(q) ||
      t.epost?.toLowerCase().includes(q) ||
      t.telefon?.includes(q) ||
      t.orgnummer?.includes(q) ||
      t.personnummer?.includes(q) || false
  }), [tenants, search])

  return (
    <div>
      <div style={S.header}>
        <div style={S.title}>Hyresgäster <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({filtered.length})</span></div>
        <button style={S.newBtn} onClick={() => { setEditTenant(null); setShowModal(true) }}>+ Ny hyresgäst</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input placeholder="Sök namn, e-post, org.nr..." value={search} onChange={e => setSearch(e.target.value)}
          style={S.search}
          onFocus={e => e.currentTarget.style.borderColor = '#E8C96A'}
          onBlur={e => e.currentTarget.style.borderColor = '#2a2a2a'} />
      </div>

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            {tenants.length === 0 ? 'Inga hyresgäster ännu' : 'Inga träffar'}
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>NAMN</th>
                <th style={S.th}>TYP</th>
                <th style={S.th}>KONTAKT</th>
                <th style={S.th}>ADRESS</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600, color: '#e0e0e0' }}>{t.namn}</div>
                    {t.kontaktperson && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{t.kontaktperson}</div>}
                    {t.orgnummer && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{t.orgnummer}</div>}
                    {t.personnummer && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>{t.personnummer}</div>}
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#2a2a2a', color: '#888' }}>{t.typ}</span>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {t.telefon && <a href={`tel:${t.telefon}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 12 }}>{t.telefon}</a>}
                      {t.epost && <a href={`mailto:${t.epost}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: 11 }}>{t.epost}</a>}
                      {!t.telefon && !t.epost && <span style={{ color: '#333' }}>—</span>}
                    </div>
                  </td>
                  <td style={S.td}>{t.adress || <span style={{ color: '#333' }}>—</span>}</td>
                  <td style={S.td}>
                    <button onClick={() => { setEditTenant(t); setShowModal(true) }}
                      style={{ background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', color: '#888', fontSize: 11, cursor: 'pointer' }}>
                      Redigera
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <TenantModal
          tenant={editTenant}
          onClose={() => setShowModal(false)}
          onSaved={() => { fetchTenants(); setShowModal(false) }}
        />
      )}
    </div>
  )
}
