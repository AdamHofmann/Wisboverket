// Källa: src/app/api/statistik/fastighetsbestand/route.ts (Prisma) → Supabase server-klient.
// Namespacad enligt fil-kartan: /api/statistik/... → /api/fastigheter/statistik/...
//
// Mönster:
//  * bolag.findMany({ include: { fastigheter: { include: { lokaler, byggnader } } } })
//    → PostgREST nested select i tre nivåer:
//      f_bolag → fastigheter:f_fastighet → { lokaler:f_lokal, byggnader:f_byggnad }.
//  * orderBy { namn: 'asc' } på topp + nästlad relation → .order(..., { foreignTable }).
//  * uthyrbarYta → uthyrbar_yta, totalyta oförändrad (snake i schema).
//  * All aggregering/beläggningslogik sker i JS (oförändrad från källan).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type LokalRow = { yta: number | null; status: string | null; typ: string | null }
type ByggnadRow = { totalyta: number | null; uthyrbar_yta: number | null }
type FastighetRow = {
  id: string
  namn: string
  lokaler: LokalRow[] | null
  byggnader: ByggnadRow[] | null
}
type BolagRow = {
  id: string
  namn: string
  fastigheter: FastighetRow[] | null
}

export async function GET() {
  try {
    const sb = await createClient()

    const { data, error } = await sb
      .from('f_bolag')
      .select(`
        id,
        namn,
        fastigheter:f_fastighet (
          id,
          namn,
          lokaler:f_lokal ( yta, status, typ ),
          byggnader:f_byggnad ( totalyta, uthyrbar_yta )
        )
      `)
      .order('namn', { ascending: true })
      .order('namn', { ascending: true, foreignTable: 'f_fastighet' })

    if (error) throw error

    const bolag = (data ?? []) as unknown as BolagRow[]

    const result = bolag.map((b) => ({
      bolagId: b.id,
      bolagNamn: b.namn,
      fastigheter: (b.fastigheter ?? []).map((f) => {
        const lokaler = f.lokaler ?? []
        const byggnader = f.byggnader ?? []
        const antalLokaler = lokaler.length

        // If buildings are registered, use their uthyrbar_yta as the ceiling
        const byggnadUthyrbarYta = byggnader.reduce((s, b) => s + (b.uthyrbar_yta ?? 0), 0)
        const byggnadTotalyta = byggnader.reduce((s, b) => s + (b.totalyta ?? 0), 0)

        // Exkludera mark från yta-baserade nyckeltal
        const inomhus = lokaler.filter((l) => l.typ !== 'mark')
        const uthyrdYta = inomhus
          .filter((l) => l.status === 'uthyrd')
          .reduce((s, l) => s + (l.yta ?? 0), 0)

        const inomhusYta = inomhus.reduce((s, l) => s + (l.yta ?? 0), 0)
        const uthyrbarYta = byggnadUthyrbarYta > 0 ? byggnadUthyrbarYta : inomhusYta

        const belaggning = uthyrbarYta > 0 ? (uthyrdYta / uthyrbarYta) * 100 : 0

        return {
          fastighetId: f.id,
          fastighetNamn: f.namn,
          antalLokaler,
          antalByggnader: byggnader.length,
          totalyta: byggnadTotalyta,
          uthyrbarYta,
          uthyrdYta,
          belaggning,
        }
      }),
    }))

    return NextResponse.json(result)
  } catch (e) {
    console.error('fastighetsbestand error:', e)
    return NextResponse.json({ error: 'Kunde inte hämta fastighetsbestånd' }, { status: 500 })
  }
}
