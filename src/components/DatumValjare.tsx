'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (d: string) => void
  placeholder?: string
  style?: React.CSSProperties
  minDate?: string
}

const MÅN = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
const VECKODAGAR = ['M', 'T', 'O', 'T', 'F', 'L', 'S']

export default function DatumValjare({ value, onChange, placeholder = 'åååå-mm-dd', style, minDate }: Props) {
  const [open, setOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const idag = new Date()
  const bas = new Date(idag.getFullYear(), idag.getMonth() + offset, 1)
  const år = bas.getFullYear()
  const månad = bas.getMonth()
  const förstaVeckodag = (new Date(år, månad, 1).getDay() + 6) % 7
  const antalDagar = new Date(år, månad + 1, 0).getDate()
  const dagar: (number | null)[] = [
    ...Array.from({ length: förstaVeckodag }, (): null => null),
    ...Array.from({ length: antalDagar }, (_, i) => i + 1),
  ]

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const pick = (dag: number) => {
    const ds = `${år}-${String(månad + 1).padStart(2, '0')}-${String(dag).padStart(2, '0')}`
    if (minDate && ds < minDate) return
    onChange(ds)
    setOpen(false)
  }

  const moveDate = useCallback((delta: number) => {
    const base = value ? new Date(value + 'T00:00:00') : new Date()
    base.setDate(base.getDate() + delta)
    const ds = base.toISOString().split('T')[0]
    if (minDate && ds < minDate) return
    // Justera månad-offset så att valt datum syns
    const today = new Date()
    const diffMån = (base.getFullYear() - today.getFullYear()) * 12 + (base.getMonth() - today.getMonth())
    setOffset(diffMån)
    onChange(ds)
  }, [value, minDate, onChange])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); moveDate(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveDate(-1) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveDate(7) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveDate(-7) }
      else if (e.key === 'Escape') setOpen(false)
      else if (e.key === 'Enter') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, moveDate])

  useEffect(() => {
    if (open) setTimeout(() => popupRef.current?.focus(), 0)
  }, [open])

  const visaDatum = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          ...style,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
        }}
      >
        <span style={{ color: value ? '#e0e0e0' : '#555' }}>{visaDatum || placeholder}</span>
        <span style={{ fontSize: 14, color: open ? '#E8C96A' : '#555' }}>📅</span>
      </div>

      {open && (
        <div ref={popupRef} tabIndex={-1} style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 10,
          padding: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: 240,
          outline: 'none',
        }}>
          {/* Månadsnavigering */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <button onClick={() => setOffset(o => o - 1)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#d0d0d0', textTransform: 'capitalize' }}>
              {MÅN[månad]} {år}
            </span>
            <button onClick={() => setOffset(o => o + 1)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>›</button>
          </div>

          {/* Veckodagar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {VECKODAGAR.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#555', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Dagar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {dagar.map((dag, i) => {
              if (!dag) return <div key={i} />
              const ds = `${år}-${String(månad + 1).padStart(2, '0')}-${String(dag).padStart(2, '0')}`
              const vald = ds === value
              const disabled = !!minDate && ds < minDate
              return (
                <div key={i} onClick={() => !disabled && pick(dag)}
                  style={{
                    textAlign: 'center', fontSize: 12, padding: '5px 2px', borderRadius: 6,
                    cursor: disabled ? 'default' : 'pointer',
                    background: vald ? '#E8C96A' : 'transparent',
                    color: vald ? '#000' : disabled ? '#333' : '#ccc',
                    fontWeight: vald ? 800 : 400,
                  }}
                  onMouseEnter={e => { if (!disabled && !vald) e.currentTarget.style.background = '#2a2a2a' }}
                  onMouseLeave={e => { if (!vald) e.currentTarget.style.background = 'transparent' }}
                >
                  {dag}
                </div>
              )
            })}
          </div>

          {/* Idag-knapp */}
          <div style={{ marginTop: 10, textAlign: 'center' }}>
            <button onClick={() => { pick(idag.getDate()); setOffset(0) }}
              style={{ fontSize: 11, color: '#E8C96A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Idag
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
