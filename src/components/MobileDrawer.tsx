'use client'

import { useEffect } from 'react'

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  /** Innehåll i panelen (t.ex. länkrad vertikalt + utloggning). */
  children: React.ReactNode
  /** Valfri rubrik högst upp i panelen. */
  title?: React.ReactNode
}

const D: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
  },
  panel: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(80vw, 320px)',
    background: '#141414', borderLeft: '1px solid #222',
    zIndex: 1001, display: 'flex', flexDirection: 'column' as const,
    padding: '12px 12px calc(12px + env(safe-area-inset-bottom))',
    overflowY: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 44, marginBottom: 8,
  },
  closeBtn: {
    minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: 'none', border: 'none',
    color: '#888', fontSize: 24, cursor: 'pointer', lineHeight: 1,
  },
}

export default function MobileDrawer({ open, onClose, children, title }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div style={D.overlay} onClick={onClose} aria-hidden="true" />
      <div style={D.panel} role="dialog" aria-modal="true">
        <div style={D.header}>
          <div>{title}</div>
          <button style={D.closeBtn} onClick={onClose} aria-label="Stäng meny">×</button>
        </div>
        {children}
      </div>
    </>
  )
}
