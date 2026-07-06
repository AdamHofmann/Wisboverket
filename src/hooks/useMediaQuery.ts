'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-säker media query-hook för Next App Router.
 * Initierar false på servern (desktop-first) för att undvika hydration-flash,
 * och synkar mot window.matchMedia i useEffect.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    setMatches(mql.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

export const useIsMobile = () => useMediaQuery('(max-width: 768px)')
export const useIsNarrow = () => useMediaQuery('(max-width: 480px)')
