// Migrerad route. Källa: src/app/api/driftskostnader/route.ts (Prisma) → Supabase server-klient.
//  * Prisma-modell Driftskostnad → tabell f_driftskostnad (snake_case-kolumner).
//  * camelCase-fält (fastighetId) → snake_case (fastighet_id). UI kan skicka båda → läs båda.
//  * include: { fastighet: true } → PostgREST nested select (alias "fastighet").
//  * orderBy fakturadatum desc → .order('fakturadatum', { ascending: false }).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('f_driftskostnad')
      .select(`
        *,
        fastighet:f_fastighet (*)
      `)
      .order('fakturadatum', { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('driftskostnader error:', e)
    return NextResponse.json({ error: 'Serverfel', detail: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()

    const { data, error } = await sb
      .from('f_driftskostnad')
      .insert({
        typ: body.typ,
        belopp: parseFloat(body.belopp),
        period: body.period,
        fastighet_id: body.fastighetId ?? body.fastighet_id,
        fakturadatum: new Date(body.fakturadatum).toISOString(),
        leverantor: body.leverantor || null,
        kommentar: body.kommentar || null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('skapa driftskostnad error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
