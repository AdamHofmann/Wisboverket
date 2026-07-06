'use client'

import { useEffect } from 'react'
import { useReportWebVitals } from 'next/web-vitals'
import { loggaKlient } from '@/lib/logg'

// Web Vitals-metriker vi loggar. Övriga ignoreras för att hålla loggen selektiv.
const VITALS = new Set(['LCP', 'CLS', 'INP', 'TTFB', 'FCP'])

/**
 * Klient-instrumentering: fångar globala fel och rapporterar Web Vitals.
 * All loggning är fire-and-forget via loggaKlient och kan aldrig krascha appen.
 */
export default function LoggProvider({
  children,
}: {
  children?: React.ReactNode
}) {
  useEffect(() => {
    const path = () =>
      typeof location !== 'undefined' ? location.pathname : undefined

    const onError = (event: ErrorEvent) => {
      void loggaKlient({
        typ: 'fel',
        niva: 'error',
        path: path(),
        meddelande: event.message || 'Okänt fel',
        detaljer: {
          stack: event.error?.stack ?? null,
          filename: event.filename ?? null,
          lineno: event.lineno ?? null,
          colno: event.colno ?? null,
        },
      })
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      void loggaKlient({
        typ: 'fel',
        niva: 'error',
        path: path(),
        meddelande:
          reason instanceof Error
            ? reason.message
            : String(reason ?? 'Ohanterad promise-rejektion'),
        detaljer: {
          reason: reason instanceof Error ? (reason.stack ?? null) : reason,
        },
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  useReportWebVitals((metric) => {
    if (!VITALS.has(metric.name)) return
    void loggaKlient({
      typ: 'prestanda',
      kalla: 'web-vitals',
      path: typeof location !== 'undefined' ? location.pathname : undefined,
      meddelande: metric.name,
      duration_ms: Math.round(metric.value),
      detaljer: { id: metric.id, rating: metric.rating },
    })
  })

  return <>{children ?? null}</>
}
