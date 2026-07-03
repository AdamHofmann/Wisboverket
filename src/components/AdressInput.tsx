'use client'

import { useRef, useState } from 'react'

type Suggestion = {
  display_name: string
  address: {
    road?: string
    house_number?: string
    postcode?: string
    city?: string
    town?: string
    village?: string
    suburb?: string
    municipality?: string
  }
}

type Props = {
  value: string
  onChange: (v: string) => void
  onPick?: (adress: string, postnummer: string, ort: string) => void
  style?: React.CSSProperties
  placeholder?: string
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
}

// Plockar ut husnumret ur en inskriven adress-sträng, t.ex. "Kalkbruksvägen 14B" -> "14B".
// Svensk konvention: avslutande siffergrupp med ev. efterföljande bokstav ("14", "14B", "3 A").
// Returnerar tom sträng om inget husnummer hittas.
const extractHouseNumber = (text: string): string => {
  const match = text.trim().match(/(\d+)\s*([A-Za-z])?$/)
  if (!match) return ''
  return (match[1] + (match[2] ?? '')).trim()
}

export default function AdressInput({ value, onChange, onPick, style, placeholder = 'Sök adress...', onFocus, onBlur }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (v: string) => {
    onChange(v)
    setSuggestions([])
    if (timer.current) clearTimeout(timer.current)
    if (v.length < 3) return
    timer.current = setTimeout(async () => {
      try {
        // &street= ger husnummer-nivå, &q= ger väg-nivå
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=se&limit=6&street=${encodeURIComponent(v)}`
        const res = await fetch(url)
        const data: Suggestion[] = await res.json()
        setSuggestions(data)
      } catch {}
    }, 400)
  }

  const pick = (s: Suggestion) => {
    const a = s.address
    // Nominatim saknar ofta husnummer för svenska adresser -> fall tillbaka på det användaren skrev.
    const husnummer = a.house_number ?? extractHouseNumber(value)
    // Svensk konvention: gatunamn + nummer, t.ex. "Vägmästarvägen 7"
    const adress = [a.road, husnummer].filter(Boolean).join(' ') || value
    const postnummer = a.postcode?.replace(/\s/g, '') || ''
    const ort = a.city || a.town || a.village || a.municipality || ''
    onChange(adress)
    if (onPick) onPick(adress, postnummer, ort)
    setSuggestions([])
  }

  const visaAdress = (s: Suggestion) => {
    const a = s.address
    // Saknar träffen husnummer? Använd det inskrivna numret så dropdownen visar rätt.
    const husnummer = a.house_number ?? extractHouseNumber(value)
    const rad1 = [a.road, husnummer].filter(Boolean).join(' ')
    const rad2 = [a.postcode, a.city || a.town || a.village || a.municipality].filter(Boolean).join(' ')
    return { rad1: rad1 || s.display_name.split(',')[0], rad2 }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        style={style}
        onFocus={onFocus}
        onBlur={e => {
          if (onBlur) onBlur(e)
          setTimeout(() => setSuggestions([]), 200)
        }}
      />
      {suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: '#1e1e1e', border: '1px solid #333', borderRadius: 8,
          zIndex: 100, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {suggestions.map((s, i) => {
            const { rad1, rad2 } = visaAdress(s)
            return (
              <div
                key={i}
                onMouseDown={() => pick(s)}
                style={{
                  padding: '9px 12px', fontSize: 12, color: '#d0d0d0', cursor: 'pointer',
                  borderBottom: i < suggestions.length - 1 ? '1px solid #2a2a2a' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2a2a2a')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontWeight: 600 }}>{rad1}</span>
                {rad2 && <span style={{ color: '#666', marginLeft: 8 }}>{rad2}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
