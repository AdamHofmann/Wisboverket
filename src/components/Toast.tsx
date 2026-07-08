'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'
type ToastItem = { id: number; text: string; type: ToastType }

export type ToastApi = {
  success: (text: string) => void
  error: (text: string) => void
  info: (text: string) => void
}

const noop = () => {}
const ToastContext = createContext<ToastApi>({ success: noop, error: noop, info: noop })

// Anropa som: const toast = useToast(); toast.error('...'); toast.success('...')
export function useToast() {
  return useContext(ToastContext)
}

const STYLE: Record<ToastType, { bar: string; icon: string }> = {
  success: { bar: '#4ade80', icon: '✓' },
  error: { bar: '#f87171', icon: '⚠' },
  info: { bar: '#60a5fa', icon: 'ℹ' },
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => setToasts(list => list.filter(x => x.id !== id)), [])

  const push = useCallback((text: string, type: ToastType) => {
    const id = nextId++
    setToasts(list => [...list, { id, text, type }])
    setTimeout(() => remove(id), type === 'error' ? 7000 : 4000)
  }, [remove])

  const api: ToastApi = {
    success: text => push(text, 'success'),
    error: text => push(text, 'error'),
    info: text => push(text, 'info'),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 4000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 'min(92vw, 420px)', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} onClick={() => remove(t.id)} role="status"
            style={{ pointerEvents: 'auto', background: '#1a1a1a', border: '1px solid #2a2a2a', borderLeft: `3px solid ${STYLE[t.type].bar}`, borderRadius: 10, padding: '12px 16px', color: '#e0e0e0', fontSize: 13, lineHeight: 1.45, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ color: STYLE[t.type].bar, fontWeight: 700, flexShrink: 0 }}>{STYLE[t.type].icon}</span>
            <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
