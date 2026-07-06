'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useMediaQuery'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isMobile = useIsMobile()
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Fel e-post eller lösenord')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#111',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: isMobile ? 16 : 0,
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>
      <div style={{
        background: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: 12,
        padding: isMobile ? '32px 20px' : '40px 36px',
        width: '100%',
        maxWidth: isMobile ? '100%' : 380,
        boxSizing: 'border-box'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Image src="/logo.png" alt="Wisboverket" width={90} height={90} style={{ borderRadius: '50%', marginBottom: 12 }} />
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>Logga in för att fortsätta</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
              E-POST
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#111', border: '1px solid #333',
                borderRadius: 7, padding: '10px 12px',
                color: '#e0e0e0', fontSize: 14,
                outline: 'none'
              }}
              onFocus={e => e.target.style.borderColor = '#E8C96A'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 11, color: '#888', fontWeight: 600, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
              LÖSENORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#111', border: '1px solid #333',
                borderRadius: 7, padding: '10px 12px',
                color: '#e0e0e0', fontSize: 14,
                outline: 'none'
              }}
              onFocus={e => e.target.style.borderColor = '#E8C96A'}
              onBlur={e => e.target.style.borderColor = '#333'}
            />
          </div>

          {error && (
            <div style={{ background: '#f8717122', border: '1px solid #f87171', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px',
              background: loading ? '#555' : '#E8C96A',
              color: '#000', border: 'none',
              borderRadius: 7, fontSize: 14,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
      </div>
    </div>
  )
}
