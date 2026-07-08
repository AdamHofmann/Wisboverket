// Migrerad från: src/app/api/elmatare/route.ts (Prisma) → Supabase server-klient.
//
// Mönster:
//  * Prisma-modell ElMatare → tabell f_elmatare (snake_case-kolumner).
//  * camelCase-fält i body (fastighetId, lokalId, byggnadId, schablonKwh)
//    → läs både camel/snake, skriv snake_case (fastighet_id, lokal_id, ...).
//  * include:{ fastighet:{select}, avlasningar:{orderBy}, _count } → PostgREST nested select.
//    - fastighet aliasas för att behålla käll-UI:ts nyckel "fastighet".
//    - avlasningar hämtas nästlat, ordnat på datum desc (foreignTable).
//    - _count.avlasningar kan PostgREST inte returnera inline i samma select som de
//      fulla nästlade raderna → beräknas i JS ur avlasningar-arrayen så svarsformen
//      { ..., _count: { avlasningar: n } } bevaras.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('f_elmatare')
      .select(`
        *,
        fastighet:f_fastighet ( id, namn ),
        avlasningar:f_elavlasning ( id, datum, varde, avlast_av )
      `)
      .order('matarnummer', { ascending: true })
      .order('datum', { ascending: false, foreignTable: 'f_elavlasning' })
    if (error) throw error

    // _count.avlasningar → JS-beräkning ur nästlade avlasningar.
    const rows = (data ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      _count: { avlasningar: Array.isArray(m.avlasningar) ? m.avlasningar.length : 0 },
    }))
    return NextResponse.json(rows)
  } catch (e) {
    console.error('GET /api/fastigheter/elmatare error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const schablon = body.schablonKwh ?? body.schablon_kwh
    const { data: matare, error } = await sb
      .from('f_elmatare')
      .insert({
        matarnummer: body.matarnummer,
        fastighet_id: body.fastighetId || body.fastighet_id,
        lokal_id: body.lokalId || body.lokal_id || null,
        byggnad_id: body.byggnadId || body.byggnad_id || null,
        beskrivning: body.beskrivning || null,
        schablon_kwh: schablon !== undefined && schablon !== null && schablon !== ''
          ? parseFloat(schablon)
          : null,
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json(matare, { status: 201 })
  } catch (e) {
    console.error('POST /api/fastigheter/elmatare error:', e)
    return NextResponse.json({ error: 'Kunde inte skapa' }, { status: 500 })
  }
}
