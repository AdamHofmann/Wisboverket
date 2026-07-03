// Migrerad från käll-appens src/app/api/lan/route.ts (Prisma → Supabase server-klient).
//
// Mönster som demonstreras här:
//  * Prisma-modell Lan → tabell f_lan (snake_case-kolumner).
//  * camelCase-fält (fastighetId, amortTyp, amortBelopp) → snake_case (fastighet_id, amort_typ, amort_belopp).
//  * include: { fastighet: { select: { id, namn, bolag: { select: { namn } } } } }
//    → PostgREST nested select: fastighet:f_fastighet ( id, namn, bolag:f_bolag ( namn ) ).
//  * orderBy: { startdatum: 'desc' } → .order('startdatum', { ascending: false }).
//  * belopp/ranta/amort_belopp är numeric i schemat → parseFloat i POST (som källan).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('f_lan')
      .select(`
        *,
        fastighet:f_fastighet ( id, namn, bolag:f_bolag ( namn ) )
      `)
      .order('startdatum', { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('lan GET error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const { data, error } = await sb
      .from('f_lan')
      .insert({
        fastighet_id: body.fastighetId ?? body.fastighet_id,
        langivare: body.langivare,
        belopp: parseFloat(body.belopp),
        ranta: parseFloat(body.ranta),
        amort_typ: body.amortTyp ?? body.amort_typ ?? 'manadlig',
        amort_belopp:
          body.amortBelopp ?? body.amort_belopp
            ? parseFloat(body.amortBelopp ?? body.amort_belopp)
            : null,
        startdatum: new Date(body.startdatum).toISOString(),
        slutdatum: body.slutdatum ? new Date(body.slutdatum).toISOString() : null,
        kommentar: body.kommentar || null,
      })
      .select(`
        *,
        fastighet:f_fastighet ( id, namn )
      `)
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    console.error('lan POST error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
