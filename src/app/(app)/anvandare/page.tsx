'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

const fmtDatum = (d: string) => new Date(d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })

export default function AnvandarePage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchUsers = () => {
    createClient().from('profiles').select('*').order('namn').then(({ data }) => { setUsers(data || []); setLoading(false) })
  }

  useEffect(() => { fetchUsers() }, [])

  const uppdatera = async (id: string, patch: Partial<Profile>) => {
    const foregaende = users.find(u => u.id === id)
    setSavingId(id)
    setError('')
    setUsers(u => u.map(x => x.id === id ? { ...x, ...patch } : x))
    const { error: err } = await createClient().from('profiles').update(patch).eq('id', id)
    if (err) {
      setError(err.message)
      if (foregaende) setUsers(u => u.map(x => x.id === id ? foregaende : x))
    }
    setSavingId(null)
  }

  const inp = { background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '5px 10px', color: '#e0e0e0', fontSize: 12, outline: 'none' }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>Laddar...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#E8C96A' }}>Användare <span style={{ fontSize: 14, color: '#555', fontWeight: 400 }}>({users.length})</span></div>
      </div>

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 12, color: '#888', lineHeight: 1.7 }}>
        Nya användare bjuds in via <strong style={{ color: '#E8C96A' }}>Supabase Dashboard → Authentication → Users → Invite user</strong>.
        När personen skapat sitt konto dyker de automatiskt upp i listan nedan, med standardroll &quot;användare&quot; och åtkomst till Order-modulen.
        Justera roll och modulåtkomst här.
      </div>

      {error && <div style={{ background: '#f8717111', border: '1px solid #f8717144', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#f87171' }}>{error}</div>}

      <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
          <thead>
            <tr>
              {['NAMN', 'E-POST', 'ROLL', 'ORDER', 'FASTIGHET', 'SKAPAD'].map(h => (
                <th key={h} style={{ textAlign: 'left' as const, padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#555', borderBottom: '1px solid #1e1e1e' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ opacity: savingId === u.id ? 0.6 : 1 }}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 13, color: '#d0d0d0', fontWeight: 600 }}>{u.namn}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
