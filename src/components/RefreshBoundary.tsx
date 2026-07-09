'use client'

import { Fragment, useEffect, useState } from 'react'

/**
 * Lyssnar på 'wb:refresh' (skickas av PullToRefresh) och remountar sidan genom
 * att byta key → alla klient-fetchar (useEffect) körs om och datan uppdateras,
 * UTAN någon sid-navigering. Behövs eftersom en full location.reload() i
 * Capacitor-skalet kan kastas ut till Safari.
 */
export default function RefreshBoundary({ children }: { children: React.ReactNode }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    const h = () => setK(x => x + 1)
    window.addEventListener('wb:refresh', h)
    return () => window.removeEventListener('wb:refresh', h)
  }, [])
  return <Fragment key={k}>{children}</Fragment>
}
