// Migrerad från käll-appens src/app/api/underhall/route.ts (Prisma → Supabase server-klient).
//
// Modell Underhallsarende → tabell f_underhallsarende (snake_case-kolumner).
// include-mönster:
//  * fastighet: { select: { id, namn } }        → nested select fastighet:f_fastighet(id,namn)
//  * logg: { orderBy: datum desc, take: 1 }      → hämta logg(datum,...) ordnad, ta senaste i JS
//    (PostgREST stödjer inte "take: 1" på nästlad relation → limit i JS).
//  * _count: { dokument, logg }                  → hämta dokument(id) + logg(id) och räkna i JS.
// orderBy nastaGang asc → .order('nasta_gang', { ascending: true }).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sb = await createClient()
    const { data, error } = await sb
      .from('f_underhallsarende')
      .select(`
        *,
        fastighet:f_fastighet ( id, namn ),
        logg:f_underhallslogg (*),
        dokument:f_underhallsdokument ( id )
      `)
      .order('nasta_gang', { ascending: true })
      .order('datum', { ascending: false, foreignTable: 'f_underhallslogg' })
    if (error) throw error

    const now = new Date()
    const result = (data ?? []).map((a: Record<string, unknown>) => {
      const logg = (a.logg as Array<Record<string, unknown>>) ?? []
      const dokument = (a.dokument as Array<Record<string, unknown>>) ?? []
      const nastaGang = a.nasta_gang ? new Date(a.nasta_gang as string) : null
      return {
        ...a,
        // Prisma include gav bara senaste logg-raden (take: 1) → efterlikna i JS.
        logg: logg.slice(0, 1),
        // _count: { dokument, logg }
        _count: { dokument: dokument.length, logg: logg.length },
        // Markera försenade
        status:
          a.status === 'planerad' && nastaGang && nastaGang < now
            ? 'forsenad'
            : a.status,
      }
    })
    return NextResponse.json(result)
  } catch (e) {
    console.error('GET /api/fastigheter/underhall error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    const { data: arende, error } = await sb
      .from('f_underhallsarende')
      .insert({
        fastighet_id: body.fastighetId ?? body.fastighet_id,
        byggnad_id: body.byggnadId ?? body.byggnad_id ?? null,
        typ: body.typ,
        namn: body.namn,
        beskrivning: body.beskrivning || null,
        intervall_manader: parseInt(body.intervallManader ?? body.intervall_manader),
        senast_utford: (body.senastUtford ?? body.senast_utford)
          ? new Date(body.senastUtford ?? body.senast_utford).toISOString()
          : null,
        nasta_gang: new Date(body.nastaGang ?? body.nasta_gang).toISOString(),
        ansvarig: body.ansvarig || null,
        leverantor: body.leverantor || null,
        kostnad: body.kostnad ? parseFloat(body.kostnad) : null,
        kommentar: body.kommentar || null,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(arende, { status: 201 })
  } catch (e) {
    console.error('POST /api/fastigheter/underhall error:', e)
    return NextResponse.json({ error: 'Kunde inte skapa' }, { status: 500 })
  }
}
