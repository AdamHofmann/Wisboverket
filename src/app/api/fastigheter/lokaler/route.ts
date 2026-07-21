// Källa: src/app/api/lokaler/route.ts (Prisma) → Supabase server-klient.
//
// Mönster:
//  * Prisma-modell Lokal → tabell f_lokal (snake_case-kolumner).
//  * camelCase-fält (fastighetId/byggnadId/beteckningId) → snake_case.
//  * include-träd → PostgREST nested select. Aliasen behåller käll-UI:ts nycklar:
//    fastighet, bolag, byggnader, beteckningar, beteckning, byggnad, hyresavtal.
//    OBS: junction-relationen heter "hyresavtal" på Lokal i källan (HyresavtalLokal[]),
//    och varje junction-rad har i sin tur "hyresavtal" (själva avtalet). Behåller
//    exakt dessa nycklar så UI:t inte behöver ändras.
//  * orderBy på nästlad relation (byggnader.namn, beteckningar.beteckning) →
//    .order('kol', { foreignTable: 'f_...' }).
//  * where på djupt nästlad relation (bara avtal med status aktiv/uppsagd) kan
//    PostgREST inte alltid göra i samma select → filtreras i JS efter hämtning.
//  * fastighetId-filter (searchParam) → .eq('fastighet_id', ...).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const fastighetId = searchParams.get('fastighetId')

    let query = sb
      .from('f_lokal')
      .select(`
        id, namn, typ, yta, vaning, status, bashyra, moms, fastighet_id, byggnad_id, beteckning_id,
        fastighet:f_fastighet (
          id, namn, taxeringsvarde,
          bolag:f_bolag ( id, fastighetsskattesats ),
          byggnader:f_byggnad ( id, namn, uthyrbar_yta ),
          beteckningar:f_fastighetsbeteckning ( id, beteckning, taxeringsvarde )
        ),
        beteckning:f_fastighetsbeteckning ( id, beteckning ),
        byggnad:f_byggnad ( id, namn ),
        hyresavtal:f_hyresavtal_lokal (
          id,
          hyresavtal:f_hyresavtal (
            id, status,
            hyresgast:f_hyresgast ( id, namn )
          )
        )
      `)
      .order('namn', { ascending: true })
      .order('namn', { ascending: true, foreignTable: 'f_byggnad' })
      .order('beteckning', { ascending: true, foreignTable: 'f_fastighetsbeteckning' })

    if (fastighetId) query = query.eq('fastighet_id', fastighetId)

    const { data, error } = await query
    if (error) throw error

    // Filtret "endast avtal med status aktiv/uppsagd" (Prisma-where på nästlad
    // relation) görs i JS efter hämtning.
    const filtered = (data ?? []).map((l: Record<string, unknown>) => ({
      ...l,
      hyresavtal: ((l.hyresavtal as Array<Record<string, unknown>>) ?? []).filter(
        (a) => ['aktiv', 'uppsagd'].includes((a.hyresavtal as { status?: string } | undefined)?.status ?? '')
      ),
    }))

    return NextResponse.json(filtered)
  } catch (e) {
    console.error('lokaler error:', e)
    return NextResponse.json({ error: 'Kunde inte hämta lokaler', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    // UI:t skickar ofta camelCase i body — läs både camel och snake, skriv snake_case.
    const insert = {
      namn: body.namn,
      typ: body.typ,
      yta: parseFloat(body.yta),
      vaning: body.vaning ? parseInt(body.vaning) : null,
      status: body.status || 'ledig',
      bashyra: body.bashyra ? parseFloat(body.bashyra) : null,
      moms: body.moms ? parseFloat(body.moms) : 0,
      fastighet_id: body.fastighetId ?? body.fastighet_id,
      byggnad_id: body.byggnadId ?? body.byggnad_id ?? null,
      beteckning_id: body.beteckningId ?? body.beteckning_id ?? null,
    }

    const { data, error } = await sb.from('f_lokal').insert(insert).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('POST /api/fastigheter/lokaler error:', e)
    return NextResponse.json({ error: 'Kunde inte skapa lokal', detail: String(e) }, { status: 500 })
  }
}
