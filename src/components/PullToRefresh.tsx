'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Dra-nedåt-för-att-uppdatera (pull-to-refresh) för hela appen.
 * Ren webblösning (ingen native-kod → uppdateras via vanlig deploy).
 * Aktiveras bara högst upp på sidan; ignoreras inne i modaler och i egna
 * scroll-ytor så den inte krockar med vanlig scroll. Vid tillräckligt drag
 * laddas sidan om.
 */
export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const activeRef = useRef(false)
  const refreshingRef = useRef(false)

  useEffect(() => {
    const THRESHOLD = 70
    const MAX = 120
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0

    // Blockera om touchen är inne i en modal (fixed overlay med hög z-index)
    // eller i en egen scroll-yta som redan är nedscrollad.
    const blocked = (el: EventTarget | null) => {
      let n = el as HTMLElement | null
      while (n && n !== document.body && n.nodeType === 1) {
        const s = getComputedStyle(n)
        if (s.position === 'fixed' && parseInt(s.zIndex || '0', 10) >= 1000) return true
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0) return true
        n = n.parentElement
      }
      return false
    }

    const set = (d: number) => { pullRef.current = d; setPull(d) }

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || !atTop() || blocked(e.target)) { startRef.current = null; return }
      startRef.current = e.touches[0].clientY
      activeRef.current = false
    }

    const onMove = (e: TouchEvent) => {
      if (startRef.current == null || refreshingRef.current) return
      const dy = e.touches[0].clientY - startRef.current
      if (dy <= 0 || !atTop()) {
        if (!atTop()) startRef.current = null
        if (activeRef.current) { activeRef.current = false; set(0) }
        return
      }
      activeRef.current = true
      set(Math.min(MAX, dy * 0.5)) // motstånd
      if (e.cancelable) e.preventDefault() // ersätt iOS-studsen med vår gest
    }

    const onEnd = () => {
      if (startRef.current == null) return
      const go = activeRef.current && pullRef.current >= THRESHOLD
      startRef.current = null
      activeRef.current = false
      if (go) {
        refreshingRef.current = true
        setRefreshing(true)
        set(THRESHOLD)
        window.setTimeout(() => window.location.reload(), 300)
      } else {
        set(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const d = refreshing ? 70 : pull
  return (
    <div aria-hidden style={{ position: 'fixed', top: 'env(safe-area-inset-top)', left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 5000 }}>
      <div style={{
        transform: `translateY(${d - 46}px)`,
        opacity: d > 4 ? 1 : 0,
        transition: (refreshing || pull === 0) ? 'transform 0.25s ease, opacity 0.2s ease' : 'none',
      }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#1c1c1e', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }}>
          <div style={{
            width: 16, height: 16, borderRadius: '50%',
            border: '2px solid #333', borderTopColor: '#E8C96A',
            transform: refreshing ? undefined : `rotate(${Math.min(1, pull / 70) * 270}deg)`,
            animation: refreshing ? 'wb-spin 0.7s linear infinite' : undefined,
            transition: refreshing ? undefined : 'transform 0.05s linear',
          }} />
        </div>
      </div>
    </div>
  )
}
