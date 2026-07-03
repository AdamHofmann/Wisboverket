'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface BolagItem {
  id: string
  namn: string
  orgnummer?: string | null
  adress?: string | null
  postnummer?: string | null
  stad?: string | null
  epost?: string | null
  telefon?: string | null
  logotyp?: string | null
  bankgiro?: string | null
  plusgiro?: string | null
  momsregistreringsnummer?: string | null
  hemsida?: string | null
  faktura_prefix_text?: string | null
  betalningsvillkor?: number | null
  drojsmalsranta?: number | null
  _count?: { fastigheter: number }
}

interface BolagContextValue {
  bolagLista: BolagItem[]
  valtBolagId: string | null
  setValtBolagId: (id: string | null) => void
  reloadBolag: () => void
}

const BolagContext = createContext<BolagContextValue>({
  bolagLista: [],
  valtBolagId: null,
  setValtBolagId: () => {},
  reloadBolag: () => {},
})

export function BolagProvider({ children }: { children: ReactNode }) {
  const [bolagLista, setBolagLista] = useState<BolagItem[]>([])
  const [valtBolagId, setValtBolagIdState] = useState<string | null>(null)

  const reloadBolag = () => {
    const sb = createClient()
    // Käll-appens /api/bolag inkluderade _count.fastigheter. Här hämtar vi bolagen
    // samt antal fastigheter per bolag via en separat aggregerad query.
    Promise.all([
      sb.from('f_bolag').select('*').order('namn'),
      sb.from('f_fastighet').select('bolag_id'),
    ]).then(([bolagRes, fastRes]) => {
      const counts = new Map<string, number>()
      for (const f of fastRes.data ?? []) {
        if (f.bolag_id) counts.set(f.bolag_id, (counts.get(f.bolag_id) ?? 0) + 1)
      }
      const lista = (bolagRes.data ?? []).map((b) => ({
        ...b,
        _count: { fastigheter: counts.get(b.id) ?? 0 },
      })) as BolagItem[]
      setBolagLista(lista)
    }).catch(() => {})
  }

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('valtBolagId') : null
    if (stored) setValtBolagIdState(stored)
    reloadBolag()
  }, [])

  const setValtBolagId = (id: string | null) => {
    setValtBolagIdState(id)
    if (id) {
      localStorage.setItem('valtBolagId', id)
    } else {
      localStorage.removeItem('valtBolagId')
    }
  }

  return (
    <BolagContext.Provider value={{ bolagLista, valtBolagId, setValtBolagId, reloadBolag }}>
      {children}
    </BolagContext.Provider>
  )
}

export function useBolag() {
  return useContext(BolagContext)
}
