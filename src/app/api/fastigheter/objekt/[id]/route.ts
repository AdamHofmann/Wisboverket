// TEMPLATE-ROUTE (dynamisk [id]). Källa: src/app/api/fastigheter/[id]/route.ts.
// Mönster: findUnique → .eq('id',id).single(); update → .update().eq(); delete → .delete().eq().
// onDelete cascade (lokaler/byggnader/beteckningar) hanteras av FK i SCHEMA.sql,
// så DELETE här raderar bara parent-raden.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const { data, error } = await sb
      .from('f_fastighet')
      .select(`*, lokaler:f_lokal(*), bolag:f_bolag(*)`)
      .eq('id', id)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Hittades inte' }, { status: 404 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const body = await request.json()
    const { data, error } = await sb
      .from('f_fastighet')
      .update({
        namn: body.namn,
        adress: body.adress,
        stad: body.stad,
        postnummer: body.postnummer,
        bolag_id: body.bolagId || body.bolag_id || null,
        fastighetsbeteckning: body.fastighetsbeteckning || null,
        taxeringsvarde: body.taxeringsvarde ? parseFloat(body.taxeringsvarde) : null,
        kommentar: body.kommentar || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Kunde inte uppdatera' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sb = await createClient()
    const { id } = await params
    const { error } = await sb.from('f_fastighet').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
