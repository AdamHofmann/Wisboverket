'use client'

import { useEffect } from 'react'
import { C } from './styles'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: 'md' | 'lg' | 'xl' | 'full'
}

const widthPx: Record<NonNullable<SlideOverProps['width']>, number | string> = {
  md: 520,
  lg: 720,
  xl: 960,
  full: '100%',
}

export default function SlideOver({ open, onClose, title, subtitle, children, footer, width = 'lg' }: SlideOverProps) {
  const isMobile = useIsMobile()
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.7)',
          transition: 'opacity 0.3s',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        }}
      />

      {/* Panel — glider in från höger */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: isMobile ? '100vw' : '100%',
          maxWidth: isMobile ? '100vw' : widthPx[width],
          left: isMobile ? 0 : undefined,
          background: C.panel,
          borderLeft: isMobile ? 'none' : `1px solid ${C.borderSoft}`,
          boxShadow: isMobile ? 'none' : '-8px 0 40px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          transition: 'transform 0.3s ease-in-out',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: C.muted, cursor: 'pointer',
              fontSize: 20, lineHeight: 1, padding: 6, borderRadius: 8,
            }}
            aria-label="Stäng"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            flexShrink: 0, borderTop: `1px solid ${C.borderSoft}`, padding: '16px 24px', background: C.panel,
          }}>
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
