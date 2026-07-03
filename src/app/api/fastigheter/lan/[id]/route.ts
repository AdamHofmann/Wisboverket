// Källa: src/app/api/lan/[id]/route.ts (Prisma) → Supabase server-klient.
// Modell Lan → tabell f_lan. camelCase → snake_case: amortTyp→amort_typ, amortBelopp→amort_belopp.
// UI:t skickar camelCase i body → läs både camel och snake, skriv snake_case till Supabase.
// belopp/ranta/amort_belopp är numeric → parseFloat som källan.
// startdatum/slutdatum är timestamptz → skicka ISO-sträng (new Date(...).toISOString()).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const body = await request.json()

    // Bygg patch-objekt: bara satta fält skrivs (matchar Prismas undefined-semantik).
    const patch: Record<string, unknown> = {}

    const langivare = body.langivare
    if (langivare !== undefined) patch.langivare = langivare

    if (body.belopp !== undefined) patch.belopp = parseFloat(body.belopp)
    if (body.ranta !== undefined) patch.ranta = parseFloat(body.ranta)

    const amortTyp = body.amortTyp ?? body.amort_typ
    if (amortTyp !== undefined) patch.amort_typ = amortTyp

    const amortBelopp = body.amortBelopp ?? body.amort_belopp
    // Källan: amortBelopp ? parseFloat : null (sätts alltid vid update).
    patch.amort_belopp = amortBelopp ? parseFloat(amortBelopp) : null

    if (body.startdatum !== undefined) patch.startdatum = new Date(body.startdatum).toISOString()

    // Källan: slutdatum ? new Date : null (sätts alltid vid update).
    patch.slutdatum = body.slutdatum ? new Date(body.slutdatum).toISOString() : null

    // Källan: kommentar ?? null (sätts alltid vid update).
    patch.kommentar = body.kommentar ?? null

    const { data, error } = await sb
      .from('f_lan')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const { error } = await sb.from('f_lan').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
