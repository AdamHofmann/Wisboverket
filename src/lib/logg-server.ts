import { createClient } from '@/lib/supabase/server'
import type { LoggPost } from '@/lib/logg'

export type { LoggPost }

/**
 * Loggar en post från serversidan till app_logg.
 * Fire-and-forget: sväljer alla egna fel och kastar aldrig.
 */
export async function loggaServer(post: LoggPost): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('app_logg').insert({
      typ: post.typ,
      niva: post.niva ?? 'info',
      kalla: post.kalla ?? 'server',
      path: post.path ?? null,
      meddelande: post.meddelande,
      duration_ms: post.duration_ms ?? null,
      detaljer: (post.detaljer ?? null) as never,
    })
  } catch {
    // Loggning får aldrig krascha appen — svälj alla fel.
  }
}
