'use client'

import { SWRConfig } from 'swr'

/**
 * Global datacache (stale-while-revalidate) för hela inloggade appen.
 * - Cachen är global och överlever sidbyten → vid återbesök visas cachad data
 *   DIREKT (ingen spinner) och uppdateras tyst i bakgrunden.
 * - dedupingInterval: samma nyckel hämtas inte om inom 30 s (dämpar refetch-storm).
 * - keepPreviousData: behåll förra datan medan ny hämtas → inga tomma blink.
 * - revalidateOnFocus av: en app-vy ska inte refetcha bara för att man växlar fönster.
 */
export default function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 30_000,
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateIfStale: true,
      }}
    >
      {children}
    </SWRConfig>
  )
}
