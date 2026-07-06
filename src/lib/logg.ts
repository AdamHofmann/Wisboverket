'use client'

import { createClient } from '@/lib/supabase/client'

export type LoggPost = {
  typ: 'fel' | 'prestanda' | 'info'
  niva?: 'error' | 'warn' | 'info'
  kalla?: string
  path?: string
  meddelande: string
  duration_ms?: number
  detaljer?: unknown
}

/**
 * Loggar en post från klientsidan till app_logg.
 * Fire-and-forget: sväljer alla egna fel och kastar aldrig.
 */
export async function loggaKlient(post: LoggPost): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from('app_logg').insert({
      typ: post.typ,
      niva: post.niva ?? 'info',
      kalla: post.kalla ?? 'klient',
      path: post.path ?? null,
      meddelande: post.meddelande,
      duration_ms: post.duration_ms ?? null,
      detaljer: (post.detaljer ?? null) as never,
    })
  } catch {
    // Loggning får aldrig krascha appen — svälj alla fel.
  }
}
