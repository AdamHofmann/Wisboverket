// Migrerad från källans /api/driftskostnader/[id]/route.ts (Prisma → Supabase).
// Tabell: f_driftskostnad. Kolumner snake_case enligt SCHEMA.sql.
// UI kan skicka camelCase (fastighetId) → läs både camel/snake, skriv snake_case.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const body = await request.json()
    const { data, error } = await sb
      .from('f_driftskostnad')
      .update({
        typ: body.typ,
        belopp: parseFloat(body.belopp),
        period: body.period,
        fastighet_id: body.fastighetId || body.fastighet_id,
        fakturadatum: new Date(body.fakturadatum).toISOString(),
        leverantor: body.leverantor || null,
        kommentar: body.kommentar || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const { error } = await sb.from('f_driftskostnad').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}
