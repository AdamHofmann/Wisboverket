// Migrerad från käll-appen: src/app/api/lokaler/[id]/route.ts (Prisma → Supabase).
// Prisma-modell Lokal → tabell f_lokal (snake_case-kolumner).
// camelCase-fält (fastighetId/byggnadId/beteckningId) läses i både camel- och
// snake_case från body, skrivs alltid som snake_case till Supabase.
// PUT: partiell uppdatering — samma undefined-semantik som källan (bashyra/moms
// utelämnas ur update om de inte skickats med).
// DELETE: hård radering (f_hyresavtal_lokal-junction och FK-referenser hanteras
// av onDelete-reglerna i SCHEMA.sql).
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const sb = await createClient()

    // Läs både camelCase (UI) och snake_case.
    const fastighetId = body.fastighetId ?? body.fastighet_id
    const byggnadId = body.byggnadId ?? body.byggnad_id
    const beteckningId = body.beteckningId ?? body.beteckning_id

    // Bygg update-objektet med samma partiella semantik som Prisma-källan:
    // bashyra/moms utelämnas helt om de inte skickats (undefined i källan).
    const data: Record<string, unknown> = {
      namn: body.namn,
      typ: body.typ,
      yta: parseFloat(body.yta),
      vaning: body.vaning ? parseInt(body.vaning) : null,
      status: body.status,
      fastighet_id: fastighetId,
      byggnad_id: byggnadId || null,
      beteckning_id: beteckningId || null,
    }
    if (body.bashyra !== undefined) {
      data.bashyra = body.bashyra ? parseFloat(body.bashyra) : null
    }
    if (body.moms !== undefined) {
      data.moms = parseFloat(body.moms)
    }

    const { data: lokal, error } = await sb
      .from('f_lokal')
      .update(data)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(lokal)
  } catch (e) {
    console.error('uppdatera lokal error:', e)
    return NextResponse.json({ error: 'Kunde inte uppdatera' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sb = await createClient()
    const { error } = await sb.from('f_lokal').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('radera lokal error:', e)
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
