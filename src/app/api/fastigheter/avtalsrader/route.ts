// Migrerad från src/app/api/avtalsrader/route.ts (Prisma) → Supabase server-klient.
// Prisma-modell Avtalsrad → tabell f_avtalsrad (snake_case-kolumner).
// camelCase-fält (hyresavtalId) → snake_case (hyresavtal_id).
// Belopp/arsbelopp/moms är numeric → parseFloat som källan gjorde.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const hyresavtalId = searchParams.get('hyresavtalId')
    if (!hyresavtalId) return NextResponse.json({ error: 'hyresavtalId krävs' }, { status: 400 })

    const { data, error } = await sb
      .from('f_avtalsrad')
      .select('*')
      .eq('hyresavtal_id', hyresavtalId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (e) {
    console.error('avtalsrader GET error:', e)
    return NextResponse.json({ error: 'Serverfel' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const body = await request.json()
    const { data, error } = await sb
      .from('f_avtalsrad')
      .insert({
        hyresavtal_id: body.hyresavtalId ?? body.hyresavtal_id,
        artikelkod: body.artikelkod,
        beskrivning: body.beskrivning,
        belopp: parseFloat(body.belopp),
        arsbelopp: body.arsbelopp ? parseFloat(body.arsbelopp) : null,
        moms: body.moms ? parseFloat(body.moms) : 0,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('avtalsrader POST error:', e)
    return NextResponse.json({ error: 'Kunde inte skapa avtalsrad' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const sb = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id krävs' }, { status: 400 })

    const { error } = await sb.from('f_avtalsrad').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('avtalsrader DELETE error:', e)
    return NextResponse.json({ error: 'Kunde inte ta bort' }, { status: 500 })
  }
}
