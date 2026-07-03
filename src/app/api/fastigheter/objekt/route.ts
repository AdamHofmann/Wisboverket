// TEMPLATE-ROUTE (mönster för resten av migrationen).
// Källa: src/app/api/fastigheter/route.ts (Prisma) → Supabase server-klient.
//
// Mönster som demonstreras här:
//  * Prisma-modell Fastighet → tabell f_fastighet (snake_case-kolumner).
//  * camelCase-fält (bolagId) → snake_case (bolag_id).
//  * include: { lokaler, bolag, byggnader, beteckningar } → PostgREST nested select.
//    - relationens namn i select-strängen blir nyckeln i svaret (aliaseras för att
//      matcha käll-UI:t: "lokaler", "bolag", "byggnader", "beteckningar").
//    - orderBy på nästlad relation → .order('kol', { foreignTable: 'f_...' }).
//  * bolagId-filter (searchParam) → .eq('bolag_id', ...).
//  * nested create (initial beteckning vid POST) → separat insert efter parent.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseBody(body: Record<string, unknown>) {
  return {
    namn: body.namn as string,
    adress: body.adress as string,
    stad: body.stad as string,
    postnummer: body.postnummer as string,
    bolag_id: (body.bolagId as string) || (body.bolag_id as string) || null,
    fastighetsbeteckning: (body.fastighetsbeteckning as string) || null,
    taxeringsvarde: body.taxeringsvarde ? parseFloat(body.taxeringsvarde as string) : null,
    kommentar: (body.kommentar as string) || null,
  }
}

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const bolagId = searchParams.get('bolagId')

    let query = sb
      .from('f_fastighet')
      .select(`
        *,
        lokaler:f_lokal (*),
        bolag:f_bolag ( id, namn ),
        byggnader:f_byggnad (*),
        beteckningar:f_fastighetsbeteckning (*)
      `)
      .order('namn', { ascending: true })
      .order('namn', { ascending: true, foreignTable: 'f_byggnad' })
      .order('beteckning', { ascending: true, foreignTable: 'f_fastighetsbeteckning' })

    if (bolagId) query = query.eq('bolag_id', bolagId)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('fastigheter error:', e)
    return NextResponse.json({ error: 'Kunde inte hämta fastigheter', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    const { data: fastighet, error } = await sb
      .from('f_fastighet')
      .insert(parseBody(body))
      .select()
      .single()
    if (error) throw error

    // Skapa initial beteckning om angiven (nested create → separat insert)
    if (body.fastighetsbeteckning) {
      await sb.from('f_fastighetsbeteckning').insert({
        fastighet_id: fastighet.id,
        beteckning: body.fastighetsbeteckning,
        taxeringsvarde: body.taxeringsvarde ? parseFloat(body.taxeringsvarde) : null,
      })
    }
    return NextResponse.json(fastighet, { status: 201 })
  } catch (e) {
    console.error('skapa fastighet error:', e)
    return NextResponse.json({ error: 'Kunde inte skapa fastighet' }, { status: 500 })
  }
}
