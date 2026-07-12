'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { useIsMobile } from '@/hooks/useMediaQuery'
import type { Profile } from '@/types'

const fmtDatum = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

export default function AnvandarePage() {
  const m = useIsMobile()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Ny användare
  const [visaNy, setVisaNy] = useState(false)
  const [nyNamn, setNyNamn] = useState('')
  const [nyEpost, setNyEpost] = useState('')
  const [nyLosen, setNyLosen] = useState('')
  const [skapar, setSkapar] = useState(false)

  // SWR-cache: cachad data visas direkt vid återbesök, revalideras tyst i bakgrunden.
  // fetchUsers() = revalidera (anropas från skapaAnvandare).
  const { data, isLoading, mutate } = useSWR('anvandare', async () => {
    const { data } = await createClient().from('profiles').select('*').order('namn')
    return (data || []) as Profile[]
  })
  const users = data ?? []
  const loading = isLoading && !data
  const fetchUsers = () => { mutate() }

  const uppdatera = async (id: string, patch: Partial<Profile>) => {
    const foregaende = users.find(u => u.id === id)
    setSavingId(id)
    setError('')
    // Optimistisk uppdatering via SWR-cachen (utan revalidering) — samma beteende som tidigare setUsers.
    mutate(u => (u ?? []).map(x => x.id === id ? { ...x, ...patch } : x), false)
    const { error: err } = await createClient().from('profiles').update(patch).eq('id', id)
    if (err) {
      setError(err.message)
      if (foregaende) mutate(u => (u ?? []).map(x => x.id === id ? foregaende : x), false)
    }
    setSavingId(null)
  }

  const skapaAnvandare = async () => {
    setError(''); setInfo('')
    if (!nyEpost.trim() || nyLosen.length < 6) { setError('E-post krävs och lösenordet måste vara minst 6 tecken'); return }
    setSkapar(true)
    try {
      const res = await fetch('/api/admin/anvandare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namn: nyNamn, epost: nyEpost, losenord: nyLosen }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error || 'Kunde inte skapa användare'); return }
      setInfo(`Användare skapad: ${nyEpost}. Dela ut lösenordet till personen.`)
      setNyNamn(''); setNyEpost(''); setNyLosen(''); setVisaNy(false)
      fetchUsers()
    } catch {
      setError('Kunde inte nå servern')
    } finally {
      setSkapar(false)
    }
  }

  const aterstallLosenord = async (epost: string | null) => {
    if (!epost) return
    setError(''); setInfo('')
    const { error: err } = await createClient().auth.resetPasswordForEmail(epost)
    if (err) setError(err.message)
    else setInfo(`Återställningsmejl skickat till ${epost}`)
  }

  const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '5px 10px', color: '#e0e0e0', fontSize: 12, outline: 'none' }
  const inpForm = { ...inp, padding: '8px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }
  const btnSmall = { background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', color: '#888', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' as const }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A' }}>Användare <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({users.length})</span></div>
        <button onClick={() => { setVisaNy(v => !v); setError(''); setInfo('') }}
          style={{ background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {visaNy ? 'Avbryt' : '+ Ny användare'}
        </button>
      </div>

      {visaNy && (
        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#888', marginBottom: 12 }}>NY ANVÄNDARE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>NAMN</div>
              <input style={inpForm} value={nyNamn} onChange={e => setNyNamn(e.target.value)} placeholder="För- och efternamn" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>E-POST *</div>
              <input style={inpForm} value={nyEpost} onChange={e => setNyEpost(e.target.value)} placeholder="namn@exempel.se" />
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>LÖSENORD * (min 6 tecken)</div>
              <input style={inpForm} value={nyLosen} onChange={e => setNyLosen(e.target.value)} placeholder="Delas ut till personen" />
            </div>
            <button onClick={skapaAnvandare} disabled={skapar}
              style={{ background: '#E8C96A', color: '#000', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: skapar ? 0.6 : 1 }}>
              {skapar ? 'Skapar...' : 'Skapa'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 10 }}>Kontot blir direkt aktivt. Personen loggar in med e-post + lösenordet du satt (kan ändras via "Återställ lösenord").</div>
        </div>
      )}

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
        Skapa användare direkt med <strong style={{ color: '#E8C96A' }}>+ Ny användare</strong>. Justera roll och modulåtkomst i listan.
        En användare utan någon modulåtkomst räknas som <strong style={{ color: '#f87171' }}>inaktiv</strong>.
      </div>

      {error && <div style={{ background: '#f8717111', border: '1px solid #f8717144', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#f87171' }}>{error}</div>}
      {info && <div style={{ background: '#4ade8011', border: '1px solid #4ade8044', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#4ade80' }}>{info}</div>}

      {m ? (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
          {users.map(u => {
            const inaktiv = !u.modul_order && !u.modul_fastighet
            return (
              <div key={u.id} style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a', opacity: savingId === u.id ? 0.6 : inaktiv ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#d0d0d0' }}>{u.namn}</span>
                  {inaktiv && <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171', border: '1px solid #f8717144', borderRadius: 4, padding: '1px 6px' }}>INAKTIV</span>}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{u.epost || '—'}</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                  <select style={{ ...inp, width: 'auto' }} value={u.roll} onChange={e => uppdatera(u.id, { roll: e.target.value as Profile['roll'] })}>
                    <option value="användare">Användare</option>
                    <option value="admin">Admin</option>
                  </select>
                  <label style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={u.modul_order} onChange={e => uppdatera(u.id, { modul_order: e.target.checked })} style={{ accentColor: '#E8C96A', width: 16, height: 16, cursor: 'pointer' }} /> Order
                  </label>
                  <label style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={u.modul_fastighet} onChange={e => uppdatera(u.id, { modul_fastighet: e.target.checked })} style={{ accentColor: '#E8C96A', width: 16, height: 16, cursor: 'pointer' }} /> Fastighet
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button style={btnSmall} onClick={() => aterstallLosenord(u.epost)}>Återställ lösenord</button>
                  {inaktiv
                    ? <button style={{ ...btnSmall, color: '#4ade80', borderColor: '#4ade8044' }} onClick={() => uppdatera(u.id, { modul_order: true })}>Aktivera</button>
                    : <button style={{ ...btnSmall, color: '#f87171', borderColor: '#f8717144' }} onClick={() => uppdatera(u.id, { modul_order: false, modul_fastighet: false })}>Inaktivera</button>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, minWidth: 520 }}>
          <thead>
            <tr>
              {['NAMN', 'E-POST', 'ROLL', 'ORDER', 'FASTIGHET', 'SKAPAD', 'ÅTGÄRDER'].map(h => (
                <th key={h} style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const inaktiv = !u.modul_order && !u.modul_fastighet
              return (
              <tr key={u.id} style={{ opacity: savingId === u.id ? 0.6 : inaktiv ? 0.55 : 1 }}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0', fontWeight: 600 }}>
                  {u.namn}
                  {inaktiv && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#f87171', border: '1px solid #f8717144', borderRadius: 4, padding: '1px 6px' }}>INAKTIV</span>}
                </td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 12, color: '#888' }}>{u.epost || '—'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a' }}>
                  <select style={inp} value={u.roll} onChange={e => uppdatera(u.id, { roll: e.target.value as Profile['roll'] })}>
                    <option value="användare">Användare</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a' }}>
                  <input type="checkbox" checked={u.modul_order} onChange={e => uppdatera(u.id, { modul_order: e.target.checked })}
                    style={{ accentColor: '#E8C96A', width: 16, height: 16, cursor: 'pointer' }} />
                </td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a' }}>
                  <input type="checkbox" checked={u.modul_fastighet} onChange={e => uppdatera(u.id, { modul_fastighet: e.target.checked })}
                    style={{ accentColor: '#E8C96A', width: 16, height: 16, cursor: 'pointer' }} />
                </td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 12, color: '#666' }}>{fmtDatum(u.created_at)}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnSmall} onClick={() => aterstallLosenord(u.epost)}>Återställ lösenord</button>
                    {inaktiv
                      ? <button style={{ ...btnSmall, color: '#4ade80', borderColor: '#4ade8044' }} onClick={() => uppdatera(u.id, { modul_order: true })}>Aktivera</button>
                      : <button style={{ ...btnSmall, color: '#f87171', borderColor: '#f8717144' }} onClick={() => uppdatera(u.id, { modul_order: false, modul_fastighet: false })}>Inaktivera</button>}
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
