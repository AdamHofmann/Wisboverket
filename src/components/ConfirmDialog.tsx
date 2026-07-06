'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type ConfirmOptions = {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

// Anropa som: const confirm = useConfirm(); if (!(await confirm({ message, danger }))) return
export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    const o = typeof opts === 'string' ? { message: opts } : opts
    setState(o)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const close = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setState(null)
  }, [])

  useEffect(() => {
    if (!state) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [state, close])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div onClick={() => close(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, width: '100%', maxWidth: 400, padding: '22px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            {state.title && <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', marginBottom: 8 }}>{state.title}</div>}
            <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5, marginBottom: 22 }}>{state.message || 'Är du säker?'}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => close(false)}
                style={{ padding: '9px 18px', background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, color: '#aaa', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {state.cancelLabel || 'Avbryt'}
              </button>
              <button autoFocus onClick={() => close(true)}
                style={{ padding: '9px 20px', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', background: state.danger ? '#f87171' : '#E8C96A', color: state.danger ? '#fff' : '#000' }}>
                {state.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
