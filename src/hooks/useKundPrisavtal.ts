import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ArtikelLike = { id: string; a_pris: number }

export function useKundPrisavtal(customerId: string | null | undefined, artiklar: ArtikelLike[]) {
  const [prisavtal, setPrisavtal] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!customerId) { setPrisavtal({}); return }
    createClient().from('kund_prisavtal').select('artikel_id,avtalspris').eq('customer_id', customerId)
      .then(({ data }) => setPrisavtal(Object.fromEntries((data || []).map(p => [p.artikel_id, p.avtalspris]))))
  }, [customerId])

  const artikelPris = (artikelId: string) => prisavtal[artikelId] ?? artiklar.find(a => a.id === artikelId)?.a_pris ?? 0

  return { prisavtal, artikelPris }
}
