'use client'

import { useRef, useState } from 'react'
import { C, inp, fo, fb } from './styles'

export interface BolagResult {
  namn: string
  orgnummer: string
  adress?: string
  postnummer?: string
  stad?: string
  epost?: string
}

interface Props {
  onSelect: (result: BolagResult) => void
}

const isOrgnummer = (q: string) => /^\d[\d\s-]{8,}\d$/.test(q.trim())
const normalizeOrgnummer = (input: string) => input.replace(/[^0-9]/g, '')

// Apiverket (via /api/lookup-company) returnerar { namn, orgnummer, adress, postnummer, ort, aktiv }.
// BolagAutocomplete använder "stad" internt → mappa ort → stad.
function mapApiverket(c: { namn?: string; orgnummer?: string; adress?: string; postnummer?: string; ort?: string }): BolagResult {
  return {
    namn: c.namn || '',
    orgnummer: c.orgnummer || '',
    adress: c.adress || '',
    postnummer: c.postnummer || '',
    stad: c.ort || '',
  }
}

export default function BolagAutocomplete({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BolagResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const search = async () => {
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setError(null)
    setResult(null)

    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    try {
      const url = isOrgnummer(q)
        ? `/api/lookup-company?orgnr=${normalizeOrgnummer(q)}`
        : `/api/lookup-company?name=${encodeURIComponent(q)}`
      const res = await fetch(url, { signal: abortRef.current.signal })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Sökningen misslyckades')

      if (data.company) {
        setResult(mapApiverket(data.company))
      } else if (Array.isArray(data.companies) && data.companies.length > 0) {
        setResult(mapApiverket(data.companies[0]))
      } else {
        setError('Inga företag hittades. Prova att söka med organisationsnummer.')
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Kunde inte hämta företagsuppgifter. Fyll i manuellt.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); search() }
  }

  const handleApply = () => {
    if (result) {
      onSelect(result)
      setQuery('')
      setResult(null)
    }
  }

  return (
    <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.field, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.gold, textTransform: 'uppercase', margin: 0 }}>🔎 Sök företag</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          style={{ ...inp, flex: 1 }}
          onFocus={fo}
          onBlur={fb}
          placeholder="Företagsnamn eller organisationsnummer"
          value={query}
          onChange={e => { setQuery(e.target.value); setResult(null); setError(null) }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          onClick={search}
          disabled={loading || !query.trim()}
          style={{
            background: C.gold, color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px',
            fontSize: 13, fontWeight: 700, cursor: loading || !query.trim() ? 'default' : 'pointer',
            opacity: loading || !query.trim() ? 0.5 : 1, whiteSpace: 'nowrap',
          }}
        >
          {loading ? '…' : 'Sök'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: C.warn, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 6, padding: '6px 8px', margin: 0 }}>{error}</p>
      )}

      {result && (
        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 15 }}>🏢</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, color: C.text, fontSize: 13, margin: 0 }}>{result.namn}</p>
              <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{result.orgnummer}</p>
              {result.adress && (
                <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{result.adress}{result.postnummer ? `, ${result.postnummer}` : ''}{result.stad ? ` ${result.stad}` : ''}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleApply}
            style={{ width: '100%', background: C.gold, color: '#000', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
          >
            Fyll i formuläret med dessa uppgifter
          </button>
        </div>
      )}
    </div>
  )
}
